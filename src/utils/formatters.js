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
    const configs = {
        BRL: { locale: 'pt-BR', currency: 'BRL', symbol: 'R$', zero: 'R$ 0,00' },
        EUR: { locale: 'it-IT', currency: 'EUR', symbol: '€', zero: '€ 0,00' },
        // Coroa sueca. O sv-SE põe o símbolo DEPOIS do valor ("1 234,00 kr") e
        // separa o milhar por espaço — deixar cair no BRL fazia o app sueco
        // exibir valores em R$.
        SEK: { locale: 'sv-SE', currency: 'SEK', symbol: 'kr', zero: '0,00 kr' }
    };

    const config = configs[moeda] || configs.BRL;

    if (valor === null || valor === undefined || isNaN(valor)) {
        return config.zero;
    }
    
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
    if (typeof valorString === 'number') {
        return Number.isFinite(valorString) ? valorString : 0;
    }

    if (!valorString || typeof valorString !== 'string') {
        return 0;
    }

    const texto = valorString.trim().replace(/\s/g, '');
    if (!texto) {
        return 0;
    }

    const normalizado = texto.includes(',')
        ? texto.replace(/\./g, '').replace(',', '.')
        : texto;

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
}
