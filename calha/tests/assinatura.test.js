// Página de assinatura do PDF (3.9.0): posições dos campos, texto no WinAnsi da Helvetica e
// nome do arquivo. A montagem com a pdf-lib é conferida no navegador. Vitest: `npm test` em local/.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const A = require('../calha-assinatura.js');

test('Campos dentro da folha A4, nas margens do relatório, sem se sobrepor e com rótulo acima', () => {
  const L = A.layout();
  const [W, H] = L.pagina;
  const campos = Object.values(L.campos);
  campos.forEach((c) => {
    assert.ok(c.x >= L.margem - 1e-9 && c.x + c.w <= W - L.margem + 1e-9, c.rotulo);
    assert.ok(c.y > L.nota && c.y + c.h + 6 + 9 < L.regua, c.rotulo);
    assert.ok(c.y + c.h <= H);
  });
  for (let i = 0; i < campos.length; i++) {
    for (let j = i + 1; j < campos.length; j++) {
      const a = campos[i];
      const b = campos[j];
      const separados = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h + 18 <= b.y || b.y + b.h + 18 <= a.y;
      assert.ok(separados, a.rotulo + ' × ' + b.rotulo);
    }
  }
  assert.ok(L.campos.assinatura.h >= 80, 'quadro de assinatura com altura para o carimbo do certificado');
  assert.deepEqual(Object.keys(A.CAMPOS).sort(), ['assinatura', 'data', 'nome', 'registro']);
});

test('Texto seguro para a Helvetica: acentos do português passam, o resto vira "?"', () => {
  assert.equal(A.seguro('Responsável técnico · São Paulo – “ok”'), 'Responsável técnico · São Paulo – “ok”');
  assert.equal(A.seguro('D ≥ 70 mm ⅔'), 'D ? 70 mm ?');
  assert.equal(A.seguro(null), '');
});

test('Quebra de linhas e nome encurtado cabem na largura pedida', () => {
  const medida = (s) => s.length * 5;
  const linhas = A.quebrar('uma frase com várias palavras para quebrar em linhas curtas', medida, 100);
  assert.ok(linhas.length > 1);
  linhas.forEach((l) => assert.ok(medida(l) <= 100 || !l.includes(' '), l));
  assert.equal(linhas.join(' '), 'uma frase com várias palavras para quebrar em linhas curtas');
  const curto = A.caber('relatorio-de-uma-obra-com-nome-muito-comprido.pdf', medida, 80);
  assert.ok(medida(curto) <= 80 && curto.endsWith('…'));
  assert.equal(A.caber('curto.pdf', medida, 80), 'curto.pdf');
});

test('Nome do arquivo baixado', () => {
  assert.equal(A.nomeAssinavel('Calhas - Obra X.pdf'), 'Calhas - Obra X - para assinar.pdf');
  assert.equal(A.nomeAssinavel('relatorio.PDF'), 'relatorio - para assinar.pdf');
  assert.equal(A.nomeAssinavel(''), 'relatorio - para assinar.pdf');
  assert.match(A.PDFLIB_SRI, /^sha384-/);
});
