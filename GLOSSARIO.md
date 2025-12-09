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
- **Resistividade do Cobre** — Propriedade do cobre que determina sua resistência elétrica. **Valor de referência usado:** 0.0175 Ω·mm²/m a 20°C. Este valor é uma constante física que representa a resistência elétrica específica do cobre puro.
- **Bitola Comercial** — Valores padronizados de bitolas disponíveis no mercado brasileiro conforme norma NBR 5410: 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240 mm².
- **Lei de Ohm** — Lei física fundamental que relaciona tensão (V), corrente (I) e resistência (R): V = I × R. No app Bitola, usamos esta lei para calcular a queda de tensão: quanto maior a corrente e a resistência do fio, maior a queda de tensão.

## ☀️ Energia Solar

- **Painel Solar (Fotovoltaico)** — Dispositivo que converte luz do sol em eletricidade. Tem potência medida em watts (ex.: 400W, 500W).
- **HSP (Horas de Sol Pleno)** — Número médio de horas por dia que o sol fornece energia equivalente ao pico. **Valor de referência usado:** 5 horas/dia (padrão para Brasil). Este valor representa a média de horas de sol com irradiação máxima (1000 W/m²) que ocorre diariamente.
- **Inversor** — Equipamento que transforma tensão CC (Corrente Contínua, da bateria) em CA (Corrente Alternada, da tomada de casa). Medido em kW.
- **Autonomia** — Quantos dias a bateria pode alimentar o consumo sem receber carga do sol. Exemplo: 3 dias de autonomia significa que o sistema funciona por 3 dias sem sol. **Valor inicial padrão:** 1 dia.
- **DoD (Depth of Discharge - Profundidade de Descarga)** — Percentual da capacidade da bateria que é utilizada. Exemplo: DoD de 50% significa usar apenas metade da capacidade. Menor DoD = maior vida útil da bateria. O DoD é calculado automaticamente baseado na vida útil desejada e tipo de bateria, usando tabelas de ciclos de vida.
- **Eficiência do Sistema** — Percentual de energia que realmente chega ao consumo após perdas (cabos, controlador, inversor). **Valor de referência usado:** 80% (20% de perdas). Este valor considera perdas em cabos DC (2-3%), MPPT (2-5%), inversor (5-10%), baterias (5-10%), temperatura dos painéis (5-10%) e sujeira (2-5%).
- **Fator de Pico de Consumo** — Relação entre consumo médio horário e consumo de pico. **Valor de referência usado:** 5.0 (o consumo de pico é 5 vezes maior que o consumo médio). Usado para dimensionar o inversor, garantindo capacidade para atender picos de consumo (ex.: chuveiro elétrico, forno).
- **Conservação de Energia** — Lei física fundamental: energia não pode ser criada nem destruída, apenas transformada. No dimensionamento solar, garantimos que a energia gerada pelos painéis seja suficiente para atender o consumo, considerando perdas e armazenamento em baterias.

## 🔋 Baterias

- **AGM (Absorbed Glass Mat)** — Tipo de bateria de chumbo-ácido onde o eletrólito é absorvido em um tapete de fibra de vidro. Mais barata, mas com menos ciclos de vida. **Valores padrão:** 12V, 100Ah (1.2 kWh), peso ~30 kg.
- **LiFePO4 (Lítio Ferro Fosfato)** — Tipo de bateria de lítio mais segura e durável. Muito mais ciclos de vida que AGM, mas mais cara. **Valores padrão:** 48V, 100Ah (4.8 kWh), peso ~60 kg. **Valor inicial padrão no app:** bateria de lítio selecionada.
- **Ciclos de Vida** — Número de vezes que uma bateria pode ser carregada e descarregada antes de perder capacidade significativa. LiFePO4: ~5000-10000 ciclos (DoD 25-50%). AGM: ~500-1500 ciclos (DoD 30-50%). O app usa tabelas de ciclos vs DoD para calcular automaticamente o DoD ideal baseado na vida útil desejada.
- **Tensão (V)** — Voltagem da bateria. Comum: 12V, 24V, 48V. Baterias podem ser conectadas em série (soma tensão) ou paralelo (soma capacidade).
- **Vida Útil** — Tempo de vida esperado da bateria em anos. **Valor inicial padrão no app Solar:** 20 anos (para baterias de lítio). O app ajusta automaticamente o DoD para garantir a vida útil desejada.

## 💰 Finanças e Empréstimos

- **SAC (Sistema de Amortização Constante)** — Sistema onde a amortização é fixa e as parcelas diminuem ao longo do tempo. Comum em financiamento imobiliário no Brasil. Na Itália é conhecido como "Ammortamento all'Italiana".
- **Tabela Price (Sistema Francês)** — Sistema onde as parcelas são fixas do início ao fim. Mais comum em empréstimos pessoais no Brasil e em mutui na Itália. Também chamado de "Sistema Francês" ou "Ammortamento alla Francese" na Itália.
- **Sistema Americano (Alemão/Tedesco)** — Sistema onde se paga apenas juros durante o período e o principal é pago integralmente na última parcela. Raro no Brasil. Na Itália é conhecido como "Sistema Tedesco".
- **Amortização** — Parte da parcela que reduz o valor emprestado (dívida).
- **Juros** — Custo do empréstimo, calculado sobre o saldo devedor restante.
- **Saldo Devedor** — Valor que ainda falta pagar do empréstimo.

## 🚤 Náutica

- **Passo da Hélice** — Distância teórica (em polegadas) que a hélice avançaria em uma rotação completa, sem considerar deslizamento.
- **Slip (Deslizamento)** — Percentual de perda de eficiência da hélice na água. Barcos de lazer típicos têm 10-20% de slip. **Valor padrão usado:** 15%. Representa a perda de eficiência devido ao deslizamento da hélice na água.
- **RPM (Rotações Por Minuto)** — Velocidade de rotação do motor ou da hélice.
- **Redução da Rabeta** — Relação entre a rotação do motor e a rotação da hélice. Exemplo: 2:1 significa que o motor gira 2 vezes para a hélice girar 1 vez. Isso aumenta o torque disponível na hélice, melhorando a eficiência de propulsão.
- **Nós (knots)** — Unidade de velocidade náutica. 1 nó = 1.852 km/h.
- **Constante de Conversão 1056** — Constante amplamente utilizada na indústria náutica para converter velocidade em nós para polegadas por minuto, permitindo o cálculo do passo da hélice. Esta constante é uma aproximação prática derivada da conversão de unidades: 1 nó = 1.852 km/h = 1.215.222 pol/min (aproximado para 1056 na prática).
- **Princípios de Propulsão Náutica** — A hélice funciona como uma "rosca" na água: quanto maior o passo, mais distância avança por rotação, mas também requer mais torque. O slip ocorre porque a água não é um meio rígido, então a hélice "desliza" parcialmente, reduzindo a eficiência.

## ❄️ Climatização

- **BTU (British Thermal Unit)** — Unidade de capacidade de refrigeração/aquecimento. Usada para dimensionar ar condicionado. 1 BTU/h ≈ 0,293 W. **Conversão usada:** BTU × 0.000293 = kW.
- **Capacidade de Ar Condicionado** — Potência de refrigeração necessária para manter o ambiente na temperatura desejada, medida em BTU/h.
- **BTU por m²** — **Valor de referência usado:** 700 BTU/m². Este valor considera remoção de calor sensível (temperatura), calor latente (umidade), renovação de ar e perdas térmicas. Baseado em normas técnicas ASHRAE e práticas da indústria. O cálculo é ajustado por um fator de altura (Altura ÷ 2.7m padrão) para considerar pé direito diferente do padrão.
- **Fator de Altura** — Fator que ajusta o cálculo de BTU baseado na altura do pé direito. **Fórmula:** Fator Altura = Altura (m) ÷ 2.7 m (padrão residencial). Permite ajustar o cálculo para ambientes com pé direito maior ou menor que o padrão.
- **BTU por Pessoa** — **Valor de referência usado:** 600 BTU/pessoa. Considera calor metabólico gerado por uma pessoa (calor sensível ~400 BTU/h + calor latente ~200 BTU/h). Baseado em normas ASHRAE.
- **BTU por Equipamento** — **Valor de referência usado:** 600 BTU/equipamento. Baseado na Lei da Conservação de Energia: toda energia elétrica consumida é convertida em calor. Equipamentos típicos (TV, computador, geladeira) geram calor que precisa ser removido pelo ar condicionado.
- **Sistema Multi-Split** — Sistema de ar condicionado com uma unidade externa (condensadora) conectada a múltiplas unidades internas (evaporadoras), uma para cada ambiente. Permite controle independente de temperatura por ambiente.
- **Unidade Externa (Condensadora)** — Componente externo do sistema multi-split que condensa o refrigerante. Capacidades comerciais: 18k, 24k, 30k, 36k, 48k, 60k, 72k, 84k, 96k, 120k, 144k, 180k BTU. Permite múltiplas unidades quando necessário.
- **Unidade Interna (Evaporadora)** — Componente interno do sistema multi-split que evapora o refrigerante e resfria o ambiente. Capacidades comerciais: 5k, 7k, 9k, 12k, 18k, 24k, 30k, 36k, 48k, 60k BTU. Permite múltiplas unidades por ambiente quando necessário.
- **Limites do Sistema** — **Número de ambientes:** 1 a 8. **Área total:** 10 a 300 m². **Unidades internas:** até 60k BTU cada (múltiplas permitidas). **Unidades externas:** até 180k BTU cada (múltiplas permitidas).
- **Fatores de Insolação** — **Valores de referência:** Baixa (1.0), Média (1.15), Alta (1.3). Ambientes com maior exposição solar recebem mais calor, aumentando a necessidade de refrigeração em até 30%.
- **Fatores de Isolamento** — **Valores de referência:** Bom (0.8), Médio (1.0), Ruim (1.2). Bom isolamento reduz transferência de calor entre ambiente interno e externo, diminuindo necessidade de refrigeração em até 20%. Isolamento ruim pode aumentar a necessidade em até 20%.

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
- **Produção Mínima por Pessoa/Dia** — Quantidade mínima de alimento (kg) que deve ser produzida por pessoa por dia. No app, configurável via sliders para plantas (frutas/verduras/legumes) e proteínas (animais).
- **Distribuição Proporcional** — Sistema que divide a produção mínima total entre os itens selecionados. Exemplo: se 0.5 kg/dia de plantas e 3 tipos selecionados, cada um produz 0.167 kg/dia.
- **Consumo Fixo vs Proporcional** — Alguns itens (ex.: ovos de galinha) têm consumo fixo garantido (2 ovos/pessoa/dia), enquanto outros recebem a produção restante distribuída proporcionalmente.

## ☀️ Energia Solar Térmica

- **Coletor Solar Térmico** — Dispositivo que capta energia solar para aquecer água ou fluido. Diferente de painel fotovoltaico (que gera eletricidade). Usa sistema termossifão com tubos a vácuo.
- **Boiler (Acumulador)** — Tanque que armazena água quente aquecida pelos coletores solares. Volume medido em litros (L). O volume é calculado multiplicando o consumo diário pelos dias de autonomia desejados.
- **Eficiência do Coletor (η)** — Percentual de energia solar captada que é convertida em calor útil. Depende da eficiência ótica e das perdas térmicas. Calculada usando a fórmula: η = η₀ - (a₁ × (T_media - T_ambiente) / G), onde η₀ é a eficiência ótica, a₁ é o coeficiente de perda linear, T_media é a temperatura média do fluido, T_ambiente é a temperatura ambiente e G é a irradiação solar.
- **Classe Energética** — Classificação de eficiência energética de edificações (A4, A3, A2, A1, B, C, D, E, F, G). A4 é a mais eficiente. Medida em kWh/m²·ano. **Valores de referência usados:** A4 (0.35), A3 (0.50), A2 (0.70), A1 (0.90), B (1.10), C (1.35), D (1.75), E (2.30), F (3.05), G (4.0) kWh/m²·ano.
- **Consumo Específico** — Consumo de energia por metro quadrado por ano (kWh/m²·ano). Usado para classificar a eficiência energética de edificações. O cálculo de perda de calor é baseado em área (m²) e não em volume (m³).
- **Dias de Autonomia** — Número de dias que o sistema deve manter a casa aquecida ou água quente disponível sem receber energia solar. **Valor padrão:** 3 dias.
- **Temperatura de Conforto** — Temperatura ambiente desejada para aquecimento. **Valor de referência usado:** 22°C. Baseado em padrões de conforto térmico humano.
- **Temperatura Mínima para Termossifões** — **Valor de referência usado:** 48°C. Temperatura mínima da água no boiler necessária para manter termossifões (radiadores) com termostato funcionando até o último dia de autonomia.
- **Temperatura de Armazenamento** — **Valor de referência usado:** 65°C. Temperatura de armazenamento da água quente no boiler.
- **Fator de Estratificação Térmica** — **Valor de referência usado:** 0.65 (65% do volume útil). Considera que apenas 65% do volume do boiler mantém água acima da temperatura mínima necessária devido à estratificação térmica (água quente sobe, água fria desce).
- **Horas de Aquecimento por Dia** — **Valor de referência usado:** 16 horas/dia. Período do dia em que o sistema de aquecimento está ativo. Usado para calcular a demanda diária de aquecimento.
- **Período de Aquecimento** — Número de dias do ano em que o aquecimento é necessário. **Valor de referência usado:** 150 dias (aproximadamente 5 meses de inverno).
- **HSP (Horas de Sol Pleno) por Latitude** — O app calcula dinamicamente as Horas de Sol Pleno no inverno baseado na latitude. **Fórmula:** Interpolação linear entre valores conhecidos: Latitude 0° (~5.5 HSP), 15° (~4.5 HSP), 30° (~3.5 HSP), 45° (~2.5 HSP), 60° (~1.5 HSP). Quanto mais longe do equador, menos horas de sol no inverno.
- **Gradiente Adiabático** — Redução de temperatura com altitude. **Valor de referência usado:** 6.5°C por 1000m para ar ambiente, 5.5°C por 1000m para água. Usado para ajustar temperaturas base ao nível do mar conforme a altitude do local.
- **Transferência de Calor** — Princípio físico: calor flui sempre do corpo mais quente para o mais frio. No aquecimento solar, os coletores captam calor do sol e transferem para a água. A eficiência diminui quando a diferença de temperatura entre o coletor e o ambiente aumenta.
- **Calor Específico da Água** — **Valor de referência usado:** 1.163 Wh/kg°C (ou 4.186 kJ/kg°C). Representa a quantidade de energia necessária para elevar 1 kg de água em 1°C. Usado para calcular a energia necessária para aquecer água.
- **Densidade da Água** — **Valor de referência usado:** 1.0 kg/L. Usado para converter volume (litros) em massa (kg) nos cálculos de energia térmica.

## ⚛️ Leis Físicas e Princípios Aplicados

### Lei de Ohm
**O que é:** Lei fundamental da eletricidade que relaciona tensão (V), corrente (I) e resistência (R).

**Fórmula:** V = I × R

**Explicação leiga:** Imagine a eletricidade como água fluindo em um cano. A tensão (V) é como a pressão da água, a corrente (I) é a quantidade de água que passa, e a resistência (R) é a "estreiteza" do cano. Quanto mais estreito o cano (maior resistência), mais pressão é necessária para fazer a mesma quantidade de água passar.

**Onde é usada:** No app **Bitola**, usamos esta lei para calcular a queda de tensão nos fios. Quanto maior a corrente e a resistência do fio, maior a queda de tensão.

### Conservação de Energia
**O que é:** Princípio físico fundamental: energia não pode ser criada nem destruída, apenas transformada de uma forma para outra.

**Explicação leiga:** É como uma conta bancária: você não pode criar dinheiro do nada, apenas transferir ou transformar. No caso da energia, ela pode ser transformada de luz solar em eletricidade (painéis solares), de eletricidade em calor (equipamentos elétricos), de calor em movimento (motor), etc.

**Onde é usada:** 
- No app **Energia Solar**: garantimos que a energia gerada pelos painéis seja suficiente para atender o consumo, considerando perdas e armazenamento.
- No app **Ar Condicionado**: todo equipamento elétrico gera calor (energia elétrica transformada em calor), que precisa ser removido pelo ar condicionado.

### Transferência de Calor
**O que é:** Princípio físico: calor sempre flui do corpo mais quente para o mais frio, até que ambos atinjam a mesma temperatura.

**Explicação leiga:** É como colocar um cubo de gelo em um copo de água quente: o gelo esquenta e a água esfria até ficarem na mesma temperatura. O calor "flui" do mais quente para o mais frio.

**Onde é usada:**
- No app **Aquecedor Solar**: os coletores captam calor do sol (quente) e transferem para a água (mais fria). A eficiência diminui quando a diferença de temperatura aumenta.
- No app **Ar Condicionado**: o ar condicionado remove calor do ambiente interno (mais quente) e transfere para o ambiente externo (mais frio).

### Resistividade Elétrica
**O que é:** Propriedade dos materiais que determina sua resistência elétrica. Cada material tem uma resistividade diferente.

**Explicação leiga:** É como a "dificuldade" que um material oferece para a passagem de eletricidade. O cobre tem baixa resistividade (é bom condutor), enquanto a borracha tem alta resistividade (é isolante).

**Onde é usada:** No app **Bitola**, usamos a resistividade do cobre (0.0175 Ω·mm²/m) para calcular a resistência dos fios e, consequentemente, a queda de tensão.

### Eficiência e Perdas
**O que é:** Nenhum sistema é 100% eficiente. Sempre há perdas de energia durante transformações e transferências.

**Explicação leiga:** É como encher um balde com água usando uma mangueira: nem toda água que sai da torneira chega ao balde (alguma se perde por vazamentos, evaporação, etc.). Nos sistemas elétricos, parte da energia se perde como calor, atrito, etc.

**Onde é usada:**
- No app **Energia Solar**: consideramos 80% de eficiência do sistema (20% de perdas em cabos, MPPT, inversor, baterias, temperatura, sujeira).
- No app **Aquecedor Solar**: a eficiência do coletor diminui quando a diferença de temperatura aumenta (mais perdas térmicas).

### Propulsão Náutica
**O que é:** Princípio físico que explica como hélices movem barcos através da água.

**Explicação leiga:** A hélice funciona como uma "rosca" na água: quando gira, "empurra" a água para trás, e pela terceira lei de Newton (ação e reação), a água "empurra" o barco para frente. O slip ocorre porque a água não é rígida, então a hélice "desliza" parcialmente, reduzindo a eficiência.

**Onde é usada:** No app **Hélice**, usamos estes princípios para calcular o passo ideal da hélice baseado na velocidade desejada, RPM e slip.

## 💻 Programação Web

- **localStorage** — Pequena área de armazenamento no navegador que persiste dados entre sessões. O projeto usa:
  - `idiomaPreferido` — Guarda o idioma escolhido (pt-BR ou it-IT)
  - `configSolar` — Guarda as configurações personalizadas do app Solar
- **Slider** — Controle deslizante na interface para ajustar valores (ex.: consumo, autonomia, velocidade).
- **i18n (Internacionalização)** — Sistema para traduzir aplicações para múltiplos idiomas. No projeto, implementado com atributos `data-i18n` e dicionários JavaScript.
- **DOM (Document Object Model)** — Representação da estrutura HTML em JavaScript, permitindo manipular elementos da página.
- **Event Listener** — Função que "escuta" eventos do usuário (cliques, mudanças de slider, etc.) e executa código em resposta.
- **Memorial de Cálculo** — Seção educativa que explica passo a passo como são realizados os cálculos de um app. Inclui fórmulas, exemplos práticos com valores reais e resumo dos resultados. Implementado nos apps Mutuo (Saiba Mais) e Solar (Memorial de Cálculo).

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
- **SAC (Sistema de Amortização Constante)**: Amortização constante, parcelas decrescentes. Na Itália: "Ammortamento all'Italiana"
- **Tabela Price (Sistema Francês)**: Parcelas fixas (mais comum). Na Itália: "Ammortamento alla Francese"
- **Sistema Americano**: Só juros + principal no final. Na Itália: "Sistema Tedesco"

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
