# Roadmap de Proximos Apps

Panorama atualizado do portfolio Engenharia NATA, separando o que ja foi entregue do backlog real de proximas calculadoras.

## Entregues

- ✅ `sobre/` - pagina institucional do projeto
- ✅ `mutuo/` - calculadora de emprestimos com SAC, Price e Americano
- ✅ `solar/` - dimensionamento fotovoltaico off-grid
- ✅ `arcondicionado/` - dimensionamento de BTU e multi-split
- ✅ `aquecimento/` - aquecimento solar termico
- ✅ `helice/` - calculadora de passo de helice
- ✅ `bitola/` - calculadora de bitola de fios
- ✅ `fazenda/` - planejador de fazenda auto-sustentavel
- ✅ `chuva/` - captacao de agua da chuva e cisterna
- ✅ `bombaagua/` - bomba d'agua, perdas e consumo
- ✅ `iluminacao/` - iluminacao residencial LED
- ✅ `ventilacao/` - ventilacao natural residencial
- ✅ `salario/` - salario liquido Brasil/Italia com memorial e graficos
- ✅ `bugs/` - formulario de reporte de problemas

## Proximo Sugerido

- 🔜 `isolamento/` - calculadora de isolamento termico para paredes e cobertura
  Entradas: area, material, clima e temperatura desejada.
  Saidas: perda/ganho de calor, espessura sugerida e impacto em aquecimento/resfriamento.

## Backlog Prioritario

1. `caixadagua/` - volume ideal da caixa d'agua, demanda diaria e dias de reserva.
2. `irrigacao/` - necessidade diaria de agua, agenda de irrigacao e demanda de bomba.
3. `composteira/` - tamanho da composteira e producao estimada de composto.
4. `estufa/` - area de ventilacao, aquecimento e produtividade sazonal.
5. `piscina/` - aquecimento de piscina com coletores ou resistencia.
6. `filtroagua/` - filtragem basica, vazao e custo estimado.
7. `gerador/` - gerador ou backup por bateria para cargas essenciais.
8. `carregadorve/` - carregador veicular residencial e tempo de recarga.
9. `horta/` - horta urbana com area, insolacao e produtividade.
10. `camarafria/` - refrigeracao de camara fria pequena.

## Notas

- O portfolio atual ja cobre energia, agua, ventilacao, agricultura, financas e utilidades residenciais.
- Os proximos apps devem manter o padrao atual: calculo pratico, memorial explicativo, i18n pt-BR/it-IT e visualizacao grafica quando fizer sentido.
- Sempre que um app novo entrar no `index`, lembrar de alinhar `config/versions.json`, `src/i18n/index.json`, `README.md` e `sitemap.xml`.
