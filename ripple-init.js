// ripple-init.js — centralized initializer for the shared ripple helper
// Loads after ripple.js, attaches ripples to common site selectors

(function(){
    'use strict';

    // Guard: if attachRippleTo not available yet, wait a short time (race-safe)
    function ensureAttachAndRun(fn) {
        if (typeof attachRippleTo === 'function') return fn();
        // Try again after a short delay, up to a few times
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            if (typeof attachRippleTo === 'function') {
                clearInterval(t);
                fn();
            } else if (tries > 10) {
                clearInterval(t);
                console.debug('ripple-init: attachRippleTo not found — giving up');
            }
        }, 80);
    }

    // Common selectors to attach ripple feedback
    const COMMON_SELECTORS = [
        '.app-icon',
        '.lang-btn',
        '.btn-idioma',
        '.home-button-fixed',
        '.arrow-btn',
        'input[type="range"]',
        '.btn-acao',
        '.btn-help',
        '.btn-voltar-exemplo',
        '.btn-fechar-exemplos',
        '.icone-info',
        '.card-header-clicavel',
        '.btn-fechar-exemplos',
        '.btn-voltar-exemplo'
    ];

    // initRipples: attach ripples to known elements and observe DOM for new ones
    // ---------------------------------------------------------------------
    // Essa função tenta anexar o efeito ripple imediatamente aos seletores
    // comuns. Também cria um MutationObserver para detectar quando novos
    // elementos são adicionados dinamicamente (por exemplo, durante render
    // de templates) e então aplica ripples a esses elementos.
    //
    // Por que isso é útil:
    // - Mantém a UX consistente mesmo quando conteúdo é inserido depois do
    //   carregamento inicial da página.
    // - Evita perda do efeito em componentes criados dinamicamente.
    function initRipples() {
        // Attach to all of the common selectors once
        COMMON_SELECTORS.forEach(sel => {
            try {
                attachRippleTo(sel);
            } catch (err) {
                // Do not break initialization on errors
                console.warn('ripple-init: failed to attach to', sel, err);
            }
        });

        // Special-case: some interactive elements may be created later in the
        // lifecycle — observe the document for new nodes and attach ripples
        // lazily for elements matching our selectors.
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                if (!m.addedNodes || m.addedNodes.length === 0) return;
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    COMMON_SELECTORS.forEach(sel => {
                        if (node.matches && node.matches(sel)) {
                            try { attachRippleTo(sel); } catch(e){}
                        }
                        // Also check its descendants
                        node.querySelectorAll && node.querySelectorAll(sel).forEach(it => {
                            try { attachRippleTo(sel); } catch(e){}
                        });
                    });
                });
            });
        });

        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }

    ensureAttachAndRun(initRipples);
})();
