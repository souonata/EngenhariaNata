# Instruções para Assistente de IA - Engenharia NATA
copilot-instructions
Este documento fornece instruções completas para **qualquer assistente de IA** (GitHub Copilot, Cursor AI, ChatGPT, Claude, etc.) sobre o projeto **Engenharia NATA**, incluindo padrões de código, estrutura do projeto, convenções e boas práticas.

**IMPORTANTE**: Este arquivo deve ser lido e seguido em TODAS as interações com este projeto. Sempre consulte este documento antes de fazer alterações no código.

## 📋 Visão Geral do Projeto

**Engenharia NATA** é um portfólio de aplicativos web educativos para engenharia e finanças, desenvolvido com **JavaScript puro** (sem frameworks), **bilíngue** (PT-BR/IT-IT) e **mobile-first**.

### Características Principais

- ✅ **100% JavaScript Puro** — Sem frameworks, fácil de entender e modificar
- ✅ **Código Completamente Comentado** — Cada linha explicada em português para aprendizado
- ✅ **Bilíngue** — Português (pt-BR) e Italiano (it-IT) com troca instantânea
- ✅ **Mobile-First** — Design responsivo que funciona perfeitamente em celular, tablet e desktop
- ✅ **Educacional** — Focado em ensinar conceitos práticos através de código bem documentado
- ✅ **Memoriais de Cálculo** — Todos os apps incluem memoriais completos explicando fórmulas, constantes e leis físicas

## 📁 Estrutura do Projeto

```
EngenhariaNata/
├── assets/
│   ├── css/
│   │   ├── shared-styles.css      # Estilos compartilhados entre todos os apps
│   │   └── controls-styles.css    # Estilos para controles (sliders, inputs, etc)
│   └── js/
│       └── site-config.js         # ⭐ Configuração global e funções compartilhadas
├── scripts/
│   ├── count-lines.ps1            # Contar linhas de código (exclui comentários)
│   ├── pre-commit-checks.ps1      # Verificações pré-commit
│   ├── update-cache-busting.ps1   # Atualizar versões CSS/JS
│   ├── validate-translations.ps1  # Validar traduções PT/IT
│   ├── analyze-bundle-size.ps1    # Analisar tamanho dos arquivos
│   └── optimize-svgs.ps1          # Otimizar SVGs inline
├── helice/                        # App Calculadora de Hélice
├── bitola/                        # App Calculadora de Bitola
├── mutuo/                         # App Calculadora de Empréstimos
├── solar/                         # App Energia Solar
│   └── config.html                # Página de configuração do app Solar
├── arcondicionado/                # App Ar Condicionado
├── aquecimento/                   # App Aquecedor Solar
├── fazenda/                       # App Fazenda
│   └── fazenda-database.js        # Banco de dados de plantas e animais
├── bugs/                          # App Reportar Bug
├── sobre/                         # Página "Sobre o Projeto"
├── index.html                     # Página inicial
├── README.md                      # Documentação principal
├── REVISAO_APPS.md                # Revisão técnica dos apps
├── GLOSSARIO.md                   # Glossário de termos técnicos
├── SEO-INSTRUCTIONS.md            # Instruções de SEO
└── sitemap.xml                    # Mapa do site para SEO
```

## 🎯 Apps Disponíveis

1. **💰 Mutuo** — Calculadora de empréstimos (SAC, Tabela Price, Sistema Americano)
2. **🚤 Helice** — Calculadora de passo de hélice para barcos
3. **🔋 Energia Solar** — Dimensionamento fotovoltaico off-grid
4. **🔌 Bitola** — Calculadora de bitola de fios elétricos
5. **❄️ Ar Condicionado** — Dimensionador de sistema multi-split
6. **☀️ Aquecedor Solar** — Dimensionador de sistemas de aquecimento solar térmico
7. **🌾 Fazenda** — Planejador de fazenda auto-sustentável
8. **🐛 Reportar Bug** — Formulário para reportar bugs

## ⚙️ Configuração Global (`assets/js/site-config.js`)

**SEMPRE** use as funções e configurações de `site-config.js` para garantir consistência:

### Funções de Formatação

```javascript
// Formatação de números
formatarNumero(valor, casasDecimais)              // Padrão: 0 decimais
formatarNumeroDecimal(valor, casasDecimais)       // Padrão: 1 decimal
formatarNumeroCompacto(valor)                     // Com abreviações (k, M)

// Formatação de potência
formatarPotencia(valor)                           // Ex: "1,5k"
formatarPotenciaWkW(valor_W)                      // Ex: "999 W" ou "2,5 kW"

// Formatação de moeda
formatarMoeda(valor, idioma)                      // R$ 1.234,56 ou € 1.234,56
formatarMoedaSemDecimal(valor, idioma)            // R$ 1.235 ou € 1.235

// Conversão de valores
converterValorFormatadoParaNumero(valorFormatado) // "1.234,56" → 1234.56
obterValorNumericoFormatado(valorFormatado)       // Versão simplificada
```

### Utilitários

```javascript
// Idioma e moeda
obterIdiomaAtual()                                // 'pt-BR' ou 'it-IT'
obterMoedaPorIdioma(idioma)                       // 'BRL' ou 'EUR'
obterSimboloMoeda(idioma)                         // 'R$' ou '€'

// Interface
ajustarTamanhoInput(input, folgaCaracteres)       // Ajusta largura de input
configurarBotoesSliderComAceleracao(container)    // Aceleração exponencial para botões
```

### Configurações

```javascript
SiteConfig.LOCAL_STORAGE.LANGUAGE_KEY             // 'idiomaPreferido'
SiteConfig.DEFAULTS.language                       // 'pt-BR'
SiteConfig.DEFAULTS.TAXA_BRL_EUR                  // 6.19
SiteConfig.SELECTORS.HOME_BUTTON                  // '.home-button-fixed'
```

## 📝 Padrões de Código

### 1. Estrutura de Arquivos

Cada app deve ter 3 arquivos:
- `app-name.html` — Estrutura HTML
- `app-name-script.js` — Lógica JavaScript
- `app-name-styles.css` — Estilos CSS

### 2. Comentários

**SEMPRE** comente o código em português, explicando:
- O que a função faz
- Por que foi implementada dessa forma
- Fórmulas matemáticas/físicas utilizadas
- Valores de referência e constantes

```javascript
/**
 * Calcula o BTU necessário para o ambiente
 * @param {number} area - Área do ambiente em m²
 * @param {number} altura - Altura do pé direito em metros
 * @returns {Object} Objeto com BTU recomendado e potência em kW
 * 
 * Fórmula: BTU = (Área × 700 BTU/m²) × Fator Altura + Pessoas × 600 + Equipamentos × 600
 * Constantes: 700 BTU/m² (ASHRAE), 600 BTU/pessoa, 600 BTU/equipamento
 */
function calcularBTU(area, altura, pessoas, equipamentos) {
    // Implementação...
}
```

### 3. Internacionalização (i18n)

**SEMPRE** implemente suporte bilíngue (PT-BR/IT-IT):

```javascript
// 1. Criar objeto de traduções
const traducoes = {
    'pt-BR': {
        'titulo': 'Título em Português',
        'subtitulo': 'Subtítulo em Português'
    },
    'it-IT': {
        'titulo': 'Titolo in Italiano',
        'subtitulo': 'Sottotitolo in Italiano'
    }
};

// 2. Função de tradução
function traduzir(chave) {
    return traducoes[idiomaAtual]?.[chave] || chave;
}

// 3. Aplicar traduções
function aplicarTraducoes() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const chave = el.getAttribute('data-i18n');
        el.textContent = traduzir(chave);
    });
}

// 4. HTML com atributo data-i18n
<h2 data-i18n="titulo">Título</h2>
```

### 4. Memorial de Cálculo

**TODOS** os apps educativos devem incluir um **Memorial de Cálculo** completo:

```javascript
// 1. HTML: Seção do memorial (inicialmente escondida)
<div id="memorialSection" class="card memorial-section" style="display: none;">
    <div class="memorial-header">
        <h2 data-i18n="memorial-title">📚 Memorial de Cálculo</h2>
        <button id="btnFecharMemorial" class="btn-fechar-memorial">
            <span data-i18n="back">← Voltar</span>
        </button>
    </div>
    <!-- Conteúdo do memorial -->
</div>

// 2. JavaScript: Função para atualizar memorial com valores atuais
function atualizarMemorialComValores() {
    // Obter valores atuais dos cálculos
    const valor1 = parseFloat(input1.value) || 0;
    const valor2 = parseFloat(input2.value) || 0;
    
    // Atualizar exemplos dinâmicos
    document.getElementById('memorial-exemplo-1').textContent = 
        `${valor1} × ${valor2} = ${valor1 * valor2}`;
    
    // Atualizar resumo dos resultados
    document.getElementById('memorial-resumo').innerHTML = 
        `<p>Resultado: ${formatarNumero(valor1 * valor2, 2)}</p>`;
}

// 3. Toggle do memorial
function toggleMemorial() {
    const memorialSection = document.getElementById('memorialSection');
    const resultadosSection = document.getElementById('resultadosSection');
    
    if (memorialSection.style.display === 'none' || memorialSection.style.display === '') {
        atualizarMemorialComValores(); // Atualizar antes de mostrar
        memorialSection.style.display = 'block';
        if (resultadosSection) resultadosSection.style.display = 'none';
    } else {
        memorialSection.style.display = 'none';
        if (resultadosSection) resultadosSection.style.display = 'block';
    }
}
```

O memorial deve explicar:
- ✅ **Fórmulas utilizadas** — Todas as fórmulas matemáticas e físicas
- ✅ **Valores de referência** — Constantes físicas, fatores de segurança
- ✅ **Leis físicas** — Explicações leigas (Lei de Ohm, conservação de energia, etc.)
- ✅ **Exemplos práticos** — Cálculos passo a passo com valores atuais
- ✅ **Resumo dos resultados** — Valores calculados organizados

### 5. Ícones de Informação Padronizados

**SEMPRE** adicione ícones de informação (ℹ️) em controles de entrada importantes:

```html
<!-- Estrutura HTML padrão -->
<div class="grupo-entrada">
    <div class="cabecalho-controle">
        <label for="sliderExemplo" data-i18n="label-exemplo">Exemplo</label>
        <span class="info-icon" id="infoIconExemplo" role="button" tabindex="0" aria-label="Informação sobre exemplo" title="Clique para mais informações">
            <span class="info-icon-symbol">ℹ️</span>
        </span>
        <input type="text" id="inputExemplo" class="valor-display valor-input" value="100">
    </div>
    <!-- Descrição que aparece/desaparece ao clicar no ícone -->
    <div class="descricao-info" id="descricaoExemplo" style="display: none;">
        <span data-i18n="tooltip-exemplo-texto">Descrição detalhada do que este controle faz e como é usado nos cálculos.</span>
    </div>
    <div class="slider-com-botoes">
        <!-- slider aqui -->
    </div>
</div>
```

```javascript
// Inicialização no DOMContentLoaded
if (typeof inicializarIconeInfo === 'function') {
    inicializarIconeInfo('infoIconExemplo', 'descricaoExemplo');
}
```

```javascript
// Traduções (adicionar em pt-BR e it-IT)
'tooltip-exemplo-texto': 'Descrição detalhada do que este controle faz e como é usado nos cálculos.',
```

**Padrão Visual:**
- Ícone aparece ao lado do label, antes do input
- Descrição aparece abaixo do label, acima do slider
- Descrição é discreta (fonte menor, cor suave)
- Espaçamento adequado para evitar toques indesejados

### 6. Sliders e Inputs

**SEMPRE** sincronize sliders com inputs e vice-versa:

```javascript
// Sincronizar slider → input
slider.addEventListener('input', (e) => {
    input.value = formatarNumero(parseFloat(e.target.value), 2);
    atualizarResultados();
});

// Sincronizar input → slider
input.addEventListener('input', (e) => {
    const valor = converterValorFormatadoParaNumero(e.target.value);
    if (valor >= slider.min && valor <= slider.max) {
        slider.value = valor;
        atualizarResultados();
    }
});
```

**Use** aceleração exponencial para botões de slider:

```javascript
// Configurar botões de seta com aceleração
configurarBotoesSliderComAceleracao(document.querySelector('.slider-container'));
```

### 7. Performance

**SEMPRE** use throttling/debouncing para eventos frequentes:

```javascript
// Throttle para sliders (executa no máximo a cada 100ms)
let throttleTimeout;
slider.addEventListener('input', (e) => {
    if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
            atualizarResultados();
            throttleTimeout = null;
        }, 100);
    }
});

// Debounce para inputs (executa após 300ms sem digitação)
let debounceTimeout;
input.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        atualizarResultados();
    }, 300);
});
```

### 8. Cache-Busting

**SEMPRE** use versões nos links CSS/JS:

```html
<link rel="stylesheet" href="app-styles.css?v=1.0.0">
<script src="app-script.js?v=1.0.0"></script>
```

**Incremente** a versão quando atualizar arquivos CSS/JS.

## 🔢 Constantes e Valores de Referência

### Constantes Físicas

- **Resistividade do Cobre**: `0.0175 Ω·mm²/m` (a 20°C)
- **HSP (Horas de Sol Pleno)**: `5 horas/dia` (padrão Brasil)
- **Eficiência do Sistema Solar**: `80%` (20% de perdas)
- **Fator de Pico de Consumo**: `5.0` (pico = 5× consumo médio)
- **Calor Específico da Água**: `1.163 Wh/kg°C`
- **Densidade da Água**: `1.0 kg/L`

### Constantes de Cálculo

- **BTU por m²**: `700 BTU/m²` (Ar Condicionado)
- **BTU por pessoa**: `600 BTU/pessoa`
- **BTU por equipamento**: `600 BTU/equipamento`
- **Constante de Conversão Hélice**: `1056` (para cálculo de passo)
- **Slip padrão hélice**: `15%` (10-20% típico)

### Fatores de Segurança

- **Fator de Segurança Bitola**: `1.25` (25% de margem)
- **Fator de Segurança Solar**: `1.2` (20% de margem)
- **Fator de Estratificação Boiler**: `0.65` (65% do volume útil)

## 🧪 Testes

**SEMPRE** teste os cálculos com valores conhecidos:

1. Verifique fórmulas com exemplos manuais
2. Teste limites (valores mínimos e máximos)
3. Valide conversões de unidades
4. Verifique formatação de números e moedas
5. Teste troca de idioma

## 📚 Documentação

### Arquivos de Documentação

- **`README.md`** — Documentação principal do projeto
- **`REVISAO_APPS.md`** — Revisão técnica de cada app
- **`GLOSSARIO.md`** — Glossário de termos técnicos
- **`SEO-INSTRUCTIONS.md`** — Instruções de SEO
- **`.github/copilot-instructions.md`** — Este arquivo

### Atualizar Documentação

**SEMPRE** atualize a documentação quando:
- Adicionar novo app
- Modificar fórmulas ou constantes
- Adicionar novas funcionalidades
- Corrigir bugs importantes

## 🚫 O que NÃO fazer

- ❌ **NÃO** use frameworks (React, Vue, Angular, etc.)
- ❌ **NÃO** use bibliotecas externas além de Chart.js (via CDN)
- ❌ **NÃO** use `console.log` em produção (remova antes de commit)
- ❌ **NÃO** deixe código comentado sem explicação
- ❌ **NÃO** use valores mágicos (sempre defina constantes)
- ❌ **NÃO** ignore a internacionalização (sempre implemente PT/IT)
- ❌ **NÃO** esqueça de atualizar o memorial de cálculo

## ✅ Checklist para Novos Apps

- [ ] Criar 3 arquivos: `.html`, `-script.js`, `-styles.css`
- [ ] Incluir `site-config.js` no HTML
- [ ] Implementar internacionalização (PT/IT)
- [ ] Criar memorial de cálculo completo
- [ ] Adicionar ícones de informação padronizados em controles importantes
- [ ] Sincronizar sliders com inputs
- [ ] Usar funções de formatação de `site-config.js`
- [ ] Adicionar throttling/debouncing
- [ ] Configurar aceleração exponencial para botões
- [ ] Adicionar ao `index.html` e `sobre/sobre.html`
- [ ] Atualizar `README.md` e `REVISAO_APPS.md`
- [ ] Testar cálculos com valores conhecidos
- [ ] Verificar responsividade mobile
- [ ] Adicionar cache-busting (`?v=X.Y.Z`)

## 🔍 Exemplos de Código

### Exemplo 1: App Básico com Memorial

```javascript
// 1. Configuração inicial
const SITE_LS = SiteConfig.LOCAL_STORAGE;
let idiomaAtual = localStorage.getItem(SITE_LS.LANGUAGE_KEY) || SiteConfig.DEFAULTS.language;

// 2. Traduções
const traducoes = {
    'pt-BR': { 'titulo': 'Título', 'calcular': 'Calcular' },
    'it-IT': { 'titulo': 'Titolo', 'calcular': 'Calcola' }
};

// 3. Função principal
function calcular() {
    const valor = parseFloat(document.getElementById('input').value) || 0;
    const resultado = valor * 2;
    
    document.getElementById('resultado').textContent = 
        formatarNumero(resultado, 2);
}

// 4. Memorial
function atualizarMemorialComValores() {
    const valor = parseFloat(document.getElementById('input').value) || 0;
    document.getElementById('memorial-exemplo').textContent = 
        `${formatarNumero(valor, 2)} × 2 = ${formatarNumero(valor * 2, 2)}`;
}
```

### Exemplo 2: Slider com Input Sincronizado

```javascript
const slider = document.getElementById('slider');
const input = document.getElementById('input');

// Slider → Input
slider.addEventListener('input', (e) => {
    input.value = formatarNumero(parseFloat(e.target.value), 2);
    calcular();
});

// Input → Slider
input.addEventListener('input', (e) => {
    const valor = converterValorFormatadoParaNumero(e.target.value);
    if (valor >= slider.min && valor <= slider.max) {
        slider.value = valor;
        calcular();
    }
});
```

## 📞 Referências

- **Site Online**: https://engnata.infinityfree.me
- **Domínio**: https://engnata.eu (redireciona para infinityfree.me)
- **Documentação Completa**: Ver `README.md`

---

**Última atualização**: Janeiro 2025

**Mantido por**: Engenharia NATA
