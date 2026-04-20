# Roadmap do Projeto

Panorama do estado atual do portfólio Engenharia NATA, com foco no que já está publicado, no próximo bloco de apps e nas melhorias técnicas que ajudam a manter o projeto consistente.

## Snapshot atual

- Portfólio estático com 14 páginas/apps publicadas.
- Núcleo atual cobre engenharia residencial, energia, água, finanças e planejamento rural.
- Idiomas suportados: `pt-BR` e `it-IT`.
- Qualidade local hoje depende principalmente de `npm run validate`, revisão manual dos apps alterados e sincronização de documentação.

## Entregues

- [x] `sobre/` - página institucional do projeto
- [x] `bugs/` - formulário de reporte de problemas e sugestões
- [x] `mutuo/` - calculadora de empréstimos com SAC, Price e Americano
- [x] `salario/` - salário líquido Brasil/Itália com memorial e gráficos
- [x] `solar/` - dimensionamento fotovoltaico off-grid com configuração local
- [x] `aquecimento/` - aquecimento solar térmico
- [x] `arcondicionado/` - dimensionamento de BTU e multi-split
- [x] `bitola/` - calculadora de bitola de cabos elétricos
- [x] `iluminacao/` - calculadora de iluminação residencial
- [x] `ventilacao/` - ventilação natural residencial
- [x] `chuva/` - captação de água da chuva e cisterna
- [x] `bombaagua/` - bomba d'água, perdas e consumo
- [x] `helice/` - calculadora de passo de hélice
- [x] `fazenda/` - planejador de fazenda auto-sustentável

## Próximo app sugerido

### `isolamento/`

Calculadora de isolamento térmico para paredes e cobertura.

- Entradas principais: área, material, clima e temperatura desejada.
- Saídas esperadas: perda/ganho de calor, espessura sugerida e impacto em aquecimento/resfriamento.
- Valor para o portfólio: conecta bem com `arcondicionado/`, `aquecimento/` e `ventilacao/`.

## Backlog prioritário de novos apps

1. `caixadagua/` - volume ideal da caixa d'água, demanda diária e dias de reserva.
2. `irrigacao/` - necessidade diária de água, agenda de irrigação e demanda de bomba.
3. `composteira/` - tamanho da composteira e produção estimada de composto.
4. `estufa/` - área de ventilação, aquecimento e produtividade sazonal.
5. `piscina/` - aquecimento de piscina com coletores ou resistência.
6. `filtroagua/` - filtragem básica, vazão e custo estimado.
7. `gerador/` - gerador ou backup por bateria para cargas essenciais.
8. `carregadorve/` - carregador veicular residencial e tempo de recarga.
9. `horta/` - horta urbana com área, insolação e produtividade.
10. `camarafria/` - refrigeração de pequena câmara fria.

## Melhorias técnicas prioritárias

1. Automatizar parte do smoke test dos apps mais críticos, especialmente idioma, memorial e renderização inicial.
2. Reduzir manutenção manual da página `sobre/`, hoje dependente de atualização explícita quando entram apps novos ou mudam métricas.
3. Consolidar convenções de estrutura entre apps legados e apps mais novos para diminuir divergência visual e de markup.
4. Tornar o fluxo de release mais previsível, sempre sincronizando `README.md`, `ROADMAP.md`, `PRE_COMMIT.md`, `src/i18n/sobre.json`, `sobre/sobre.html`, `config/versions.json` e `sitemap.xml`.
5. Eliminar warnings do build do Vite causados por scripts legados não-module, em especial `Chart.js` UMD e `fazenda-database.js`.

## Critérios para próximos apps

- Manter cálculo prático e explicação didática no navegador.
- Preservar i18n `pt-BR` / `it-IT`.
- Reutilizar `src/core/`, `src/utils/` e CSS compartilhado antes de criar código duplicado.
- Priorizar apps que se conectem com os já publicados, formando trilhas temáticas de energia, água, conforto e finanças.
