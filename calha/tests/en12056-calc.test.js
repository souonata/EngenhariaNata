// Núcleo da EN 12056-3:2000 (versão 4.0, italiano e sueco). Confere o núcleo contra:
//  - as tabelas da própria norma (6, 8 e C.1);
//  - uma referência independente em tests/referencia/en12056-ref.js;
//  - os exemplos resolvidos do manual SR 620 (HR Wallingford), com a tolerância documentada.
// Vitest: `npm test` a partir de local/.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as REF from './referencia/en12056-ref.js';

const require = createRequire(import.meta.url);
const E = require('../en12056-calc.js');
const D = require('../en12056-dados.js');
const NAC = require('../en12056-nacional.js');

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const codigos = (r) => r.avisos.map((a) => a.codigo);

/* ----------------------------------------------------------------- */
/* Tabelas da norma                                                   */
/* ----------------------------------------------------------------- */

test('Tabela 8 sai da equação de Wyly-Eaton nos dois enchimentos', () => {
  [0.2, 0.33].forEach((f) => {
    D.TABELA8.diametros.forEach((di, k) => {
      const impresso = D.TABELA8.Q[f][k];
      const calc = E.condutor({ di, f }).Q;
      // A tabela é impressa com uma casa decimal; 0,2 % cobre o resto do arredondamento.
      perto(calc, impresso, 0.05 + impresso * 0.002, `Tabela 8 di=${di} f=${f}`);
      perto(calc, REF.condutor(di, f), 1e-9, `núcleo vs referência di=${di}`);
    });
  });
});

test('Tabela C.1 inteira sai do Colebrook-White com o Di real de cada DN', () => {
  D.TABELA_C1.dn.forEach((dn) => {
    const di = D.DI_TABELA_C1[dn];
    D.TABELA_C1.declividades.forEach((i, k) => {
      const [Q, v] = D.TABELA_C1.valores[dn][k];
      const r = E.coletor({ di, i });
      perto(r.Q, Q, 0.06, `C.1 DN${dn} i=${i} vazão`);
      perto(r.v, v, 0.051, `C.1 DN${dn} i=${i} velocidade`);
      perto(r.Q, REF.coletor(di, i).Q, 1e-9, `núcleo vs referência DN${dn}`);
    });
  });
});

test('Tabela 6: calha curta não tem redução, e acima de L/W 500 sai do domínio', () => {
  const curta = E.fatorComprimento({ W: 100, L: 5000 });
  assert.equal(curta.FL, 1);
  assert.equal(curta.curta, true);

  const longa = E.fatorComprimento({ W: 100, L: 20000 }); // L/W = 200, nivelada
  perto(longa.FL, 0.8, 1e-9, 'FL tabelado');
  perto(longa.FL, REF.FLnivelada(200), 1e-9, 'FL vs referência');

  const meio = E.fatorComprimento({ W: 75, L: 12500 }); // L/W = 166,7
  perto(meio.FL, REF.FLnivelada(12500 / 75), 1e-9, 'FL interpolado');

  const fora = E.fatorComprimento({ W: 20, L: 20000 }); // L/W = 1000
  assert.equal(fora.FL, null);
  assert.equal(E.situacao(fora.avisos), 'fora_do_dominio');
});

test('Tabela 6: declividade só conta se o trecho cai para a própria saída', () => {
  const nivel = E.fatorComprimento({ W: 100, L: 20000, declividade: 3 });
  perto(nivel.FL, 0.8, 1e-9, 'até 3 mm/m projeta-se como nivelada');

  const inclinada = E.fatorComprimento({ W: 100, L: 20000, declividade: 6, caimentoParaSaida: true });
  perto(inclinada.FL, 1.25, 1e-9, 'coluna de 6 mm/m');

  const intermediaria = E.fatorComprimento({ W: 100, L: 20000, declividade: 7, caimentoParaSaida: true });
  perto(intermediaria.FL, 1.25, 1e-9, 'usa a declividade tabelada de baixo');
  assert.ok(codigos(intermediaria).includes('declividade-arredondada'));

  const semCaimento = E.fatorComprimento({ W: 100, L: 20000, declividade: 8, caimentoParaSaida: false });
  perto(semCaimento.FL, 0.8, 1e-9, 'sem caimento para a saída, projeta-se como nivelada');
  assert.ok(codigos(semCaimento).includes('caimento-nao-aproveitado'));
});

test('Tabela 5: bordo livre bate com a referência nas três faixas', () => {
  [50, 84, 85, 120, 250, 251, 400].forEach((Z) => perto(E.bordoLivre(Z), REF.bordoLivre(Z), 1e-12, `bordo livre Z=${Z}`));
  perto(E.bordoLivre(85), 25.5, 1e-12, 'em Z = 85 já vale 0,3·Z');
});

/* ----------------------------------------------------------------- */
/* Figuras 5, 6 e 10 (curvas lidas do vetor do PDF)                   */
/* ----------------------------------------------------------------- */

test('Figuras 5, 6 e 10: pontos de controle e distância conhecida dos ajustes da SR 620', () => {
  perto(E.Fd(1), 1, 0.002, 'calha quadrada tem Fd = 1');
  perto(E.Fs(1), 1, 0.002, 'calha de fundo plano tem Fs = 1');
  perto(E.Fs(0.001), 0.891, 0.003, 'triangular tem Fs ≈ 0,89');
  assert.equal(E.Fd(3.5), null, 'fora do eixo da figura não inventa valor');
  assert.equal(E.Fh(1.4), null, 'fora do eixo da figura não inventa valor');

  // Desvios medidos em 19/09/2026 entre a curva da norma e os ajustes publicados na SR 620.
  let maxFd = 0;
  let maxFs = 0;
  let maxFh = 0;
  for (let x = 0.02; x <= 0.999; x += 0.01) {
    maxFd = Math.max(maxFd, Math.abs(REF.FdAjuste(x) / E.Fd(x) - 1));
    maxFs = Math.max(maxFs, Math.abs(REF.FsAjuste(x) / E.Fs(x) - 1));
    maxFh = Math.max(maxFh, Math.abs(REF.FhAjuste(x) / E.Fh(x) - 1));
  }
  assert.ok(maxFd < 0.03, `Fd: ajuste da SR 620 a ${(maxFd * 100).toFixed(1)} % da curva`);
  assert.ok(maxFs < 0.005, `Fs: ajuste a ${(maxFs * 100).toFixed(2)} % da curva`);
  assert.ok(maxFh < 0.03, `Fh: ajuste a ${(maxFh * 100).toFixed(1)} % da curva`);
});

/* ----------------------------------------------------------------- */
/* 4 — chuva, área e vazão                                            */
/* ----------------------------------------------------------------- */

test('4.2.2: intensidade da Tabela 1 multiplicada pelo fator de risco da Tabela 2', () => {
  const r = E.intensidade({ via: 'tabela1', rBase: 0.02, risco: 'interna' });
  perto(r.r, 0.04, 1e-12, 'r = 0,020 × 2,0');
  assert.equal(r.situacao, 'atende');

  const fora = E.intensidade({ via: 'tabela1', rBase: 0.0181, risco: 'beiral' });
  assert.ok(codigos(fora).includes('fora-da-tabela1'));
});

test('4.2.1: com dado estatístico o fator de risco não se aplica', () => {
  const r = E.intensidade({ via: 'estatistica', r: 0.0181, risco: 'interna' });
  perto(r.r, 0.0181, 1e-12, 'r estatístico entra como está');
  assert.equal(r.fator, 1);
  assert.ok(codigos(r).includes('risco-nao-se-aplica'));
});

test('fator climático é opcional, fica marcado e nunca entra sozinho', () => {
  const sem = E.intensidade({ via: 'pratica-nacional', rBase: 0.0181, risco: 'beiral' });
  perto(sem.r, 0.0181, 1e-12, 'sem fator climático');
  const com = E.intensidade({ via: 'pratica-nacional', rBase: 0.0181, risco: 'beiral', kf: 1.25 });
  perto(com.r, 0.0181 * 1.25, 1e-12, 'com fator climático');
  assert.ok(codigos(com).includes('fator-climatico'));
  assert.ok(codigos(com).includes('base-pratica-nacional'));
  assert.equal(E.intensidade({ via: 'inventada', rBase: 0.02, risco: 'beiral' }).situacao, 'invalida');
  assert.equal(E.intensidade({ via: 'tabela1', rBase: 0.02 }).situacao, 'incompleta');
});

test('4.3: área efetiva sem vento é o padrão, e parede só conta com vento', () => {
  const semVento = E.areaEfetiva({ LR: 10, BR: 4 });
  perto(semVento.A, 40, 1e-12, 'A = LR · BR');

  const comVento = E.areaEfetiva({ LR: 10, BR: 4, HR: 2, vento: 'chuva-26-graus' });
  perto(comVento.A, 50, 1e-12, 'A = LR · (BR + HR/2)');
  assert.ok(codigos(comVento).includes('vento-considerado'));

  const parede = E.areaEfetiva({ LR: 10, BR: 4, HR: 2, vento: 'chuva-26-graus', paredes: [20] });
  perto(parede.A, 60, 1e-12, '50 % da parede entra na área');

  const paredeSemVento = E.areaEfetiva({ LR: 10, BR: 4, paredes: [20] });
  perto(paredeSemVento.A, 40, 1e-12, 'sem vento a parede não entra');
  assert.ok(codigos(paredeSemVento).includes('paredes-sem-vento'));

  perto(E.areaEfetiva({ LR: 10, BR: 3, HR: 4, vento: 'chuva-perpendicular' }).A, 50, 1e-12, 'A = LR · TR');
  assert.equal(E.areaEfetiva({ LR: 10 }).situacao, 'incompleta');
});

test('4.1: Q = r · A · C', () => {
  perto(E.vazao({ r: 0.04, A: 120 }).Q, 4.8, 1e-12, 'vazão de projeto');
  assert.ok(codigos(E.vazao({ r: 0.04, A: 120, C: 0.8 })).includes('coeficiente-escoamento'));
  assert.equal(E.vazao({ r: 0.04 }).situacao, 'incompleta');
});

/* ----------------------------------------------------------------- */
/* 5 — calhas                                                         */
/* ----------------------------------------------------------------- */

test('5.1.2: meia-cana de beiral — exemplo 2 da SR 620 (150 mm, L = 12,5 m)', () => {
  const r = E.calha({ tipo: 'beiral', forma: 'semicircular', dims: { D: 150 }, L: 12500, Q: 1.75 });
  perto(r.geometria.area, REF.areaSemicircular(150), 1e-9, 'AE = π·D²/8');
  perto(r.geometria.area, 8836, 1, 'AE do exemplo');
  perto(r.geometria.W, 75, 1e-12, 'W = D/2');
  perto(r.QN, REF.QN_semicircular(r.geometria.area), 1e-12, 'QN vs referência');
  perto(r.QN, 2.38, 0.02, 'QN do exemplo');
  perto(r.FL, 0.84, 0.005, 'FL do exemplo (a SR 620 usa 0,844, do ajuste dela)');
  perto(r.Qcap, 1.8, 0.03, 'capacidade de projeto do exemplo');
  assert.equal(r.ok, true);
  assert.equal(r.situacao, 'atende');
});

test('5.2.3: calha interna trapezoidal — exemplo 3 da SR 620', () => {
  // Calha V do exemplo: fundo 250 mm, profundidade 175 mm, um lado a 45°, trecho de 15 m.
  const r = E.calha({
    tipo: 'interna', forma: 'trapezoidal', dims: { S: 250, T: 425, Z: 175 },
    L: 15000, Q: 10.45,
  });
  perto(r.geometria.bordoLivre, 52.5, 1e-12, 'bordo livre = 0,3·Z');
  perto(r.geometria.W, 122.5, 1e-12, 'W = Z − bordo livre');
  perto(r.geometria.T, 372.5, 1e-9, 'largura na linha d’água');
  perto(r.geometria.area, REF.areaTrapezio(250, 372.5, 122.5), 1e-9, 'AW vs referência');
  perto(r.geometria.area, 37942, 250, 'AW do exemplo (lá arredondado com W = 122)');
  perto(r.Fd, REF.FdAjuste(122.5 / 372.5), 0.02, 'Fd perto do ajuste da SR 620');
  perto(r.Fs, REF.FsAjuste(250 / 372.5), 0.005, 'Fs perto do ajuste da SR 620');
  perto(r.QN, REF.QSV(r.geometria.area) * r.Fd * r.Fs, 1e-12, 'QN vs referência');
  perto(r.FL, REF.FLnivelada(15000 / 122.5), 1e-12, 'FL interpolado');
  perto(r.Qcap, 12.4, 0.6, 'capacidade do exemplo (a SR 620 usa os ajustes dela)');
  assert.equal(r.ok, true);
});

test('5.2.7: obstrução desconta o dobro da área', () => {
  const base = E.calha({ tipo: 'interna', forma: 'retangular', dims: { T: 300, Z: 200 }, L: 5000 });
  const com = E.calha({ tipo: 'interna', forma: 'retangular', dims: { T: 300, Z: 200 }, L: 5000, obstrucao: 1000 });
  perto(base.geometria.area - com.geometria.area, 2000, 1e-9, 'desconta 2× a área obstruída');
  assert.ok(com.Qcap < base.Qcap);
});

test('5.1.8 e 5.3.3: ângulo maior que 10° e ralo reduzem a capacidade', () => {
  const p = { tipo: 'beiral', forma: 'semicircular', dims: { D: 150 }, L: 5000 };
  const simples = E.calha(p);
  const comAngulo = E.calha(Object.assign({}, p, { angulo: true }));
  const comRalo = E.calha(Object.assign({}, p, { ralo: true }));
  perto(comAngulo.Qcap, simples.Qcap * 0.85, 1e-12, 'fator 0,85');
  perto(comRalo.Qcap, simples.Qcap * 0.5, 1e-12, 'fator 0,5');
});

test('a EN não cobre meia-cana como calha interna: sem suporte, não "atende"', () => {
  const r = E.calha({ tipo: 'interna', forma: 'semicircular', dims: { D: 200 }, L: 5000, Q: 1 });
  assert.equal(r.Qcap, null);
  assert.equal(r.situacao, 'sem_suporte');
  assert.ok(codigos(r).includes('meia-cana-interna'));
});

test('entrada inválida ou fora das figuras nunca devolve capacidade', () => {
  assert.equal(E.calha({ tipo: 'beiral', forma: 'retangular', dims: { T: 0, Z: 100 }, L: 1000 }).situacao, 'invalida');
  assert.equal(E.calha({ tipo: 'torta', forma: 'retangular', dims: { T: 100, Z: 100 }, L: 1000 }).situacao, 'invalida');
  // W/T = 4 está fora do eixo da Figura 5 (vai até 3).
  const funda = E.calha({ tipo: 'beiral', forma: 'retangular', dims: { T: 50, Z: 200 }, L: 1000, Q: 1 });
  assert.equal(funda.Qcap, null);
  assert.equal(funda.situacao, 'fora_do_dominio');
});

test('ensaio (anexo A) substitui o cálculo, mas o 0,9 continua', () => {
  const r = E.calha({ tipo: 'beiral', forma: 'semicircular', dims: { D: 150 }, L: 1000, QNensaio: 3 });
  perto(r.Qcap, 2.7, 1e-12, 'QL = 0,9 · QN de ensaio');
  assert.ok(codigos(r).includes('capacidade-por-ensaio'));
});

/* ----------------------------------------------------------------- */
/* 5.3 — bocais                                                       */
/* ----------------------------------------------------------------- */

test('Tabela 7: vertedor e orifício se encontram em h = D/2', () => {
  const D0 = 100;
  perto(E.capacidadeBocal({ tipo: 'circular', D: D0, h: 50 }).Q,
    E.capacidadeBocal({ tipo: 'circular', D: D0, h: 50.0001 }).Q, 1e-3, 'continuidade entre os dois regimes');
  perto(E.capacidadeBocal({ tipo: 'circular', D: D0, h: 40 }).Q, REF.bocalCircular(D0, 40), 1e-12, 'vertedor vs referência');
  perto(E.capacidadeBocal({ tipo: 'circular', D: D0, h: 80 }).Q, REF.bocalCircular(D0, 80), 1e-12, 'orifício vs referência');
  perto(E.capacidadeBocal({ tipo: 'circular', D: D0, h: 40, grelha: true }).Q,
    REF.bocalCircular(D0, 40, 0.5), 1e-12, 'grelha: kO = 0,5');
  perto(E.capacidadeBocal({ tipo: 'nao-circular', LW: 400, AO: 10000, h: 40 }).Q,
    REF.bocalNaoCircular(400, 10000, 40), 1e-12, 'bocal não circular');
});

test('exemplo 4 da SR 620: carga disponível e capacidade do bocal cônico', () => {
  const g = E.geometria({ tipo: 'interna', forma: 'trapezoidal', dims: { S: 250, T: 425, Z: 175 } });
  const h = E.cargaDisponivel(g);
  perto(h, 60.2, 1.5, 'h = Fh · W (a SR 620 chega a 61,4 com o ajuste dela)');

  const D0 = E.diametroEfetivo({ borda: 'conico', DO: 250, di: 175, LT: 300 });
  perto(D0.D, 250, 1e-12, 'bocal cônico: D = DO');
  assert.equal(D0.situacao, 'atende');

  const q = E.capacidadeBocal({ tipo: 'circular', D: D0.D, h, Q: 12.4 });
  assert.equal(q.regime, 'vertedor');
  perto(q.Q, 15.8, 0.6, 'capacidade do bocal do exemplo');
  assert.equal(q.situacao, 'atende', 'a ponta descarrega livre');

  const central = E.capacidadeBocal({ tipo: 'circular', D: D0.D, h, Q: 24.8 });
  assert.equal(central.situacao, 'nao_atende', 'o bocal central não descarrega livre');
});

test('Figura 9: geometria do bocal fora dos limites sai do domínio (errata da SR 620)', () => {
  assert.equal(E.diametroEfetivo({ borda: 'conico', DO: 250, di: 150, LT: 300 }).situacao, 'fora_do_dominio');
  assert.equal(E.diametroEfetivo({ borda: 'conico', DO: 250, di: 175, LT: 200 }).situacao, 'fora_do_dominio');
  const arred = E.diametroEfetivo({ borda: 'arredondado', DO: 200, di: 150, R: 40 });
  perto(arred.D, 180, 1e-12, 'borda arredondada: D = 0,9·DO');
  assert.equal(E.diametroEfetivo({ borda: 'arredondado', DO: 200, di: 150, R: 10 }).situacao, 'fora_do_dominio');
  perto(E.diametroEfetivo({ borda: 'vivo', DO: 100 }).D, 100, 1e-12, 'aresta viva: D = DO');
});

test('bocal dimensionado inverte a Tabela 7 e a folga de 5 % é cobrada', () => {
  const alvo = E.diametroBocalCircular({ Q: 5, h: 40 });
  perto(E.capacidadeBocal({ tipo: 'circular', D: alvo.D, h: 40 }).Q, 5, 1e-9, 'diâmetro devolve a vazão pedida');
  const estreito = E.capacidadeBocal({ tipo: 'circular', D: 100, h: 40, folga: 2 });
  assert.equal(estreito.situacao, 'fora_do_dominio');
});

test('5.3.2: bocal de calha de sola não plana é dado por área, não por fórmula', () => {
  const r = E.bocalSolaNaoPlana({ Q: 2, f: 0.33 });
  assert.equal(r.di, 55, 'menor condutor da Tabela 8 que passa 2 l/s (55 mm dá 2,2 l/s)');
  perto(r.areaMinima, 2 * ((Math.PI * 55 * 55) / 4), 1e-9, 'duas vezes a seção do condutor');
});

test('5.3.5: caixa coletora devolve o comprimento de vertedor da Figura 12', () => {
  const r = E.caixaColetora({ Q: 12.4, h: 60 });
  perto((r.LW * Math.pow(60, 1.5)) / 24000, 12.4, 1e-9, 'inverso da fórmula do vertedor');
});

/* ----------------------------------------------------------------- */
/* 6 — condutores e coletores                                         */
/* ----------------------------------------------------------------- */

test('6.1.1: enchimento fora da faixa 0,20–0,33 é entrada inválida', () => {
  assert.equal(E.condutor({ di: 100, f: 0.5 }).situacao, 'invalida');
  assert.equal(E.condutor({ di: 100, f: 0.1 }).situacao, 'invalida');
  perto(E.condutor({ di: 100 }).Q, 10.7, 0.05, 'f = 0,33 é o padrão da norma');
});

test('dimensionar condutor usa o valor impresso da Tabela 8 e avisa do risco de entupimento', () => {
  const r = E.dimensionarCondutor({ Q: 10, f: 0.33 });
  assert.equal(r.di, 100);
  assert.equal(r.escolhido.fonte, 'Tabela 8');
  perto(r.escolhido.Q, 10.7, 1e-12, 'valor impresso');

  const pequeno = E.dimensionarCondutor({ Q: 1.5, f: 0.33 });
  assert.equal(pequeno.di, 50);
  assert.ok(codigos(pequeno).includes('risco-de-entupimento'));

  const comCatalogo = E.dimensionarCondutor({ Q: 10, f: 0.33, tubos: [{ dn: 110, di: 103.6 }, { dn: 125, di: 119 }] });
  assert.equal(comCatalogo.escolhido.fonte, 'Wyly-Eaton', 'tubo de catálogo calcula pelo Di real');
  assert.equal(comCatalogo.di, 103.6);
});

test('6.3.3: coletor não pode ser menor que o condutor nem abaixo de DN 100', () => {
  const menor = E.coletor({ di: 90, i: 0.01, diCondutor: 100, dn: 90 });
  assert.equal(menor.situacao, 'nao_atende');
  assert.ok(codigos(menor).includes('coletor-menor-que-condutor'));
  assert.ok(codigos(menor).includes('coletor-abaixo-do-dn-minimo'));

  const esc = E.dimensionarColetor({ Q: 20, i: 0.01 });
  assert.equal(esc.escolhido.dn, 200, 'DN 150 dá 12,8 l/s e DN 200 dá 23,7 l/s');
});

/* ----------------------------------------------------------------- */
/* Dimensionamento direto (base do modo simples)                      */
/* ----------------------------------------------------------------- */

test('menor meia-cana e menor retangular são as menores que ainda escoam', () => {
  const meia = E.menorMeiaCana({ Q: 2.5, L: 10000, passo: 5 });
  assert.ok(meia.calha.Qcap >= 2.5);
  const menor = E.calha({ tipo: 'beiral', forma: 'semicircular', dims: { D: meia.D - 5 }, L: 10000 });
  assert.ok(menor.Qcap < 2.5, 'a medida logo abaixo não escoa');

  const ret = E.menorRetangular({ Q: 2.5, L: 10000, passo: 5 });
  assert.ok(ret.calha.Qcap >= 2.5);
  perto(ret.T, 2 * ret.Z, 5, 'proporção 2:1 pedida');
});

/* ----------------------------------------------------------------- */
/* Parâmetros nacionais                                               */
/* ----------------------------------------------------------------- */

test('Dahlström (2010) reproduz os valores publicados', () => {
  perto(NAC.dahlstrom2010({ anos: 10, minutos: 36 }).i, 102, 0.5, '10 anos, 36 min');
  perto(NAC.dahlstrom2010({ anos: 10, minutos: 25 }).i, 131, 0.5, '10 anos, 25 min');
  perto(NAC.dahlstrom2010({ anos: 5, minutos: 10 }).r, 0.0181, 0.0002, 'chuva sueca de projeto');
  assert.equal(NAC.dahlstrom2010({ anos: 0, minutos: 10 }), null);
});

test('padrões nacionais: sueco por estatística × risco, italiano pela Tabela 1', () => {
  const sv = NAC.SUECIA.chuva;
  const rSv = E.intensidade({ via: sv.via, rBase: sv.rBase, risco: 'beiral' });
  perto(rSv.r, sv.rBase, 1e-12, 'fator de risco 1,0 em calha de beiral');
  assert.ok(codigos(rSv).includes('base-pratica-nacional'));

  const it = NAC.ITALIA.chuva;
  assert.ok(D.TABELA1.includes(it.rBase), 'o valor italiano é um da Tabela 1');
  const rIt = E.intensidade({ via: it.via, rBase: it.rBase, risco: 'interna' });
  perto(rIt.r, 0.08, 1e-12, '0,04 × 2,0');
  assert.equal(rIt.situacao, 'atende');
  assert.equal(NAC.SUECIA.fatorClimatico.padrao, 1, 'fator climático não entra sozinho');
});

test('probabilidade de excedência na vida útil', () => {
  perto(E.probabilidadeExcedencia(5, 50), 1 - Math.pow(0.8, 50), 1e-12, 'fórmula');
  perto(E.probabilidadeExcedencia(100, 50), 0.395, 0.002, '100 anos em 50 anos de vida');
  assert.equal(E.probabilidadeExcedencia(0, 50), null);
});
