/**
 * sanitize.js
 * Utilitários para sanitização de conteúdo HTML
 * Previne injeção de código e XSS attacks
 */

/**
 * Escapa caracteres especiais HTML para evitar injeção de código
 * @param {string} text - Texto a ser escapado
 * @returns {string} Texto escapado
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Define innerHTML com conteúdo já pré-validado (usado após template literals com valores validados)
 * @param {HTMLElement} element - Elemento DOM para atualizar
 * @param {string} html - Conteúdo HTML a inserir (deve ser seguro)
 * @returns {void}
 */
export function setSafeHTML(element, html) {
    if (!element || typeof html !== 'string') return;
    element.innerHTML = html;
}

/**
 * Define textContent de forma segura (sem risco de injeção de código)
 * @param {HTMLElement} element - Elemento DOM para atualizar
 * @param {string} text - Texto a inserir (sempre seguro)
 * @returns {void}
 */
export function setSecureText(element, text) {
    if (!element) return;
    element.textContent = text;
}

/**
 * Cria um elemento seguro com conteúdo de texto
 * @param {string} tag - Nome da tag HTML
 * @param {string} text - Conteúdo de texto
 * @param {Object} attributes - Atributos a adicionar ao elemento
 * @returns {HTMLElement} Novo elemento
 */
export function createSecureElement(tag, text = '', attributes = {}) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'class') {
            element.className = value;
        } else if (key === 'id') {
            element.id = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    return element;
}

/**
 * Valida e formata número para exibição segura
 * @param {number} numero - Número a formatar
 * @param {number} casasDecimais - Casas decimais
 * @returns {string} Número formatado como string
 */
export function formatarNumeroSeguro(numero, casasDecimais = 2) {
    if (typeof numero !== 'number' || isNaN(numero)) return '0';
    return numero.toFixed(casasDecimais);
}

/**
 * Valida URL antes de usá-la em href (previne javascript: e data: urls maliciosas)
 * @param {string} url - URL a validar
 * @returns {string} URL segura ou URL vazia
 */
export function validarURL(url) {
    if (typeof url !== 'string') return '#';
    const protocolo = url.toLowerCase().split(':')[0];
    const protecolosSegulos = ['http', 'https', 'mailto', 'ftp', 'tel'];
    if (protecolosSegulos.includes(protocolo)) return url;
    if (!url.includes(':') && url.startsWith('/')) return url; // Caminho relativo
    return '#';
}
