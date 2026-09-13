// Onda 1 do plano de 13/09/2026: nenhum canal pode dizer "atende" com entrada inválida ou
// incompleta, dado de chuva sem suporte, H acima da calha ou leitura fora do ábaco.
// Vitest: `npm test` a partir de local/.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as REF from './referencia/nbr10844-ref.js';

const require = createRequire(import.meta.url);
const N = require('../nbr10844-calc.js');
const E = require('../calha-estado.js');
const P = require('../calha-projeto.js');
const M = require('../calha-memorial.js');
const REL = require('../calha-relatorio.js');

function residencia(ajuste) {
  const e = E.EXEMPLOS.residencia().estado;
  ajuste(e, e.calhas[0]);
  return { e, r: P.calcularProjeto(e) };
}

// Os canais de saída que não dependem do navegador: estados, pendências, resposta direta,
// memorial (conclusão) e relatório em PDF (selos e faixa de situação).
function canais(e, r) {
  const html = REL.relatorio(r, e, { data: '13/09/2026' });
  return {
    calhas: r.calhas.map((R) => R.status),
    trechos: r.trechos.map((T) => T.status),
    projeto: r.status,
    selosPdf: (html.match(/class="selo [a-z]*">[^<]*/g) || []).map((s) => s.replace(/.*">/, '')),
    faixa: (html.match(/class="rel-faixa [^"]*"><p><b>([^<]*)/) || [])[1],
    conclusao: M.memorial(r, e).conclusao,
    resposta: r.calhas.map((R) => (P.respostaCalha(R) || {}).status),
  };
}

function semAtende(c, msg) {
  assert.ok(!c.calhas.includes('ok'), msg + ': calha "atende"');
  assert.notEqual(c.projeto, 'ok', msg + ': projeto "atende"');
  assert.ok(!c.selosPdf.includes('atende'), msg + ': selo "atende" no PDF');
  assert.ok(c.faixa && c.faixa !== 'Situação: atende', msg + ': faixa do PDF');
  assert.ok(!c.resposta.includes('ok'), msg + ': resposta direta');
  assert.match(c.conclusao, /^Situação do projeto: /, msg + ': conclusão do memorial');
}

test('C2: Congonhas com T = 25 (sem dado na Tabela 5) não atende em nenhum canal', () => {
  const { e, r } = residencia((e) => { e.localId = E.idLocal('São Paulo/SP (Congonhas)'); e.T = 25; });
  assert.equal(r.chuva.estado, 'sem_suporte');
  assert.ok(r.calhas.every((R) => R.status === 'semsuporte'));
  semAtende(canais(e, r), 'Congonhas');
  assert.match(M.memorial(r, e).grupos[0].passos[0][2][0], /pedido T = 25 anos; o valor usado refere-se a T = 5 anos/);
  assert.equal(P.pendencias(r, e)[0].item, '5.1');
  // Os oito postos sem coluna de 25 anos seguem a mesma regra.
  const semT25 = N.DADOS.TABELA5.filter((l) => l.I[25] == null);
  assert.equal(semT25.length, 8);
  semT25.forEach((l) => {
    const { r: rr } = residencia((x) => { x.localId = l.id; x.T = 25; });
    assert.equal(rr.chuva.estado, 'sem_suporte', l.local);
  });
});

test('C3 e D1: valor inconsistente bloqueia; período do dado menor e coerente fica com ressalva', () => {
  const sc = residencia((e) => { e.localId = E.idLocal('São Carlos/SP'); e.T = 25; }).r;
  assert.equal(sc.chuva.estado, 'sem_suporte');
  const aviso = sc.chuva.avisos51.find((a) => a.codigo === 'CHUVA_INCONSISTENTE');
  assert.match(aviso.texto, /161 mm\/h.*T = 10 anos.*nota b.*178 mm\/h/);
  assert.equal(sc.status, 'semsuporte');

  // Calha folgada (250 × 150) para que só a chuva decida a situação.
  [['Cruz Alta/RS', 25], ['Porto Alegre/RS', 25], ['Rio Branco/AC', 5]].forEach(([local, T]) => {
    const { e, r } = residencia((x, c) => { x.localId = E.idLocal(local); x.T = T; Object.assign(c, { b: 250, h: 150 }); });
    assert.equal(r.chuva.estado, 'ressalva', local);
    assert.ok(r.calhas.every((R) => R.status === 'ressalva'), local);
    const c = canais(e, r);
    assert.equal(c.projeto, 'ressalva', local);
    assert.match(c.faixa, /atende com ressalva/, local);
    assert.ok(!c.selosPdf.includes('atende'), local + ': nenhum selo de "atende" puro');
  });
  assert.equal(residencia((x) => { x.localId = E.idLocal('Curitiba/PR'); x.T = 25; }).r.chuva.estado, 'atende');

  // Varredura: "atende" puro só quando o período do dado é o pedido.
  N.DADOS.TABELA5.forEach((l) => [1, 5, 25].forEach((T) => {
    const ch = N.intensidade({ modo: 'tabela', localId: l.id, T });
    if (ch.estado === 'atende') assert.equal(l.Treal[T], T, l.local + ' T' + T);
  }));
});

test('C4 (3.7.1): H é sempre a lâmina máxima admitida; um H digitado salvo é ignorado', () => {
  // A calha do exemplo tem 120 × 80 mm e lâmina limite de 2/3 (53,3 mm).
  const R = residencia((e, c) => Object.assign(c, { fonteH: 'digitada', Hlam: 150 })).r.calhas[0];
  assert.ok(Math.abs(R.H - R.calha.yLim * 1000) < 1e-9);
  assert.ok(R.H <= R.calha.hTotal * 1000, 'a lâmina nunca passa da altura da calha');
  assert.equal(R.status, 'ok');
  assert.equal(E.migrar({ versao: 3, calhas: [{ fonteH: 'digitada', Hlam: 150 }], trechos: [] }).calhas[0].fonteH, 'limite');
});

test('C5: medida negativa, vazia ou zerada não soma área nem libera "atende"', () => {
  const neg = residencia((e, c) => { c.superficies[0].v.a = -5; });
  assert.equal(neg.r.calhas[0].sups[0].estado, 'invalida');
  assert.equal(neg.r.calhas[0].sups[0].A, 0);
  assert.equal(neg.r.calhas[0].status, 'invalida');
  semAtende(canais(neg.e, neg.r), 'a = −5');
  const p = P.pendencias(neg.r, neg.e)[0];
  assert.equal(p.item, '5.2');
  assert.equal(p.classe, 'invalida');
  assert.equal(p.alvo, '#superficies [data-sup="0"][data-var="a"]');

  const vazio = residencia((e, c) => { c.superficies[0].v.a = ''; }).r.calhas[0];
  assert.equal(vazio.sups[0].estado, 'incompleta');
  assert.equal(vazio.sups[0].A, 0, 'sem área parcial h/2·b');
  assert.equal(vazio.status, '');

  const parede = residencia((e, c) => { c.superficies[1].v.a = -2; }).r.calhas[0];
  assert.equal(parede.status, 'invalida');
  assert.equal(parede.A, 69, 'a parede inválida não soma nada');

  const zero = residencia((e, c) => { c.superficies[0].v.b = 0; }).r.calhas[0];
  assert.equal(zero.sups[0].estado, 'incompleta');
  // h = 0 é válido: a água vira superfície horizontal.
  assert.equal(N.areaSuperficie({ tipo: 'b', v: { a: 5, h: 0, b: 12 } }).estado, 'ok');
});

test('C5: calha incompleta deixa incompleto o trecho que a recebe', () => {
  const { r } = residencia((e, c) => { c.superficies[0].v.a = ''; });
  assert.equal(r.trechos[0].status, '');
  assert.ok(r.trechos[0].avisos.some((a) => a.codigo === 'TRECHO_CONTRIBUICAO_INCOMPLETA'));
});

test('A5: fora do ábaco não aparece nenhum diâmetro de busca', () => {
  const d = N.abaco({ saida: 'b', Q: 2079, H: 66.7, L: 10 });
  assert.equal(d.fora, 'D');
  assert.ok(Number.isNaN(d.D));
  assert.ok(!(d.DH > 150) && !(d.DL > 150));
  const q = N.abaco({ saida: 'a', Q: 18217, H: 100, L: 30 });
  assert.equal(q.fora, 'Q');
  assert.ok(Number.isNaN(q.D));
  const s = N.sugerirSaidas({ Q: 4158, H: 66.7, L: 10, saida: 'b', tubos: N.DADOS.TUBOS_VERTICAIS });
  assert.equal(s.n, 3);
  assert.equal(s.tubo.dn, 150);
  // No projeto: sem leitura, com a sugestão de saídas e sem "atende".
  const e = E.estadoVazio();
  e.localId = E.idLocal('Manaus/AM');
  e.T = 25;
  Object.assign(e.calhas[0], {
    tipoCalha: 'agua-furtada', superficies: [{ tipo: 'b', v: { a: 12, h: 1.2, b: 50 } }, { tipo: 'b', v: { a: 12, h: 1.2, b: 50 } }],
    Lc: 50, saidas: 'duas-pontas', material: 'concreto-bruto', decl: 1, b: 500, h: 100, saida: 'b', Lcond: 10,
  });
  const R = P.calcularProjeto(e).calhas[0];
  assert.equal(R.vert.fora, 'D');
  assert.equal(R.status, 'fora');
  assert.equal(R.vert.sugestao.n, 3);
});

test('A6: o item 5.1.4 exige a projeção da construção e confere as coberturas', () => {
  const sem = residencia((e) => { e.modoI = 'pequena'; e.areaProj = ''; }).r;
  assert.equal(sem.chuva.estado, 'incompleta');
  assert.equal(P.pendencias(sem, { modoI: 'pequena' })[0].alvo, '#areaProj');
  assert.equal(residencia((e) => { e.modoI = 'pequena'; e.areaProj = 90; }).r.chuva.estado, 'atende');
  assert.equal(residencia((e) => { e.modoI = 'pequena'; e.areaProj = 150; }).r.chuva.estado, 'sem_suporte');
  const grande = residencia((e, c) => { e.modoI = 'pequena'; e.areaProj = 90; c.superficies = [{ tipo: 'a', v: { a: 20, b: 25 } }]; }).r;
  assert.equal(grande.chuva.estado, 'sem_suporte');
  assert.ok(grande.chuva.avisos51.some((a) => a.codigo === 'CHUVA_PROJECAO_SUPERFICIES'));
});

test('A7: dado local ou IDF sem fonte fica com ressalva; valor atípico só é anotado', () => {
  const semFonte = residencia((e) => { e.modoI = 'manual'; e.Imanual = 150; }).r;
  assert.equal(semFonte.chuva.estado, 'ressalva');
  assert.equal(residencia((e) => { e.modoI = 'manual'; e.Imanual = 150; e.fonteChuva = 'Posto X, 2020'; }).r.chuva.estado, 'atende');
  const atipico = residencia((e) => { e.modoI = 'manual'; e.Imanual = 10000; e.fonteChuva = 'teste'; }).r;
  assert.ok(atipico.chuva.avisos51.some((a) => a.codigo === 'CHUVA_ATIPICA'));
  assert.equal(atipico.chuva.estado, 'atende', 'atípico não é limite da norma');
  assert.equal(residencia((e) => { e.modoI = 'manual'; e.Imanual = -100; }).r.chuva.estado, 'invalida');
  assert.equal(residencia((e) => { e.modoI = 'manual'; e.Imanual = ''; }).r.chuva.estado, 'incompleta');
  const idf = residencia((e) => Object.assign(e, { modoI: 'idf', idfK: 1239, idfA: 0.15, idfB: 20, idfC: 0.74, T: 25 })).r;
  assert.equal(idf.chuva.estado, 'ressalva');
});

test('M7: saídas, talude e declividade inválidos não são ajustados em silêncio', () => {
  const st = (ajuste) => residencia((e, c) => ajuste(c)).r.calhas[0].status;
  assert.equal(st((c) => Object.assign(c, { saidas: 'espacadas', nSaidas: 0 })), 'invalida');
  assert.equal(st((c) => Object.assign(c, { saidas: 'espacadas', nSaidas: 2.5 })), 'invalida');
  assert.equal(st((c) => Object.assign(c, { saidas: 'espacadas', nSaidas: 3 })), 'ok');
  assert.equal(st((c) => Object.assign(c, { saidas: 'personalizadas', listaSaidas: '-5; 30' })), 'invalida');
  assert.equal(st((c) => Object.assign(c, { forma: 'trapezoidal', bt: 100, z: -1, ht: 100 })), 'invalida');
  assert.equal(st((c) => Object.assign(c, { decl: -1 })), 'invalida');
  assert.equal(st((c) => Object.assign(c, { b: -120 })), 'invalida');
  const decl = residencia((e, c) => { c.decl = 100; }).r.calhas[0];
  assert.ok(decl.calha.avisos.some((a) => a.codigo === 'DECL_ATIPICA'));
  const extra = residencia((e) => { e.trechos[0].Qextra = -50; }).r;
  assert.equal(extra.trechos[0].status, 'invalida');
});

test('Canais coerentes: os exemplos atendem; o sobrado (Porto Alegre, coluna de 25 = T 21) fica com ressalva', () => {
  ['residencia', 'galpao'].forEach((k) => {
    const e = E.EXEMPLOS[k]().estado;
    const r = P.calcularProjeto(e);
    const c = canais(e, r);
    assert.equal(c.projeto, 'ok', k);
    assert.equal(c.faixa, 'Situação: atende', k);
    assert.ok(c.selosPdf.every((s) => s === 'atende'), k);
    assert.match(c.conclusao, /^Resultado: /, k);
  });
  const e = E.EXEMPLOS.sobrado().estado;
  const r = P.calcularProjeto(e);
  assert.equal(r.status, 'ressalva');
  assert.deepEqual(P.pendencias(r, e), []);
});

test('Referência independente: TC2 (Curitiba) e TC4 (Cruz Alta) batem com o cálculo feito à parte', () => {
  // TC2: água (b) 5 / 1,5 / 12, saída a 4 m numa calha de 12 m, 150 × 100 de aço, i 0,5%.
  const { r } = residencia((e, c) => Object.assign(c, { superficies: [{ tipo: 'b', v: { a: 5, h: 1.5, b: 12 } }], b: 150, h: 100 }));
  const R = r.calhas[0];
  const A = REF.area('b', { a: 5, h: 1.5, b: 12 });
  const Q = REF.vazao(204, A);
  assert.ok(Math.abs(R.A - A) < 1e-9);
  assert.ok(Math.abs(R.Q - Q) / Q < 1e-9);
  const Qcalha = (Q * 8) / 12;
  assert.ok(Math.abs(R.Qcalha - Qcalha) / Qcalha < 1e-9);
  const y = REF.laminaRetangular(0.15, Qcalha, 0.011, 0.005, 0.1);
  assert.ok(Math.abs(R.calha.y - y) < 1e-5, 'lâmina em 0,01 mm');
  const g = REF.retangular(0.15, 0.1 * 0.6667);
  assert.ok(Math.abs(R.calha.Qlim - REF.manning(g.S, g.P, 0.011, 0.005)) / R.calha.Qlim < 1e-6);
  // Coletor PVC 1%: a Tabela 4 impressa dá 75 → 133 (não basta) e 100 → 287 (basta).
  assert.ok(REF.TABELA4_N011[75][1] < Q && REF.TABELA4_N011[100][1] >= Q);
  // No app, o coletor enterrado de PVC é o NBR 7362: DN 100 com Di 105.
  assert.equal(r.trechos[0].escolhido.dn, 100);

  // TC4: (b) 8 / 1,2 / 10 + (c) 1 × 10; Tabela 1 canto reto de 2 a 4 m (× 1,1); 250 × 115 de
  // concreto alisado (n 0,012), lâmina 1/2.
  const e4 = E.estadoVazio();
  e4.localId = E.idLocal('Cruz Alta/RS');
  e4.T = 25;
  Object.assign(e4.calhas[0], {
    tipoCalha: 'platibanda', superficies: [{ tipo: 'b', v: { a: 8, h: 1.2, b: 10 } }, { tipo: 'c', v: { a: 1, b: 10 } }],
    Lc: 10, saidas: 'ponta', curva: 'canto-reto', faixa: 'de2a4m', material: 'concreto-alisado', decl: 0.5, b: 250, h: 115, fracLamina: '0.5', saida: 'b', Lcond: 6,
  });
  const R4 = P.calcularProjeto(e4).calhas[0];
  const A4 = REF.area('b', { a: 8, h: 1.2, b: 10 }) + REF.area('c', { a: 1, b: 10 });
  const Q4 = REF.vazao(347, A4) * 1.1;
  assert.ok(Math.abs(R4.Qcalha - Q4) / Q4 < 1e-9);
  const y4 = REF.laminaRetangular(0.25, Q4, 0.012, 0.005, 0.115);
  assert.ok(Math.abs(R4.calha.y - y4) < 1e-5);
  assert.equal(R4.status, 'ressalva', 'Cruz Alta: coluna de 25 anos com dado de T = 14');
});
