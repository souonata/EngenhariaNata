// Controles de UI compartilhados (ESM).
// Migrados do antigo assets/js/site-config.js (removido na auditoria), que não
// era carregado e deixava solar/fazenda com recursos degradados:
//   - ajustarTamanhoInput: largura dinâmica do input conforme o conteúdo.
//   - configurarBotoesSliderComAceleracao: botões +/- com aceleração ao segurar.
//   - ajustarValorSlider: ajuste padrão de um slider por um passo.

const INPUT_PADDING_CHARS = 2;
const INPUT_MIN_WIDTH = 50;

// Ajusta dinamicamente a largura de um input com base no seu conteúdo.
export function ajustarTamanhoInput(input, folgaCaracteres = INPUT_PADDING_CHARS) {
    if (typeof input === 'string') {
        input = document.getElementById(input);
    }
    if (!input || input.tagName !== 'INPUT') {
        return;
    }

    const medida = document.createElement('span');
    const estilo = window.getComputedStyle(input);
    medida.style.visibility = 'hidden';
    medida.style.position = 'absolute';
    medida.style.whiteSpace = 'pre';
    medida.style.fontFamily = estilo.fontFamily;
    medida.style.fontSize = estilo.fontSize;
    medida.style.fontWeight = estilo.fontWeight;
    medida.style.fontStyle = estilo.fontStyle;
    medida.style.fontVariant = estilo.fontVariant;
    medida.style.letterSpacing = estilo.letterSpacing;
    medida.style.padding = estilo.padding;
    medida.style.border = estilo.border;
    medida.style.boxSizing = estilo.boxSizing;

    const textoAtual = input.value || input.placeholder || '';
    medida.textContent = textoAtual + 'M'.repeat(folgaCaracteres);
    document.body.appendChild(medida);
    const larguraNecessaria = medida.offsetWidth;
    document.body.removeChild(medida);

    input.style.width = Math.max(larguraNecessaria, INPUT_MIN_WIDTH) + 'px';
}

// Ajusta o valor de um slider por um passo, respeitando min/max/step, e dispara
// o evento 'input' para o app recalcular.
export function ajustarValorSlider(targetId, step, options = {}) {
    const slider = document.getElementById(targetId);
    if (!slider) {
        return;
    }
    if (typeof step === 'string') {
        return;
    }

    const minRaw = parseFloat(slider.min);
    const min = isNaN(minRaw) ? 1 : minRaw;
    const max = parseFloat(slider.max) || 100;
    const stepAttr = parseFloat(slider.step) || 1;

    let valorAtual = parseFloat(slider.value);
    if (isNaN(valorAtual)) {
        valorAtual = min;
    }

    let novoValor = valorAtual + step;
    novoValor = Math.round(novoValor / stepAttr) * stepAttr;
    novoValor = Math.max(min, Math.min(max, novoValor));

    slider.value = novoValor;
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    if (typeof options.onUpdate === 'function') {
        options.onUpdate(novoValor);
    }
}

// Configura botões +/- (data-target = id do slider, data-step = passo) com
// aceleração ao manter pressionado: dobra a velocidade a cada segundo.
export function configurarBotoesSliderComAceleracao(buttonSelector, customAdjustFn = null) {
    const buttons = document.querySelectorAll(buttonSelector);

    buttons.forEach((btn) => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) {
            return;
        }

        const slider = document.getElementById(targetId);
        if (!slider) {
            return;
        }

        let step = btn.getAttribute('data-step');
        if (step !== 'dynamic' && step !== '-dynamic') {
            step = parseFloat(step) || 1;
        }

        const minRaw = parseFloat(slider.min);
        const min = isNaN(minRaw) ? 1 : minRaw;
        const max = parseFloat(slider.max) || 100;

        const adjustFn =
            customAdjustFn ||
            ((alvo, passo) => {
                ajustarValorSlider(alvo, passo);
            });

        let intervalId = null;
        let timeoutId = null;
        let startTime = null;
        let isActive = false;

        const getInterval = (elapsed) => {
            const intervaloInicial = 200;
            const segundos = Math.floor(elapsed / 1000);
            const intervalo = intervaloInicial / Math.pow(2, segundos);
            return Math.max(10, Math.round(intervalo));
        };

        const stopRepeating = () => {
            isActive = false;
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            startTime = null;
        };

        const startRepeating = () => {
            if (isActive) {
                return;
            }
            isActive = true;
            startTime = Date.now();

            adjustFn(targetId, step);

            let lastInterval = 200;
            let lastSecond = 0;

            const doAdjust = () => {
                if (!isActive) {
                    return;
                }
                const elapsed = Date.now() - startTime;
                const currentSecond = Math.floor(elapsed / 1000);
                const currentInterval = getInterval(elapsed);

                if (currentSecond !== lastSecond || currentInterval !== lastInterval) {
                    clearInterval(intervalId);
                    lastInterval = currentInterval;
                    lastSecond = currentSecond;
                    intervalId = setInterval(doAdjust, currentInterval);
                }

                let valorAntes = parseFloat(slider.value);
                if (isNaN(valorAntes)) {
                    valorAntes = min;
                }
                adjustFn(targetId, step);
                let valorDepois = parseFloat(slider.value);
                if (isNaN(valorDepois)) {
                    valorDepois = min;
                }

                if (valorAntes === valorDepois) {
                    const stepNum =
                        step === 'dynamic' ? 1 : step === '-dynamic' ? -1 : parseFloat(step) || 1;
                    if ((stepNum > 0 && valorDepois >= max) || (stepNum < 0 && valorDepois <= min)) {
                        stopRepeating();
                    }
                }
            };

            intervalId = setInterval(doAdjust, 200);
        };

        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('mouseup', stopRepeating);
        btn.addEventListener('mouseleave', stopRepeating);
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRepeating();
        });
        btn.addEventListener('touchend', stopRepeating);
        btn.addEventListener('touchcancel', stopRepeating);
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    });
}
