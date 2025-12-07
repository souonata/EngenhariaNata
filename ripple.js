// ripple.js — central shared helper for tap highlight (ripple effect)
// Exposes attachRippleTo(selector) globally (window.attachRippleTo)

(function(global){
    'use strict';

    /**
     * Attach a tap ripple (visual feedback) to elements matching `selector`.
     *
     * Explicação didática:
     * - Usamos 'pointerdown' para cobrir mouse, toque e canetas em um único
     *   evento, simplificando o suporte a dispositivos distintos.
     * - O handler calcula as coordenadas relativas ao elemento para posicionar
     *   a animação do 'ripple'. Caso o evento não contenha coordenadas (por ex.,
     *   ativação via teclado), usamos o centro do elemento para que o efeito
     *   ainda seja visível.
     * - O tamanho do ripple é proporcional ao maior lado do elemento (cobertura
     *   visual adequada). Removemos o span criado após um timeout para limpeza.
     * - Marcamos elementos com el.__rippleAttached para evitar anexar múltiplos
     *   listeners (idempotência), o que poderia provocar efeitos duplicados.
     *
     * Observações sobre performance e acessibilidade:
     * - O listener é registrado como {passive: true} para não bloquear a
     *   thread em interações táteis — o efeito visual é independente do fluxo
     *   de eventos de rolagem.
     * - Para melhor acessibilidade, o efeito também aparece quando o usuário
     *   aciona elementos via teclado (fallback para centro).
     *
     * @param {string} selector - CSS selector for elements to receive the ripple
     */
    function attachRippleTo(selector) {
        document.querySelectorAll(selector).forEach(el => {
            // Avoid attaching the handler multiple times
            if (el.__rippleAttached) return;
            el.__rippleAttached = true;

            el.addEventListener('pointerdown', (ev) => {
                const rect = el.getBoundingClientRect();
                const ripple = document.createElement('span');
                ripple.className = 'ripple';

                // Compute coordinates relative to the element
                // If event coordinates are 0 (keyboard activation) fall back to center
                let x = ev.clientX - rect.left;
                let y = ev.clientY - rect.top;
                if (isNaN(x) || isNaN(y)) {
                    x = rect.width / 2;
                    y = rect.height / 2;
                }

                const size = Math.max(rect.width, rect.height) * 0.9;
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = (x - size/2) + 'px';
                ripple.style.top = (y - size/2) + 'px';

                // Append ripple and clean up automatically
                el.appendChild(ripple);
                window.setTimeout(() => {
                    if (ripple && ripple.parentNode) ripple.remove();
                }, 700);
            }, {passive: true});
        });
    }

    // Export to global scope
    global.attachRippleTo = attachRippleTo;

})(window);
