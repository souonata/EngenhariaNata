// Testes do projeto inteiro (várias calhas, coletores, pendências, lista de
// materiais, migração, relatório). Vitest: `npm test` a partir de local/.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Os módulos do app são scripts clássicos UMD: carregados pelo require do Node.
const require = createRequire(import.meta.url);
const E = require('../calha-estado.js');
const P = require('../calha-projeto.js');
const M = require('../calha-memorial.js');

test('Galpão: 924,5 L/min por água, coletor D 200 → D 250, nada pendente', () => {
  const e = E.EXEMPLOS.galpao().estado;
  const r = P.calcularProjeto(e);
  r.calhas.forEach((c) => assert.equal(c.Q.toFixed(1), '924.5'));
  assert.deepEqual(r.trechos.map((t) => t.escolhido.D), [200, 250]);
  assert.equal(P.pendencias(r, e).length, 0);
});

test('Os três exemplos fecham sem pendências e com resposta direta', () => {
  Object.keys(E.EXEMPLOS).forEach((k) => {
    const e = E.EXEMPLOS[k]().estado;
    const r = P.calcularProjeto(e);
    assert.deepEqual(P.pendencias(r, e), [], k);
    r.calhas.forEach((R) => assert.match(P.respostaCalha(R).texto, /^Calha .* DN \d+/, k));
  });
});

test('Tabela 1 só vale para calhas de beiral e de platibanda (5.5.6)', () => {
  const e = E.EXEMPLOS.residencia().estado;
  const c = e.calhas[0];
  Object.assign(c, { curva: 'canto-reto', faixa: 'ate2m' });
  const chuva = P.calcularChuva(e);
  assert.equal(P.calcularCalha(e, c, chuva).coef, 1.2);
  c.tipoCalha = 'agua-furtada';
  assert.equal(P.calcularCalha(e, c, chuva).coef, 1);
});

test('Pendências: folha em branco pede a chuva primeiro, depois a área da calha', () => {
  const e = E.estadoVazio();
  let p = P.pendencias(P.calcularProjeto(e), e);
  assert.equal(p.length, 1);
  assert.equal(p[0].item, '5.1');
  e.localId = E.idLocal('Curitiba/PR');
  p = P.pendencias(P.calcularProjeto(e), e);
  assert.equal(p[0].item, '5.2');
  assert.equal(p[0].calhaId, e.calhas[0].id);
});

test('Pendência de seção que transborda aponta o botão de dimensionar', () => {
  const e = E.EXEMPLOS.residencia().estado;
  Object.assign(e.calhas[0], { b: 60, h: 30 });
  const p = P.pendencias(P.calcularProjeto(e), e);
  assert.equal(p[0].item, '5.5');
  assert.equal(p[0].alvo, '#btn-dimensionar');
});

test('Lista de materiais do galpão: projeto inteiro em três grupos, peças iguais somadas', () => {
  const e = E.EXEMPLOS.galpao().estado;
  const PR = P.calcularProjeto(e);
  const g = P.listaMateriais(PR, e);
  const lerQtd = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  assert.deepEqual(g.map((x) => x.titulo), ['Calhas', 'Condutores verticais', 'Coletores horizontais']);
  g.forEach((x) => assert.equal(new Set(x.itens.map((i) => i.peca)).size, x.itens.length, 'nenhuma peça repetida em ' + x.titulo));

  const vert = g[1].itens;
  const comTubo = PR.calhas.filter((R) => R.vert.pronto && R.vert.adocao.tubo);
  assert.ok(comTubo.length >= 2, 'o galpão tem duas calhas com condutor');
  const porDN = {};
  comTubo.forEach((R) => { const dn = R.vert.adocao.tubo.dn; porDN[dn] = (porDN[dn] || 0) + R.dist.n * Number(R.c.Lcond); });
  Object.keys(porDN).forEach((dn) => {
    const linha = vert.find((i) => i.peca.startsWith('Condutor vertical DN ' + dn + ','));
    assert.ok(linha && lerQtd(linha.qtd) === porDN[dn], 'metros de todas as descidas DN ' + dn);
  });
  const descidas = comTubo.reduce((s, R) => s + R.dist.n, 0);
  const curva = vert.find((i) => /raio longo/.test(i.peca));
  assert.equal(lerQtd(curva.qtd), descidas, 'uma curva por descida, somando as calhas');
  comTubo.forEach((R) => assert.ok(curva.ref.includes(R.c.nome), 'a base mostra a parcela de ' + R.c.nome));

  const caixas = PR.trechos.reduce((s, T) => s + Math.max(0, Math.ceil(Number(T.t.comp) / 20 - 1e-9) - 1), 0);
  assert.ok(caixas >= 1, 'o trecho A de 30 m pede ao menos uma caixa no meio');
  assert.ok(g[2].itens.some((i) => /^Caixa de areia intermediária/.test(i.peca) && lerQtd(i.qtd) === caixas));
  e.trechos[0].instalacao = 'aparente';
  const g2 = P.listaMateriais(P.calcularProjeto(e), e);
  assert.ok(g2[2].itens.some((i) => /^Inspeção intermediária/.test(i.peca)));
});

test('Migração: estado da versão 2 vira projeto com uma calha e um trecho', () => {
  const v2 = {
    versao: 2, modoI: 'tabela', localId: E.idLocal('Curitiba/PR'), T: 5,
    superficies: [{ tipo: 'a', v: { a: 5, b: 10 } }], Lc: 10, b: 100, h: 80, Lcond: 3, materialH: 'pvc', declH: 1,
  };
  const e = E.migrar(v2);
  assert.equal(e.versao, 3);
  assert.equal(e.calhas.length, 1);
  assert.equal(e.calhas[0].Lc, 10);
  assert.equal(e.trechos[0].instalacao, 'enterrado');
  assert.equal(e.materialV, 'pvc');
  const r = P.calcularProjeto(e);
  assert.ok(r.calhas[0].Q > 0);
  assert.match(M.memorial(r, e).conclusao, /DN/);
});

test('Lâmina calculada abaixo do ábaco vira pendência do item 5.6, sem diâmetro', () => {
  const e = E.EXEMPLOS.residencia().estado;
  e.calhas[0].fonteH = 'calculada';
  const r = P.calcularProjeto(e);
  const R = r.calhas[0];
  assert.ok(R.H < 50);
  assert.equal(R.vert.fora, 'H');
  assert.equal(R.vert.adocao.tubo, null);
  assert.equal(R.status, 'fora');
  const p = P.pendencias(r, e);
  assert.equal(p[0].item, '5.6');
  assert.equal(p[0].alvo, 'input[name="fonteH"]');
  assert.match(M.memorial(r, e).grupos[1].passos.find((x) => x[0] === '5.6')[2][1], /sem extrapolar/);
});

test('Relatório em PDF: uma seção por calha, com seção desenhada, ábaco e ids únicos', () => {
  const REL = require('../calha-relatorio.js');
  const e = E.EXEMPLOS.galpao().estado;
  const r = P.calcularProjeto(e);
  const html = REL.relatorio(r, e, { data: '12/09/2026' });
  assert.equal((html.match(/class="rel-calha"/g) || []).length, 2);
  assert.match(html, /Água leste/);
  assert.match(html, /Água oeste/);
  assert.equal((html.match(/class="desenho abaco"/g) || []).length, 2);
  assert.equal((html.match(/class="desenho"/g) || []).length, 2, 'duas seções transversais');
  assert.match(html, /Trecho B \(as duas águas\)/);
  assert.doesNotMatch(html, /Verificações/);
  const ids = html.match(/ id="[^"]+"/g) || [];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(REL.tituloArquivo({ projeto: 'Galpão 20 × 30 m / SP' }), 'Aguas pluviais NBR 10844 - Galpão 20 × 30 m SP');
});
