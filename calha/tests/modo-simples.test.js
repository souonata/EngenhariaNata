// Modo simples (3.8.0): entradas em linguagem comum → o mesmo estado e o mesmo cálculo do modo
// avançado. Nenhuma conta própria, nenhum "atende" fora de atende. Vitest: `npm test` em local/.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const N = require('../nbr10844-calc.js');
const E = require('../calha-estado.js');
const P = require('../calha-projeto.js');
const S = require('../calha-simples.js');

const casa = (extra) => Object.assign(S.exemplo(), extra || {});
const chave = (R) => ({
  secao: JSON.stringify(R.calha.dims),
  dn: R.vert.adocao && R.vert.adocao.tubo ? R.vert.adocao.tubo.dn : null,
  di: R.vert.adocao && R.vert.adocao.tubo ? R.vert.adocao.tubo.di : null,
  estado: R.estado,
});

test('Exemplo: a água da residência de Curitiba, com o resultado lido do calcularProjeto', () => {
  const res = S.resolver(S.exemplo());
  assert.equal(res.situacao, 'atende');
  assert.equal(res.titulo, S.SUCESSO);
  assert.equal(res.R.A, (5 + 1.5 / 2) * 12);
  const I = N.DADOS.TABELA5.find((l) => l.local === 'Curitiba/PR').I[5];
  assert.equal(res.P.chuva.I.I, I);
  assert.deepEqual(chave(res.R), chave(P.calcularProjeto(res.estado).calhas[0]));
  assert.equal(res.resultado.tubo.dn, res.R.vert.adocao.tubo.dn);
  assert.match(res.resultado.descida.valor, /^DN \d+$/);
});

test('Aberto no modo avançado (link → migrar), o estado dá a mesma seção, DN, Di e estado', () => {
  const casos = [
    casa(),
    casa({ forma: 'semicircular' }),
    casa({ descidas: 'duas', Lc: 20 }),
    casa({ posicao: 'platibanda', mureta: 0.8, localId: E.idLocal('Porto Alegre/RS') }),
    casa({ localId: '', semTabela: 'pequena', areaProj: 90 }),
    casa({ localId: '', semTabela: 'local', Ilocal: 180, fonteChuva: 'estudo municipal' }),
  ];
  casos.forEach((ent) => {
    const res = S.resolver(ent);
    const link = S.linkAvancado(res.estado);
    assert.match(link, /^avancado\.html#s=/);
    const volta = E.migrar(S.decodificar(decodeURIComponent(link.split('#s=')[1])));
    assert.deepEqual(chave(P.calcularProjeto(volta).calhas[0]), chave(res.R), JSON.stringify(ent));
  });
});

test('Mesmo caminho do botão do passo B.3: a lâmina fica no ábaco (H ≥ 50 mm) sempre que há resultado', () => {
  let n = 0;
  ['Curitiba/PR', 'Porto Alegre/RS', 'Manaus/AM', 'São Paulo/SP (Mirante Santana)'].forEach((local) => {
    ['retangular', 'semicircular'].forEach((forma) => {
      ['ponta', 'meio', 'duas'].forEach((descidas) => {
        [4, 12, 25].forEach((Lc) => {
          const res = S.resolver(casa({ localId: E.idLocal(local), forma, descidas, Lc }));
          if (!res.mostrarResultado) return;
          n++;
          assert.ok(res.R.H >= 50 - 1e-9, local + ' ' + forma + ' H ' + res.R.H);
          assert.ok(!res.R.vert.fora);
        });
      });
    });
  });
  assert.ok(n > 40);
});

test('Estado diferente de "atende" nunca vira mensagem de sucesso', () => {
  const locais = N.DADOS.TABELA5.filter((l, k) => k % 9 === 0).map((l) => l.id);
  let vistos = new Set();
  locais.forEach((localId) => {
    ['beiral', 'platibanda'].forEach((posicao) => {
      ['retangular', 'semicircular'].forEach((forma) => {
        [3, 15, 40].forEach((Lc) => {
          [0.2, 3].forEach((Lcond) => {
            const res = S.resolver(casa({ localId, posicao, mureta: 1, forma, Lc, largura: 8, Lcond }));
            vistos.add(res.situacao);
            assert.equal(res.tom === 'ok', res.situacao === 'atende');
            assert.equal(res.titulo === S.SUCESSO, res.situacao === 'atende');
            if (res.mostrarResultado) assert.ok(['atende', 'ressalva'].includes(res.situacao));
            else assert.equal(res.resultado, undefined);
          });
        });
      });
    });
  });
  assert.ok(vistos.size >= 3, [...vistos].join(','));
});

test('Cidade fora da tabela: até 100 m² usa 150 mm/h; acima disso nunca produz resultado', () => {
  const ok = S.resolver(casa({ localId: '', semTabela: 'pequena', areaProj: 80, largura: 5, Lc: 12 }));
  assert.equal(ok.P.chuva.I.I, 150);
  assert.ok(ok.mostrarResultado);
  const grande = S.resolver(casa({ localId: '', semTabela: 'pequena', areaProj: 150 }));
  assert.equal(grande.situacao, 'sem_suporte');
  assert.equal(grande.mostrarResultado, false);
  assert.match(grande.mensagens[0], /100 m²/);
  const telhado = S.resolver(casa({ localId: '', semTabela: 'pequena', areaProj: 90, largura: 10, Lc: 12 }));
  assert.equal(telhado.situacao, 'sem_suporte');
  assert.equal(telhado.mostrarResultado, false);
  const semValor = S.resolver(casa({ localId: '', semTabela: 'local', Ilocal: '' }));
  assert.equal(semValor.situacao, 'incompleta');
  assert.equal(semValor.alvo, '#s-ilocal');
});

test('Atrás de mureta: T = 25 anos, face da mureta na área; sem dado confiável na tabela, sem resultado', () => {
  const pa = S.resolver(casa({ posicao: 'platibanda', mureta: 0.8, localId: E.idLocal('Porto Alegre/RS') }));
  assert.equal(pa.estado.T, 25);
  assert.equal(pa.R.A, (5 + 1.5 / 2) * 12 + (0.8 * 12) / 2);
  assert.equal(pa.situacao, 'ressalva');
  assert.match(pa.mensagens[0], /21 anos/);
  ['Ouro Preto/MG', 'São Carlos/SP'].forEach((local) => {
    const r = S.resolver(casa({ posicao: 'platibanda', mureta: 0.8, localId: E.idLocal(local) }));
    assert.equal(r.situacao, 'sem_suporte', local);
    assert.equal(r.mostrarResultado, false);
    assert.match(r.mensagens[0], /não está na lista/);
  });
  const semMureta = S.resolver(casa({ posicao: 'platibanda', mureta: '' }));
  assert.equal(semMureta.alvo, '#s-mureta');
});

test('O que falta vem na ordem da tela, em palavras comuns, e leva ao campo', () => {
  const vazio = S.resolver(S.entradasVazias());
  assert.equal(vazio.situacao, 'incompleta');
  assert.equal(vazio.alvo, '#s-busca');
  assert.match(vazio.titulo, /^Falta preencher: cidade da obra, comprimento da calha/);
  assert.doesNotMatch(vazio.titulo, /\b(Lc|Lcond|5\.\d)\b/);
  const neg = S.resolver(casa({ Lc: -3 }));
  assert.equal(neg.situacao, 'invalida');
  assert.equal(neg.alvo, '#s-Lc');
  const plano = S.resolver(casa({ altura: 0 }));
  assert.ok(plano.mostrarResultado, 'telhado plano: altura 0 vale');
  const varias = S.resolver(casa({ descidas: 'varias', nDescidas: 1 }));
  assert.equal(varias.alvo, '#s-n');
});

test('Vazão grande: a meia-cana manda para a retangular e uma descida só pede mais descidas', () => {
  let semi = null;
  for (let Lc = 10; Lc <= 120 && !semi; Lc += 5) {
    const r = S.resolver(casa({ forma: 'semicircular', Lc, largura: 9, descidas: 'ponta' }));
    if (r.acao && r.acao.tipo === 'forma') semi = r;
  }
  assert.ok(semi, 'algum comprimento esgota a Tabela 3');
  assert.equal(semi.mostrarResultado, false);
  assert.equal(semi.acao.forma, 'retangular');

  let fora = null;
  for (let Lc = 10; Lc <= 120 && !fora; Lc += 5) {
    const r = S.resolver(casa({ Lc, largura: 9, descidas: 'ponta' }));
    if (r.acao && r.acao.tipo === 'descidas') fora = r;
  }
  assert.ok(fora, 'algum comprimento passa do ábaco com uma descida');
  assert.notEqual(fora.situacao, 'atende');
  const comN = S.resolver(Object.assign({}, fora.entradas, { descidas: 'varias', nDescidas: fora.acao.n }));
  assert.ok(comN.mostrarResultado, 'com as descidas sugeridas o condutor tem leitura');
});

test('Busca de cidades sem acentos, as que começam pelo texto primeiro', () => {
  assert.equal(S.buscarCidades('curitiba')[0].local, 'Curitiba/PR');
  const sp = S.buscarCidades('sao paulo').map((l) => l.local);
  assert.ok(sp.includes('São Paulo/SP (Congonhas)') && sp.includes('São Paulo/SP (Mirante Santana)'));
  assert.deepEqual(S.buscarCidades('c'), []);
  assert.equal(S.buscarCidades('rio', 3).length, 3);
});
