# Glossário Completo — Termos Técnicos Explicados

Este glossário ajuda visitantes não técnicos e estudantes a entender os termos usados no projeto.

## 🔋 Energia e Eletricidade

- **kWh (quilo-watt-hora)** — Unidade de energia usada para medir capacidade de baterias e consumo elétrico. Exemplo: uma bateria de 4.8 kWh pode fornecer 4.8 kW por 1 hora, ou 1 kW por 4.8 horas.
- **W (Watt)** — Unidade de potência. Exemplo: um painel solar de 400W pode gerar até 400 watts de energia quando exposto ao sol.
- **kW (quilowatt)** — 1000 watts. Usado para medir potência de inversores e sistemas maiores.
- **Ah (Ampère-hora)** — Unidade de capacidade de bateria. Pode ser convertida para kWh multiplicando pela tensão: kWh = (V × Ah) / 1000. Exemplo: 48V × 100Ah = 4.8 kWh.
- **CC (Corrente Contínua)** — Tipo de corrente elétrica onde o fluxo de elétrons é constante em uma direção. Usada em baterias, painéis solares e sistemas de baixa tensão (12V, 24V, 48V).
- **CA (Corrente Alternada)** — Tipo de corrente elétrica onde o fluxo de elétrons inverte direção periodicamente. Usada na rede elétrica residencial (110V, 220V).
- **Bitola de Fio** — Área de seção transversal do condutor elétrico, medida em milímetros quadrados (mm²). Determina a capacidade de corrente que o fio pode transportar.
- **Queda de Tensão** — Redução da tensão elétrica ao longo do circuito devido à resistência do condutor. Em projetos residenciais no Brasil, recomenda-se máximo de 4% de queda.
- **Resistividade do Cobre** — Propriedade do cobre que determina sua resistência elétrica. Valor padrão: 0.0175 Ω·mm²/m a 20°C.
- **Bitola Comercial** — Valores padronizados de bitolas disponíveis no mercado brasileiro conforme norma NBR 5410: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm².

## ☀️ Energia Solar

- **Painel Solar (Fotovoltaico)** — Dispositivo que converte luz do sol em eletricidade. Tem potência medida em watts (ex.: 400W, 500W).
- **HSP (Horas de Sol Pleno)** — Número médio de horas por dia que o sol fornece energia equivalente ao pico. No projeto, usamos 5 horas como padrão.
- **Inversor** — Equipamento que transforma tensão CC (Corrente Contínua, da bateria) em CA (Corrente Alternada, da tomada de casa). Medido em kW.
- **Autonomia** — Quantos dias a bateria pode alimentar o consumo sem receber carga do sol. Exemplo: 3 dias de autonomia significa que o sistema funciona por 3 dias sem sol.
- **DoD (Depth of Discharge - Profundidade de Descarga)** — Percentual da capacidade da bateria que é utilizada. Exemplo: DoD de 50% significa usar apenas metade da capacidade. Menor DoD = maior vida útil da bateria.
- **Eficiência do Sistema** — Percentual de energia que realmente chega ao consumo após perdas (cabos, controlador, inversor). No projeto, usamos 80% (20% de perdas).

## 🔋 Baterias

- **AGM (Absorbed Glass Mat)** — Tipo de bateria de chumbo-ácido onde o eletrólito é absorvido em um tapete de fibra de vidro. Mais barata, mas com menos ciclos de vida.
- **LiFePO4 (Lítio Ferro Fosfato)** — Tipo de bateria de lítio mais segura e durável. Muito mais ciclos de vida que AGM, mas mais cara.
- **Ciclos de Vida** — Número de vezes que uma bateria pode ser carregada e descarregada antes de perder capacidade significativa. LiFePO4: ~5000-10000 ciclos. AGM: ~500-1500 ciclos.
- **Tensão (V)** — Voltagem da bateria. Comum: 12V, 24V, 48V. Baterias podem ser conectadas em série (soma tensão) ou paralelo (soma capacidade).

## 💰 Finanças e Empréstimos

- **SAC (Sistema de Amortização Constante)** — Sistema onde a amortização é fixa e as parcelas diminuem ao longo do tempo. Comum em financiamento imobiliário no Brasil.
- **Price (Tabela Price)** — Sistema onde as parcelas são fixas do início ao fim. Mais comum em empréstimos pessoais. Também chamado de "Sistema Francês".
- **Americano (Alemão)** — Sistema onde se paga apenas juros durante o período e o principal é pago integralmente na última parcela. Raro no Brasil.
- **Amortização** — Parte da parcela que reduz o valor emprestado (dívida).
- **Juros** — Custo do empréstimo, calculado sobre o saldo devedor restante.
- **Saldo Devedor** — Valor que ainda falta pagar do empréstimo.

## 🚤 Náutica

- **Passo da Hélice** — Distância teórica (em polegadas) que a hélice avançaria em uma rotação completa, sem considerar deslizamento.
- **Slip (Deslizamento)** — Percentual de perda de eficiência da hélice na água. Barcos de lazer típicos têm 10-20% de slip.
- **RPM (Rotações Por Minuto)** — Velocidade de rotação do motor ou da hélice.
- **Redução da Rabeta** — Relação entre a rotação do motor e a rotação da hélice. Exemplo: 2:1 significa que o motor gira 2 vezes para a hélice girar 1 vez.
- **Nós (knots)** — Unidade de velocidade náutica. 1 nó = 1.852 km/h.

## ❄️ Climatização

- **BTU (British Thermal Unit)** — Unidade de capacidade de refrigeração/aquecimento. Usada para dimensionar ar condicionado. 1 BTU/h ≈ 0,293 W.
- **Capacidade de Ar Condicionado** — Potência de refrigeração necessária para manter o ambiente na temperatura desejada, medida em BTU/h.

## 🌾 Agricultura e Fazenda Auto-Sustentável

- **Produção por m²/ano** — Quantidade de alimento (em kg) que pode ser produzida em um metro quadrado por ano. Varia conforme o tipo de planta.
- **Ciclo de Plantio** — Tempo (em dias) desde o plantio até a colheita. Usado para calcular frequência de plantio para manter produção contínua.
- **Frequência de Plantio** — Intervalo entre plantios sucessivos para manter produção contínua. Calculado como metade do ciclo para garantir sobreposição.
- **Época de Plantio** — Período do ano mais adequado para plantar cada tipo de cultura (ex.: Primavera, Verão, Ano todo).
- **Época de Colheita** — Período do ano em que a colheita ocorre, baseado no ciclo e época de plantio.
- **Consumo por Pessoa** — Quantidade média de alimento (kg/ano) consumida por pessoa. Usado para calcular produção necessária.
- **Espaço por Animal** — Área mínima (m²) necessária para cada animal, considerando bem-estar e manejo adequado.
- **Ciclo Reprodutivo** — Tempo (em dias) entre reproduções de animais. Usado para calcular frequência de reprodução.
- **Produção Diária** — Quantidade de produto (ovos, leite) produzida por animal por dia.
- **Produção por Ciclo** — Quantidade de produto (carne) obtida por animal em um ciclo completo (cria até abate).
- **Tempo de Crescimento** — Período (em dias) desde o nascimento até o animal começar a produzir ou estar pronto para abate.
- **Auto-Sustentabilidade** — Capacidade de uma fazenda produzir todos os alimentos necessários para uma família sem depender de fontes externas.

## ☀️ Energia Solar Térmica

- **Coletor Solar Térmico** — Dispositivo que capta energia solar para aquecer água ou fluido. Diferente de painel fotovoltaico (que gera eletricidade).
- **Boiler (Acumulador)** — Tanque que armazena água quente aquecida pelos coletores solares. Volume medido em litros (L).
- **Eficiência do Coletor (η)** — Percentual de energia solar captada que é convertida em calor útil. Depende da eficiência ótica e das perdas térmicas.
- **Classe Energética** — Classificação de eficiência energética de edificações (A4, A3, A2, A1, B, C, D, E, F, G). A4 é a mais eficiente. Medida em kWh/m²·ano.
- **Consumo Específico** — Consumo de energia por metro quadrado por ano (kWh/m²·ano). Usado para classificar a eficiência energética de edificações.
- **Dias de Autonomia** — Número de dias que o sistema deve manter a casa aquecida ou água quente disponível sem receber energia solar.
- **Temperatura de Conforto** — Temperatura ambiente desejada para aquecimento. Padrão: 22°C.
- **Período de Aquecimento** — Número de dias do ano em que o aquecimento é necessário. Padrão: 150 dias (inverno).

## 💻 Programação Web

- **localStorage** — Pequena área de armazenamento no navegador que persiste dados entre sessões. O projeto usa:
  - `idiomaPreferido` — Guarda o idioma escolhido (pt-BR ou it-IT)
  - `configSolar` — Guarda as configurações personalizadas do app Solar
- **Slider** — Controle deslizante na interface para ajustar valores (ex.: consumo, autonomia, velocidade).
- **i18n (Internacionalização)** — Sistema para traduzir aplicações para múltiplos idiomas. No projeto, implementado com atributos `data-i18n` e dicionários JavaScript.
- **DOM (Document Object Model)** — Representação da estrutura HTML em JavaScript, permitindo manipular elementos da página.
- **Event Listener** — Função que "escuta" eventos do usuário (cliques, mudanças de slider, etc.) e executa código em resposta.

## 📝 Funções JavaScript Comuns

- **`window`** — Objeto global que representa a janela do navegador
- **`console`** — Ferramenta de debug para exibir mensagens no console do navegador
- **`addEventListener`** — Método para adicionar um "ouvinte" de eventos (ex.: clique, mudança de valor)
- **`querySelector`** — Método para buscar um elemento HTML usando seletor CSS
- **`querySelectorAll`** — Método para buscar todos os elementos que correspondem a um seletor CSS
- **`getElementById`** — Método para buscar um elemento HTML pelo seu ID
- **`localStorage.getItem()`** — Lê um valor salvo no armazenamento local do navegador
- **`localStorage.setItem()`** — Salva um valor no armazenamento local do navegador
- **`toLocaleString()`** — Formata números de acordo com o idioma (ex.: 1000 → "1.000" em pt-BR)
- **`parseFloat()`** — Converte uma string em número decimal
- **`parseInt()`** — Converte uma string em número inteiro
- **`Math.ceil()`** — Arredonda um número para cima (ex.: 2.3 → 3)
- **`Math.round()`** — Arredonda um número para o inteiro mais próximo (ex.: 2.5 → 3)
- **`Math.max()`** — Retorna o maior valor entre os argumentos
- **`Math.min()`** — Retorna o menor valor entre os argumentos

### HTML
- `<div>` = divisão (caixa genérica)
- `<span>` = espaço (texto inline)
- `<button>` = botão
- `<input>` = entrada
- `<a>` = âncora (link)
- `<img>` = imagem
- `<svg>` = gráfico vetorial
- `<header>` = cabeçalho
- `<footer>` = rodapé
- `<section>` = seção
- `<article>` = artigo
- `<nav>` = navegação
- `<main>` = conteúdo principal
- `<aside>` = conteúdo lateral

### CSS

- **`:hover`** — Estilo aplicado quando o mouse passa sobre o elemento
- **`:active`** — Estilo aplicado quando o elemento está sendo clicado
- **`:focus`** — Estilo aplicado quando o elemento está focado (selecionado, ex.: campo de input)
- **`@media`** — Regra CSS para aplicar estilos diferentes baseado no tamanho da tela (responsividade)
- **`@keyframes`** — Define uma animação CSS que pode ser aplicada a elementos
- **`linear-gradient()`** — Cria um gradiente linear (transição suave entre cores)
- **`rgba()`** — Define uma cor com transparência (Red, Green, Blue, Alpha). Exemplo: `rgba(0, 0, 0, 0.5)` = preto com 50% de opacidade
- **`flexbox`** — Sistema de layout CSS para organizar elementos em linhas ou colunas
- **`grid`** — Sistema de layout CSS para criar grades bidimensionais
- **`position: fixed`** — Posiciona o elemento fixo na tela, não rola com a página
- **`transform: translateX(-50%)`** — Move o elemento horizontalmente (usado para centralizar)

---

## 🎯 **Conceitos Importantes**

### Mobile-First
Estratégia de design que começa pelo celular e depois adapta para telas maiores.

### Responsividade
Capacidade de um site se adaptar a diferentes tamanhos de tela (celular, tablet, desktop).

### Cache Busting
Técnica para forçar o navegador a baixar arquivos atualizados usando `?v=X.X.X` — incremente o número quando modificar CSS/JS.

### i18n (Internacionalização)
Sistema para traduzir aplicações para múltiplos idiomas.

### Sistema de Amortização
Método de pagamento de empréstimos:
- **SAC**: Amortização constante, parcelas decrescentes
- **Price**: Parcelas fixas (mais comum)
- **Americano**: Só juros + principal no final

---

## 📖 **Referências Adicionais**

Para aprender mais, consulte:
- `copilot-instructions.md` - Documentação completa do projeto
- `sobre/` - Visão geral e guias de desenvolvimento
- `<section>` = seção
- `<article>` = artigo

### CSS
- Todas as propriedades CSS são em inglês e não podem ser traduzidas

---

## 💡 **Dica de Ouro: Traduzir ou Não Traduzir?**

Quando você ver uma palavra em inglês no código:

1. **É uma palavra reservada?** (JavaScript: `function`, `const`, `if`, `return` | HTML: `div`, `span`, `button`)
   - ✋ **NÃO MUDE!** A linguagem não vai entender. Essas são palavras-chave da linguagem.

2. **É um nome escolhido pelo programador?** (classes CSS: `.app-icon`, funções: `calcularEmprestimo`, variáveis: `valorEmprestimo`)
   - 👍 **PODE TRADUZIR!** Isso ajuda a entender o código. No projeto, muitos nomes já estão em português.

3. **É uma propriedade ou método nativo?** (ex.: `addEventListener`, `querySelector`, `localStorage`)
   - ✋ **NÃO MUDE!** Esses são métodos da API do navegador/JavaScript.

4. **Na dúvida?** Procure neste glossário ou veja os comentários no código! 📚

## 🎓 **Sobre os Comentários no Código**

Todo o código deste projeto está **completamente comentado em português** para facilitar o aprendizado. Os comentários explicam:
- **O que** cada linha faz
- **Por que** foi implementado dessa forma
- **Como** os algoritmos funcionam (fórmulas, cálculos, etc.)

Isso torna o projeto ideal para estudantes que querem aprender JavaScript, HTML e CSS através de exemplos práticos e bem documentados.

---

## 🎮 **Exercício Prático**

Tente ler este código e traduzir só o que pode:

```javascript
function calcularSoma(primeiroNumero, segundoNumero) {
    const resultado = primeiroNumero + segundoNumero;
    return resultado;
}
```

**Pode traduzir:**
- `calcularSoma` = nome da função (escolhido pelo programador)
- `primeiroNumero` = nome da variável
- `segundoNumero` = nome da variável  
- `resultado` = nome da variável

**NÃO pode traduzir:**
- `function` = palavra reservada do JavaScript
- `const` = palavra reservada do JavaScript
- `return` = palavra reservada do JavaScript

---

✨ **Lembre-se**: Programar é como aprender uma nova língua. Algumas palavras você traduz, outras você aprende o significado em inglês!
