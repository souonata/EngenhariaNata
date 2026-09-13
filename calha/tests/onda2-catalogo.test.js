// Onda 2 do plano de 13/09/2026: catálogo de tubos com origem (Tigre e Amanco), seleção do
// coletor pelo diâmetro interno real, política da Tabela 4, grandezas de margem e os passos
// do "Como usar". Vitest: `npm test` a partir de local/.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const N = require('../nbr10844-calc.js');
const E = require('../calha-estado.js');
const P = require('../calha-projeto.js');
const M = require('../calha-memorial.js');
const REL = require('../calha-relatorio.js');
const D = N.DADOS;
const daLinha = (id) => D.CATALOGO_TUBOS.filter((t) => t.linha === id);

test('Catálogo: Di = DE − 2e, origem do fabricante e cada linha com fonte', () => {
  D.CATALOGO_TUBOS.forEach((t) => {
    assert.ok(Math.abs(t.di - (t.de - 2 * t.e)) < 0.051, t.linha + ' DN ' + t.dn);
    assert.equal(t.origem, 'fabricante');
    assert.ok(D.LINHAS_TUBO.find((l) => l.id === t.linha).fonte.length > 10);
  });
  assert.deepEqual(daLinha('pvc-sn').filter((t) => t.dn >= 75).map((t) => t.di), [72.1, 98, 144.8, 192.8]);
  assert.deepEqual(daLinha('pvc-sr').filter((t) => t.dn >= 75).map((t) => t.di), [71.5, 96.6, 142.8]);
  assert.deepEqual(daLinha('pvc-7362').map((t) => t.di), [105, 152.8, 191, 237.8, 299.6, 337.6, 380.4]);
  assert.equal(daLinha('aquapluv-88')[0].di, 84.6);
});

test('T-C1-01: 280 L/min em PVC a 1% não cabe no DN 100 da Série Normal (Di 98)', () => {
  const r = N.condutorHorizontal({ Q: 280, n: 0.011, i: 0.01, tubos: daLinha('pvc-sn') });
  const dn100 = r.linhas.find((l) => l.dn === 100);
  assert.ok(Math.abs(dn100.Q - 272.1) < 0.1, 'Manning a 2/3 de 98 mm');
  assert.equal(dn100.fonteQ, 'Manning');
  assert.equal(r.escolhido.dn, 150);
  // O coletor NBR 7362 DN 100 tem Di 105 e basta.
  assert.equal(N.condutorHorizontal({ Q: 280, n: 0.011, i: 0.01, tubos: daLinha('pvc-7362') }).escolhido.dn, 100);
});

test('T-C1-02: em nenhuma combinação o tubo adotado leva menos que Q no próprio Di', () => {
  let casos = 0;
  ['pvc-sn', 'pvc-sr', 'pvc-7362'].forEach((id) => {
    const tubos = daLinha(id);
    [0.011, 0.012, 0.013].forEach((n) => {
      [0.005, 0.0075, 0.01, 0.02, 0.04].forEach((i) => {
        for (let Q = 10; Q < 12000; Q *= 1.17) {
          const r = N.condutorHorizontal({ Q, n, i, tubos });
          if (!r.escolhido) continue;
          casos++;
          assert.ok(N.qCondutorHorizontal(r.escolhido.di, n, i) >= Q - 1e-9, `${id} n ${n} i ${i} Q ${Q}`);
          const k = r.linhas.indexOf(r.escolhido);
          if (k > 0) assert.ok(r.linhas[k - 1].Q < Q, 'o tubo anterior não bastava');
        }
      });
    });
  });
  assert.ok(casos > 500);
});

test('T-M1: Di igual ao D da Tabela 4, com n e i de uma coluna, aceita o valor impresso', () => {
  const r = N.condutorHorizontal({ Q: 602, n: 0.011, i: 0.005 });
  assert.equal(r.escolhido.di, 150);
  assert.equal(r.escolhido.fonteQ, 'Tabela 4');
  assert.equal(r.escolhido.Q, 602);
  assert.ok(r.escolhido.Qmanning < 602, 'Manning dá 599');
  assert.equal(N.condutorHorizontal({ Q: 602, n: 0.011, i: 0.0075 }).escolhido.fonteQ, 'Manning');
  assert.equal(N.condutorHorizontal({ Q: 4550, n: 0.013, i: 0.01 }).escolhido.di, 300);
});

test('Coletor sem catálogo (concreto): Di da Tabela 4 com ressalva; tubos informados tiram a ressalva', () => {
  const e = E.EXEMPLOS.residencia().estado;
  e.trechos[0].material = 'concreto';
  let r = P.calcularProjeto(e);
  assert.equal(r.trechos[0].linha, 'tabela4');
  assert.equal(r.trechos[0].estado, 'ressalva');
  assert.ok(r.trechos[0].avisos.some((a) => a.codigo === 'TUBO_DI_TABELA4'));
  assert.match(P.listaMateriais(r, e)[2].itens[0].peca, /Di ≥ 125 mm \(Tabela 4, confirmar\)/);
  e.trechos[0].linha = 'usuario';
  r = P.calcularProjeto(e);
  assert.equal(r.trechos[0].estado, 'incompleta');
  assert.equal(P.pendencias(r, e)[0].alvo, '[data-trecho="0"][data-campo="tubosH"]');
  e.trechos[0].tubosH = '100; 150; 200';
  r = P.calcularProjeto(e);
  assert.equal(r.trechos[0].estado, 'atende');
  assert.equal(r.trechos[0].escolhido.origem, 'usuario');
});

test('B2: o vertical usa a linha do catálogo; material sem catálogo pede os tubos; Di < 70 fica fora', () => {
  const e = E.EXEMPLOS.residencia().estado;
  let R = P.calcularProjeto(e).calhas[0];
  assert.equal(R.vert.linha, 'pvc-sn');
  assert.equal(R.vert.adocao.tubo.origem, 'fabricante');
  assert.equal(R.vert.adocao.tubo.di, 72.1);
  e.linhaV = 'aquapluv-88';
  R = P.calcularProjeto(e).calhas[0];
  assert.equal(R.vert.adocao.tubo.dn, 88);
  e.materialV = 'ferro-fundido';
  let r = P.calcularProjeto(e);
  assert.equal(r.calhas[0].estado, 'incompleta');
  const p = P.pendencias(r, e)[0];
  assert.equal(p.passo, 'B.4');
  assert.match(p.alvo, /#tubos/);
  e.tubos = [{ dn: 50, di: 47 }, { dn: 75, di: 73 }];
  r = P.calcularProjeto(e);
  assert.equal(r.calhas[0].vert.adocao.tubo.dn, 75);
  assert.equal(r.calhas[0].vert.adocao.tubo.origem, 'usuario');
  assert.ok(r.calhas[0].vert.avisos.some((a) => a.codigo === 'TUBO_V_MENOR_70'));
  assert.equal(r.calhas[0].estado, 'atende');
});

test('Migração: lista antiga intacta vira a Série Normal; lista editada continua como "meus tubos"', () => {
  const antigo = JSON.parse(JSON.stringify(E.EXEMPLOS.residencia().estado));
  delete antigo.linhaV;
  antigo.tubos = [{ dn: 75, di: 72 }, { dn: 100, di: 97 }, { dn: 150, di: 146 }, { dn: 200, di: 194 }];
  delete antigo.trechos[0].linha;
  let e = E.migrar(antigo);
  assert.equal(e.linhaV, 'pvc-sn');
  assert.deepEqual(e.tubos, []);
  assert.equal(e.trechos[0].linha, 'auto');
  antigo.tubos = [{ dn: 100, di: 97 }];
  e = E.migrar(antigo);
  assert.equal(e.linhaV, 'usuario');
  assert.equal(P.calcularProjeto(e).calhas[0].vert.adocao.tubo.di, 97);
});

test('B3: uso e margem do coletor e folga de diâmetro do vertical, cada um com a sua fórmula', () => {
  const r = P.calcularProjeto(E.EXEMPLOS.galpao().estado);
  r.trechos.forEach((T) => {
    assert.ok(Math.abs(T.uso - T.Q / T.escolhido.Q) < 1e-12);
    assert.ok(Math.abs(T.margem - (T.escolhido.Q / T.Q - 1)) < 1e-12);
  });
  r.calhas.forEach((R) => assert.ok(Math.abs(R.vert.folga - (R.vert.adocao.tubo.di / R.vert.adocao.minimo - 1)) < 1e-12));
});

test('T-C1-04: DN, Di e fonte iguais no memorial, na lista de materiais e no PDF', () => {
  const e = E.EXEMPLOS.galpao().estado;
  const r = P.calcularProjeto(e);
  const mem = M.textoMemorial(M.memorial(r, e), e);
  const lista = JSON.stringify(P.listaMateriais(r, e));
  const pdf = REL.relatorio(r, e, { data: '13/09/2026' });
  [mem, lista, pdf].forEach((txt) => {
    assert.match(txt, /DN 250/);
    assert.match(txt, /237,8/);
  });
  assert.match(mem, /DE 250 − 2 × 6,1 = Di 237,8 mm/);
  assert.match(pdf, /Tubos adotados: origem do diâmetro interno/);
  assert.match(pdf, /Amanco Wavin, ficha Linha Coletor/);
});

test('Como usar: cada passo diz o que falta e leva ao campo certo', () => {
  const e = E.estadoVazio();
  let s = P.calcularProjeto(e).passos;
  assert.equal(s.A.estado, 'incompleta');
  assert.equal(s.A.pend.alvo, '#busca-local');
  e.localId = E.idLocal('Curitiba/PR');
  s = P.calcularProjeto(e).passos;
  assert.equal(s.A.estado, 'atende');
  assert.equal(s['B.1'].estado, 'incompleta');
  assert.equal(s['B.1'].pend.passo, 'B.1');
  assert.equal(s['B.2'].estado, 'aguarda');
  assert.equal(s['B.3'].estado, 'incompleta');
  assert.equal(s['B.3'].pend.alvo, '#b');
  assert.equal(s['B.4'].estado, 'incompleta');
  assert.equal(s['B.4'].pend.alvo, '#Lcond');
  assert.equal(s.B.pend.passo, 'B.1');
  assert.equal(s.C.estado, 'aguarda');
  const ok = P.calcularProjeto(E.EXEMPLOS.residencia().estado).passos;
  ['A', 'B', 'B.1', 'B.2', 'B.3', 'B.4', 'C'].forEach((id) => assert.equal(ok[id].estado, 'atende', id));
  const concreto = E.EXEMPLOS.residencia().estado;
  concreto.trechos[0].material = 'concreto';
  const sc = P.calcularProjeto(concreto).passos.C;
  assert.equal(sc.estado, 'ressalva');
  assert.match(sc.texto, /Tabela 4/);
});
