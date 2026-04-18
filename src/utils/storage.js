// Utilitários de localStorage

const STORAGE_PREFIX = 'engnata_';

export function salvarDados(chave, dados) {
    try {
        const chaveCompleta = STORAGE_PREFIX + chave;
        localStorage.setItem(chaveCompleta, JSON.stringify(dados));
        return true;
    } catch (erro) {
        console.error('Erro ao salvar dados:', erro);
        return false;
    }
}

export function carregarDados(chave, valorPadrao = null) {
    try {
        const chaveCompleta = STORAGE_PREFIX + chave;
        const dados = localStorage.getItem(chaveCompleta);
        return dados ? JSON.parse(dados) : valorPadrao;
    } catch (erro) {
        console.error('Erro ao carregar dados:', erro);
        return valorPadrao;
    }
}

export function removerDados(chave) {
    try {
        const chaveCompleta = STORAGE_PREFIX + chave;
        localStorage.removeItem(chaveCompleta);
        return true;
    } catch (erro) {
        console.error('Erro ao remover dados:', erro);
        return false;
    }
}

export function limparTodosDados() {
    try {
        const chaves = Object.keys(localStorage);
        chaves.forEach(chave => {
            if (chave.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(chave);
            }
        });
        return true;
    } catch (erro) {
        console.error('Erro ao limpar dados:', erro);
        return false;
    }
}
