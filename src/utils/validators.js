// Validadores de entrada

export function validarNumero(valor, min = -Infinity, max = Infinity) {
    const num = normalizarNumeroValidacao(valor);
    return Number.isFinite(num) && num >= min && num <= max;
}

function normalizarNumeroValidacao(valor) {
    if (typeof valor === 'number') {
        return valor;
    }

    if (typeof valor !== 'string') {
        return NaN;
    }

    const texto = valor.trim().replace(/\s/g, '');
    if (!texto) {
        return NaN;
    }

    const normalizado = texto.includes(',')
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto;

    return Number(normalizado);
}

export function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

export function validarCampoObrigatorio(valor) {
    return valor !== null && valor !== undefined && valor !== '';
}

export function limitarValor(valor, min, max) {
    return Math.max(min, Math.min(max, valor));
}

export function arredondarDecimais(valor, casas = 2) {
    const multiplicador = Math.pow(10, casas);
    return Math.round(valor * multiplicador) / multiplicador;
}
