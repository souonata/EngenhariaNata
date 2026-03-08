import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL_PORT = Number(process.env.CONTROL_PORT || 3001);
const VITE_URL = process.env.VITE_URL || 'http://localhost:5173';
const APP_DIR = dirname(fileURLToPath(import.meta.url));

let viteProcess = null;
let startedByController = false;

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

const isControllerRunning = () => Boolean(viteProcess && !viteProcess.killed);

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
    timestamp: new Date().toISOString()
  };
};

const startVite = () => {
  if (isControllerRunning()) {
    return { ok: true, message: 'Vite ja esta em execucao', pid: viteProcess.pid };
  }

  let child;
  if (process.platform === 'win32') {
    // On Windows, running npm through cmd is more reliable than spawning npm.cmd directly.
    child = spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
      cwd: APP_DIR,
      windowsHide: true,
      stdio: 'ignore'
    });
  } else {
    child = spawn('npm', ['run', 'dev'], {
      cwd: APP_DIR,
      stdio: 'ignore'
    });
  }

  viteProcess = child;

  startedByController = true;

  viteProcess.on('exit', () => {
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
      json(res, 200, { ...(await currentStatus()), ...(startVite()) });
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
});
