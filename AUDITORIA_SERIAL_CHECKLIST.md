# Checklist Serial de Auditoria - Engenharia NATA

Data de inicio: 2026-06-10

Escopo: auditar e melhorar, app por app, o portfolio Engenharia NATA mantendo compatibilidade com hospedagem estatica. O app `br12c/` e protegido e deve permanecer fora das edicoes, salvo ajuste minimo e documentado de navegacao compartilhada.

## Ordem de execucao

1. Shared layout, navegacao, CSS global, scripts compartilhados e utilitarios comuns
2. Reportar Bug (`bugs/`)
3. Sobre o Projeto (`sobre/`)
4. Aquecedor Solar (`aquecimento/`)
5. Ar Condicionado (`arcondicionado/`)
6. Bitola / Calculadora de Fios Eletricos (`bitola/`)
7. Bomba d'Agua (`bombaagua/`)
8. Captacao de Agua da Chuva (`chuva/`)
9. Energia Solar Fotovoltaica (`solar/`)
10. Fazenda Auto-Sustentavel (`fazenda/`)
11. Helice / Propeller Pitch (`helice/`)
12. Iluminacao Residencial (`iluminacao/`)
13. Mutuo / Emprestimos (`mutuo/`)
14. Previsao 7 dias (`previsao/`)
15. Salario Liquido BR/IT (`salario/`)
16. Ventilacao Natural (`ventilacao/`)

## Topicos obrigatorios por app

Para cada item da ordem serial, preencher:

| Topico | Perguntas de auditoria |
|---|---|
| Estrutura | Arquivos envolvidos, dependencias, scripts classicos, imports ESM e duplicacoes. |
| UI/UX | Fluxo principal, textos, botoes, estados vazios, reset/export/share, consistencia visual. |
| Inputs | Tipos, unidades, labels, sliders, mobile keyboard, valores padrao e persistencia. |
| Validacao | Minimos/maximos realistas, campo vazio, valor invalido, extremos e mensagens. |
| Formulas | Equacoes, hipoteses, arredondamentos, invariantes e possibilidade de extrair nucleo puro. |
| Unidades | Conversoes, simbolos, locale, separador decimal e unidade exibida no resultado. |
| Constantes | Fonte, ano, isolamento em configuracao e alerta de manutencao quando dependem de norma/tabela. |
| Warnings | Avisos educativos, limites de uso, necessidade de especialista e riscos de interpretacao. |
| Resultados | Cards, memorial, breakdown, graficos, comparacoes, acessibilidade dos resultados. |
| Responsividade | Mobile, desktop, toque, overflow, textos longos e estabilidade de layout. |
| Acessibilidade | Semantica, foco, aria, contraste, teclado, labels e erros anunciaveis. |
| i18n | Chaves PT/IT, persistencia de idioma, textos dinamicos e locale de numeros/moedas. |
| Testes | Testes unitarios, smoke local, console, casos vazios/invalidos/extremos e regressao. |
| Riscos | Risco residual, dependencias externas, dados temporais e necessidade de validacao tecnica. |

## Mapa inicial do projeto

- Entrada principal: `index.html`, `index-script.js`, `index-styles.css`.
- Base comum: `src/core/app.js`, `src/core/i18n.js`, `src/core/theme.js`.
- Componentes comuns: `src/components/resultado-explicado.js`, `src/components/loading.js`.
- Utilitarios comuns: `src/utils/formatters.js`, `src/utils/validators.js`, `src/utils/storage.js`, `src/utils/dom.js`, `src/utils/input-handlers.js`, `src/utils/ui-controls.js`, `src/utils/sanitize.js`.
- CSS comum: `assets/css/shared-styles.css`, `assets/css/v2-components.css`, `assets/css/controls-styles.css`.
- JS comum classico: `assets/js/error-overlay.js`, `assets/js/ajustarValorUtil.js`.
- Vendor local: `assets/js/vendor/chart.umd.js`.
- i18n: `src/i18n/*.json`, um arquivo por app.
- Configuracao de versoes: `config/versions.json`.
- Toolchain local: `local/package.json`, `local/vite.config.js`, `local/vitest.config.js`.
- Apps com calculo puro e testes: `mutuo/`, `salario/`.
- Apps com calculo acoplado ao DOM/UI: `aquecimento/`, `arcondicionado/`, `bitola/`, `bombaagua/`, `chuva/`, `fazenda/`, `helice/`, `iluminacao/`, `solar/`, `ventilacao/`.
- Paginas de suporte: `bugs/`, `sobre/`, `previsao/`.
- Protegido: `br12c/`, incluindo assets, estilos, scripts e testes proprios.

## Registro de checkpoints

Adicionar checkpoints aqui ou no relatorio final apos cada acao atomica, sempre com:

- O que foi checado
- O que foi alterado
- Por que foi alterado
- Arquivos modificados
- Testes executados
- Riscos restantes
- Proxima acao recomendada

### 2026-06-10 - Shared utils

- O que foi checado: parsers, validadores, sanitizacao de URL e alcance do Vitest.
- O que foi alterado: parsing numerico comum, validacao de numero vazio/invalido, URLs relativas seguras e inclusao de testes `src/**/*.test.js`.
- Por que foi alterado: reduzir divergencias entre apps, evitar tratar campo vazio como zero valido e permitir links internos estaticos sem abrir brecha para `javascript:`.
- Arquivos modificados: `src/utils/formatters.js`, `src/utils/validators.js`, `src/utils/sanitize.js`, `src/utils/utils.test.js`, `local/vitest.config.js`.
- Testes executados: `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: apps que ainda fazem parsing proprio no DOM podem nao aproveitar todos os utilitarios comuns ate serem auditados.
- Proxima acao recomendada: continuar auditoria serial por app.

### 2026-06-10 - bugs/

- O que foi checado: formulario de relato, chips de categoria, status de envio, i18n e privacidade.
- O que foi alterado: status anunciavel por leitor de tela, `aria-pressed` nos chips, validacao basica de e-mail quando informado, mensagem de privacidade e correcao da classe de status.
- Por que foi alterado: melhorar acessibilidade, feedback de erro e transparencia sobre envio externo.
- Arquivos modificados: `bugs/bugs.html`, `bugs/bugs-script.js`, `bugs/bugs-styles.css`, `src/i18n/bugs.json`.
- Testes executados: `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: o envio `no-cors` para Google Forms nao permite confirmar sucesso real pelo navegador.
- Proxima acao recomendada: seguir para `sobre/`.

### 2026-06-10 - sobre/

- O que foi checado: cards de autores/contribuidores, acordeon, ordenacao, troca de idioma e navegacao por teclado.
- O que foi alterado: headers de cards focaveis, alternancia por teclado, `aria-expanded`/`aria-label` dinamicos, titulo do documento sincronizado com idioma e filtro robusto antes de remontar cards.
- Por que foi alterado: reduzir barreiras de acessibilidade e evitar nodes nulos em ordenacao/renderizacao.
- Arquivos modificados: `sobre/sobre-script.js`.
- Testes executados: `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: validacao visual em navegador ficou limitada por falhas do ambiente Playwright/Edge headless.
- Proxima acao recomendada: seguir para `aquecimento/`.

### 2026-06-10 - aquecimento/

- O que foi checado: controles de uso, slider de dias de autonomia, formula de volume do boiler, memorial explicativo e textos PT/IT.
- O que foi alterado: o calculo agora usa `sliderDiasAutonomia` no volume do boiler; a explicacao mostra os dias de autonomia; a visibilidade do controle de autonomia acompanha agua e/ou casa; os textos deixam claro que autonomia de ambiente e margem educativa.
- Por que foi alterado: havia um controle visivel e documentado que nao afetava o calculo, enquanto o script usava fator fixo `1.5`.
- Arquivos modificados: `aquecimento/aquecimento-script.js`, `src/i18n/aquecimento.json`.
- Testes executados: `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: o modelo termico para aquecimento ambiente permanece simplificado e educativo, sem extracao para nucleo puro testavel nesta fase.
- Proxima acao recomendada: iniciar Phase A em `arcondicionado/`.

### 2026-06-10 - arcondicionado/

- O que foi checado: escala de classe energetica, calculo BTU multi-split, memorial, exemplos dinamicos, i18n e acessibilidade de controles informativos.
- O que foi alterado: memorial passa a usar o mesmo BTU final do resultado, incluindo fator de classe energetica; exemplos de modelo e custo agora sao preenchidos dinamicamente; escala de classe energetica recebeu semantica `radiogroup`/`radio` e `aria-checked`; listeners duplicados da escala foram evitados; icones de informacao agora respondem a teclado.
- Por que foi alterado: o resultado principal aplicava classe energetica, mas o memorial recalculava sem esse fator, produzindo BTU final e BTU por ambiente divergentes.
- Arquivos modificados: `arcondicionado/arcondicionado.html`, `arcondicionado/arcondicionado-script.js`, `src/i18n/arcondicionado.json`.
- Testes executados: `npm run lint:check`, `npm test`, `npm run build`, validacao JSON de `src/i18n/arcondicionado.json`.
- Riscos restantes: validacao visual pelo Browser interno falhou no bootstrap com `windows sandbox failed: spawn setup refresh`; faixas de preco e fatores tecnicos continuam como dados educativos existentes, sem nova verificacao externa nesta fase.
- Proxima acao recomendada: iniciar Phase A em `bitola/`.

### 2026-06-10 - bitola/

- O que foi checado: inputs de potencia/comprimento/tensao/queda, selecao CC/CA, formulas de corrente/quedas, memorial, chaves i18n e consistencia de mensagens normativas.
- O que foi alterado: parser de entrada passou a usar `parsearNumero`; chave HTML `unidades.metro` foi corrigida para `unidades.meter`; chaves `memorial.bitolasList` foram corrigidas em PT/IT; texto da explicacao de queda de tensao passou a refletir o limite configurado em vez de mencionar 3% fixo.
- Por que foi alterado: havia chaves i18n inexistentes, parsing numerico local divergente do utilitario comum e uma mensagem que contradizia o slider/default de queda maxima.
- Arquivos modificados: `bitola/bitola.html`, `bitola/bitola-script.js`, `src/i18n/bitola.json`.
- Testes executados: validacao JSON de `src/i18n/bitola.json`, checagem estatica de chaves i18n PT/IT usadas no HTML, `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: calculo continua simplificado para queda de tensao, sem fator de potencia/reatancia/metodo de instalacao/temperatura/agrupamento; validacao visual pelo Browser interno segue bloqueada por `windows sandbox failed: spawn setup refresh`.
- Proxima acao recomendada: iniciar Phase A em `bombaagua/`.

### 2026-06-10 - bombaagua/

- O que foi checado: entradas de altura/comprimento/vazao/diametro, formula Darcy-Weisbach simplificada, memorial, texto de consumo e chaves i18n.
- O que foi alterado: parser local passou a usar `parsearNumero`; exibicao de consumo deixou de usar `kWh/h` e passou a explicitar energia consumida em uma hora; rotulos PT/IT do resultado foram ajustados.
- Por que foi alterado: `kWh/h` e uma forma ambigua para o usuario, pois equivale a potencia; para estimativa de energia, o app orienta multiplicar por horas de uso.
- Arquivos modificados: `bombaagua/bombaagua-script.js`, `src/i18n/bombaagua.json`.
- Testes executados: validacao JSON de `src/i18n/bombaagua.json`, checagem estatica de chaves i18n PT/IT usadas no HTML, `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: modelo continua educativo e simplificado, com eficiencia fixa de 55%, rugosidade PVC, perdas locais fixas de 15% e sem curva real de fabricante/NPSH/cavitacao.
- Proxima acao recomendada: iniciar Phase A em `chuva/`.

### 2026-06-10 - chuva/

- O que foi checado: area de captacao, precipitacao, pessoas, tipo de uso, volume de cisterna, risco de overflow, economia, memorial e i18n.
- O que foi alterado: parser local passou a usar `parsearNumero`; botoes de incremento agora respeitam o maximo do slider; textos PT/IT de volumes comerciais foram alinhados com os volumes realmente usados no calculo.
- Por que foi alterado: o controle por setas podia ultrapassar o maximo visual, e o memorial citava apenas ate 10.000 L enquanto o algoritmo seleciona tambem 15.000 e 20.000 L.
- Arquivos modificados: `chuva/chuva-script.js`, `src/i18n/chuva.json`.
- Testes executados: validacao JSON de `src/i18n/chuva.json`, checagem estatica de chaves i18n PT/IT usadas no HTML, `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: tarifas de agua sao referencias fixas e temporais; metodo segue educativo, sem serie historica de chuva local, sazonalidade, area efetiva detalhada, descarte inicial configuravel ou dimensionamento normativo completo.
- Proxima acao recomendada: iniciar Phase A em `solar/`.

### 2026-06-10 - solar/

- O que foi checado: parsing de valores monetarios, DoD, memorial de inversor/MPPT, notas de preco e consistencia PT/IT.
- O que foi alterado: parser monetario passou a usar `parsearNumero`; textos do memorial deixaram de usar `kW/h` para potencia media; notas de preco foram alinhadas com os valores padrao configuraveis e deixaram de declarar referencias datadas/inconsistentes.
- Por que foi alterado: `parseFloat` local interpretava `1.234,56` incorretamente, `kW/h` comunicava unidade errada para potencia media e havia divergencia entre nota de bateria LiFePO4 e constante real usada pelo calculo.
- Arquivos modificados: `solar/solar.html`, `solar/solar-script.js`, `src/i18n/solar.json`.
- Testes executados: validacao JSON de `src/i18n/solar.json`, checagem estatica de chaves i18n PT/IT usadas no HTML, `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: valores de tarifa, bateria, HSP, eficiencia, fator de pico e tabelas DoD continuam referencias educativas/configuraveis, sem verificacao externa primaria nesta fase; validacao visual pelo Browser interno segue bloqueada por `windows sandbox failed: spawn setup refresh`.
- Proxima acao recomendada: iniciar Phase A em `fazenda/`.

### 2026-06-10 - fazenda/

- O que foi checado: entradas de pessoas/consumo, selecao dinamica de plantas/animais, calculo de animais de corte, chaves i18n HTML e textos PT/IT.
- O que foi alterado: inputs editaveis passaram a usar `parsearNumero`; opcoes dinamicas receberam `aria-pressed`; `anatra-corte` entrou no ramo correto de animais de corte; JSON i18n foi sincronizado com as chaves usadas no HTML; texto italiano do botao de memorial foi corrigido.
- Por que foi alterado: o parser local podia interpretar separadores de milhar/decimal de forma divergente, os botoes selecionaveis nao comunicavam estado a tecnologias assistivas e pato de corte era distribuido como animal de corte, mas calculado pelo fallback minimo.
- Arquivos modificados: `fazenda/fazenda-script.js`, `src/i18n/fazenda.json`.
- Testes executados: validacao JSON de `src/i18n/fazenda.json`, checagem estatica de chaves i18n PT/IT usadas no HTML, `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: dados agronomicos/zootecnicos permanecem referencias educativas do banco local, sem validacao por regiao/clima/solo real nesta fase; validacao visual pelo Browser interno segue bloqueada por `windows sandbox failed: spawn setup refresh`.
- Proxima acao recomendada: iniciar Phase A em `helice/`.

### 2026-06-10 - helice/

- O que foi checado: formula de passo, conversoes mph/kmh/nos, memorial, grafico, botoes de incremento e chaves i18n.
- O que foi alterado: constante de conversao passou de `1056` para `1215.2`, pois o app converte a velocidade para nos antes da formula; textos e exemplos do memorial foram alinhados; chave `resultado.passoLabel` foi adicionada ao JSON; setas agora aplicam um passo imediato em clique curto e mantem aceleracao ao segurar.
- Por que foi alterado: `1056` e a constante para mph, nao para nos, o que subdimensionava o passo quando a velocidade ja estava normalizada para nos; tambem havia chave i18n faltante e clique rapido nas setas podia nao alterar o valor.
- Arquivos modificados: `helice/helice.html`, `helice/helice-script.js`, `src/i18n/helice.json`.
- Testes executados: validacao JSON de `src/i18n/helice.json`, checagem estatica de chaves i18n PT/IT usadas no HTML, smoke test da formula 25 nos/2:1/5000 RPM/15%, `npm run lint:check`, `npm test`, `npm run build`.
- Riscos restantes: calculo segue educativo e nao substitui selecao por curva real de motor/casco/helice; slip e reducao permanecem parametros estimados; validacao visual pelo Browser interno segue bloqueada por `windows sandbox failed: spawn setup refresh`.
- Proxima acao recomendada: iniciar Phase A em `iluminacao/`.

### 2026-06-10 - iluminacao/

- O que foi checado: parsing numerico, selecao de lampadas (teto artificial de 10 unidades + fallback fixo 2x9 W), fator de luz natural, textos do memorial (NBR 5413 e ajuste de pe-direito), chaves i18n PT/IT usadas no HTML, valores estaticos de fallback do HTML e estado visual `slider-fora-faixa` apos clamp.
- O que foi alterado: parser local passou a usar `parsearNumero` com guarda de NaN; removidos o teto `quantidade <= 10` e o fallback silencioso 2x9 W (caso critico: cozinha 100 m2 escura mostrava 2x9 W para 100.000 lm); a selecao agora escolhe a menor potencia total e, em quase empate (ate 1%), menos lampadas (67x15 W em vez de 167x6 W), com guarda para entrada degenerada que impede TypeError; luz natural padrao passou de "muita" para "nenhuma" (dimensiona para lux pleno noturno; fator vira reducao opcional documentada); textos NBR 5413 reescritos como referencia educativa de norma cancelada em 2013 (ver NBR ISO/CIE 8995-1) em HTML, JSON e script; memorial corrigido de "10 %/metro" para "~3,7 %/metro"; chave `resultado.matrizLampadas` adicionada em PT/IT; exemplos e valores estaticos do HTML alinhados aos defaults reais (7x6 W, 42 W, 6,3 kWh, R$ 7,56/mes); classe `slider-fora-faixa` limpa apos clamp programatico.
- Por que foi alterado: o fallback fixo produzia dimensionamento ate 55x menor que o necessario com memorial matematicamente falso; o default "muita" dimensionava o sistema para metade do lux alvo (insuficiente a noite); o app citava norma cancelada como vigente e ensinava regra de pe-direito que o codigo nao aplica.
- Arquivos modificados: `iluminacao/iluminacao-script.js`, `iluminacao/iluminacao.html`, `src/i18n/iluminacao.json`.
- Testes executados: validacao JSON de `src/i18n/iluminacao.json`, checagem estatica das chaves data-i18n do HTML contra PT/IT (todas presentes), `npm run lint:check`, `npm test` (213), `npm run build`, cache Vitest restaurado; validacao visual no navegador via Vite dev (preview interno voltou a funcionar): defaults 7x6 W/42 W/6,3 kWh, caso extremo 100.000 lm -> 67x15 W com memorial coerente, troca PT/IT ok, matriz multiambiente com titulo traduzido, console sem erros (so goatcounter/localhost).
- Riscos restantes: modelo continua educativo — sem fator de manutencao (Fm ~ 0,8) e com reflexao das paredes fazendo papel de fator de utilizacao (documentado no memorial como simplificacao); tarifa padrao pt-BR de 1,20 R$/kWh possivelmente acima da media ANEEL (needs_external_verification); strings da matriz/explicacao ainda hardcoded em ternarios pt/it no script (funcionais, candidatas a migracao futura para JSON); TEMP_COR_LED e chaves `tabela.*` sao codigo morto removivel.
- Proxima acao recomendada: iniciar Phase A em `mutuo/`.

### 2026-06-10 - mutuo/

- O que foi checado: nucleo puro mutuo-calc.js + testes (conversao de taxa equivalente, PMT, SAC/Price/Americano, extras recorrentes/pontuais, invariantes — refeitos casos a mao, tudo correto); script de UI (overrides de digitacao, conversao ao trocar periodicidade, graficos Chart.js com destroy correto, memorial dinamico); chaves i18n PT/IT usadas no HTML e pelo script; terminologia financeira italiana.
- O que foi alterado: (1) ao trocar a periodicidade (ano/mes), a taxa digitada (override) agora e convertida pela mesma formula de equivalencia usada para o slider — antes o numero era reinterpretado no novo periodo (12% a.a. virava 12% a.m. no calculo, com display divergente); (2) removido codigo morto `aplicarExemplo` + listener `[data-exemplo]` (botoes nao existem no HTML e os seletores de radio estavam errados); (3) adicionadas 12 chaves i18n faltantes usadas no HTML (formula-payment, formula-price-1/2/3, titles/aria.toggleGrafico) e 5 usadas pelo script no grafico de extra recorrente (extra-chart-*) — usuario italiano via fallback em portugues; (4) it-IT: sistema "Tedesco" renomeado para "Americano" em 11 textos — o sistema tedesco (juros antecipados) e outro sistema; o que o app calcula (so juros + principal no fim) e o americano/bullet, e uma chave ja dizia "Sistema Americano" contradizendo as demais; (5) acentuacao corrigida nos textos hardcoded da explicacao ("voce pagara" → "você pagará", "Quitacao" → "Quitação" etc.) e aria-label do tablist traduzido; (6) entrada invalida em campo de texto agora recalcula e restaura o display anterior em vez de manter o texto invalido.
- Por que foi alterado: a taxa digitada com troca de periodicidade produzia calculo silenciosamente errado (severidade alta); "Tedesco" era terminologia financeira incorreta para o sistema bullet; chaves faltantes quebravam a experiencia italiana.
- Arquivos modificados: `mutuo/mutuo-script.js`, `src/i18n/mutuo.json` (mutuo-calc.js e testes intactos).
- Testes executados: validacao JSON, checagem estatica das 119 chaves data-i18n do HTML contra PT/IT (todas presentes), `npm run lint:check`, `npm test` (213), `npm run build`, cache Vitest restaurado; validacao no navegador (Vite dev): digitar 12% a.a. e trocar para mensal exibe 0,949% a.m. com parcela identica (R$ 1.256,30 antes e depois — invariante de equivalencia), IT mostra Italiana/Francese/Americano, grafico extra com rotulos italianos, console sem erros.
- Riscos restantes: nomenclatura "americano" simplifica (no rigor italiano, ammortamento americano classico usa fundo de acumulacao a segunda taxa; aqui e bullet com juros periodicos — descricao textual do app ja explica corretamente o comportamento); chaves internas system-german-* mantidas como identificadores; strings da explicacao continuam em ternarios pt/it no script (candidatas a migracao futura).
- Proxima acao recomendada: iniciar Phase A em `previsao/`.

### 2026-06-10 - previsao/

- O que foi checado: matematica de visualizacao (escalas, gradiente, estacoes astronomicas com inversao por hemisferio, rosa dos ventos, teto historico de chuva — auditor especialista refez as contas, sem erro numerico), uso da API Open-Meteo (parametros, timezone=auto, nulls), persistencia dos 4 slots, i18n inline, seguranca de innerHTML, acessibilidade e descricao do app no index.
- O que foi alterado: (1) excluir Milao/Curitiba agora PERSISTE apos reload — clearSlotCity grava sentinela 'null' em vez de removeItem, impedindo o seedDefaults de re-semear; (2) dados do geocoding/localStorage agora passam por esc() antes de innerHTML (injecao persistente via nome de cidade era possivel com API comprometida); (3) erros de rede mostram mensagem traduzida com o detalhe tecnico entre parenteses (antes: "Failed to fetch" cru) e falha de rede na busca nao finge mais "nenhuma cidade encontrada"; (4) descricoes WMO movidas para o I18N — usuario italiano via tooltips em portugues; (5) defaults alinhados ao site: idioma it-IT e tema light (eram pt-BR/dark so nesta pagina); (6) decimais com locale (virgula em pt/it) nos mm de chuva e coordenadas; (7) a11y: aria-label resumindo cada dia (role=img), SVGs aria-hidden, aria-pressed nos botoes de idioma/tema; (8) cache historico valida por timestamp (mistura UTC/local podia invalidar a toa); (9) GoatCounter adicionado (unica pagina sem analytics); (10) descricao do app no index (pt/it/estatico) atualizada — citava cidades fixas e gatilho de 24°C que nao existem mais.
- Por que foi alterado: exclusao de cidade que "ressuscita" contradiz a UI; paridade bilingue e mensagens de erro honestas sao padrao do site; injecao persistente e barata de fechar.
- Arquivos modificados: `previsao/previsao.html`, `src/i18n/index.json`, `index.html`.
- Testes executados: `npm run lint:check`, `npm test` (213), `npm run build`, cache Vitest restaurado, JSON do index validado; navegador (Vite dev): app carrega dados reais, IT mostra "Parz. nuvoloso"/coordenadas "45,46°", aria-label "Oggi 10/06: Temporale · ↑26° ↓19°...", tema light default, exclusao de Curitiba persistiu apos reload (estado default restaurado ao final), console sem erros.
- Riscos restantes: app continua inline no HTML (fora do padrao <app>-script.js/-styles.css/src/i18n) — extracao exige passo novo de copia no deploy.yml para scripts classicos, adiada e documentada; chaves localStorage sem prefixo engnata_ (fora do limparTodosDados) mantidas por compatibilidade; ~80 linhas de CSS/i18n/funcoes mortas da versao antiga ainda presentes; CSP da pagina permite origens Google nao usadas (boilerplate unificado do site).
- Proxima acao recomendada: iniciar Phase A em `salario/`.

### 2026-06-10 - salario/

- O que foi checado: nucleo salario-calc.js (tabelas 2026 BR/IT, INSS progressivo, IRRF min(tradicional, simplificado), 13º/ferias/aviso previo, IRPEF/detrazioni/trattamento integrativo, INPS com +1% sobre a soglia, tredicesima/quattordicesima com IRPEF marginal sem detrazioni, TFR), isolamento e documentacao das constantes, coerencia entre memorial exibido e constantes do calc, paridade i18n PT/IT, avisos de validade temporal.
- O que foi alterado: NENHUM valor ou formula (testes de 2026 ja cobrem o calc). Mudancas de documentacao e i18n: (1) 22 chaves faltantes no pt-BR adicionadas (opcoes.azienda/fondo e as 20 regioes italianas — usuario PT no modo Italia via fallback estatico); (2) rotulos do memorial atualizados para as tabelas realmente usadas: "Tabela INSS 2026", "Tabela IRRF vigente (desde maio/2024, mantida em 2026)", "Scaglioni IRPEF 2026 (33%)", "Aliquote INPS 2026"; (3) texto INPS italiano corrigido — dizia "9,49% oltre il massimale di €55.008 (2025)" mas o calc usa 9,19% +1% acima da prima fascia de €56.224 (Circolare INPS 6/2026); (4) texto das detrazioni agora explicita que o taper 15k-28k do trattamento integrativo e modelagem do app; (5) nova secao "⚠️ Validade das tabelas / Validità delle tabelle" no memorial dos dois idiomas (valores anuais, finalidade educativa); (6) comentarios de fonte/premissa adicionados no calc para CUSTO_EMPRESA_FATOR 1.70, COSTO_AZIENDA_IT 1.40, teto previdenza €5.164,57 (D.Lgs. 252/2005), rendimentos TFR assumidos 3%/4% e natureza simplificada do taper do trattamento integrativo.
- Por que foi alterado: o memorial citava anos/valores de 2025 enquanto o calc usa 2026 (risco de descredito), e a missao exige constantes documentadas + aviso de atualizacao anual.
- Arquivos modificados: `src/i18n/salario.json`, `salario/salario-script.js` (1 linha — secao aviso), `salario/salario-calc.js` (somente comentarios).
- Testes executados: `npm run lint:check`, `npm test` (213 — inclui as suites fiscais intactas), `npm run build`, cache Vitest restaurado, paridade das 81 chaves data-i18n OK; navegador: memorial PT mostra rotulos 2026 + aviso, memorial IT mostra INPS corrigido e scaglioni 2026, opcao "Lazio (3,33%)" resolvida, console limpo.
- Riscos restantes (needs_external_verification): valores 2026 (INSS teto 8.475,55; IRRF maio/2024; IRPEF 33%; soglia INPS 56.224) documentados com fontes no calc mas nao re-verificados em fonte primaria nesta fase; cuneo fiscale 2025+ da Italia (somma integrativa ≤20k e ulteriore detrazione 20k-40k da LdB 2025) NAO modelado — subestima o liquido italiano em rendas baixas/medias; detrazione familiari simplificada (Assegno Unico nao modelado); redutor IRRF ate R$ 5.000 (2026) nao modelado — ambos ja documentados no codigo. Recomenda-se validacao por contador/commercialista antes de uso nao-educativo.
- Proxima acao recomendada: iniciar Phase A em `ventilacao/`.

### 2026-06-10 - ventilacao/

- O que foi checado: modelo de vazao por efeito vento, atribuicoes normativas (ACH=6, regra de 1/8), fator de orientacao cardeal, validacao de entradas, i18n PT/IT, acessibilidade e aviso educativo.
- O que foi alterado: (1) FORMULA — o modelo assumia ventilacao cruzada ideal (Cv=0,60 da ASHRAE) sobre a SOMA das janelas para qualquer ambiente, dando 200 ACH no caso default e "Excelente" para praticamente tudo; agora ha seletor "Tipo de Ventilacao" com unilateral (default, Cv=0,025 — BS 5925/CIBSE, caso residencial tipico) e cruzada (Cv=0,60 — ASHRAE, com instrucao de informar a area da fachada de entrada); default passa a 450 m³/h → 8,3 ACH → "Boa", e a classificacao semaforica volta a diferenciar (abrigada → 5,8 ACH "Aceitavel"); (2) o fator de orientacao cardeal baseado em "ventos predominantes no Brasil" (premissa falsa e inutil para usuarios italianos) virou exposicao da fachada ao vento LOCAL: a favor 1,00 / obliquo 0,85 / abrigada 0,70; (3) "ACH minimo residencial = 6 (ASHRAE 62.2/NBR 15575)" — atribuicao incorreta (ASHRAE 62.2 usa formula por area+ocupantes; NBR 15575 ~1 ren/h) — rerotulado como alvo educativo de qualidade do ar (recomendacao sanitaria, ex. CDC ≥5 ACH), valor mantido; (4) area minima de 1/8 do piso rerotulada de "NBR 15575" para regra tipica de codigo de obras (a NBR 15575-4 define % por zona bioclimatica, tipicamente 7-12%) em todos os textos, metas e memorial; (5) entrada invalida agora restaura o display e limpa o estado slider-fora-faixa; (6) "OK — excedente" traduzido no modo italiano ("in eccesso"), descricao da vazao com texto italiano proprio, "max" neutro no memorial e decimais via formatarNumero; (7) nova nota educacional no card de resultados explicando que ACH (vazao) e area minima (exigencia construtiva) sao criterios independentes; (8) a11y: tabindex positivos 1-12 removidos, aria-live=polite nos resultados, aria-expanded nos icones de info; (9) linha morta no clamp da animacao removida.
- Por que foi alterado: o resultado numerico enganava o usuario em ordem de grandeza (achado high do auditor de conforto ambiental) e duas referencias normativas eram falsas; ambos minam o proposito educativo.
- Arquivos modificados: `ventilacao/ventilacao-script.js`, `ventilacao/ventilacao.html`, `ventilacao/ventilacao-styles.css`, `src/i18n/ventilacao.json`.
- Testes executados: `npm run lint:check`, `npm run style:check`, `npm test` (213), `npm run build`, cache Vitest restaurado, paridade das 90 chaves data-i18n OK; navegador: default 8,3 ACH "Boa", cruzada 200 ACH, abrigada 5,8 ACH "Aceitavel", memorial coerente com o calculo, IT com rotulos novos ("Sopravvento", "Mancano 0,50 m²"), nota educativa visivel, console limpo.
- Riscos restantes (needs_external_verification): percentual exato de aberturas da NBR 15575-4:2021 por zona bioclimatica nao confirmado em fonte primaria (por isso o rotulo prudente); o alvo de 6 ACH e escolha educativa (nao normativa) e pode ser recalibrado por especialista; efeito chamine nao modelado (documentado); coeficiente unilateral 0,025 e ordem de grandeza da BS 5925 — modelo continua educativo.
- Proxima acao recomendada: relatorio final consolidado + commits.

---

## RELATORIO FINAL — Auditoria Serial Completa (2026-06-10)

### Apps revisados e ordem serial seguida

1. Shared utils (`src/utils/`) → 2. `bugs/` → 3. `sobre/` → 4. `aquecimento/` → 5. `arcondicionado/` → 6. `bitola/` → 7. `bombaagua/` → 8. `chuva/` → 9. `solar/` → 10. `fazenda/` → 11. `helice/` → 12. `iluminacao/` → 13. `mutuo/` → 14. `previsao/` → 15. `salario/` → 16. `ventilacao/`. Todos com Phase A–E completas e checkpoint individual acima.

Apoio adicional: auditoria paralela por agentes especialistas cobriu 8 apps (arcondicionado, bombaagua, helice, iluminacao, previsao, ventilacao, bugs, sobre) com achados estruturados que alimentaram as fases seriais; os demais foram auditados diretamente em serie.

### Arquivos alterados (45 rastreados + 2 novos)

- Compartilhados: `src/utils/formatters.js`, `src/utils/validators.js`, `src/utils/sanitize.js`, `src/utils/utils.test.js` (novo), `local/vitest.config.js`.
- Por app: scripts/HTML/CSS/i18n de bugs, sobre, aquecimento, arcondicionado, bitola, bombaagua, chuva, solar, fazenda, helice, iluminacao, mutuo, previsao (inline), salario, ventilacao + `index.html`/`src/i18n/index.json` (descricao do previsao).
- Documentacao: `AUDITORIA_SERIAL_CHECKLIST.md` (novo, este arquivo).

### Principais bugs e correcoes de formula

| App | Problema | Correcao |
|---|---|---|
| aquecimento | Controle de dias de autonomia nao afetava o calculo (fator fixo 1,5) | Slider agora entra no volume do boiler |
| arcondicionado | Memorial recalculava BTU sem o fator de classe energetica (contas nao fechavam) | Memorial usa o mesmo BTU final do resultado |
| helice | Constante 1056 (mph) usada com velocidade ja em nos | Corrigida para 1215,2 |
| fazenda | Pato de corte caia no fallback minimo | Entrou no ramo correto de animais de corte |
| iluminacao | Fallback silencioso 2×9 W acima de 15.000 lm (resultado ate 55× menor); luz natural padrao reduzia o lux alvo a metade; "10%/m" ensinado mas ~3,7%/m aplicado | Selecao real sem teto (menor potencia; quase-empate → menos lampadas), default "nenhuma" (lux pleno noturno), memorial corrigido |
| mutuo | Taxa digitada nao era convertida ao trocar periodicidade (12% a.a. virava 12% a.m. no calculo); it-IT chamava o sistema bullet de "Tedesco" | Override convertido por equivalencia (parcela invariante verificada); "Americano" no italiano |
| previsao | Excluir cidade-padrao nao persistia (re-seed no boot); innerHTML sem escape com dados do geocoding | Sentinela 'null' no slot; esc() nos pontos de injecao |
| ventilacao | Cv=0,60 (cruzada ideal) para tudo → 200 ACH e tudo "Excelente"; ACH=6 e 1/8 atribuidos erradamente a ASHRAE/NBR | Seletor unilateral (0,025 — BS 5925) × cruzada (0,60); rotulos normativos honestos; exposicao ao vento no lugar de orientacao cardeal |
| bitola/chuva/solar/bombaagua | Chaves i18n erradas, parsing local divergente, "kWh/h" e "kW/h" ambiguos, volumes do memorial divergentes | Corrigidos (ver checkpoints) |

### Padronizacao UI/UX aplicada

- Parsing numerico unificado via `parsearNumero` (vazio/invalido ≠ zero) em todos os apps tocados; entrada invalida restaura o display.
- Avisos "estimativa educacional" e validade temporal de tabelas (salario, ventilacao, iluminacao via memorial prudente).
- i18n: paridade PT/IT verificada por script em todos os apps da fase final (chaves de HTML × JSON); textos hardcoded visiveis corrigidos; acentuacao corrigida em strings dinamicas.
- A11y: aria-pressed (chips/idioma/tema), aria-expanded (info icons), aria-live (resultados ventilacao), tabindex positivos removidos, rotulos para leitores de tela no previsao.
- Referencias normativas reescritas com linguagem honesta (norma cancelada, regra tipica, recomendacao sanitaria) em iluminacao e ventilacao.

### Utilitarios compartilhados

- `formatters.js`: parsing comum endurecido; `validators.js`: numero vazio/invalido; `sanitize.js`: URLs relativas seguras; `src/utils/utils.test.js` novo cobre os tres; Vitest agora inclui `src/**/*.test.js`.
- Duplicatas documentadas para consolidacao futura (ajustarTamanhoInput em dom.js × ui-controls.js; hold-to-repeat copiado em ~10 apps; escapeHtml local em iluminacao/previsao).

### Testes executados

- `npm run lint:check`, `npm test` (213 testes, 23 arquivos — incluindo suites fiscais salario/mutuo e br12c intactas) e `npm run build` (Vite multipage) apos CADA fase; `npm run style:check` na fase ventilacao.
- Validacao em navegador (Vite dev, preview interno): por app — valores default, casos extremos, troca PT/IT, memorial, graficos, persistencia (previsao), console limpo. Home com 16 cards OK.
- Cache `node_modules/.vite/vitest/.../results.json` restaurado apos cada `npm test`.

### Riscos restantes / melhorias futuras

1. previsao/ continua inline no HTML (extracao exige passo de copia no deploy.yml para scripts classicos); chaves localStorage sem prefixo engnata_; ~80 linhas de CSS/i18n mortos.
2. Consolidar helpers duplicados (hold-to-repeat, escapeHtml, input-slider) em src/utils — refactor unico futuro.
3. iluminacao: modelo sem fator de manutencao (Fm) documentado como simplificacao; tarifa default 1,20 R$/kWh possivelmente alta (ANEEL).
4. Strings dinamicas em ternarios pt/it nos scripts (iluminacao matriz, mutuo explicacao, ventilacao explicacao) — candidatas a migracao para JSON.
5. CSP segue com 'unsafe-inline' (risco ja conhecido da auditoria mestra).

### Calculos que exigem verificacao por especialista humano

- salario/: valores 2026 (INSS teto 8.475,55; IRRF maio/2024; IRPEF 33%; soglia INPS 56.224) — documentados com fontes, nao re-verificados em fonte primaria; cuneo fiscale IT 2025+ (somma integrativa/ulteriore detrazione) NAO modelado; redutor IRRF ate R$ 5.000 NAO modelado; validar com contador/commercialista.
- ventilacao/: percentual de aberturas da NBR 15575-4:2021 por zona bioclimatica; calibracao do alvo educativo de 6 ACH.
- arcondicionado/: papel da classe energetica como multiplicador de carga (mantido e documentado; especialista HVAC pode recalibrar).
- iluminacao/: tarifa media ANEEL vigente.
- fazenda/: dados agronomicos do banco local (faixas Embrapa/FAO).

### BR 12C Niobium

**Confirmado: nenhum arquivo rastreado de `br12c/` foi modificado** (`git status --porcelain -- br12c` = 0 mudancas; suites de teste do br12c passam — 204 dos 213 testes). Os unicos artefatos em br12c/ sao itens nao rastreados pre-existentes (node_modules e probes de teste locais), fora do escopo desta auditoria.
