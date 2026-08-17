// Dock global flutuante: seletor de idioma (bandeiras) + alternador de tema
// (sol/lua), apenas ícones, fixo e sempre visível em qualquer app.
//
// Por que um componente único: o bloco `.language-selector` estava duplicado e
// hardcoded em ~17 HTMLs, e o botão de tema era injetado com o texto
// "Light"/"Dark". Aqui existe uma fonte da verdade só, e as páginas legadas têm
// o seletor antigo ocultado na inicialização.
//
// Os botões mantêm as classes `lang-btn` + `data-lang` de propósito: assim o
// wiring existente (`configurarBotoesIdioma` e `atualizarBotoesIdioma` do
// core/i18n.js) continua valendo sem alteração.

import { IDIOMAS_SUPORTADOS } from '../core/i18n.js';

const DOCK_ID = 'engnataDockGlobal';

// Bandeiras em SVG inline — não emoji. O portfólio já apanhou de PCs Windows
// sem Twemoji, onde a bandeira caía para o texto "BR"/"IT".
const BANDEIRAS = {
    'pt-BR': `<svg viewBox="0 0 14 10" width="20" height="14" role="img" focusable="false" aria-hidden="true">
        <rect width="14" height="10" fill="#009c3b" />
        <polygon points="7,1.4 12.6,5 7,8.6 1.4,5" fill="#ffdf00" />
        <circle cx="7" cy="5" r="1.9" fill="#002776" />
    </svg>`,
    'it-IT': `<svg viewBox="0 0 15 10" width="21" height="14" role="img" focusable="false" aria-hidden="true">
        <rect width="5" height="10" x="0" fill="#009246" />
        <rect width="5" height="10" x="5" fill="#ffffff" />
        <rect width="5" height="10" x="10" fill="#ce2b37" />
    </svg>`,
    'sv-SE': `<svg viewBox="0 0 16 10" width="21" height="14" role="img" focusable="false" aria-hidden="true">
        <rect width="16" height="10" fill="#005293" />
        <rect x="5" y="0" width="2" height="10" fill="#fecc00" />
        <rect x="0" y="4" width="16" height="2" fill="#fecc00" />
    </svg>`
};

// Cada idioma é rotulado no próprio idioma — prática recomendada para
// seletores de idioma e dispensa uma matriz de tradução cruzada.
const NOMES_NATIVOS = {
    'pt-BR': 'Português',
    'it-IT': 'Italiano',
    'sv-SE': 'Svenska'
};

const ROTULO_TOOLBAR = {
    'pt-BR': 'Idioma e tema',
    'it-IT': 'Lingua e tema',
    'sv-SE': 'Språk och tema'
};

// Idiomas exibidos na página. `data-dock-idiomas` permite restringir por app —
// usado pelo patentenautica, que não tem versão sueca (o exame é italiano).
function idiomasDaPagina() {
    const bruto = document.documentElement.dataset.dockIdiomas;
    if (!bruto) {
        return IDIOMAS_SUPORTADOS;
    }

    const pedidos = bruto
        .split(',')
        .map(item => item.trim())
        .filter(item => IDIOMAS_SUPORTADOS.includes(item));

    return pedidos.length > 0 ? pedidos : IDIOMAS_SUPORTADOS;
}

// Oculta seletores de idioma legados embutidos no HTML das páginas ainda não
// limpas, para não haver dois controles na tela.
function ocultarSeletoresLegados(dock) {
    document.querySelectorAll('.language-selector, .seletor-idioma').forEach(el => {
        if (el === dock || dock.contains(el)) {
            return;
        }
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
    });
}

export function inicializarDockGlobal() {
    // Opt-out por página para apps com layout próprio.
    if (document.documentElement.dataset.dock === 'off') {
        return null;
    }

    let dock = document.getElementById(DOCK_ID);
    if (dock) {
        return dock;
    }

    dock = document.createElement('div');
    dock.id = DOCK_ID;
    dock.className = 'engnata-dock';
    dock.setAttribute('role', 'toolbar');

    const grupoIdiomas = document.createElement('div');
    grupoIdiomas.className = 'engnata-dock__grupo engnata-dock__grupo--idiomas';

    idiomasDaPagina().forEach(idioma => {
        const btn = document.createElement('button');
        btn.type = 'button';
        // `lang-btn` + `data-lang` reaproveitam o wiring do core/i18n.js.
        btn.className = 'lang-btn engnata-dock__btn';
        btn.setAttribute('data-lang', idioma);
        btn.setAttribute('aria-label', NOMES_NATIVOS[idioma] || idioma);
        btn.setAttribute('title', NOMES_NATIVOS[idioma] || idioma);
        btn.innerHTML = BANDEIRAS[idioma] || '';
        grupoIdiomas.appendChild(btn);
    });

    // O botão de tema não é criado aqui: o core/theme.js o injeta neste grupo
    // (seletor `.engnata-dock__grupo--tema`), mantendo a lógica de tema num
    // lugar só.
    const grupoTema = document.createElement('div');
    grupoTema.className = 'engnata-dock__grupo engnata-dock__grupo--tema';

    dock.appendChild(grupoIdiomas);
    dock.appendChild(grupoTema);
    document.body.appendChild(dock);

    // Marca o documento para o CSS reservar espaço no topo em telas estreitas,
    // onde o cabeçalho ocupa a largura toda e ficaria por baixo do dock.
    document.documentElement.classList.add('engnata-dock-ativo');

    ocultarSeletoresLegados(dock);
    atualizarRotuloDock();

    return dock;
}

// Rótulo acessível da toolbar acompanha o idioma ativo.
export function atualizarRotuloDock() {
    const dock = document.getElementById(DOCK_ID);
    if (!dock) {
        return;
    }

    const idioma = document.documentElement.lang || 'it-IT';
    const rotulo = ROTULO_TOOLBAR[idioma] || ROTULO_TOOLBAR['it-IT'];
    dock.setAttribute('aria-label', rotulo);
}
