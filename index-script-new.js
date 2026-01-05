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

const versoesApps = {
    'sobre': '1.3.8',
    'bitola': '1.2.7',
    'helice': '1.2.2',
    'mutuo': '1.2.7',
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
    }

    inicializarIndex() {
        this.configurarRelogio();
        this.adicionarVersoesNosIcones();
    }

    atualizarAposTrocaIdioma() {
        this.atualizarHorario();
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
            if (!appKey || !versoesApps[appKey]) return;
            
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
            versionText.textContent = `V. ${versoesApps[appKey]}`;
            
            svg.appendChild(versionText);
        });
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

if (document.readyState === 'loading') {
    console.log('⏳ Index: Aguardando DOM carregar...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('✅ Index: DOM carregado, inicializando...');
        const app = new IndexApp();
        app.inicializar();
    });
} else {
    console.log('✅ Index: DOM já carregado, inicializando imediatamente...');
    const app = new IndexApp();
    app.inicializar();
}
