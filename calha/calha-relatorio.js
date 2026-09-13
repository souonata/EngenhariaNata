/*
 * Calha 10844 — relatório do projeto para imprimir ou salvar em PDF: capa com a
 * chuva de projeto, quadro-resumo, cada calha com o memorial e os desenhos
 * (esquema, seção, ábaco), coletores e lista de materiais.
 * Devolve HTML; quem chama decide onde mostrar e quando imprimir.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const deps = node
    ? [require('./nbr10844-calc.js'), require('./calha-util.js'), require('./calha-projeto.js'), require('./calha-desenhos.js'), require('./calha-memorial.js')]
    : [root.NBR10844, root.CalhaUtil, root.CalhaProjeto, root.CalhaDesenhos, root.CalhaMemorial];
  const api = factory.apply(null, deps);
  if (node) module.exports = api;
  else root.CalhaRelatorio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (N, U, PJ, DS, MEM) {
  'use strict';

  const { esc, nf, na, num, descSecao, avisosHtml, ROTULO_STATUS, rotuloTubo } = U;

  function paragrafos(linhas) {
    return linhas.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
  }
  function selo(st) { return '<span class="selo ' + st + '">' + ROTULO_STATUS[st] + '</span>'; }
  // Cada desenho tem <title id>: no relatório há um por calha, então o id ganha sufixo.
  function unico(svg, k) {
    return svg.replace(/(id|aria-labelledby)="(esq-t|abaco-t)"/g, '$1="$2-rel' + k + '"');
  }
  function figura(svg, legenda) {
    return '<figure class="rel-fig">' + svg + '<figcaption>' + legenda + '</figcaption></figure>';
  }
  function tabela(cab, linhas, classe) {
    return '<div class="rolagem"><table class="tabela rel-tabela' + (classe ? ' ' + classe : '') + '"><thead><tr>' + cab.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
      '</tr></thead><tbody>' + linhas.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  // Faixa de situação no topo: o PDF não pode parecer aprovado quando o projeto tem entrada
  // inválida ou incompleta, dado de chuva sem suporte, leitura fora do ábaco ou ressalva.
  function faixaSituacao(P) {
    if (P.status === 'ok') {
      return '<section class="rel-faixa ok"><p><b>Situação: atende</b> às verificações hidráulicas listadas neste relatório (NBR 10844:1989). ' +
        'Não substitui a responsabilidade técnica do projetista.</p></section>';
    }
    const d = P.diagnosticos || [];
    return '<section class="rel-faixa ' + (P.status || 'incompleta') + '"><p><b>Situação do projeto: ' + ROTULO_STATUS[P.status] + '</b>' +
      (P.status === 'ressalva' ? '. O cálculo fecha, mas depende das premissas abaixo.' : '. Este relatório não comprova conformidade enquanto houver os itens abaixo.') + '</p>' +
      (d.length ? '<ul>' + d.map(function (x) { return '<li><b>' + esc(x.nome) + ':</b> ' + esc(x.texto) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
  }

  function tabelaCalhas(P) {
    return tabela(['Calha', 'Área (m²)', 'Q (L/min)', 'Q calha', 'Seção (mm)', 'Lâmina / limite (mm)', 'Condutores', 'Situação'], P.calhas.map(function (r) {
      const c = r.calha;
      const v = r.vert;
      return [esc(r.c.nome || 'Calha sem nome'), nf(r.A, 1), nf(r.Q, 0), nf(r.Qcalha, 0), c.pronta ? descSecao(c) : '—',
        c.pronta ? (c.y != null ? nf(c.y * 1000) : '&gt; h') + ' / ' + nf(c.yLim * 1000) : '—',
        v.pronto && v.adocao.tubo ? r.dist.n + ' × ' + rotuloTubo(v.adocao.tubo) : '—', selo(r.status)];
    }).concat([['<b>Total</b>', '<b>' + nf(P.A, 1) + '</b>', '<b>' + nf(P.Q, 0) + '</b>', '', '', '', '', '']]));
  }

  function tabelaTrechos(P) {
    if (!P.trechos.length) return '';
    return tabela(['Trecho', 'Recebe', 'Q (L/min)', 'Material', 'Instalação', 'i', 'Tubo adotado', 'Uso', 'Desnível', 'Situação'], P.trechos.map(function (T) {
      return [esc(T.t.nome || 'Trecho'), T.recebe.length ? T.recebe.map(function (r) { return esc(r.c.nome || 'sem nome'); }).join(', ') : '—',
        T.Q > 0 ? nf(T.Q, 0) : '—', esc(T.mat.rotulo), T.t.instalacao === 'aparente' ? 'aparente' : 'enterrado',
        T.i > 0 ? na(T.i * 100) + '%' : '—', T.pronto ? (T.escolhido ? esc(rotuloTubo(T.escolhido)) + (T.linha === 'tabela4' ? ' (Tabela 4)' : '') : 'nenhum') : '—',
        T.escolhido ? nf(T.uso * 100, 0) + '%' : '—', T.desnivel != null ? nf(T.desnivel * 100, 1) + ' cm' : '—', selo(T.status)];
    }));
  }

  // Origem do diâmetro interno de cada linha de tubo adotada (plano, B5): o PDF se sustenta sozinho.
  function fontesTubos(P) {
    if (!P.linhasUsadas || !P.linhasUsadas.length) return '';
    return '<section class="rel-bloco"><h2>Tubos adotados: origem do diâmetro interno</h2><p class="rel-nota">Di = DE − 2e, com o diâmetro externo e a espessura impressos pelo fabricante; ' +
      'o DN não serve para cálculo (3.11).</p><ul class="rel-fontes">' + P.linhasUsadas.map(function (l) {
      return '<li><b>' + esc(l.rotulo) + ':</b> ' + esc(l.fonte) + '.</li>';
    }).join('') + '</ul></section>';
  }

  function secaoCalha(R, P, estado, k) {
    const c = R.c;
    let h = '<section class="rel-calha"><header class="rel-calha-topo"><div><p class="rel-sobre">Calha ' + (k + 1) + ' de ' + P.calhas.length +
      '</p><h2>' + esc(c.nome || 'Calha sem nome') + '</h2></div>' + selo(R.status) + '</header>';
    h += figura(unico(DS.svgEsquema(R, P), k), 'Esquema da calha: saídas, sentido do escoamento e condutores (fora de escala vertical).');
    MEM.memorialCalha(R, estado).forEach(function (p) {
      h += '<div class="rel-passo"><h3><span>' + p[0] + '</span>' + esc(p[1]) + '</h3>' + paragrafos(p[2]);
      if (p[0] === '5.5' && R.calha.pronta) {
        h += figura(DS.svgSecao(R.calha.forma, R.calha.dims, R.calha.y, R.calha.yLim), 'Seção transversal com a lâmina calculada e o limite adotado (5.5.7).');
      }
      if (p[0] === '5.6' && R.vert.pronto && !R.vert.fora) {
        h += figura(unico(DS.svgAbaco(c.saida, R.Qcond, R.H, num(c.Lcond), R.vert), k), 'Leitura no ábaco (' + c.saida + ') da Figura 3: vale a interseção mais alta (5.6.4.1).');
      }
      h += '</div>';
    });
    const avisos = [].concat(R.avisos53 || [], R.calha.avisos || [], R.vert.avisos || []);
    if (avisos.length) h += '<div class="rel-passo"><h3><span>!</span>Avisos</h3>' + avisosHtml(avisos) + '</div>';
    return h + '</section>';
  }

  function relatorio(P, estado, opcoes) {
    const o = opcoes || {};
    const m = MEM.memorial(P, estado);
    let h = '<article class="rel">';
    h += '<header class="rel-capa"><p class="rel-sobre">Instalação predial de águas pluviais · ABNT NBR 10844:1989</p><h1>' +
      esc(estado.projeto || 'Obra sem nome') + '</h1>' + (o.data ? '<p class="rel-data">Emitido em ' + esc(o.data) + '</p>' : '') + '</header>';
    h += faixaSituacao(P);
    h += '<section class="rel-bloco"><h2>Chuva de projeto</h2>' + paragrafos(m.grupos[0].passos[0][2]) +
      '<dl class="pares rel-pares"><div><dt>Área de contribuição total</dt><dd>' + nf(P.A, 2) + ' m²</dd></div><div><dt>Vazão total</dt><dd>' + nf(P.Q, 1) +
      ' L/min</dd></div><div><dt>Calhas</dt><dd>' + P.calhas.length + '</dd></div><div><dt>Trechos de coletor</dt><dd>' + P.trechos.length + '</dd></div></dl></section>';
    h += '<section class="rel-bloco"><h2>Quadro-resumo</h2>' + tabelaCalhas(P) + tabelaTrechos(P) +
      (m.conclusao ? '<p class="rel-conclusao">' + esc(m.conclusao) + '</p>' : '') + '</section>';
    h += fontesTubos(P);
    P.calhas.forEach(function (R, k) { h += secaoCalha(R, P, estado, k); });
    const col = m.grupos.find(function (g) { return g.titulo === 'Coletores horizontais'; });
    if (col) {
      const av = [];
      P.trechos.forEach(function (T) {
        T.avisos.forEach(function (a) { av.push({ nivel: a.nivel, texto: (T.t.nome || 'Trecho') + ': ' + a.texto }); });
      });
      h += '<section class="rel-bloco rel-quebra"><h2>Coletores horizontais</h2>' + col.passos.map(function (p) {
        return '<div class="rel-passo"><h3><span>' + p[0] + '</span>' + esc(p[1]) + '</h3>' + paragrafos(p[2]) + '</div>';
      }).join('') + avisosHtml(av) + '</section>';
    }
    const lista = PJ.listaMateriais(P, estado).filter(function (g) { return g.itens.length; });
    if (lista.length) {
      h += '<section class="rel-bloco"><h2>Lista de materiais</h2><p class="rel-nota">Quantidades mínimas tiradas do cálculo; cantos, emendas, suportes e mudanças de direção do traçado real acrescentam peças.</p>' +
        '<div class="rolagem"><table class="tabela rel-tabela"><thead><tr><th>Peça</th><th>Qtd.</th><th>Un.</th><th>Base</th></tr></thead>' + lista.map(function (g) {
          return '<tbody><tr class="grupo"><th colspan="4">' + esc(g.titulo) + '</th></tr>' + g.itens.map(function (it) {
            return '<tr><td>' + esc(it.peca) + '</td><td>' + esc(it.qtd) + '</td><td>' + esc(it.un) + '</td><td>' + esc(it.ref) + '</td></tr>';
          }).join('') + '</tbody>';
        }).join('') + '</table></div></section>';
    }
    const verif = o.verificacoes || [];
    if (verif.length) {
      const feitos = verif.filter(function (v) { return v.ok; }).length;
      h += '<section class="rel-bloco"><h2>O que a conta não verifica</h2><p class="rel-nota">Exigências dos itens 4 e 5 que dependem do projeto e da obra. Conferidas: ' +
        feitos + ' de ' + verif.length + '.</p><ul class="rel-verif">' + verif.map(function (v) {
          return '<li' + (v.ok ? ' class="ok"' : '') + '><span class="rel-marca" aria-label="' + (v.ok ? 'conferido' : 'não conferido') + '">' + (v.ok ? '☑' : '☐') +
            '</span><span class="rel-ref">' + esc(v.ref) + '</span><span>' + esc(v.texto) + '</span></li>';
        }).join('') + '</ul></section>';
    }
    h += '<footer class="rel-rodape"><div class="rel-assina"><span>Responsável técnico</span><span>Registro profissional</span><span>Data e assinatura</span></div>' +
      '<p>Documento gerado pela ferramenta Calhas a partir da ABNT NBR 10844:1989. As curvas dos ábacos da Figura 3 foram digitalizadas da norma impressa. ' +
      'Não substitui a leitura da norma nem a responsabilidade técnica do projetista.</p></footer>';
    return h + '</article>';
  }

  // Nome sugerido para o arquivo PDF (o navegador usa o título da página).
  function tituloArquivo(estado) {
    const obra = String(estado.projeto || 'obra').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return 'Aguas pluviais NBR 10844 - ' + (obra || 'obra');
  }

  return {
    relatorio: relatorio,
    tituloArquivo: tituloArquivo,
  };
});
