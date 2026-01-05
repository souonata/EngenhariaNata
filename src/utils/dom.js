// Utilitários DOM

class DOMCache {
    constructor() {
        this.cache = new Map();
    }

    get(seletor) {
        if (!this.cache.has(seletor)) {
            this.cache.set(seletor, document.querySelector(seletor));
        }
        return this.cache.get(seletor);
    }

    getAll(seletor) {
        if (!this.cache.has(seletor)) {
            this.cache.set(seletor, document.querySelectorAll(seletor));
        }
        return this.cache.get(seletor);
    }

    clear() {
        this.cache.clear();
    }
}

export const domCache = new DOMCache();

export function ajustarTamanhoInput(input, valorAtual) {
    if (!input) return;
    
    const minWidth = 50;
    const maxWidth = 300;
    const paddingExtra = 30;
    
    const texto = valorAtual || input.value || input.placeholder || '';
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const estilo = window.getComputedStyle(input);
    context.font = `${estilo.fontSize} ${estilo.fontFamily}`;
    
    const larguraTexto = context.measureText(texto).width;
    const larguraFinal = Math.max(minWidth, Math.min(maxWidth, larguraTexto + paddingExtra));
    
    input.style.width = `${larguraFinal}px`;
}

export function mostrarElemento(elemento, display = 'block') {
    if (elemento) {
        elemento.style.display = display;
    }
}

export function ocultarElemento(elemento) {
    if (elemento) {
        elemento.style.display = 'none';
    }
}

export function alternarElemento(elemento, forcarMostrar = null) {
    if (!elemento) return;
    
    if (forcarMostrar !== null) {
        elemento.style.display = forcarMostrar ? 'block' : 'none';
    } else {
        elemento.style.display = elemento.style.display === 'none' ? 'block' : 'none';
    }
}

export function limparConteudo(elemento) {
    if (elemento) {
        elemento.innerHTML = '';
    }
}

export function adicionarClasse(elemento, ...classes) {
    if (elemento) {
        elemento.classList.add(...classes);
    }
}

export function removerClasse(elemento, ...classes) {
    if (elemento) {
        elemento.classList.remove(...classes);
    }
}

export function alternarClasse(elemento, classe) {
    if (elemento) {
        elemento.classList.toggle(classe);
    }
}
