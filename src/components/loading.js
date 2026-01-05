// Gerenciador de loading spinner

import { domCache } from '../utils/dom.js';

class LoadingManager {
    constructor() {
        this.contador = 0;
    }

    mostrar() {
        this.contador++;
        const loading = domCache.get('#loading');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    ocultar() {
        this.contador = Math.max(0, this.contador - 1);
        
        if (this.contador === 0) {
            const loading = domCache.get('#loading');
            if (loading) {
                loading.style.display = 'none';
            }
        }
    }

    reset() {
        this.contador = 0;
        this.ocultar();
    }
}

export const loading = new LoadingManager();
