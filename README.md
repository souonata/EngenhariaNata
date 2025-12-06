# 📱 Portfólio Engenharia NATA

Portfólio web com simulador mobile e sistema bilíngue (PT-BR/IT-IT).

## 🎯 Visão Geral

Portfólio de apps web usando HTML5, CSS3 e JavaScript puro. Sem frameworks.

## 🚀 Aplicativos Disponíveis

### 💰 Mutuo
Calculadora de empréstimos com 3 sistemas de amortização (SAC, Price, Americano). Bilíngue PT-BR/IT-IT com gráficos Chart.js.

### 🚤 Helice
Calculadora de passo de hélice para barcos de lazer. Calcula passo ideal, RPM na hélice e velocidade teórica considerando slip e redução.

### ☀️ Solar
Dimensionamento de sistemas fotovoltaicos off-grid. Calcula quantidade de painéis, baterias (AGM ou LiFePO₄), inversor e custo estimado. Considera autonomia, vida útil desejada e DoD (profundidade de descarga). Página de configuração para customizar preços de componentes.

### 📖 Sobre mim
Informações sobre o projeto e tecnologias utilizadas.

## 📂 Estrutura do Projeto

```
├── index.html                   (Tela inicial - simulador mobile)
├── index-script.js              (Lógica da tela inicial)
├── index-styles.css             (Estilos da tela inicial)
├── README.md                    (Este arquivo)
├── GLOSSARIO.md                 (Glossário técnico)
├── .github/
│   └── copilot-instructions.md  (Instruções para o Copilot)
├── mutuo/                       (Calculadora de empréstimos)
│   ├── mutuo.html
│   ├── mutuo-script.js
│   └── mutuo-styles.css
├── helice/                      (Calculadora de hélice)
│   ├── helice.html
│   ├── helice-script.js
│   └── helice-styles.css
├── solar/                       (Dimensionamento solar)
│   ├── solar.html
│   ├── solar-script.js
│   ├── solar-styles.css
│   ├── config.html              (Configuração de preços)
│   └── config-script.js
└── sobre/                       (Sobre o projeto)
    ├── sobre.html
    ├── sobre-script.js
    └── sobre-styles.css
```

## 🛠️ Como Usar

### Abrir Localmente
```powershell
# PowerShell (Windows)
Start-Process "index.html"
```

### Live Server (Recomendado)
1. Instale a extensão "Live Server" no VS Code
2. Clique com botão direito em `index.html`
3. Selecione "Open with Live Server"

## 🌍 Idiomas

Português (padrão) e Italiano. Troca automática de moeda (R$ ↔ €).

## 🔧 Tecnologias

- **HTML5** - Estrutura semântica
- **CSS3** - Estilos, animações, gradientes, responsividade
- **JavaScript Puro** - Sem frameworks ou bibliotecas (exceto Chart.js)
- **Chart.js** - Gráficos interativos (apenas no Mutuo)
- **localStorage** - Persistência de idioma e configurações

## 📚 Documentação

- **[sobre/](sobre/)** - Informações sobre o projeto
- **[GLOSSARIO.md](GLOSSARIO.md)** - Termos técnicos em português

## 🤝 Contribuindo

Projeto open source. Sinta-se livre para explorar, modificar e aprender.

## 👨‍💻 Autor

**Engenharia NATA** - Portfólio web educacional
