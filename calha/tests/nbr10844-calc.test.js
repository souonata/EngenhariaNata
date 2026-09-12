// Testes do núcleo de cálculo da NBR 10844 (Vitest: `npm test` a partir de local/).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Os módulos do app são scripts clássicos UMD: carregados pelo require do Node.
const require = createRequire(import.meta.url);
const N = require('../nbr10844-calc.js');
const D = N.DADOS;

function perto(real, esperado, tolRel, msg) {
  const erro = Math.abs(real - esperado) / esperado;
  assert.ok(erro <= tolRel, (msg || '') + ` esperado ${esperado}, obtido ${real.toFixed(2)} (erro ${(erro * 100).toFixed(2)}%)`);
}

test('Tabela 3: Manning com lâmina D/2 reproduz as calhas semicirculares da norma', () => {
  D.TABELA3.linhas.forEach((l) =>
    l.Q.forEach((Qn, j) => {
      const i = D.TABELA3.declividades[j];
      const Q = N.qSecao('semicircular', { D: l.D / 1000 }, l.D / 2000, 0.011, i);
      perto(Q, Qn, 0.015, `D=${l.D} i=${i}:`);
    }),
  );
});

test('Tabela 4: lâmina 2/3 D reproduz os condutores horizontais da norma', () => {
  Object.keys(D.TABELA4.Q).forEach((n) =>
    D.TABELA4.Q[n].forEach((linha, k) =>
      linha.forEach((Qn, j) => {
        const Q = N.qCondutorHorizontal(D.TABELA4.diametros[k], Number(n), D.TABELA4.declividades[j]);
        perto(Q, Qn, 0.02, `n=${n} D=${D.TABELA4.diametros[k]} i=${D.TABELA4.declividades[j]}:`);
      }),
    ),
  );
});

test('Materiais de calha e de condutor horizontal usam os n da Tabela 2', () => {
  const ns = D.TABELA2.map((m) => m.n);
  D.MATERIAIS_CALHA.concat(D.MATERIAIS_HORIZONTAL).forEach((m) => assert.ok(ns.includes(m.n), m.rotulo));
  assert.ok(D.MATERIAIS_CALHA.filter((m) => m.alvenaria).every((m) => m.n >= 0.012));
});

test('Figura 2: áreas de contribuição', () => {
  assert.equal(N.areaSuperficie({ tipo: 'a', v: { a: 4, b: 10 } }).A, 40);
  assert.equal(N.areaSuperficie({ tipo: 'b', v: { a: 5, h: 1.5, b: 12 } }).A, 69);
  assert.equal(N.areaSuperficie({ tipo: 'c', v: { a: 2, b: 4 } }).A, 4);
  assert.equal(N.areaSuperficie({ tipo: 'e', v: { a: 3, b: 4, c: 5, d: 4 } }).A, 4);
  assert.equal(N.areaSuperficie({ tipo: 'f', v: { A1: 6, A2: 8 } }).A, 5);
  // pátio cercado por muros de 2 m com fachada de 42 m (Figura 2h): 300 + 40·20/2
  const patio = N.areaTotal([{ tipo: 'a', v: { a: 15, b: 20 } }, { tipo: 'h', v: { a: 40, b: 20 } }]);
  assert.equal(patio, 700);
});

test('Vazão de projeto', () => {
  assert.equal(N.vazao(150, 80), 200);
  assert.equal(N.coefTabela1('canto-reto', 'ate2m'), 1.2);
  assert.equal(N.coefTabela1('canto-arredondado', 'de2a4m'), 1.05);
});

test('Saídas: maior trecho para a calha, maior bacia para o condutor', () => {
  const um = N.distribuicao({ config: 'ponta' });
  assert.equal(um.fracCalha, 1);
  assert.equal(um.fracCondutor, 1);
  const meio = N.distribuicao({ config: 'intermediaria', Lc: 12, x: 4 });
  assert.ok(Math.abs(meio.fracCalha - 8 / 12) < 1e-12);
  assert.equal(meio.fracCondutor, 1);
  assert.equal(meio.trecho, 8);
  const pontas = N.distribuicao({ config: 'duas-pontas', Lc: 20 });
  assert.equal(pontas.fracCalha, 0.5);
  assert.equal(pontas.fracCondutor, 0.5);
  const esp = N.distribuicao({ config: 'espacadas', Lc: 20, n: 2 });
  assert.equal(esp.fracCalha, 0.25);
  assert.equal(esp.fracCondutor, 0.5);
  // saídas em 0, 5 e 12 m numa calha de 12 m: divisores em 2,5 e 8,5 m
  const livre = N.distribuicao({ config: 'personalizadas', Lc: 12, lista: [12, 0, 5] });
  assert.ok(Math.abs(livre.trecho - 3.5) < 1e-12);
  assert.ok(Math.abs(livre.fracCondutor - 0.5) < 1e-12);
  assert.deepEqual(livre.saidas.map((s) => s.x), [0, 5, 12]);
  assert.ok(N.distribuicao({ config: 'intermediaria', x: 4 }).erro);
  assert.ok(N.distribuicao({ config: 'personalizadas', Lc: 10, lista: [] }).erro);
});

test('Intensidade por equação IDF com t = 5 min', () => {
  const I = N.intensidadeIDF({ K: 1000, a: 0.15, b: 10, c: 0.8, T: 5 });
  perto(I, 145.88, 0.001);
  const r = N.intensidade({ modo: 'idf', K: 1000, a: 0.15, b: 10, c: 0.8, T: 5 });
  assert.equal(r.avisos.length, 0);
  const fora = N.intensidade({ modo: 'idf', K: 20, a: 0.15, b: 10, c: 0.8, T: 5 });
  assert.ok(fora.avisos.some((a) => a.nivel === 'atencao'));
  assert.ok(N.intensidade({ modo: 'idf', T: 5 }).avisos.some((a) => a.nivel === 'erro'));
});

test('Manning em calha retangular cheia: 150 × 80 mm de PVC a 1% leva 12,48 L/s', () => {
  // exemplo resolvido clássico: S = 0,012 m², P = 0,31 m, R = 0,0387 m, n = 0,011
  perto(N.qSecao('retangular', { b: 0.15, h: 0.08 }, 0.08, 0.011, 0.01), 749, 0.003);
});

test('Lâmina normal inverte Manning-Strickler', () => {
  const dims = { b: 0.12, h: 0.08 };
  const r = N.laminaNormal('retangular', dims, 184, 0.011, 0.005, 0.08);
  assert.ok(r.cabe);
  perto(N.qSecao('retangular', dims, r.y, 0.011, 0.005), 184, 1e-6);
  const cheio = N.laminaNormal('retangular', dims, 5000, 0.011, 0.005, 0.08);
  assert.equal(cheio.cabe, false);
});

test('Dimensionar calha devolve seção que atende', () => {
  const r = N.dimensionarCalha({ forma: 'retangular', dims: { b: 0.15 }, Q: 400, n: 0.011, i: 0.005, fracLamina: 2 / 3 });
  const v = N.verificarCalha({ forma: 'retangular', dims: r.dims, Q: 400, n: 0.011, i: 0.005, fracLamina: 2 / 3 });
  assert.ok(v.ok);
  const s = N.dimensionarCalha({ forma: 'semicircular', dims: {}, Q: 500, n: 0.011, i: 0.01, fracLamina: 1 });
  assert.equal(Math.round(s.dims.D * 1000), 150); // Tabela 3: 150 mm a 1% leva 541 L/min
});

test('Chapa: desenvolvimento e corte usual', () => {
  const dev = N.desenvolvimento('retangular', { b: 0.12, h: 0.08 }, 0.04);
  assert.ok(Math.abs(dev - 0.32) < 1e-12);
  assert.equal(N.corteComercial(dev), 333);
  const semi = N.desenvolvimento('semicircular', { D: 0.15 }, 0.04);
  assert.equal(N.corteComercial(semi), 300);
  assert.equal(N.corteComercial(0.7), null);
});

test('Ábaco (a): L = ∞ coincide com a queda livre em tubo rugoso (f = 0,04)', () => {
  const ab = N.ABACOS.a;
  // Q = (π/4)·D²·√(2gD/f)  →  D = 64,4 mm para 1100 L/min e 73,0 mm para 1500 L/min
  assert.ok(Math.abs(N.diametroNaFamilia(ab.L, Infinity, 1100, 'L') - 64.4) < 0.8);
  assert.ok(Math.abs(N.diametroNaFamilia(ab.L, Infinity, 1500, 'L') - 73.0) < 0.8);
});

test('Ábaco (a): reta H = 50 mm passa por (608 L/min, 100 mm)', () => {
  const ab = N.ABACOS.a;
  assert.ok(Math.abs(N.diametroNaFamilia(ab.H, 50, 608, 'H') - 100) < 1.5);
});

test('Ábaco: famílias ordenadas (mais H ou mais L ⇒ menor D) e interseção mais alta governa', () => {
  ['a', 'b'].forEach((k) => {
    const ab = N.ABACOS[k];
    const Q = 1200;
    const dh = [50, 60, 70, 80, 90, 100].map((h) => N.diametroNaFamilia(ab.H, h, Q, 'H'));
    for (let j = 1; j < dh.length; j++) assert.ok(dh[j] < dh[j - 1], `${k}: H ordenado`);
    const dl = [0.3, 0.6, 1, 1.5, 2, 3, 6, 25, Infinity].map((l) => N.diametroNaFamilia(ab.L, l, Q, 'L'));
    for (let j = 1; j < dl.length; j++) assert.ok(dl[j] < dl[j - 1], `${k}: L ordenado`);
    const r = N.abaco({ saida: k, Q, H: 70, L: 2 });
    assert.equal(r.D, Math.max(r.DH, r.DL));
  });
  // funil de saída engole mais água que a aresta viva com a mesma lâmina
  const Da = N.abaco({ saida: 'a', Q: 1200, H: 60, L: 25 }).DH;
  const Db = N.abaco({ saida: 'b', Q: 1200, H: 60, L: 25 }).DH;
  assert.ok(Db < Da);
});

test('Ábaco: curvas L não se cruzam dentro do trecho desenhado', () => {
  ['a', 'b'].forEach((k) => {
    const L = N.ABACOS[k].L;
    for (let j = 1; j < L.length; j++) {
      const lo = Math.max(L[j - 1].faixa[0], L[j].faixa[0]);
      const hi = Math.min(L[j - 1].faixa[1], L[j].faixa[1]);
      for (let d = lo; d <= hi; d += 1) {
        assert.ok(
          N.qNaCurva(L[j].pts, d) > N.qNaCurva(L[j - 1].pts, d),
          `${k}: L=${L[j].v} deveria escoar mais que L=${L[j - 1].v} em D=${d}`,
        );
      }
    }
  });
});

test('Adoção do tubo: diâmetro interno ≥ D e mínimo de 70 mm', () => {
  const t = D.TUBOS_VERTICAIS;
  assert.equal(N.adotarTubo(40, t).tubo.dn, 75);
  assert.equal(N.adotarTubo(40, t).peloMinimo, true);
  assert.equal(N.adotarTubo(80, t).tubo.dn, 100);
  assert.equal(N.adotarTubo(160, t).tubo.dn, 200);
});

test('Sugestão de saídas: menor n em que cada condutor cabe no ábaco', () => {
  // 6000 L/min: com 3 saídas (2000 cada) a reta H = 80 pede ~172 mm; com 4 (1500) cabe em DN 150
  const s = N.sugerirSaidas({ Q: 6000, H: 80, L: 3, saida: 'a', tubos: D.TUBOS_VERTICAIS });
  assert.equal(s.n, 4);
  assert.equal(s.tubo.dn, 150);
  assert.equal(N.sugerirSaidas({ Q: 300, H: 60, L: 3, saida: 'a', tubos: D.TUBOS_VERTICAIS }).n, 1);
});

test('Intensidade: Tabela 5, períodos entre parênteses e lacunas', () => {
  const bh = D.TABELA5.find((l) => l.local === 'Belo Horizonte/MG');
  const r5 = N.intensidade({ modo: 'tabela', localId: bh.id, T: 5 });
  assert.equal(r5.I, 227);
  assert.equal(r5.avisos.length, 0);
  const r25 = N.intensidade({ modo: 'tabela', localId: bh.id, T: 25 });
  assert.equal(r25.I, 230);
  assert.equal(r25.T, 12);
  assert.ok(r25.avisos.length > 0);
  const op = D.TABELA5.find((l) => l.local === 'Ouro Preto/MG');
  const falta = N.intensidade({ modo: 'tabela', localId: op.id, T: 25 });
  assert.equal(falta.I, 211);
  assert.ok(falta.avisos.some((a) => a.nivel === 'erro'));
  assert.equal(D.TABELA5.length, 98);
  const pequena = N.intensidade({ modo: 'pequena', areaProjecao: 140 });
  assert.equal(pequena.I, 150);
  assert.ok(pequena.avisos.some((a) => a.nivel === 'erro'));
});

test('Ábaco sem extrapolar: abaixo de H = 50 mm ou L = 0,3 m não há leitura (5.6.4.1)', () => {
  const rH = N.abaco({ saida: 'a', Q: 300, H: 40, L: 3 });
  assert.equal(rH.fora, 'H');
  assert.ok(Number.isNaN(rH.D));
  assert.equal(rH.avisos[0].nivel, 'erro');
  assert.equal(N.abaco({ saida: 'a', Q: 300, H: 60, L: 0.2 }).fora, 'L');
  assert.equal(N.sugerirSaidas({ Q: 3000, H: 40, L: 3, saida: 'a', tubos: D.TUBOS_VERTICAIS }), null);
  const r = N.abaco({ saida: 'a', Q: 300, H: 60, L: 3 });
  assert.equal(r.fora, undefined);
  assert.ok(r.D > 0);
});
