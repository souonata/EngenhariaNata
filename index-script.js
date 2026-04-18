/**
 * index-script-new.js
 * Landing Page - Versão Modular
 *
 * Página inicial do portfólio com cards de apps e relógio/data
 */

import { App } from './src/core/app.js';
import { i18n } from './src/core/i18n.js';

// ============================================
// VERSÕES DOS APLICATIVOS
// ============================================

const versoesAppsPadrao = {
    'sobre': '1.0.0',
    'bitola': '1.2.0',
    'helice': '1.6.0',
    'mutuo': '1.2.0',
    'bugs': '1.0.0',
    'arcondicionado': '0.2.0',
    'aquecimento': '0.2.0',
    'solar': '0.20.0',
    'fazenda': '0.1.0'
};

// ============================================
// CLASSE PRINCIPAL
// ============================================

class IndexApp extends App {
    constructor() {
        super({
            appName: 'index',
            callbacks: {
                aoInicializar: () => this.inicializarIndex(),
                aoTrocarIdioma: () => this.atualizarAposTrocaIdioma()
            }
        });

        this.intervaloRelogio = null;
        this.versoesApps = { ...versoesAppsPadrao };
    }

    async inicializarIndex() {
        await this.carregarVersoesDoServidor();
        this.configurarRelogio();
        this.adicionarVersoesNosIcones();
        this.inicializarWidgetVisitantes();
    }

    async carregarVersoesDoServidor() {
        try {
            const response = await fetch(`./config/versions.json?t=${Date.now()}`, {
                cache: 'no-store'
            });

            if (!response.ok) {
                return;
            }

            const dados = await response.json();
            this.versoesApps = {
                ...this.versoesApps,
                ...dados
            };
        } catch (_erro) {
            // Mantem versoes padrao caso versions.json esteja indisponivel.
        }
    }

    atualizarAposTrocaIdioma() {
        this.atualizarHorario();
        this.renderizarContagemVisitantes();
    }

    configurarRelogio() {
        // Atualizar imediatamente
        this.atualizarHorario();

        // Atualizar a cada segundo
        this.intervaloRelogio = setInterval(() => {
            this.atualizarHorario();
        }, 1000);
    }

    atualizarHorario() {
        const elementoHorario = document.getElementById('horario');
        const elementoData = document.getElementById('data');

        if (!elementoHorario || !elementoData) return;

        const agora = new Date();

        // Formata horário com zero à esquerda
        const horas = String(agora.getHours()).padStart(2, '0');
        const minutos = String(agora.getMinutes()).padStart(2, '0');
        const segundos = String(agora.getSeconds()).padStart(2, '0');

        // Traduz dias da semana
        const diasSemana = [
            i18n.t('dia-dom'),
            i18n.t('dia-seg'),
            i18n.t('dia-ter'),
            i18n.t('dia-qua'),
            i18n.t('dia-qui'),
            i18n.t('dia-sex'),
            i18n.t('dia-sab')
        ];
        const diaSemana = diasSemana[agora.getDay()];

        // Traduz meses
        const meses = [
            i18n.t('mes-jan'),
            i18n.t('mes-fev'),
            i18n.t('mes-mar'),
            i18n.t('mes-abr'),
            i18n.t('mes-mai'),
            i18n.t('mes-jun'),
            i18n.t('mes-jul'),
            i18n.t('mes-ago'),
            i18n.t('mes-set'),
            i18n.t('mes-out'),
            i18n.t('mes-nov'),
            i18n.t('mes-dez')
        ];
        const mesAbreviado = meses[agora.getMonth()];
        const dia = agora.getDate();

        // Atualiza elementos na página
        elementoHorario.textContent = `${horas}:${minutos}:${segundos}`;
        elementoData.textContent = `${diaSemana} ${dia} ${mesAbreviado}`;
    }

    adicionarVersoesNosIcones() {
        const hrefParaApp = {
            'sobre/sobre.html': 'sobre',
            'bitola/bitola.html': 'bitola',
            'helice/helice.html': 'helice',
            'mutuo/mutuo.html': 'mutuo',
            'bugs/bugs.html': 'bugs',
            'arcondicionado/arcondicionado.html': 'arcondicionado',
            'aquecimento/aquecimento.html': 'aquecimento',
            'solar/solar.html': 'solar',
            'fazenda/fazenda.html': 'fazenda'
        };

        const appIcons = document.querySelectorAll('.app-icon');

        appIcons.forEach(appIcon => {
            const href = appIcon.getAttribute('href');
            if (!href) return;

            const appKey = hrefParaApp[href];
            if (!appKey || !this.versoesApps[appKey]) return;

            const iconDiv = appIcon.querySelector('.icon');
            if (!iconDiv) return;

            const svg = iconDiv.querySelector('svg');
            if (!svg) return;

            // Evita duplicação
            if (svg.querySelector('.version-text')) return;

            // Cria badge de versão no SVG
            const versionText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            versionText.setAttribute('class', 'version-text');
            versionText.setAttribute('x', '30');
            versionText.setAttribute('y', '56');
            versionText.setAttribute('text-anchor', 'middle');
            versionText.setAttribute('font-size', '8');
            versionText.setAttribute('font-weight', '500');
            versionText.setAttribute('fill', 'rgba(255, 255, 255, 0.85)');
            versionText.setAttribute('style', 'filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));');
            versionText.textContent = `V. ${this.versoesApps[appKey]}`;

            svg.appendChild(versionText);
        });
    }

    // ============================================
    // CONTADOR DE VISITANTES (display LED retrô)
    // ============================================

    inicializarWidgetVisitantes() {
        this.totalVisitas = null;
        this._canvasMedicao = null;
        this._reajustarAoRedimensionar = () => {
            const el = document.getElementById('visitorsCount');
            if (el) this.ajustarGridSpan(el, el.textContent || '');
        };
        window.addEventListener('resize', this._reajustarAoRedimensionar);
        this.carregarTotalVisitas();
    }

    async carregarTotalVisitas() {
        // Primeiro tenta via API oficial do count.js (visit_count), conforme docs.
        const totalViaVisitCount = await this.carregarTotalVisitasViaVisitCount();
        if (Number.isFinite(totalViaVisitCount)) {
            this.totalVisitas = totalViaVisitCount;
            this.renderizarContagemVisitantes();
            return;
        }

        // Fallback para endpoint JSON direto (mantem compatibilidade).
        try {
            const resposta = await fetch('https://souonata.goatcounter.com/counter/TOTAL.json', {
                cache: 'no-store'
            });
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            const dados = await resposta.json();
            // GoatCounter retorna count como string formatada ("1,234"). Extrai apenas dígitos.
            const raw = dados && dados.count != null ? String(dados.count).replace(/[^\d]/g, '') : '';
            const n = raw.length > 0 ? parseInt(raw, 10) : NaN;
            this.totalVisitas = Number.isFinite(n) ? n : null;
        } catch (_erro) {
            this.totalVisitas = null;
        }
        this.renderizarContagemVisitantes();
    }

    async carregarTotalVisitasViaVisitCount() {
        const carregou = await this.aguardarVisitCountDisponivel(5000);
        if (!carregou) return null;

        const idContainer = `gc-total-tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const container = document.createElement('div');
        container.id = idContainer;
        container.style.display = 'none';
        container.setAttribute('aria-hidden', 'true');
        document.body.appendChild(container);

        try {
            window.goatcounter.visit_count({
                append: `#${idContainer}`,
                path: 'TOTAL',
                type: 'html',
                no_branding: true
            });

            // Aguarda o count.js renderizar o HTML do contador no container oculto.
            await this.esperar(350);

            const texto = (container.textContent || '').trim();
            const apenasDigitos = texto.replace(/[^\d]/g, '');
            if (!apenasDigitos) return null;

            const numero = parseInt(apenasDigitos, 10);
            return Number.isFinite(numero) ? numero : null;
        } catch (_erro) {
            return null;
        } finally {
            container.remove();
        }
    }

    async aguardarVisitCountDisponivel(timeoutMs = 5000) {
        const inicio = Date.now();
        while (Date.now() - inicio < timeoutMs) {
            if (
                window.goatcounter &&
                typeof window.goatcounter.visit_count === 'function'
            ) {
                return true;
            }
            await this.esperar(100);
        }
        return false;
    }

    esperar(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }

    renderizarContagemVisitantes() {
        const elementoContagem = document.getElementById('visitorsCount');
        if (!elementoContagem) return;

        if (this.totalVisitas == null) {
            elementoContagem.textContent = '—';
            this.ajustarGridSpan(elementoContagem, '—');
            return;
        }

        const texto = this.formatarNumeroVisitantes(this.totalVisitas);
        elementoContagem.textContent = texto;
        this.ajustarGridSpan(elementoContagem, texto);
    }

    /**
     * Formata o número completo com separador de milhares, localizado.
     * Exemplos: 999 → "999", 1500 → "1.500", 999960 → "999.960",
     *           1234567 → "1.234.567" (pt-BR e it-IT usam "." como separador de milhares)
     */
    formatarNumeroVisitantes(n) {
        if (!Number.isFinite(n) || n < 0) return '—';
        const inteiro = Math.floor(n);
        const idioma = typeof i18n.obterIdiomaAtual === 'function' ? i18n.obterIdiomaAtual() : 'pt-BR';
        try {
            return new Intl.NumberFormat(idioma, { useGrouping: true, maximumFractionDigits: 0 }).format(inteiro);
        } catch (_erro) {
            // Fallback manual: insere ponto a cada 3 dígitos da direita pra esquerda
            return String(inteiro).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
    }

    /**
     * Ajusta dinamicamente quantas colunas do grid o tile de visitantes ocupa,
     * de modo que o numero completo (ex.: "1.234.567") caiba com a fonte 7-seg
     * no tamanho 61,2% da altura do icone (36.72px para icone de 60px).
     *
     * Estrategia:
     * 1. Aguarda a DSEG7Classic carregar para medir com a metrica correta.
     * 2. Mede a largura do texto com canvas offscreen.
     * 3. Le as colunas reais do grid via getComputedStyle (funciona com auto-fit).
     * 4. Escolhe o menor span N tal que N*colW + (N-1)*gap >= larguraNecessaria.
     */
    async ajustarGridSpan(elemento, texto) {
        const tile = elemento.closest('.app-icon-static');
        if (!tile) return;

        // Reseta span para medir o tamanho natural de uma coluna
        tile.style.gridColumn = '';

        // Aguarda a fonte DSEG7 carregar para medicao acurada
        try {
            if (document && document.fonts && typeof document.fonts.load === 'function') {
                await document.fonts.load('700 36.72px "DSEG7Classic"');
            }
        } catch (_erro) {
            // Fallback silencioso para fonte monoespacada
        }

        const textoMedir = (texto ?? elemento.textContent ?? '').toString() || '—';

        // Canvas reaproveitavel
        if (!this._canvasMedicao) {
            this._canvasMedicao = document.createElement('canvas');
        }
        const ctx = this._canvasMedicao.getContext('2d');
        // Mesma font-stack do CSS, no tamanho final renderizado
        ctx.font = '700 36.72px "DSEG7Classic", "Courier New", "Consolas", monospace';
        const larguraTexto = Math.ceil(ctx.measureText(textoMedir).width);

        // .icon-visitantes tem padding lateral de 4px de cada lado + borda interna 1px
        const paddingIcone = 8 + 2;
        const larguraNecessaria = larguraTexto + paddingIcone;

        // Le colunas reais do grid (auto-fit expande "1fr" em pixeis resolvidos)
        const grid = tile.parentElement;
        if (!grid) return;

        const cs = getComputedStyle(grid);
        const cols = cs.gridTemplateColumns
            .split(/\s+/)
            .map((valor) => parseFloat(valor))
            .filter((valor) => Number.isFinite(valor) && valor > 0);

        if (cols.length === 0) {
            tile.style.gridColumn = '';
            return;
        }

        const larguraCol = Math.min(...cols);
        const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;

        let span = 1;
        if (larguraNecessaria > larguraCol) {
            span = Math.ceil((larguraNecessaria + gap) / (larguraCol + gap));
        }
        span = Math.max(1, Math.min(span, cols.length));

        tile.style.gridColumn = span > 1 ? `span ${span}` : '';
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new IndexApp();
        app.inicializar();
    });
} else {
    const app = new IndexApp();
    app.inicializar();
}
