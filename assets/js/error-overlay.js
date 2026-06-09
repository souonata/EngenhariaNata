/**
 * error-overlay.js
 * Rede de segurança global de erros — Engenharia NATA.
 *
 * Por quê: o site é 100% ESM. Um único erro fatal no carregamento de um módulo
 * compartilhado descarta o módulo inteiro silenciosamente e CONGELA a página
 * (tela viva, nada responde). Antes deste arquivo não havia NENHUM aviso —
 * a falha era invisível. Ver GUIA_FALHA_CONGELAMENTO.md.
 *
 * O que faz: registra cedo (script clássico, não-module) ouvintes globais de
 * `error` (fase de captura, para pegar até falha de carregamento de <script>)
 * e `unhandledrejection`, e mostra uma faixa vermelha com arquivo+linha em vez
 * de deixar a página morta e muda.
 *
 * Regras: zero dependências; nunca lança; same-origin (compatível com a CSP
 * `script-src 'self'`); precisa carregar ANTES dos <script type="module">.
 */
(function () {
    'use strict';

    if (window.__engnataErrorOverlay) return; // idempotente
    window.__engnataErrorOverlay = true;

    var MAX = 6;            // no máximo N erros listados (evita avalanche)
    var contador = 0;
    var caixa = null;
    var lista = null;

    function montar() {
        if (caixa) return;
        try {
            caixa = document.createElement('div');
            caixa.setAttribute('role', 'alert');
            caixa.style.cssText = [
                'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
                'background:#7f1d1d', 'color:#fff', 'font:13px/1.5 system-ui,sans-serif',
                'padding:10px 44px 10px 14px', 'box-shadow:0 2px 12px rgba(0,0,0,.4)',
                'max-height:45vh', 'overflow:auto', 'white-space:pre-wrap',
                'word-break:break-word'
            ].join(';');

            var titulo = document.createElement('div');
            titulo.style.cssText = 'font-weight:700;margin-bottom:4px';
            titulo.textContent = '⚠ Erro de JavaScript — a página pode estar travada. Abra o Console (F12) para detalhes.';
            caixa.appendChild(titulo);

            lista = document.createElement('div');
            caixa.appendChild(lista);

            var fechar = document.createElement('button');
            fechar.type = 'button';
            fechar.textContent = '×';
            fechar.setAttribute('aria-label', 'Fechar');
            fechar.style.cssText = [
                'position:absolute', 'top:6px', 'right:10px', 'background:transparent',
                'border:0', 'color:#fff', 'font-size:22px', 'line-height:1',
                'cursor:pointer', 'padding:0'
            ].join(';');
            fechar.onclick = function () {
                if (caixa && caixa.parentNode) caixa.parentNode.removeChild(caixa);
                caixa = null;
            };
            caixa.appendChild(fechar);

            (document.body || document.documentElement).appendChild(caixa);
        } catch (e) { /* nunca propaga */ }
    }

    function registrar(texto) {
        try {
            if (contador >= MAX) return;
            contador++;
            montar();
            if (!lista) return;
            var linha = document.createElement('div');
            linha.style.cssText = 'margin-top:2px;opacity:.95';
            linha.textContent = '• ' + texto;
            lista.appendChild(linha);
            if (contador === MAX) {
                var mais = document.createElement('div');
                mais.style.cssText = 'margin-top:4px;opacity:.8;font-style:italic';
                mais.textContent = '… mais erros omitidos (veja o Console).';
                lista.appendChild(mais);
            }
        } catch (e) { /* nunca propaga */ }
    }

    function local(src, linha, col) {
        var s = src || '';
        try { s = s.replace(location.origin, ''); } catch (e) {}
        if (linha) s += ':' + linha + (col ? ':' + col : '');
        return s;
    }

    // Erros de runtime, sintaxe e — em fase de captura — falha de carregamento
    // de <script>/<link> (inclui módulo ESM que não baixou).
    window.addEventListener('error', function (ev) {
        try {
            var alvo = ev.target;
            if (alvo && alvo !== window && (alvo.tagName === 'SCRIPT' || alvo.tagName === 'LINK')) {
                registrar('Falha ao carregar: ' + local(alvo.src || alvo.href));
                return;
            }
            var msg = (ev.error && ev.error.message) || ev.message || 'Erro desconhecido';
            registrar(msg + '  [' + local(ev.filename, ev.lineno, ev.colno) + ']');
        } catch (e) {}
    }, true);

    // Promises rejeitadas sem catch (ex.: fetch de tradução que falhou).
    window.addEventListener('unhandledrejection', function (ev) {
        try {
            var r = ev.reason;
            var msg = (r && (r.message || r.toString && r.toString())) || 'Promise rejeitada sem tratamento';
            registrar('Promise: ' + msg);
        } catch (e) {}
    });
})();
