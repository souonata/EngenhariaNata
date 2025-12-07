# Engenharia NATA — Portfólio de Apps Web

Uma pequena coleção de apps web educativos para estudar conceitos práticos de engenharia e finanças:

- **💰 Mutuo** — Calculadora de empréstimos (SAC, Price, Americano) com gráficos interativos e tabela de amortização completa.
- **🚤 Helice** — Calculadora de passo de hélice para barcos de lazer, com análise de slip e gráficos de relação velocidade × passo.
- **☀️ Solar** — Dimensionamento fotovoltaico off-grid (painéis, baterias AGM/LiFePO4, inversor) com página de configuração personalizável.

## 🎯 Características Principais

- **100% JavaScript Puro** — Sem frameworks, fácil de entender e modificar
- **Código Completamente Comentado** — Cada linha explicada em português para aprendizado
- **Bilíngue** — Português (pt-BR) e Italiano (it-IT) com troca instantânea
- **Mobile-First** — Design responsivo que funciona perfeitamente em celular, tablet e desktop
- **Educacional** — Focado em ensinar conceitos práticos através de código bem documentado

## 🚀 Como Usar

1. **Abra `index.html`** no seu navegador (clique duas vezes) ou use Live Server no VS Code.
2. **Escolha o app** que quer testar na tela inicial.
3. **Troque o idioma** usando o seletor no topo (Português 🇧🇷 / Italiano 🇮🇹).

## ⚙️ Configurações do Solar

A página `solar/config.html` permite ajustar:
- Potência e preço dos painéis solares
- Tensão, capacidade (kWh/Ah), preço e peso das baterias (AGM e LiFePO4)
- Limites: peso máximo de 180 kg por bateria, inversor mínimo de 1 kW

As configurações são salvas automaticamente em `localStorage` sob a chave `configSolar`.

## 📚 Documentação

- **`GLOSSARIO.md`** — Glossário completo com termos técnicos explicados de forma simples
- **`sobre/sobre.html`** — Informações detalhadas sobre cada app e tecnologias usadas
- **`.github/copilot-instructions.md`** — Documentação técnica completa para desenvolvedores

## 💡 Para Estudantes

Este projeto foi desenvolvido com foco educacional. Todo o código está **completamente comentado em português**, explicando:
- Como funcionam os algoritmos (fórmulas financeiras, cálculos de hélice, dimensionamento solar)
- Por que cada decisão foi tomada
- Conceitos de programação web (DOM, eventos, localStorage, i18n)

Ideal para quem está aprendendo JavaScript, HTML e CSS e quer ver exemplos práticos e bem documentados.

## 🛠️ Tecnologias

- **HTML5** — Estrutura semântica
- **CSS3** — Estilos modernos com animações e gradientes
- **JavaScript ES6+** — Lógica pura, sem dependências
- **Chart.js** — Gráficos interativos (CDN)
- **localStorage** — Persistência de preferências do usuário

---

**Este README foi mantido conciso e direto — para mais detalhes, consulte os arquivos de documentação mencionados acima.**
