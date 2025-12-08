# Engenharia NATA — Portfólio de Apps Web

Uma coleção de aplicativos web educativos para estudar conceitos práticos de engenharia e finanças, desenvolvidos com JavaScript puro, sem frameworks.

## 📱 Aplicativos Disponíveis

- **💰 Mutuo** — Calculadora de empréstimos (SAC, Price, Americano) com gráficos interativos e tabela de amortização completa.
- **🚤 Helice** — Calculadora de passo de hélice para barcos de lazer, com análise de slip e gráficos de relação velocidade × passo.
- **🔋 Energia Solar** — Dimensionamento fotovoltaico off-grid (painéis, baterias AGM/LiFePO4, inversor) com página de configuração personalizável e memorial de cálculo didático.
- **🔌 Bitola** — Calculadora de bitola de fios elétricos para circuitos CC e CA, com seleção automática de bitola comercial padrão brasileiro.
- **❄️ Ar Condicionado** — Dimensionador de ar condicionado com cálculo de BTU baseado em área, altura, número de pessoas e condições ambientais.
- **☀️ Aquecedor Solar** — Dimensionador completo de sistemas de aquecimento solar térmico (coletores, boiler, potência) para água de consumo e aquecimento ambiente.
- **🌾 Fazenda** — Planejador de fazenda auto-sustentável com cálculo de espaço, quantidade de plantas e animais, calendário de plantio/colheita e frequência de reprodução.

## 🎯 Características Principais

- **100% JavaScript Puro** — Sem frameworks, fácil de entender e modificar
- **Código Completamente Comentado** — Cada linha explicada em português para aprendizado
- **Bilíngue** — Português (pt-BR) e Italiano (it-IT) com troca instantânea
- **Mobile-First** — Design responsivo que funciona perfeitamente em celular, tablet e desktop
- **Educacional** — Focado em ensinar conceitos práticos através de código bem documentado
- **Configuração Global Centralizada** — Funções e configurações compartilhadas em `assets/js/site-config.js`

## 🌐 Site Online

O site está disponível online em:
- **https://engnata.infinityfree.me** (endereço de hosting principal)

**Nota:** O domínio `engnata.eu` redireciona para `engnata.infinityfree.me`. Ambos os endereços funcionam.

## 🚀 Como Usar

1. **Acesse o site** em https://engnata.infinityfree.me ou abra `index.html` localmente no seu navegador.
2. **Escolha o app** que quer testar na tela inicial.
3. **Troque o idioma** usando o seletor no topo (PT 🇧🇷 / IT 🇮🇹).

## 📁 Estrutura do Projeto

```
EngenhariaNata/
├── assets/
│   ├── css/
│   │   ├── shared-styles.css      # Estilos compartilhados entre todos os apps
│   │   └── controls-styles.css    # Estilos para controles (sliders, inputs, etc)
│   └── js/
│       └── site-config.js         # ⭐ Configuração global e funções compartilhadas
├── helice/                        # App Calculadora de Hélice
├── bitola/                        # App Calculadora de Bitola
├── mutuo/                         # App Calculadora de Empréstimos
├── solar/                         # App Energia Solar
│   └── config.html                # Página de configuração do app Solar
├── arcondicionado/                # App Ar Condicionado
├── aquecimento/                   # App Aquecedor Solar
├── fazenda/                       # App Fazenda
├── sobre/                         # Página "Sobre o Projeto"
├── index.html                     # Página inicial
├── README.md                      # Este arquivo
├── sitemap.xml                    # Mapa do site para SEO
└── robots.txt                     # Instruções para bots de busca
```

## ⚙️ Configuração Global (`assets/js/site-config.js`)

O arquivo `site-config.js` centraliza todas as configurações e funções utilitárias compartilhadas entre os apps:

### Configurações Disponíveis

- **`SiteConfig.LOCAL_STORAGE`** — Chaves do localStorage (idioma, configurações)
- **`SiteConfig.DEFAULTS`** — Valores padrão (idioma, taxas, limites)
- **`SiteConfig.SELECTORS`** — Seletores CSS padronizados
- **`SiteConfig.ASSETS`** — Caminhos de recursos (CSS, JS, CDNs)
- **`SiteConfig.UI`** — Configurações de interface (tamanhos, espaçamentos)
- **`SiteConfig.FORMATTING`** — Configurações de formatação de números
- **`SiteConfig.CURRENCY`** — Configurações de moeda (BRL, EUR)

### Funções Globais Disponíveis

#### Formatação de Números
- `formatarNumero(valor, casasDecimais)` — Formata número com separadores (padrão: 0 decimais)
- `formatarNumeroDecimal(valor, casasDecimais)` — Formata número com casas decimais (padrão: 1 decimal)
- `formatarNumeroBR(valor, casasDecimais)` — Alias para `formatarNumero` (compatibilidade)
- `formatarNumeroCompacto(valor)` — Formata números grandes com abreviações (k, M)

#### Conversão de Valores
- `converterValorFormatadoParaNumero(valorFormatado)` — Converte string formatada para número
- `obterValorNumericoFormatado(valorFormatado)` — Versão simplificada da conversão

#### Formatação de Potência
- `formatarPotencia(valor)` — Formata potência com "k" para valores >= 1000 (ex: "1,5k")
- `formatarPotenciaWkW(valor_W)` — Formata potência em W ou kW (ex: "999 W" ou "2,5 kW")

#### Formatação de Moeda
- `formatarMoeda(valor, idioma)` — Formata valor como moeda (R$ ou €) com 2 decimais
- `formatarMoedaSemDecimal(valor, idioma)` — Formata valor como moeda sem decimais

#### Utilitários de Interface
- `ajustarTamanhoInput(input, folgaCaracteres)` — Ajusta largura de input dinamicamente
- `obterIdiomaAtual()` — Obtém idioma atual do localStorage
- `obterMoedaPorIdioma(idioma)` — Obtém código da moeda (BRL/EUR) por idioma
- `obterSimboloMoeda(idioma)` — Obtém símbolo da moeda (R$/€) por idioma

### Exemplo de Uso

```javascript
// Usar configurações
const idioma = SiteConfig.DEFAULTS.language;
const chaveIdioma = SiteConfig.LOCAL_STORAGE.LANGUAGE_KEY;

// Usar funções de formatação
const valorFormatado = formatarNumero(1234.56, 2); // "1.234,56"
const potencia = formatarPotenciaWkW(2500); // "2,5 kW"
const moeda = formatarMoeda(1234.56, 'pt-BR'); // "R$ 1.234,56"

// Converter valor formatado para número
const numero = converterValorFormatadoParaNumero("1.234,56"); // 1234.56
```

## ⚙️ Configurações do App Solar

A página `solar/config.html` permite ajustar:
- Potência e preço dos painéis solares
- Tensão, capacidade (kWh/Ah), preço e peso das baterias (AGM e LiFePO4)
- Limites: peso máximo de 180 kg por bateria, inversor mínimo de 1 kW

As configurações são salvas automaticamente em `localStorage` sob a chave `configSolar`.

O app Energia Solar inclui um **Memorial de Cálculo** completo (botão "SAIBA MAIS!") que explica passo a passo como são calculados todos os componentes do sistema, com fórmulas, exemplos práticos e resumo dos cálculos atuais.

## 📚 Documentação

- **`GLOSSARIO.md`** — Glossário completo com termos técnicos explicados de forma simples
- **`sobre/sobre.html`** — Informações detalhadas sobre cada app e tecnologias usadas
- **`sitemap.xml`** — Mapa do site para indexação em mecanismos de busca
- **`robots.txt`** — Instruções para bots de busca
- **`REVISAO_APPS.md`** — Revisão técnica dos cálculos e memoriais de cada app

## 💡 Para Estudantes

Este projeto foi desenvolvido com foco educacional. Todo o código está **completamente comentado em português**, explicando:
- Como funcionam os algoritmos (fórmulas financeiras, cálculos de hélice, dimensionamento solar)
- Por que cada decisão foi tomada
- Conceitos de programação web (DOM, eventos, localStorage, i18n)
- Padrões de código e organização de projetos

Ideal para quem está aprendendo JavaScript, HTML e CSS e quer ver exemplos práticos e bem documentados.

## 🛠️ Tecnologias

- **HTML5** — Estrutura semântica
- **CSS3** — Estilos modernos com animações e gradientes
- **JavaScript ES6+** — Lógica pura, sem dependências
- **Chart.js** — Gráficos interativos (CDN)
- **localStorage** — Persistência de preferências do usuário

## 🔧 Desenvolvimento

### Padrões de Código

- **Formatação de Números**: Sempre use as funções globais de `site-config.js` para garantir consistência
- **Idioma**: Use `obterIdiomaAtual()` para obter o idioma atual
- **Moeda**: Use `formatarMoeda()` ou `formatarMoedaSemDecimal()` com o idioma como parâmetro
- **Inputs Dinâmicos**: Use `ajustarTamanhoInput()` para inputs que precisam ajustar tamanho automaticamente

### Adicionando um Novo App

1. Crie uma pasta para o app (ex: `meuapp/`)
2. Crie os arquivos: `meuapp.html`, `meuapp-script.js`, `meuapp-styles.css`
3. Inclua `assets/js/site-config.js` no HTML antes do script do app
4. Use as funções globais de formatação e configuração
5. Adicione o app ao `index.html` e `sobre/sobre.html`

---

**Este README foi mantido conciso e direto — para mais detalhes, consulte os arquivos de documentação mencionados acima.**
