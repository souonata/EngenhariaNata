// Sistema de internacionalização centralizado

const IDIOMA_SESSION_KEY = 'engnata_idioma';

// Idiomas do portfólio. Cada idioma carrega junto a sua jurisdição
// (pt-BR ⇒ Brasil, it-IT ⇒ Itália, sv-SE ⇒ Suécia), por isso constantes,
// normas e moeda seguem o idioma selecionado.
export const IDIOMAS_SUPORTADOS = ['pt-BR', 'it-IT', 'sv-SE'];
export const IDIOMA_PADRAO = 'it-IT';

// Cadeia de fallback por idioma: uma chave ausente cai no próximo idioma da
// lista em vez de sumir da tela. Necessário porque a tradução sueca entra de
// forma incremental, app por app.
const CADEIA_FALLBACK = {
    'pt-BR': ['pt-BR', 'it-IT'],
    'it-IT': ['it-IT', 'pt-BR'],
    'sv-SE': ['sv-SE', 'it-IT', 'pt-BR']
};

// Ordem de fallback de um idioma, do preferido ao último recurso.
export function obterCadeiaFallback(idioma) {
    return CADEIA_FALLBACK[idioma] || [idioma];
}

const MOEDAS = {
    'pt-BR': 'BRL',
    'it-IT': 'EUR',
    'sv-SE': 'SEK'
};

class I18nManager {
    constructor() {
        this.idiomaAtual = IDIOMA_PADRAO;
        this.traducoes = {};
        this.callbacks = [];
    }

    inicializar(traducoes, idiomaInicial = null) {
        this.traducoes = traducoes;

        const idiomaSessao = sessionStorage.getItem(IDIOMA_SESSION_KEY);
        const idiomaPreferido = idiomaInicial || idiomaSessao || IDIOMA_PADRAO;
        const idiomaValido = IDIOMAS_SUPORTADOS.includes(idiomaPreferido)
            ? idiomaPreferido
            : IDIOMA_PADRAO;
        this.trocarIdioma(idiomaValido);
    }

    trocarIdioma(novoIdioma) {
        // Valida contra a lista de idiomas suportados — e não contra a presença
        // de traduções — para que o seletor continue funcionando em apps ainda
        // não traduzidos: a cadeia de fallback cobre as chaves que faltam.
        if (!IDIOMAS_SUPORTADOS.includes(novoIdioma)) {
            console.error(`Idioma ${novoIdioma} não suportado`);
            return;
        }

        this.idiomaAtual = novoIdioma;
        sessionStorage.setItem(IDIOMA_SESSION_KEY, novoIdioma);
        
        this.atualizarDocumento();
        this.executarCallbacks();
        this.atualizarBotoesIdioma();
    }

    atualizarDocumento() {
        document.documentElement.lang = this.idiomaAtual;
        
        document.querySelectorAll('[data-i18n]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n');
            const texto = this.obterTraducao(chave);
            
            if (texto) {
                if (elemento.tagName === 'INPUT' || elemento.tagName === 'TEXTAREA') {
                    if (elemento.type === 'submit' || elemento.type === 'button') {
                        elemento.value = texto;
                    } else {
                        elemento.placeholder = texto;
                    }
                } else {
                    elemento.textContent = texto;
                }
            }
        });

        document.querySelectorAll('[data-i18n-html]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n-html');
            const html = this.obterTraducao(chave);
            if (html) {
                elemento.innerHTML = html;
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n-title');
            const titulo = this.obterTraducao(chave);
            if (titulo) {
                elemento.setAttribute('title', titulo);
            }
        });

        document.querySelectorAll('[data-i18n-aria]').forEach(elemento => {
            const chave = elemento.getAttribute('data-i18n-aria');
            const aria = this.obterTraducao(chave);
            if (aria) {
                elemento.setAttribute('aria-label', aria);
            }
        });
    }

    atualizarBotoesIdioma() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            const lang = btn.getAttribute('data-lang');
            if (lang === this.idiomaAtual) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    // Resolve uma chave pontilhada ("labels.bruto") dentro de um único idioma.
    resolverEm(idioma, chave) {
        const partes = chave.split('.');
        let valor = this.traducoes[idioma];

        for (const parte of partes) {
            if (valor && typeof valor === 'object') {
                valor = valor[parte];
            } else {
                return null;
            }
        }

        return valor ?? null;
    }

    obterTraducao(chave) {
        const cadeia = CADEIA_FALLBACK[this.idiomaAtual] || [this.idiomaAtual];

        for (const idioma of cadeia) {
            const valor = this.resolverEm(idioma, chave);
            if (valor !== null) {
                return valor;
            }
        }

        return null;
    }

    t(chave, valores = {}) {
        let texto = this.obterTraducao(chave) || chave;
        
        Object.keys(valores).forEach(key => {
            texto = texto.replace(new RegExp(`{${key}}`, 'g'), valores[key]);
        });
        
        return texto;
    }

    registrarCallback(callback) {
        this.callbacks.push(callback);
    }

    executarCallbacks() {
        this.callbacks.forEach(callback => callback(this.idiomaAtual));
    }

    obterIdiomaAtual() {
        return this.idiomaAtual;
    }

    obterMoeda() {
        return MOEDAS[this.idiomaAtual] || MOEDAS[IDIOMA_PADRAO];
    }

    // Locale BCP-47 para toLocaleString. O sueco separa milhar por espaço e usa
    // vírgula decimal ("1 234,56"), diferente de pt-BR e it-IT.
    obterLocaleNumerico() {
        return this.idiomaAtual;
    }

    formatarMoeda(valor, opcoes = {}) {
        return new Intl.NumberFormat(this.obterLocaleNumerico(), {
            style: 'currency',
            currency: this.obterMoeda(),
            ...opcoes
        }).format(valor);
    }

    // Seleciona o valor correspondente ao idioma ativo a partir de um mapa por
    // locale. Substitui os ternários `idioma === 'it-IT' ? valorIT : valorBR`,
    // que não comportam um terceiro idioma.
    porIdioma(mapa) {
        const cadeia = CADEIA_FALLBACK[this.idiomaAtual] || [this.idiomaAtual];

        for (const idioma of cadeia) {
            if (mapa && Object.prototype.hasOwnProperty.call(mapa, idioma)) {
                return mapa[idioma];
            }
        }

        return undefined;
    }
}

export const i18n = new I18nManager();

export function configurarBotoesIdioma() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idioma = btn.getAttribute('data-lang');
            i18n.trocarIdioma(idioma);
        });
    });
}
