// assets/js/ajustarValorUtil.js
// Função utilitária padrão para ajuste de sliders com step, min, max e arredondamento
// Uso: ajustarValorPadrao('sliderId', step, { onInput, arredondarInteiro })
// Ajusta o valor de um input range (slider) de forma padronizada.
// Exporta como função global para compatibilidade com scripts não-module
function ajustarValorPadrao(targetId, step, options = {}) { // referência do elemento slider pelo ID informado
    const slider = document.getElementById(targetId);
    // Se não encontrar o slider, interrompe a função (proteção contra erro de ID)
    if (!slider) return; // valor mínimo do slider (min). Se não definido, assume 0 como padrão
    const minRaw = parseFloat(slider.min);
    const min = isNaN(minRaw) ? 0 : minRaw; // valor máximo do slider (max). Se não definido, assume 100 como padrão
    const max = parseFloat(slider.max) || 100; // step do slider (incremento mínimo permitido). Se não definido, assume 1
    const stepAttr = parseFloat(slider.step) || 1; // valor atual do slider. Se não for número, usa o mínimo
    let valor = parseFloat(slider.value);
    if (isNaN(valor)) valor = min;

    // Soma o step ao valor atual (incrementa ou decrementa)
    valor += step;

    // Arredondamento do valor: // Se opção 'arredondarInteiro' estiver ativada, arredonda para inteiro mais próximo
    if (options.arredondarInteiro) {
        valor = Math.round(valor);
    } else {
        // Caso contrário, arredonda para o múltiplo mais próximo do step do slider
        valor = Math.round(valor / stepAttr) * stepAttr;
    }
    // Garante que o valor fique dentro dos limites mínimo e máximo
    valor = Math.max(min, Math.min(max, valor));

    // Atualiza o valor do slider no DOM
    slider.value = valor;
    // Dispara o evento 'input' para que outros scripts atualizem a interface automaticamente
    slider.dispatchEvent(new Event('input', { bubbles: true }));

    // Se foi passada uma função callback 'onInput', executa após o ajuste
    if (typeof options.onInput === 'function') {
        options.onInput(valor);
    }
}
// Exporta também como ES6 module para compatibilidade futura
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ajustarValorPadrao };
}
