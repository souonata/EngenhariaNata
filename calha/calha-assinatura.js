/*
 * Calha 10844 — página de assinatura do relatório em PDF. O PDF do relatório sai do "Imprimir"
 * do navegador, que não cria campos de formulário. Aqui o PDF salvo ganha uma página final com
 * campos para o nome, o registro profissional e a data do responsável técnico e um campo de
 * assinatura digital (/FT /Sig). Usa a pdf-lib, carregada só quando a função é usada; o arquivo
 * é lido e gravado no próprio navegador.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalhaAssinatura = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  const PDFLIB_SRI = 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';
  const CAMPOS = { nome: 'responsavel_nome', registro: 'responsavel_registro', data: 'responsavel_data', assinatura: 'responsavel_assinatura' };
  const NOTA = 'Os campos acima podem ser preenchidos em qualquer leitor de PDF com formulários, como o Adobe Acrobat Reader. ' +
    'O quadro de assinatura aceita certificado digital (por exemplo, ICP-Brasil): no Acrobat Reader, clique nele e escolha o certificado. ' +
    'Depois de assinado, qualquer alteração no documento invalida a assinatura.';
  const RODAPE = 'Documento gerado pela ferramenta Calhas (engnata.eu/calha) a partir da ABNT NBR 10844:1989.';

  function erro(codigo) {
    const e = new Error(codigo);
    e.code = codigo;
    return e;
  }

  // A4 em pontos, com as margens da folha do relatório (12 mm dos lados, 14 mm no alto).
  const MM = 72 / 25.4;
  function layout() {
    const W = 595.28;
    const H = 841.89;
    const mx = 12 * MM;
    const largura = W - 2 * mx;
    const topo = H - 14 * MM;
    return {
      pagina: [W, H],
      margem: mx,
      largura: largura,
      sobre: topo - 8,
      titulo: topo - 34,
      origem: topo - 54,
      regua: topo - 68,
      campos: {
        nome: { rotulo: 'Nome do responsável técnico', x: mx, y: topo - 120, w: largura, h: 26 },
        registro: { rotulo: 'Registro profissional (CREA ou CAU)', x: mx, y: topo - 178, w: largura * 0.62, h: 26 },
        data: { rotulo: 'Data', x: mx + largura * 0.66, y: topo - 178, w: largura * 0.34, h: 26 },
        assinatura: { rotulo: 'Assinatura digital', x: mx, y: topo - 316, w: largura * 0.62, h: 102 },
      },
      nota: topo - 340,
      rodape: 12 * MM,
    };
  }

  // A Helvetica padrão do PDF só tem o WinAnsi: o que não couber nele vira "?".
  const EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function seguro(s) {
    return Array.from(String(s == null ? '' : s)).map(function (ch) {
      const c = ch.charCodeAt(0);
      return (c >= 32 && c < 127) || (c >= 160 && c <= 255) || EXTRA_WINANSI.indexOf(ch) >= 0 ? ch : '?';
    }).join('');
  }

  // Quebra o texto em linhas que caibam em `max` pontos; `medida(s)` dá a largura de s.
  function quebrar(texto, medida, max) {
    const linhas = [];
    let atual = '';
    String(texto).split(/\s+/).filter(Boolean).forEach(function (p) {
      const tenta = atual ? atual + ' ' + p : p;
      if (atual && medida(tenta) > max) {
        linhas.push(atual);
        atual = p;
      } else atual = tenta;
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  // Encurta com reticências o que passar de `max` pontos (nome de arquivo longo).
  function caber(texto, medida, max) {
    let t = String(texto);
    if (medida(t) <= max) return t;
    while (t.length > 1 && medida(t + '…') > max) t = t.slice(0, -1);
    return t + '…';
  }

  function nomeAssinavel(nome) {
    return String(nome || 'relatorio.pdf').replace(/\.pdf$/i, '') + ' - para assinar.pdf';
  }

  let carregando = null;
  function carregarPdfLib() {
    if (root.PDFLib) return Promise.resolve(root.PDFLib);
    if (!carregando) {
      carregando = new Promise(function (ok, falha) {
        const s = document.createElement('script');
        s.src = PDFLIB_URL;
        s.integrity = PDFLIB_SRI;
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
        s.onload = function () {
          if (root.PDFLib) ok(root.PDFLib);
          else falha(erro('SEM_BIBLIOTECA'));
        };
        s.onerror = function () {
          carregando = null;
          s.remove();
          falha(erro('SEM_BIBLIOTECA'));
        };
        document.head.appendChild(s);
      });
    }
    return carregando;
  }

  // Acrescenta a página de assinatura ao PDF (bytes) e devolve os bytes do novo PDF.
  async function acrescentar(PDFLib, bytes, info) {
    const i = info || {};
    const pdf = await PDFLib.PDFDocument.load(bytes);
    const form = pdf.getForm();
    if (form.getFields().some(function (f) { return f.getName() === CAMPOS.nome; })) throw erro('JA_TEM');
    const L = layout();
    const page = pdf.addPage(L.pagina);
    const normal = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    const negrito = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const cor = function (hex) {
      return PDFLib.rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
    };
    const tinta = cor('#15222a');
    const grafite = cor('#4b5a61');
    const apagado = cor('#626e74');
    const patina = cor('#1b6f61');
    const linha = cor('#788c8b');
    const fundo = cor('#f7f9f8');
    const texto = function (s, x, y, tam, fonte, c) { page.drawText(seguro(s), { x: x, y: y, size: tam, font: fonte, color: c }); };
    const medida = function (fonte, tam) { return function (s) { return fonte.widthOfTextAtSize(seguro(s), tam); }; };
    const mx = L.margem;

    texto('CALHAS · ABNT NBR 10844:1989', mx, L.sobre, 8, negrito, patina);
    texto('Assinatura do responsável técnico', mx, L.titulo, 18, negrito, tinta);
    const origem = 'Página acrescentada ao relatório "' + (i.arquivo || 'relatorio.pdf') + '".';
    texto(caber(origem, medida(normal, 10), L.largura), mx, L.origem, 10, normal, grafite);
    page.drawLine({ start: { x: mx, y: L.regua }, end: { x: mx + L.largura, y: L.regua }, thickness: 1, color: tinta });

    const C = L.campos;
    ['nome', 'registro', 'data'].forEach(function (k) {
      const c = C[k];
      texto(c.rotulo, c.x, c.y + c.h + 6, 9, negrito, grafite);
      const campo = form.createTextField(CAMPOS[k]);
      campo.addToPage(page, { x: c.x, y: c.y, width: c.w, height: c.h, font: normal, textColor: tinta, backgroundColor: fundo, borderColor: linha, borderWidth: 1 });
      campo.setFontSize(11);
    });

    // Campo de assinatura digital: a pdf-lib não cria /Sig pela API de formulário, então o
    // widget vai direto no dicionário (FT /Sig), na página e no /AcroForm. O quadro desenhado
    // embaixo o mostra em qualquer leitor.
    const s = C.assinatura;
    texto(s.rotulo, s.x, s.y + s.h + 6, 9, negrito, grafite);
    page.drawRectangle({ x: s.x, y: s.y, width: s.w, height: s.h, color: fundo, borderColor: linha, borderWidth: 1 });
    const ref = pdf.context.register(pdf.context.obj({
      Type: 'Annot', Subtype: 'Widget', FT: 'Sig', T: PDFLib.PDFString.of(CAMPOS.assinatura),
      Rect: [s.x, s.y, s.x + s.w, s.y + s.h], F: 4, P: page.ref,
    }));
    page.node.addAnnot(ref);
    form.acroForm.addField(ref);

    quebrar(NOTA, medida(normal, 8.5), L.largura).forEach(function (l, k) {
      texto(l, mx, L.nota - k * 12, 8.5, normal, apagado);
    });
    texto(RODAPE, mx, L.rodape, 8, normal, apagado);
    return pdf.save();
  }

  return {
    PDFLIB_URL: PDFLIB_URL,
    PDFLIB_SRI: PDFLIB_SRI,
    CAMPOS: CAMPOS,
    layout: layout,
    seguro: seguro,
    quebrar: quebrar,
    caber: caber,
    nomeAssinavel: nomeAssinavel,
    carregarPdfLib: carregarPdfLib,
    acrescentar: acrescentar,
  };
});
