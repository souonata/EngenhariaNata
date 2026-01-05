/**
 * input-handlers.js
 * Utilitários para gerenciar inputs conectados a sliders
 * 
 * Funcionalidades:
 * - Aceita valores fora dos limites do slider
 * - Sincroniza com slider quando valor está dentro do range
 * - Suporta formatação personalizada
 */

/**
 * Cria um handler para sincronizar input com slider
 * @param {Object} options - Opções de configuração
 * @param {HTMLInputElement} options.input - Elemento input
 * @param {HTMLInputElement} options.slider - Elemento slider
 * @param {Function} options.onUpdate - Callback chamado após atualização
 * @param {Function} [options.parseValue] - Função customizada para parsear valor do input
 * @returns {Function} Função para atualizar do input
 */
export function criarHandlerInput({ input, slider, onUpdate, parseValue }) {
    const atualizarDoInput = () => {
        let valor;
        
        if (parseValue) {
            valor = parseValue(input.value);
        } else {
            const textoLimpo = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
            valor = parseFloat(textoLimpo);
        }
        
        if (!isNaN(valor) && valor > 0) {
            // Ajustar slider apenas se valor estiver dentro do range
            const min = parseFloat(slider.min);
            const max = parseFloat(slider.max);
            
            if (valor >= min && valor <= max) {
                slider.value = valor;
            }
            
            // Armazenar o valor real digitado
            input.dataset.valorReal = valor;
            
            if (onUpdate) {
                onUpdate();
            }
        }
    };
    
    return atualizarDoInput;
}

/**
 * Configura eventos para input com slider
 * @param {Object} options - Opções de configuração
 * @param {HTMLInputElement} options.input - Elemento input
 * @param {HTMLInputElement} options.slider - Elemento slider
 * @param {Function} options.onUpdate - Callback chamado após atualização
 * @param {Function} [options.parseValue] - Função customizada para parsear valor
 */
export function configurarInputComSlider({ input, slider, onUpdate, parseValue }) {
    if (!input || !slider) return;
    
    const handler = criarHandlerInput({ input, slider, onUpdate, parseValue });
    
    // Selecionar todo o texto ao focar
    input.addEventListener('focus', () => {
        input.select();
    });
    
    // Ao perder foco
    input.addEventListener('blur', handler);
    
    // Ao pressionar Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handler();
        }
    });
}

/**
 * Obtém o valor real de um input (considerando valorReal armazenado)
 * @param {HTMLInputElement} input - Elemento input
 * @param {HTMLInputElement} slider - Elemento slider (fallback)
 * @param {*} defaultValue - Valor padrão se nenhum for encontrado
 * @returns {number} Valor real
 */
export function obterValorReal(input, slider, defaultValue = 0) {
    if (input?.dataset.valorReal) {
        return parseFloat(input.dataset.valorReal);
    }
    
    if (slider?.value) {
        return parseFloat(slider.value);
    }
    
    return defaultValue;
}

/**
 * Limpa o valorReal de um input quando o slider é usado
 * @param {HTMLInputElement} input - Elemento input
 */
export function limparValorReal(input) {
    if (input?.dataset.valorReal) {
        delete input.dataset.valorReal;
    }
}

/**
 * Configura múltiplos inputs com sliders
 * @param {Array} configs - Array de configurações {input, slider, onUpdate, parseValue}
 */
export function configurarMultiplosInputs(configs) {
    configs.forEach(config => {
        configurarInputComSlider(config);
    });
}
