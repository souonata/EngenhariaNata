/**
 * resultado-explicado.js  — V2.0
 * Componente reutilizável de explicação de resultados para pessoas leigas.
 *
 * Uso:
 *   import { ExplicacaoResultado } from '../src/components/resultado-explicado.js';
 *   const explicacao = new ExplicacaoResultado('v2-explicacao', i18n);
 *   explicacao.renderizar({ linhas: [...], destaque: '...', dica: '...' });
 */

export class ExplicacaoResultado {
    /**
     * @param {string} containerId - ID do elemento <div> onde será renderizado
     * @param {object} i18nRef     - referência ao singleton i18n (para idioma atual)
     */
    constructor(containerId, i18nRef) {
        this.containerId = containerId;
        this.i18n = i18nRef;
    }

    /**
     * Renderiza o painel de explicação no container.
     *
     * @param {object} dados
     *   @param {Array<{icone, titulo, valor, descricao}>} dados.linhas  - linhas de explicação
     *   @param {string} [dados.destaque]  - texto de destaque principal ("seu sistema em 1 frase")
     *   @param {string} [dados.dica]      - dica prática opcional
     *   @param {string} [dados.norma]     - referência de norma/fonte opcional
     */
    renderizar(dados) {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const { linhas = [], destaque = '', dica = '', norma = '' } = dados;

        const idioma = this.i18n?.obterIdiomaAtual?.() || this.i18n?.getIdioma?.() || 'it-IT';
        const labelTitulo = idioma === 'it-IT' ? 'Cosa significa questo?' : 'O que isso significa?';
        const labelDica    = idioma === 'it-IT' ? '💡 Consiglio pratico' : '💡 Dica prática';
        const labelNorma   = idioma === 'it-IT' ? '📖 Riferimento' : '📖 Referência';

        let linhasHTML = linhas.map(l => `
            <div class="v2-exp-linha">
                <span class="v2-exp-icone" aria-hidden="true">${l.icone || '▸'}</span>
                <div class="v2-exp-texto">
                    <strong class="v2-exp-titulo">${l.titulo}</strong>
                    ${l.valor ? `<span class="v2-exp-valor">${l.valor}</span>` : ''}
                    ${l.descricao ? `<p class="v2-exp-desc">${l.descricao}</p>` : ''}
                </div>
            </div>
        `).join('');

        const destaqueHTML = destaque
            ? `<div class="v2-exp-destaque">${destaque}</div>`
            : '';

        const dicaHTML = dica
            ? `<div class="v2-exp-dica"><span class="v2-exp-dica-label">${labelDica}:</span> ${dica}</div>`
            : '';

        const normaHTML = norma
            ? `<div class="v2-exp-norma"><span class="v2-exp-norma-label">${labelNorma}:</span> <em>${norma}</em></div>`
            : '';

        container.innerHTML = `
            <div class="v2-explicacao-card">
                <div class="v2-exp-header">
                    <span class="v2-exp-header-icon" aria-hidden="true">🔍</span>
                    <h3 class="v2-exp-header-titulo">${labelTitulo}</h3>
                </div>
                ${destaqueHTML}
                <div class="v2-exp-linhas">${linhasHTML}</div>
                ${dicaHTML}
                ${normaHTML}
            </div>
        `;

        // Reveal animado
        container.classList.add('v2-explicacao-visivel');
    }

    /** Esconde o painel (ex: enquanto calcula) */
    limpar() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = '';
        container.classList.remove('v2-explicacao-visivel');
    }
}
