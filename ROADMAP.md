# Roadmap de Próximos Apps

Lista de apps planejados para o portfólio Engenharia NATA.
Objetivo: ferramentas úteis para qualquer pessoa — do cotidiano simples ao cálculo técnico.
Cada app explora um tema, amplia o público-alvo e privilegia visualizações que mostrem
ao vivo como cada entrada afeta cada resultado.

> ℹ️ **Referência de qualidade:** o app **Mutuo / Empréstimos** (`mutuo/`) é o padrão-ouro
> do portfólio — foi o que recebeu mais tempo de refinamento (UX, responsividade,
> i18n, dark mode, sliders+inputs sincronizados, gráficos, explicações).
> **Todo novo app deve usá-lo como base** (estrutura, componentes, estilos e padrões de interação).

---

## ✅ Entregues

- **Mutuo / Empréstimos** (`mutuo/`)
- **Solar — Dimensionamento Fotovoltaico** (`solar/`)
- **Ar-Condicionado — Dimensionamento** (`arcondicionado/`)
- **Aquecedor Solar Térmico** (`aquecimento/`)
- **Hélice de Barco — Passo** (`helice/`)
- **Bitola de Fios Elétricos** (`bitola/`)
- **Fazenda Auto-Sustentável** (`fazenda/`)
- **Captação de Água da Chuva** (`chuva/`)
- **Bomba d'Água** (`bombaagua/`)
- **Iluminação Residencial LED** (`iluminacao/`)
- **Ventilação Natural** (`ventilacao/`)

---

## 🎯 Próximo sugerido (recomendação)

### Salário CLT — Líquido, Férias, 13º e Rescisão (`salario/`)

Útil para **100% dos assalariados** brasileiros. Pode ter versão IT (contrato CCNL).

- **Entradas**
  - Salário bruto mensal (R$)
  - Número de dependentes
  - Plano de saúde descontado (R$)
  - Vale-transporte (% desconto, 6% máx)
  - Horas-extra no mês (h)
  - Adicional noturno (sim/não)
  - Tempo de empresa (meses)
- **Saídas**
  - Salário líquido mensal
  - Decomposição: INSS, IRRF, VT, Plano
  - Valor do 13º salário (integral e proporcional)
  - Valor de férias + 1/3
  - FGTS acumulado (8% × meses)
  - Rescisão estimada (demissão sem justa causa: saldo + aviso + férias + 13º + multa 40% FGTS)
- **Visualizações**
  - **Donut chart** da composição do bruto → líquido (barras coloridas para cada desconto)
  - **Barra de progresso** com tarja INSS/IR/líquido animada ao mover slider
  - **Linha temporal** mostrando renda anual total somando 12 × líquido + férias + 13º
  - **Comparativo** do custo real para empresa (bruto + FGTS + encargos ≈ 1,8× o líquido)

---

## 🚀 Top 15 Para Próxima Fase — Especificações Detalhadas

### 💰 1. Independência Financeira / FIRE (`fire/`)

*Para qualquer pessoa que quer saber quando pode parar de trabalhar.*

- **Entradas:** salário líquido, % de poupança, gasto mensal desejado, retorno anual esperado (%), idade atual
- **Saídas:** patrimônio-alvo (25× gasto anual — regra 4%), anos até FIRE, valor em 10/20/30 anos, idade provável de aposentadoria
- **Visualização:** **gráfico de linha com duas curvas sobrepostas** — curva de patrimônio acumulado (verde) e curva de despesas anuais acumuladas (vermelha). O ponto de cruzamento é o "ponto FIRE" destacado. Slider de % poupança anima o gráfico em tempo real.

### 🍔 2. Divisão de Conta com Gorjeta (`conta/`)

*App do dia-a-dia, super simples.*

- **Entradas:** valor total, % gorjeta, número de pessoas, ajustes individuais (quem bebeu, quem não)
- **Saídas:** valor por pessoa, gorjeta total, breakdown individual
- **Visualização:** **barras horizontais** mostrando quanto cada pessoa paga (personalizáveis). Animação de divisão tipo "slice pie" ao mudar o nº de pessoas.

### 🏃 3. IMC + TMB + Meta de Peso (`peso/`)

- **Entradas:** peso, altura, idade, sexo, atividade física (5 níveis), meta de peso
- **Saídas:** IMC com classificação, TMB (metabolismo basal, Harris-Benedict), gasto diário estimado, calorias para emagrecer/ganhar, tempo para atingir meta
- **Visualização:** **termômetro de IMC** colorido (baixo peso → obesidade) com seta na posição atual. **Gráfico de linha** da curva de peso ao longo do tempo com déficit calórico aplicado.

### 😴 4. Ciclos de Sono (`sono/`)

*Para acordar descansado no meio de um ciclo REM, não no meio dele.*

- **Entradas:** hora que quer acordar OU hora que vai dormir
- **Saídas:** 5–6 horários ideais para dormir/acordar (ciclos de 90 min + 15 min para adormecer)
- **Visualização:** **círculo de relógio 24h** com fatias coloridas indicando ciclos de sono leve/profundo/REM. Melhor horário destacado com selo ⭐.

### 🚗 5. Custo Total de Posse do Carro (TCO) (`carro/`)

*Revela o custo real de ter carro — geralmente muito maior que as pessoas imaginam.*

- **Entradas:** preço do carro, km/ano, consumo (km/L), preço combustível, seguro, IPVA, manutenção/ano, depreciação (%/ano), tempo de uso (anos)
- **Saídas:** custo mensal real, custo por km, custo total em N anos, comparativo com Uber/transporte público (break-even de km/mês)
- **Visualização:** **pizza** da composição de custos. **Linha de break-even** comparando TCO vs Uber em função de km/ano (onde um cruza o outro). **Waterfall** do valor inicial → gastos → valor residual.

### 🏃‍♀️ 6. Pace / Treino de Corrida (`correr/`)

- **Entradas:** distância OU tempo alvo OU pace, frequência cardíaca, idade
- **Saídas:** pace (min/km), velocidade média (km/h), tempo estimado para 5k/10k/21k/42k, zonas de treino (FC alvo)
- **Visualização:** **barra horizontal de pace** com zonas coloridas (fácil/moderado/intenso). **Tabela de projeção** para distâncias padrão com previsão de Riegel.

### 🧱 7. Reforma — Tinta, Piso, Argamassa (`reforma/`)

*Três calculadoras em um só app, seletor no topo.*

- **Entradas por modo:**
  - Tinta: área a pintar, demãos, rendimento L/m²
  - Piso: área total, tamanho da peça, rejunte
  - Argamassa: área, espessura, perda (%)
- **Saídas:** quantidade total, nº de embalagens comerciais, custo estimado
- **Visualização:** **grade visual** mostrando peças dispostas no ambiente (tipo tabuleiro) destacando recortes/perdas. **Barra** comparando custo por metro² entre opções.

### 🍳 8. Cozinha — Escalar Receita + Converter Medidas (`cozinha/`)

- **Entradas:** receita base (lista de ingredientes com quantidade/unidade), nº de porções original, nº de porções desejado. Conversor universal xícara↔ml↔g↔colher.
- **Saídas:** receita escalada, tabela de conversão
- **Visualização:** **barras comparativas** do original vs escalado. **Tabela de equivalência** visual (ícones de xícara, colher) para cada ingrediente.

### 🌍 9. Fuso Horário & Reuniões Globais (`fuso/`)

*Para quem trabalha com equipes internacionais ou viaja.*

- **Entradas:** cidades (até 6), data/hora base
- **Saídas:** hora em cada cidade, diferença em horas
- **Visualização:** **faixa horizontal 24h** com gradiente claro/escuro (dia/noite) e marcador da hora atual em cada fuso. **Heatmap** da sobreposição de "horário comercial" (8h–18h) entre as cidades — mostra janelas de reunião possíveis.

### 🌱 10. Pegada de Carbono Pessoal (`carbono/`)

- **Entradas:** km de carro/ano, dieta (vegano/vegetariano/onívoro/carnívoro), voos/ano, consumo elétrico, reciclagem (%)
- **Saídas:** toneladas de CO₂/ano, comparação com média nacional, quantas árvores para compensar
- **Visualização:** **barra empilhada** da pegada por categoria (transporte/alimentação/casa/viagem). **Ícones de árvores** (cada árvore = 22 kg CO₂/ano) para mostrar compensação.

### 💸 11. Aposentadoria — Quanto Preciso Guardar? (`aposentadoria/`)

- **Entradas:** idade atual, idade desejada, gasto mensal na aposentadoria, poupança atual, contribuição mensal, retorno (%)
- **Saídas:** patrimônio necessário, patrimônio projetado, gap, valor extra/mês para fechar gap
- **Visualização:** **gráfico de linha** com curva de patrimônio acumulado + linha horizontal do patrimônio-alvo. **Slider de contribuição** anima a curva tentando alcançar o alvo. **Contador** de anos até alcançar.

### 🎲 12. Probabilidade — Loteria / Apostas / Odds (`probabilidade/`)

*Educativo: mostra o quão improváveis são certas coisas.*

- **Entradas:** tipo (mega-sena, quina, dado, cartas, odds esportivas), parâmetros
- **Saídas:** probabilidade (fração + %), tempo médio para acertar jogando 1×/semana, expected value
- **Visualização:** **grade de 1 milhão de pixels** com 1 aceso (ilustra "6 em 60 milhões"). **Barra** comparando com eventos cotidianos (raio, acidente, etc.).

### 🛒 13. Preço por Unidade — "Qual é mais barato?" (`unidade/`)

*Para comparar embalagens no mercado.*

- **Entradas:** até 4 produtos (nome, preço, quantidade, unidade)
- **Saídas:** preço por unidade padrão (R$/kg, R$/L, R$/un), ranking, economia comparando com mais caro
- **Visualização:** **barras horizontais ordenadas** com o mais barato em verde destacado. **Badge** "economia de X%" em cada.

### 📚 14. Curva de Aprendizado / Projeto PERT (`projeto/`)

*Para estimar quanto tempo um projeto/habilidade leva.*

- **Entradas:** tempo otimista, tempo mais provável, tempo pessimista (metodologia PERT)
- **Saídas:** tempo esperado (fórmula (O + 4M + P)/6), desvio padrão, intervalo 95% de confiança
- **Visualização:** **distribuição Beta** da probabilidade de terminar em X tempo. **Linhas verticais** marcando média, desvios e intervalos de confiança.

### 💊 15. Dose de Medicamento por Peso (`dose/`)

*Principalmente para pediatria — super útil para pais.*

- **Entradas:** medicamento (paracetamol, dipirona, ibuprofeno), peso da criança, idade
- **Saídas:** dose recomendada em mg, equivalente em ml (considerando a concentração do fabricante), intervalo entre doses, dose máxima diária
- **Visualização:** **seringa visual** mostrando a quantidade em ml. **Relógio circular** com próximas doses marcadas. **Alerta vermelho** se input estiver fora da faixa segura.

---

## 📋 Backlog Amplo — Organizado por Categoria

### 🧾 Finanças
- **Juros compostos universal** — poupança, CDB, qualquer aplicação
- **Financiamento de imóvel** — SAC vs Price vs SACRE com gráfico
- **Comparador de investimentos** — Tesouro vs CDB vs Fundo vs Ações com imposto
- **Dívida do cartão — rolagem** — quanto custa rolar mínimo
- **Método 50/30/20** — organização de orçamento pessoal
- **Câmbio em viagem** — cartão vs espécie vs Wise com IOF
- **Custo real de ter um filho** — 0 aos 18 anos por faixa etária

### 🏃 Saúde & Bem-estar
- **Hidratação diária** — água por dia por peso/atividade/clima
- **Calculadora de gestação** — datas, semanas, marcos, peso ideal da gestante
- **Calendário vacinal infantil** — próxima vacina, atrasos
- **Força máxima 1RM** — treino de hipertrofia
- **Ciclo menstrual / ovulação** — previsão de período fértil
- **Pressão arterial** — classificação e metas
- **Zona alvo de treino** — FC alvo por objetivo (queima/resistência/VO2)

### 🛒 Vida Cotidiana
- **Gorjeta internacional** — % esperada por país
- **Conversor universal** — °C↔°F, kg↔lb, cm↔ft, km↔mi, m²↔ft² etc.
- **Quanto vale R$100 de X anos atrás hoje?** — inflação IPCA/IGP
- **Senha segura** — gerador + avaliador de força

### 🚗 Mobilidade & Carro
- **Gasolina vs Etanol vs Elétrico** — qual compensa hoje?
- **Consumo real do carro** — km/L baseado em abastecimentos
- **Financiamento ou à vista?** — comparação com juros vs investir a diferença
- **Troca de carro** — quando vale a pena trocar?

### 🏠 Casa & Construção
- **Cimento, areia, brita** — traço de concreto
- **Calculadora de ar-condicionado por BTU** (já existe mas versão simples)
- **Aquecedor de água elétrico** — chuveiro custo mensal
- **Isolamento térmico** — economia em calefação/AC
- **Placa solar off-grid pequena** — para caseiro/caravana

### 🍳 Cozinha & Alimentação
- **Churrasco — quanto de carne por pessoa?** — com bebida e acompanhamentos
- **Fermentação de pão** — tempo por temperatura
- **Ração de pet** — gato/cachorro por peso
- **Custo por refeição** — preço da sua comida vs delivery

### ✈️ Viagens
- **Orçamento de viagem** — hospedagem + comida + passeios por dia × dias
- **Jet lag** — dias para se adaptar ao destino
- **Bagagem — limite em kg** — organizador visual
- **Comparador de voos** — preço por hora de voo

### 💻 Tecnologia
- **Tempo de download** — X GB em Y Mbps
- **Espaço em disco** — horas de vídeo 4K/Full HD por GB
- **Custo de cloud** — AWS S3/EC2 simples
- **Watts do PC** — consumo mensal em R$

### 💼 Carreira & Produtividade
- **Quanto vale sua hora?** — baseado em salário + tempo livre
- **Técnica Pomodoro** — ciclos de foco
- **Revisão espaçada** — Ebbinghaus para estudar
- **ROI de curso / MBA** — vale o investimento?

### 🌍 ESG & Sustentabilidade
- **Água virtual** — litros para produzir 1 kg de carne, 1 jeans etc.
- **Reciclagem familiar** — quanto gera por mês
- **Compensação por plantio** — árvores para zerar emissões
- **Carro elétrico vs combustão** — break-even com energia limpa

### 🎲 Jogos & Esportes
- **Pace de natação / ciclismo** — distâncias padrão
- **Chance em partida esportiva** — odds → probabilidade implícita
- **Handicap de golfe**
- **Passos para 10 mil** — tempo e distância

### 🔧 Utilidades Simples
- **Contagem regressiva** para datas importantes
- **Calculadora de idade** — anos, meses, dias, próximo aniversário
- **Dias úteis entre datas** — considerando feriados
- **Dívida igualitária entre amigos** — quem deve para quem (algoritmo de Splitwise)
- **Dimensionamento de prato/travessa** — quanto de comida por nº de convidados
- **Dobradura de papel** — vezes para atingir X metros (exponencial)

---

## 🎨 Princípios de Design Visual

Cada app deve ter ao menos **uma visualização interativa** que mostre ao vivo como as
entradas afetam os resultados. Opções disponíveis (Chart.js já integrado):

| Tipo | Quando usar |
|---|---|
| **Linha temporal** | Projeções (patrimônio, peso, juros) |
| **Barras horizontais** | Comparação de N opções (preços, custos) |
| **Donut / Pizza** | Composição (descontos do salário, gastos) |
| **Waterfall** | Como um valor inicial vira um valor final |
| **Termômetro / Gauge** | Métrica única com faixas (IMC, pressão) |
| **Heatmap** | 2 dimensões (fuso × hora, dia × atividade) |
| **Grade de pixels** | Ilustrar probabilidades muito pequenas |
| **Círculo 24h** | Ciclos diários (sono, solar) |
| **Curva de distribuição** | Incerteza (PERT, risco) |
| **Slider anima gráfico** | Ensinar sensibilidade de cada input |

---

## 🧭 Como priorizar

1. **Utilidade diária** — quantas pessoas usariam por mês?
2. **Surpresa / insight** — o resultado ensina algo (ex: TCO do carro)
3. **Visualização impactante** — o gráfico é memorável
4. **Escopo bem definido** — cabe em 1 tela sem overwhelming

---

*Próximo passo: escolha 1 app do Top 15 e parta para desenvolvimento.*
