import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const CONTROL_PORT = Number(process.env.CONTROL_PORT || 3001);
const VITE_URL = process.env.VITE_URL || 'http://localhost:5173';
const APP_DIR = dirname(fileURLToPath(import.meta.url));

// Buffer circular com a saída recente do processo Vite (para diagnóstico)
const MAX_LOG_LINES = 80;

let viteProcess = null;
let startedByController = false;
let processLog = [];
let lastExit = null; // { code, signal, at, tail }

const json = (res, statusCode, payload) => {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
};

const isControllerRunning = () =>
    Boolean(viteProcess && !viteProcess.killed && viteProcess.exitCode === null);

const checkDependencies = () => {
    const binName = process.platform === 'win32' ? 'vite.cmd' : 'vite';
    return existsSync(resolve(APP_DIR, 'node_modules', '.bin', binName));
};

const pushLogLine = (source, chunk) => {
    const text = chunk.toString('utf8');
    // Remove códigos ANSI de cor que poluem o log no frontend
    // eslint-disable-next-line no-control-regex
    const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
    const lines = clean
        .split(/\r?\n/)
        .map(line => line.trimEnd())
        .filter(line => line.length > 0);
    for (const line of lines) {
        processLog.push({ at: new Date().toISOString(), source, line });
        if (processLog.length > MAX_LOG_LINES) {
            processLog.shift();
        }
    }
};

const pushControlMessage = line => {
    processLog.push({ at: new Date().toISOString(), source: 'control', line });
    if (processLog.length > MAX_LOG_LINES) {
        processLog.shift();
    }
};

const pingVite = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
        const response = await fetch(VITE_URL, { signal: controller.signal });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
};

const currentStatus = async () => {
    const siteReachable = await pingVite();
    return {
        status: siteReachable ? 'running' : 'stopped',
        controllerRunning: isControllerRunning(),
        startedByController,
        pid: isControllerRunning() ? viteProcess.pid : null,
        siteUrl: VITE_URL,
        siteReachable,
        canStop: isControllerRunning() && startedByController,
        dependenciesInstalled: checkDependencies(),
        recentOutput: processLog.slice(-40),
        lastExit,
        timestamp: new Date().toISOString()
    };
};

const startVite = () => {
    if (isControllerRunning()) {
        return { ok: true, message: 'Vite ja esta em execucao', pid: viteProcess.pid };
    }

    if (!checkDependencies()) {
        const msg = 'Dependencias nao instaladas. Execute: cd local && npm install';
        pushControlMessage(`[control] ${msg}`);
        return {
            ok: false,
            message: msg,
            dependenciesInstalled: false
        };
    }

    // Reinicia buffers a cada start para que a saída refletida seja desta execução
    processLog = [];
    lastExit = null;
    pushControlMessage('[control] Iniciando Vite via npm run dev...');

    let child;
    if (process.platform === 'win32') {
        child = spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
            cwd: APP_DIR,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } else {
        child = spawn('npm', ['run', 'dev'], {
            cwd: APP_DIR,
            stdio: ['ignore', 'pipe', 'pipe']
        });
    }

    viteProcess = child;
    startedByController = true;

    if (child.stdout) {
        child.stdout.on('data', chunk => pushLogLine('stdout', chunk));
    }
    if (child.stderr) {
        child.stderr.on('data', chunk => pushLogLine('stderr', chunk));
    }

    child.on('error', err => {
        pushControlMessage(`[control] Erro ao iniciar processo: ${err?.message || err}`);
    });

    child.on('exit', (code, signal) => {
        const tail = processLog
            .slice(-20)
            .map(entry => entry.line)
            .join('\n');
        lastExit = {
            code: typeof code === 'number' ? code : null,
            signal: signal || null,
            at: new Date().toISOString(),
            tail
        };
        pushControlMessage(
            `[control] Processo encerrado (code=${code ?? '-'}, signal=${signal || '-'}).`
        );
        viteProcess = null;
        startedByController = false;
    });

    return { ok: true, message: 'Comando para iniciar Vite enviado', pid: viteProcess.pid };
};

const stopVite = async () => {
    if (!isControllerRunning()) {
        return { ok: true, message: 'Nao ha processo controlado para parar' };
    }

    const pid = viteProcess.pid;
    if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
        });
        await once(killer, 'exit');
    } else {
        viteProcess.kill('SIGTERM');
    }

    viteProcess = null;
    startedByController = false;
    return { ok: true, message: 'Comando para parar Vite enviado' };
};

const restartVite = async () => {
    await stopVite();
    return startVite();
};

const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    try {
        if (req.method === 'GET' && url.pathname === '/status') {
            json(res, 200, await currentStatus());
            return;
        }

        if (req.method === 'POST' && url.pathname === '/start') {
            json(res, 200, { ...(await currentStatus()), ...startVite() });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/stop') {
            json(res, 200, { ...(await currentStatus()), ...(await stopVite()) });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/restart') {
            json(res, 200, { ...(await currentStatus()), ...(await restartVite()) });
            return;
        }

        json(res, 404, { ok: false, message: 'Rota nao encontrada' });
    } catch (error) {
        json(res, 500, { ok: false, message: error?.message || 'Erro interno' });
    }
});

server.listen(CONTROL_PORT, () => {
    console.log(`[control] API de controle em http://localhost:${CONTROL_PORT}`);
    console.log(`[control] Monitorando Vite em ${VITE_URL}`);
    if (!checkDependencies()) {
        console.warn(
            '[control] AVISO: node_modules ausente em local/. Rode "npm install" antes de ativar.'
        );
    }
});
