// Utilitários de formatação de números e moedas

export function formatarNumero(valor, casasDecimais = 2) {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return '0';
    }
    return valor.toLocaleString('pt-BR', {
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais
    });
}

export function formatarNumeroDecimal(valor, casasDecimais = 2) {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return '0,00';
    }
    return valor.toFixed(casasDecimais).replace('.', ',');
}

export function formatarNumeroComSufixo(valor, casasDecimais = 0) {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return '0';
    }
    if (valor >= 1000000) {
        return formatarNumero(valor / 1000000, casasDecimais) + 'M';
    }
    if (valor >= 1000) {
        return formatarNumero(valor / 1000, casasDecimais) + 'K';
    }
    return formatarNumero(valor, casasDecimais);
}

export function formatarMoeda(valor, moeda = 'BRL', casasDecimais = 2) {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return moeda === 'BRL' ? 'R$ 0,00' : '€ 0,00';
    }
    
    const configs = {
        BRL: { locale: 'pt-BR', currency: 'BRL', symbol: 'R$' },
        EUR: { locale: 'it-IT', currency: 'EUR', symbol: '€' }
    };
    
    const config = configs[moeda] || configs.BRL;
    
    return valor.toLocaleString(config.locale, {
        style: 'currency',
        currency: config.currency,
        minimumFractionDigits: casasDecimais,
        maximumFractionDigits: casasDecimais
    });
}

export function formatarMoedaComVirgula(valor, moeda = 'BRL', casasDecimais = 2) {
    return formatarMoeda(valor, moeda, casasDecimais);
}

export function formatarPercentual(valor, casasDecimais = 1) {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return '0%';
    }
    return `${formatarNumero(valor, casasDecimais)}%`;
}

export function parsearNumero(valorString) {
    if (!valorString || typeof valorString !== 'string') {
        return 0;
    }
    return parseFloat(valorString.replace(/\./g, '').replace(',', '.')) || 0;
}
