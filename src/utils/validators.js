// Validadores de entrada

export function validarNumero(valor, min = -Infinity, max = Infinity) {
    const num = typeof valor === 'string' ? parseFloat(valor.replace(',', '.')) : valor;
    return !isNaN(num) && num >= min && num <= max;
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
