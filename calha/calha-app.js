/*
 * Calha 10844 — interface. Guarda o estado vivo, monta e lê o formulário,
 * mostra só os campos que valem para as opções escolhidas e desenha os
 * resultados. As contas ficam em calha-projeto.js e nbr10844-calc.js.
 */
(function () {
  'use strict';

  const N = window.NBR10844;
  const DD = N.DADOS;
  const CHAVE = 'calha10844:estado:v1';
  const CHAVE_TEMA = 'calha10844:tema';

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };

  const U = window.CalhaUtil;
  const { esc, nf, na, num, z, lerNum, mostrarNum, lerLista, normaliza, uid, copia, MAT_C, MAT_H, matCalha, matHor, tubosPadrao, linhaTubo, tubosDaLinha, rotuloTubo, avisosHtml, grande, pares, nota, aguardando, cabecalho, descSecao, ROTULO_STATUS, seloStatus } = U;
  const { novaCalha, novoTrecho, estadoVazio, EXEMPLOS, migrar } = window.CalhaEstado;
  const GUIAS = window.CalhaGuias.GUIAS;
  const PJ = window.CalhaProjeto;
  const { temNivel, textoSaidas, TEXTO_FONTE_H } = PJ;
  const { FIGURAS, svgSecao, svgAbaco, svgEsquema } = window.CalhaDesenhos;
  const MEM = window.CalhaMemorial;
  const REL = window.CalhaRelatorio;
  const CHAVE_TEMA_SITE = 'engnata_theme_mode';
  const CHAVE_GUIA = 'calha10844:guia';
  const CHAVE_VERIF = 'calha10844:verificacoes';

  const G_NUM = ['areaProj', 'Imanual', 'Tmanual', 'idfK', 'idfA', 'idfB', 'idfC'];
  const C_NUM = ['Lc', 'xSaida', 'nSaidas', 'decl', 'b', 'h', 'Dcalha', 'bt', 'z', 'ht', 'abas', 'Lcond'];
  const G_RADIO = ['modoI', 'T'];
  const C_RADIO = ['saidas', 'curva', 'faixa', 'posicao', 'forma', 'fracLamina', 'saida'];
  const C_CHECK = ['otima'];

  let estado = null;
  let nomeExemplo = null;

  function calhaAtiva() {
    return estado.calhas.find(function (c) { return c.id === estado.ativa; }) || estado.calhas[0];
  }

  /* ------------------------------------------------------------------ */
  /* Persistência e migração das versões anteriores                     */
  /* ------------------------------------------------------------------ */

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ estado: estado, exemplo: nomeExemplo })); } catch (e) { /* sem armazenamento */ }
  }
  function codificar(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
  function decodificar(s) { return JSON.parse(decodeURIComponent(escape(atob(s)))); }

  function carregarInicial() {
    const m = /[#&]s=([^&]+)/.exec(location.hash);
    if (m) {
      try { return { estado: migrar(decodificar(decodeURIComponent(m[1]))), exemplo: null }; } catch (e) { /* link inválido */ }
    }
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && s.estado) {
        const ex = s.exemplo === true ? 'uma residência em Curitiba' : s.exemplo || null;
        return { estado: migrar(s.estado), exemplo: ex };
      }
    } catch (e) { /* sem armazenamento */ }
    const r = EXEMPLOS.residencia();
    return { estado: r.estado, exemplo: r.nome };
  }

  /* ------------------------------------------------------------------ */
  /* Montagem dos controles                                             */
  /* ------------------------------------------------------------------ */

  // Materiais agrupados pela linha da Tabela 2 que define o n.
  function opcoesMateriais(lista, escolhido) {
    const grupos = {};
    lista.forEach(function (m) { (grupos[m.n] = grupos[m.n] || []).push(m); });
    return Object.keys(grupos).sort().map(function (n) {
      return '<optgroup label="n = ' + nf(Number(n), 3) + '">' + grupos[n].map(function (m) {
        return '<option value="' + m.id + '"' + (m.id === escolhido ? ' selected' : '') + '>' + esc(m.rotulo) + ' · n = ' + nf(m.n, 3) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function montarSelects() {
    $('#material').innerHTML = opcoesMateriais(MAT_C);
    $('#materialV').innerHTML = DD.MATERIAIS_VERTICAL.map(function (m) { return '<option value="' + m.id + '">' + esc(m.rotulo) + '</option>'; }).join('');
    $('#espessura').innerHTML = DD.ESPESSURAS_CHAPA.map(function (e) {
      return '<option value="' + e + '">' + nf(e, 2) + ' mm</option>';
    }).join('');
    $('#add-tipo').innerHTML = Object.keys(N.SUPERFICIES).map(function (k) {
      return '<option value="' + k + '">(' + k + ') ' + esc(N.SUPERFICIES[k].nome) + '</option>';
    }).join('');
  }

  // Lista de postos filtrada pela busca (sem acentos); o local escolhido fica sempre na lista.
  function montarLocais() {
    const f = normaliza($('#busca-local').value.trim());
    const sel = String(estado.localId);
    const lista = DD.TABELA5.filter(function (l) { return !f || normaliza(l.local).indexOf(f) >= 0; });
    let html = '<option value="">' + (lista.length ? 'Escolha o local…' : 'Nenhum posto com esse nome') + '</option>';
    html += lista.map(function (l) { return '<option value="' + l.id + '">' + esc(l.local) + '</option>'; }).join('');
    if (sel && !lista.some(function (l) { return String(l.id) === sel; })) {
      const l = DD.TABELA5.find(function (x) { return String(x.id) === sel; });
      if (l) html += '<option value="' + l.id + '">' + esc(l.local) + '</option>';
    }
    $('#local').innerHTML = html;
    $('#local').value = sel;
    return lista;
  }

  function montarOpcoesT() {
    const linha = DD.TABELA5.find(function (l) { return l.id === Number(estado.localId); });
    $('#opcoes-T').innerHTML = DD.PERIODOS.map(function (p) {
      let val = '';
      if (estado.modoI === 'tabela' && linha) {
        const I = linha.I[p.T];
        const Tr = linha.Treal[p.T];
        val = I == null ? ' · sem dado' : ' · ' + I + ' mm/h' + (Tr !== p.T ? ' (T=' + Tr + ')' : '');
      } else if (estado.modoI === 'idf') {
        const I = N.intensidadeIDF({ K: num(estado.idfK), a: num(estado.idfA), b: num(estado.idfB), c: num(estado.idfC), T: p.T });
        if (I > 0) val = ' · ' + nf(I) + ' mm/h';
      }
      return '<label><input type="radio" name="T" value="' + p.T + '"' + (Number(estado.T) === p.T ? ' checked' : '') +
        ' /><b>' + p.T + (p.T === 1 ? ' ano' : ' anos') + esc(val) + '</b>' + esc(p.rotulo) + '</label>';
    }).join('');
  }

  // Tubos do condutor vertical: DN e diâmetro interno de catálogo, editáveis.
  function montarTubos() {
    $('#tubos').innerHTML = estado.tubos.map(function (t, i) {
      return '<li class="tubo"><label class="campo"><span>DN</span><input type="text" class="num" inputmode="numeric" data-tubo="' + i +
        '" data-tcampo="dn" value="' + esc(mostrarNum(t.dn)) + '" /></label><label class="campo"><span>Diâmetro interno</span><span class="com-unidade">' +
        '<input type="text" class="num" inputmode="decimal" data-tubo="' + i + '" data-tcampo="di" value="' + esc(mostrarNum(t.di)) + '" /><em>mm</em></span></label>' +
        '<button type="button" class="btn fantasma" data-remover-tubo="' + i + '" aria-label="Remover o tubo ' + (i + 1) + '">Remover</button></li>';
    }).join('');
  }

  // Linha de tubo dos condutores verticais: há catálogo só de PVC; os demais materiais usam os
  // tubos informados pelo usuário.
  function montarLinhaV() {
    const pvc = estado.materialV === 'pvc';
    const linhas = DD.LINHAS_TUBO.filter(function (l) { return l.usos.indexOf('vertical') >= 0; });
    $('#linhaV').innerHTML = (pvc ? linhas.map(function (l) { return '<option value="' + l.id + '">' + esc(l.rotulo) + '</option>'; }).join('') : '') +
      '<option value="usuario">' + (pvc ? 'Meus tubos (outro fabricante ou série)' : 'Meus tubos: o app não tem catálogo de ' + esc(PJ.matVertical(estado).toLowerCase())) + '</option>';
    $('#linhaV').value = PJ.linhaVertical(estado);
  }

  // Tabela da linha escolhida: DN, DE, espessura e o Di que sai deles, com a fonte.
  function renderCatalogoV() {
    const id = PJ.linhaVertical(estado);
    if (id === 'usuario') { $('#catalogo-v-corpo').innerHTML = ''; return; }
    $('#catalogo-v-corpo').innerHTML = '<div class="rolagem"><table class="tabela"><thead><tr><th>DN</th><th>DE (mm)</th><th>e (mm)</th><th>Di = DE − 2e (mm)</th></tr></thead><tbody>' +
      tubosDaLinha(id, 'vertical').map(function (t) {
        return '<tr><td>' + t.dn + '</td><td>' + na(t.de) + '</td><td>' + na(t.e) + '</td><td><b>' + nf(t.di, 1) + '</b>' + (t.obs ? ' <small>' + esc(t.obs) + '</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="fonte">Fonte: ' + esc(linhaTubo(id).fonte) + '.</p>';
  }

  /* Barra da calha: presa no topo enquanto se preenchem os passos B.1 a B.4, com a calha em
     edição e os atalhos para trocar, criar, duplicar e remover. */
  let assinaturaBarra = '';
  function montarBarraCalha() {
    const ass = estado.ativa + '|' + estado.calhas.map(function (c) { return c.id + ':' + (c.nome || ''); }).join('|');
    if (ass !== assinaturaBarra) {
      assinaturaBarra = ass;
      const n = estado.calhas.length;
      $('#barra-calha-sel').innerHTML = estado.calhas.map(function (c, i) {
        return '<option value="' + c.id + '"' + (c.id === estado.ativa ? ' selected' : '') + '>' +
          (n > 1 ? (i + 1) + ' de ' + n + ': ' : '') + esc(c.nome || 'Calha sem nome') + '</option>';
      }).join('');
    }
    $('[data-acao-calha="remover"]').disabled = estado.calhas.length < 2;
    agendarBarra();
  }
  // São três medições baratas: roda direto no scroll, sem requestAnimationFrame (que não dispara
  // com a aba oculta e deixaria a barra presa no estado errado até a próxima rolagem).
  function posicionarBarraCalha() {
    const barra = $('#barra-calha');
    // No computador o resumo fica preso no topo e a barra vem logo abaixo; no celular o resumo
    // vai para baixo e a barra ocupa o topo.
    const r = $('.resumo').getBoundingClientRect();
    const topo = r.top < 1 && r.bottom < innerHeight / 2 ? r.bottom : 0;
    const ini = $('#s52').getBoundingClientRect().top;
    const fim = $('#s56').getBoundingClientRect().bottom;
    const ver = !document.documentElement.classList.contains('com-relatorio') && ini < topo + 80 && fim > topo + 120;
    barra.style.top = topo + 'px';
    if (barra.hidden === ver) barra.hidden = !ver;
    // Âncoras e "Ir até lá" param abaixo da barra enquanto ela aparece.
    document.documentElement.style.scrollPaddingTop = ver ? (topo + barra.offsetHeight + 16) + 'px' : '';
  }
  const agendarBarra = function () { posicionarBarraCalha(); };
  function iniciarBarraCalha() {
    window.addEventListener('scroll', agendarBarra, { passive: true });
    window.addEventListener('resize', agendarBarra);
    agendarBarra();
  }

  function montarAbas() {
    $('#abas-calhas').innerHTML = estado.calhas.map(function (c) {
      const sel = c.id === estado.ativa;
      return '<button type="button" class="aba" role="tab" aria-selected="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" data-calha-id="' + c.id +
        '"><i class="ponto" data-ponto-calha="' + c.id + '"></i><span data-nome-calha="' + c.id + '">' + esc(c.nome || 'Calha sem nome') + '</span></button>';
    }).join('');
  }

  function campoTrecho(i, campo, rotulo, uni, valor) {
    return '<label class="campo"><span>' + rotulo + '</span><span class="com-unidade"><input type="text" class="num" inputmode="decimal" data-trecho="' + i +
      '" data-campo="' + campo + '" value="' + esc(mostrarNum(valor)) + '" /><em>' + uni + '</em></span></label>';
  }

  // Linhas de tubo que valem para o material do trecho; 'auto' diz qual é a padrão.
  function opcoesLinhaTrecho(t) {
    const pvc = t.material === 'pvc';
    const ops = [['auto', 'Padrão: ' + (pvc ? (t.instalacao === 'aparente' ? 'PVC Série Normal' : 'coletor PVC NBR 7362') : 'diâmetros da Tabela 4')]];
    if (pvc) {
      DD.LINHAS_TUBO.filter(function (l) { return l.usos.indexOf('horizontal') >= 0; }).forEach(function (l) { ops.push([l.id, l.rotulo]); });
      ops.push(['tabela4', 'Diâmetros da Tabela 4 (confirmar o Di)']);
    }
    ops.push(['usuario', 'Meus tubos (diâmetros internos)']);
    const sel = ops.some(function (o) { return o[0] === t.linha; }) ? t.linha : 'auto';
    return ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }

  function montarTrechos() {
    $('#trechos').innerHTML = estado.trechos.map(function (t, i) {
      const chks = estado.calhas.map(function (c) {
        return '<label class="caixa-check"><input type="checkbox" data-trecho-calha="' + i + '" value="' + c.id + '"' +
          (t.calhas.indexOf(c.id) >= 0 ? ' checked' : '') + ' /><span><span data-nome-calha="' + c.id + '">' + esc(c.nome || 'Calha sem nome') +
          '</span> <small data-q-calha="' + c.id + '"></small></span></label>';
      }).join('');
      return '<li class="trecho"><div class="trecho-topo"><label class="campo"><span>Nome do trecho</span><input type="text" data-trecho="' + i +
        '" data-campo="nome" value="' + esc(t.nome) + '" /></label><button type="button" class="btn fantasma" data-remover-trecho="' + i + '">Remover</button></div>' +
        '<fieldset><legend>Recebe os condutores das calhas</legend><div class="chips">' + chks + '</div></fieldset>' +
        '<div class="linha-campos">' + campoTrecho(i, 'Qextra', 'Vazão extra', 'L/min', t.Qextra) +
        '<label class="campo"><span>Material (4.1.3)</span><select data-trecho="' + i + '" data-campo="material">' + opcoesMateriais(MAT_H, t.material) + '</select></label>' +
        '<label class="campo"><span>Instalação</span><select data-trecho="' + i + '" data-campo="instalacao"><option value="enterrado"' + (t.instalacao !== 'aparente' ? ' selected' : '') +
        '>Enterrado (caixa de areia)</option><option value="aparente"' + (t.instalacao === 'aparente' ? ' selected' : '') + '>Aparente (inspeção)</option></select></label>' +
        '<label class="campo campo-linha"><span>Linha de tubo</span><select data-trecho="' + i + '" data-campo="linha">' + opcoesLinhaTrecho(t) + '</select></label>' +
        campoTrecho(i, 'decl', 'Declividade', '%', t.decl) + campoTrecho(i, 'comp', 'Comprimento', 'm', t.comp) + '</div>' +
        (PJ.linhaDoTrecho(t) === 'usuario' ? '<label class="campo campo-largo"><span>Diâmetros internos disponíveis (mm), separados por ponto e vírgula</span><input type="text" inputmode="decimal" data-trecho="' + i +
          '" data-campo="tubosH" value="' + esc(t.tubosH || '') + '" placeholder="Ex.: 97; 144,8; 192,8" /><small class="dica">Di = DE − 2e, do catálogo do tubo que você vai usar.</small></label>' : '') +
        '<p class="parcial" data-trecho-res="' + i + '"></p></li>';
    }).join('');
  }

  function montarSuperficies() {
    $('#superficies').innerHTML = calhaAtiva().superficies.map(function (s, idx) {
      const def = N.SUPERFICIES[s.tipo];
      const rotuloFigura = 'Figura 2(' + s.tipo + '): ' + esc(def.nome);
      const figura = '<svg class="fig" viewBox="-4 0 224 150" role="img" aria-label="' + rotuloFigura + '">' + FIGURAS[s.tipo] + '</svg>';
      const campos = def.campos.map(function (c) {
        const v = s.v[c[0]];
        return '<label class="campo"><span>' + esc(c[1]) + '</span><input type="text" class="num" inputmode="decimal" data-sup="' +
          idx + '" data-var="' + c[0] + '" value="' + esc(mostrarNum(v)) + '" /></label>';
      }).join('');
      return '<li class="sup">' + figura +
        '<div class="corpo"><b style="font-family:var(--f-titulo);font-weight:600">(' + s.tipo + ') ' + esc(def.nome) + '</b>' +
        '<div class="linha-campos">' + campos + '</div><p class="parcial" data-parcial="' + idx + '"></p></div>' +
        '<button type="button" class="btn fantasma" data-remover="' + idx + '" aria-label="Remover superfície ' + (idx + 1) + '">Remover</button></li>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Formulário ⇄ estado                                                */
  /* ------------------------------------------------------------------ */

  function preencher() {
    const c = calhaAtiva();
    $('#projeto').value = estado.projeto || '';
    $('#fonteChuva').value = estado.fonteChuva || '';
    $('#nome-calha').value = c.nome || '';
    $('#listaSaidas').value = c.listaSaidas || '';
    montarLocais();
    $('#material').value = c.material;
    $('#materialV').value = estado.materialV;
    montarLinhaV();
    $('#espessura').value = String(c.espessura);
    G_NUM.forEach(function (id) { document.getElementById(id).value = mostrarNum(estado[id]); });
    C_NUM.forEach(function (id) { document.getElementById(id).value = mostrarNum(c[id]); });
    G_RADIO.forEach(function (nome) {
      $$('input[name="' + nome + '"]').forEach(function (r) { r.checked = String(estado[nome]) === r.value; });
    });
    // Estados antigos e exemplos só têm tipoCalha: a posição sai dele.
    if (!POSICOES[c.posicao] || POSICOES[c.posicao].tipo !== c.tipoCalha) c.posicao = c.tipoCalha;
    C_RADIO.forEach(function (nome) {
      $$('input[name="' + nome + '"]').forEach(function (r) { r.checked = String(c[nome]) === r.value; });
    });
    C_CHECK.forEach(function (id) { document.getElementById(id).checked = !!c[id]; });
    montarOpcoesT();
    montarAbas();
    montarSuperficies();
    montarTubos();
    montarTrechos();
  }

  function ler() {
    const c = calhaAtiva();
    estado.projeto = $('#projeto').value;
    estado.fonteChuva = $('#fonteChuva').value;
    c.nome = $('#nome-calha').value;
    c.listaSaidas = $('#listaSaidas').value;
    estado.localId = $('#local').value === '' ? '' : Number($('#local').value);
    c.material = $('#material').value;
    estado.materialV = $('#materialV').value;
    // A lista de linhas só tem catálogo com PVC; com outro material ela mostra só "Meus tubos"
    // e não apaga a linha de PVC escolhida antes.
    const lv = $('#linhaV');
    if (estado.materialV === 'pvc' && lv.options.length > 1) estado.linhaV = lv.value;
    c.espessura = Number($('#espessura').value);
    G_NUM.forEach(function (id) { estado[id] = lerNum(document.getElementById(id).value); });
    C_NUM.forEach(function (id) { c[id] = lerNum(document.getElementById(id).value); });
    G_RADIO.forEach(function (nome) {
      const r = $('input[name="' + nome + '"]:checked');
      if (r) estado[nome] = nome === 'T' ? Number(r.value) : r.value;
    });
    C_RADIO.forEach(function (nome) {
      const r = $('input[name="' + nome + '"]:checked');
      if (r) c[nome] = r.value;
    });
    if (POSICOES[c.posicao]) c.tipoCalha = POSICOES[c.posicao].tipo;
    C_CHECK.forEach(function (id) { c[id] = document.getElementById(id).checked; });
    $$('[data-sup]').forEach(function (el) {
      const s = c.superficies[Number(el.dataset.sup)];
      if (s) s.v[el.dataset.var] = lerNum(el.value);
    });
    $$('[data-tubo]').forEach(function (el) {
      const t = estado.tubos[Number(el.dataset.tubo)];
      if (t) t[el.dataset.tcampo] = lerNum(el.value);
    });
    $$('[data-trecho][data-campo]').forEach(function (el) {
      const t = estado.trechos[Number(el.dataset.trecho)];
      if (!t) return;
      const k = el.dataset.campo;
      t[k] = ['nome', 'material', 'instalacao', 'linha', 'tubosH'].indexOf(k) >= 0 ? el.value : lerNum(el.value);
    });
    estado.trechos.forEach(function (t, i) {
      const caixas = $$('[data-trecho-calha="' + i + '"]');
      if (caixas.length) t.calhas = caixas.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
    });
  }

  // Calha de alvenaria não é semicircular: troca a seção em vez de aceitar um caso impossível.
  function normalizarOpcoes() {
    const c = calhaAtiva();
    if (matCalha(c.material).alvenaria && c.forma === 'semicircular') {
      c.forma = 'retangular';
      $$('input[name="forma"]').forEach(function (r) { r.checked = r.value === 'retangular'; });
      toast('Calha de alvenaria não é semicircular: a seção passou para retangular');
    }
  }

  // Posições da calha: cada uma diz o tipo usado no cálculo (Tabela 1 e declividade) e as
  // superfícies da Figura 2 que se aplicam. Escolher uma posição já monta essas superfícies.
  const POSICOES = {
    beiral: { nome: 'Beiral', tipo: 'beiral', sups: ['b'],
      dica: 'Calha de beiral: some a água do telhado que desce para ela, Figura 2(b), e as paredes mais altas que despejam chuva nesse telhado.' },
    platibanda: { nome: 'Platibanda', tipo: 'platibanda', sups: ['b', 'c'],
      dica: 'Calha de platibanda: além da água do telhado, inclua a face interna da platibanda, que recebe a chuva inclinada, Figura 2(c).' },
    'agua-furtada': { nome: 'Água-furtada', tipo: 'agua-furtada', sups: ['b', 'b'],
      dica: 'Calha de água-furtada: o vale recebe as duas águas que se encontram nele, uma superfície (b) para cada lado.' },
    'parede-mais-alta': { nome: 'Entre paredes, uma mais alta', tipo: 'platibanda', sups: ['b', 'd'],
      dica: 'Telhado entre duas paredes opostas, uma mais alta: some a água do telhado, Figura 2(b), e o excedente da parede mais alta, Figura 2(d).' },
    'paredes-desiguais': { nome: 'Entre paredes desiguais', tipo: 'platibanda', sups: ['b', 'e'],
      dica: 'Telhado entre duas paredes opostas de medidas diferentes: some a água do telhado, Figura 2(b), e as duas paredes, Figura 2(e).' },
    canto: { nome: 'Canto de paredes', tipo: 'platibanda', sups: ['b', 'f'],
      dica: 'Telhado no canto de duas paredes adjacentes e perpendiculares: some a água do telhado, Figura 2(b), e as duas paredes, Figura 2(f).' },
    'patio-u': { nome: 'Pátio em U', tipo: 'platibanda', sups: ['b', 'g'],
      dica: 'Telhado cercado por três paredes em U, as opostas iguais: some a água do telhado, Figura 2(b), e as paredes, Figura 2(g).' },
    'quatro-paredes': { nome: 'Quatro paredes', tipo: 'platibanda', sups: ['a', 'h'],
      dica: 'Laje cercada por quatro paredes, uma mais alta: some a laje, Figura 2(a), e o excedente da parede mais alta, Figura 2(h).' },
  };

  // Troca as superfícies pelas da posição escolhida, aproveitando os valores já digitados das
  // que continuam valendo. As que saem ficam guardadas por calha (nesta sessão) e voltam com
  // as medidas se outra posição usar o mesmo tipo. O aviso ainda oferece desfazer.
  const guardadas = {};
  function aplicarPosicao(c, anterior) {
    const P = POSICOES[c.posicao];
    if (!P) return;
    c.tipoCalha = P.tipo;
    const antes = copia(c.superficies);
    const sobra = c.superficies.slice();
    const reserva = guardadas[c.id] || (guardadas[c.id] = []);
    const tirar = function (lista, tipo) {
      const k = lista.findIndex(function (s) { return s.tipo === tipo; });
      return k >= 0 ? lista.splice(k, 1)[0] : null;
    };
    c.superficies = P.sups.map(function (tipo) {
      const s = tirar(sobra, tipo) || tirar(reserva, tipo);
      if (s) return s;
      const v = {};
      N.SUPERFICIES[tipo].campos.forEach(function (cc) { v[cc[0]] = ''; });
      return { tipo: tipo, v: v };
    });
    sobra.forEach(function (s) { reserva.unshift(s); });
    montarSuperficies();
    const mesmas = antes.length === c.superficies.length && antes.every(function (s, i) { return s.tipo === c.superficies[i].tipo; });
    if (mesmas) return;
    toast('Superfícies de "' + P.nome + '": ' + P.sups.map(function (t) { return '(' + t + ')'; }).join(' + '), {
      rotulo: 'Desfazer',
      fn: function () {
        c.superficies = antes;
        c.posicao = anterior;
        if (POSICOES[anterior]) c.tipoCalha = POSICOES[anterior].tipo;
        preencher();
        atualizar();
      },
    });
  }

  function mostrar(sel, cond) { $$(sel).forEach(function (el) { el.hidden = !cond; }); }

  function visibilidade() {
    const c = calhaAtiva();
    const mat = matCalha(c.material);
    $$('[data-modo-i]').forEach(function (el) { el.hidden = el.dataset.modoI !== estado.modoI; });
    $('[data-bloco-t]').hidden = !(estado.modoI === 'tabela' || estado.modoI === 'idf');
    mostrar('[data-fonte-chuva]', estado.modoI === 'idf' || estado.modoI === 'manual');
    $$('[data-so-saidas]').forEach(function (el) { el.hidden = el.dataset.soSaidas !== c.saidas; });
    const precisaL = c.saidas === 'intermediaria' || c.saidas === 'personalizadas';
    $('#rot-Lc').textContent = precisaL ? 'Comprimento da calha' : 'Comprimento da calha (dá o desnível)';
    const t1 = c.tipoCalha !== 'agua-furtada';
    $('[data-tabela1]').hidden = !t1;
    $('[data-so-curva]').hidden = !t1 || c.curva === 'nenhuma';
    $('[data-forma-card="semicircular"]').hidden = !!mat.alvenaria;
    $$('[data-forma]').forEach(function (el) { el.hidden = el.dataset.forma !== c.forma; });
    $('#bloco-chapa').hidden = !mat.chapa;
    $('#leg-lamina').innerHTML = c.forma === 'semicircular'
      ? 'Lâmina máxima admitida (a altura da semicircular é <var>D</var>/2)'
      : 'Lâmina máxima admitida (o que sobra é o bordo livre)';
    $('#rot-decl').innerHTML = c.tipoCalha === 'agua-furtada' ? 'Declividade <var>i</var> (a da cobertura)' : 'Declividade <var>i</var> (mínimo 0,5%)';
    $('#btn-dimensionar').textContent = c.forma === 'semicircular' ? 'Escolher o menor diâmetro'
      : c.forma === 'retangular' && c.otima ? 'Calcular a seção econômica' : 'Calcular a altura mínima';
    const usuarioV = PJ.linhaVertical(estado) === 'usuario';
    mostrar('[data-tubos-usuario]', usuarioV);
    mostrar('[data-tubos-catalogo]', !usuarioV);
    $('#dica-area').textContent = (POSICOES[c.posicao] || POSICOES[c.tipoCalha] || {}).dica || '';
    const pos = estado.calhas.indexOf(c) + 1;
    const tag = 'Calha ' + (estado.calhas.length > 1 ? pos + ' de ' + estado.calhas.length + ': ' : ': ') + (c.nome || 'sem nome');
    $$('[data-calha-tag]').forEach(function (el) { el.textContent = tag; });
    $('#btn-remover-calha').disabled = estado.calhas.length < 2;
    const aviso = $('#estado-exemplo');
    aviso.hidden = !nomeExemplo;
    if (nomeExemplo) aviso.textContent = 'Exemplo carregado: ' + nomeExemplo + '. Troque pelos dados da sua obra.';
  }

  /* ------------------------------------------------------------------ */
  /* Renderização                                                       */
  /* ------------------------------------------------------------------ */

  const FONTE_I = { tabela: 'Tabela 5', idf: 'equação IDF do local', pequena: 'item 5.1.4', manual: 'dado local' };

  function render51(R) {
    const e = estado;
    if (!(R.I.I > 0)) {
      const falta = e.modoI === 'tabela' ? 'Escolha o local da obra na Tabela 5.' : e.modoI === 'idf' ? 'Informe os coeficientes da equação IDF.' : 'Informe a intensidade pluviométrica.';
      $('#r51').innerHTML = aguardando(falta) + avisosHtml(R.avisos51.filter(function (a) { return a.nivel !== 'erro'; }));
      return;
    }
    let h = grande('I', nf(R.I.I), 'mm/h');
    const itens = [['Duração', '5 min <small>(5.1.3)</small>'], ['Fonte', FONTE_I[e.modoI]]];
    if (e.modoI === 'tabela' || e.modoI === 'idf') itens.push(['Período de retorno', (R.I.T || '—') + ' anos']);
    if (e.modoI === 'pequena') itens.push(['Área de projeção', na(num(e.areaProj)) + ' m²']);
    if (e.modoI === 'manual') itens.push(['Período de retorno', R.I.T ? R.I.T + ' anos' : '—']);
    h += pares(itens);
    if (e.modoI === 'idf') {
      h += '<p class="formula"><var>i</var> = ' + na(num(e.idfK)) + ' · ' + e.T + '<sup>' + na(num(e.idfA)) + '</sup> / (5 + ' + na(num(e.idfB)) + ')<sup>' + na(num(e.idfC)) +
        '</sup> = <b>' + nf(R.I.I, 1) + ' mm/h</b><span class="ref">5.1.1</span></p>';
    }
    if (e.modoI === 'tabela' && R.I.linha) {
      const l = R.I.linha;
      h += '<div class="rolagem"><table class="tabela"><caption>Linha da Tabela 5 · entre parênteses, o período real quando o posto não tinha 5 ou 25 anos de registros</caption><thead><tr><th>' + esc(l.local) + '</th><th>T = 1</th><th>T = 5</th><th>T = 25</th></tr></thead><tbody><tr><td>mm/h</td>' +
        [1, 5, 25].map(function (t) {
          const v = l.I[t];
          const sel = t === Number(e.T);
          return '<td' + (sel ? ' style="background:var(--patina-suave);font-weight:600"' : '') + '>' + (v == null ? '—' : v + (l.Treal[t] !== t ? ' (' + l.Treal[t] + ')' : '')) + '</td>';
        }).join('') + '</tr></tbody></table></div>';
    }
    h += avisosHtml(R.avisos51);
    $('#r51').innerHTML = h;
  }

  function render52(R) {
    R.sups.forEach(function (s, idx) {
      const el = document.querySelector('[data-parcial="' + idx + '"]');
      if (el) el.innerHTML = '<var>' + esc(s.formula) + '</var> = ' + esc(s.subst) + ' = <b>' + nf(s.A, 2) + ' m²</b>';
    });
    if (!(R.A > 0)) {
      $('#r52').innerHTML = aguardando('Preencha as dimensões das superfícies que escoam para esta calha.');
      return;
    }
    let h = grande('A', nf(R.A, 2), 'm²');
    h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Superfície</th><th>Fórmula</th><th>Área (m²)</th></tr></thead><tbody>' +
      R.sups.map(function (s, idx) {
        const t = R.c.superficies[idx].tipo;
        return '<tr><td>(' + t + ') ' + esc(N.SUPERFICIES[t].nome) + '</td><td>' + esc(s.subst) + '</td><td>' + nf(s.A, 2) + '</td></tr>';
      }).join('') +
      '<tr><td><b>Total</b></td><td></td><td><b>' + nf(R.A, 2) + '</b></td></tr></tbody></table></div>';
    $('#r52').innerHTML = h;
  }


  function render53(R) {
    if (!(R.Q > 0)) {
      $('#r53').innerHTML = aguardando('A vazão aparece quando houver intensidade e área.');
      return;
    }
    let h = grande('Q', nf(R.Q, 1), 'L/min');
    h += '<p class="formula"><var>Q</var> = <var>I</var> · <var>A</var> / 60 = ' + nf(R.I.I, 1) + ' · ' + nf(R.A, 2) + ' / 60 = <b>' + nf(R.Q, 1) + ' L/min</b><span class="ref">5.3.1</span></p>';
    h += '<p class="formula"><var>Q</var><sub>calha</sub> = <var>Q</var> · ' + nf(R.dist.fracCalha, 3) + (R.coef !== 1 ? ' · ' + nf(R.coef, 2) : '') + ' = <b>' + nf(R.Qcalha, 1) + ' L/min</b><span class="ref">' + (R.coef !== 1 ? '5.5.4 · Tabela 1' : '5.5.4') + '</span></p>';
    h += pares([
      ['Trecho crítico da calha', textoSaidas(R)],
      ['Coeficiente da Tabela 1', R.coef === 1 ? '1,00 <small>sem curva a &lt; 4 m</small>' : nf(R.coef, 2)],
      ['Condutores verticais', String(R.dist.n)],
      ['Vazão no condutor mais carregado', nf(R.Qcond, 1) + ' <small>L/min</small>'],
    ]);
    if (R.dist.saidas.length > 1 || R.c.saidas === 'personalizadas') {
      const comL = R.dist.trecho != null;
      h += '<div class="rolagem"><table class="tabela"><caption>Cada saída recebe o trecho entre os divisores de água vizinhos</caption><thead><tr><th>Saída</th><th>Posição</th><th>Trecho que escoa para ela</th><th>Vazão</th></tr></thead><tbody>' +
        R.dist.saidas.map(function (s, k) {
          return '<tr><td>' + (k + 1) + '</td><td>' + (comL ? na(s.x) + ' m' : '—') + '</td><td>' +
            (comL ? na(s.ladoEsq + s.ladoDir) + ' m' : nf(s.fracao * 100, 0) + '% da calha') + '</td><td>' + nf(R.Q * s.fracao, 1) + ' L/min</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += avisosHtml(R.avisos53);
    $('#r53').innerHTML = h;
  }

  function render55(R) {
    const c = R.calha;
    if (!c.pronta) {
      $('#r55').innerHTML = aguardando(R.Qcalha > 0 ? 'Informe as dimensões da seção e a declividade.' : 'A calha é verificada quando houver vazão de projeto.') + avisosHtml(c.avisos);
      return;
    }
    const yMm = c.y != null ? c.y * 1000 : null;
    const selo = c.ok ? '<span class="selo ok">Atende</span>' : c.y == null ? '<span class="selo erro">Transborda</span>' : '<span class="selo erro">Acima do limite adotado</span>';
    let h = cabecalho(yMm != null ? grande('y', nf(yMm), 'mm de lâmina') : grande('y', '&gt; h', 'a seção cheia não basta'), selo);
    h += svgSecao(c.forma, c.dims, c.y, c.yLim);
    const g = c.y != null ? c : null;
    h += '<p class="formula"><var>Q</var> = <var>K</var> · (<var>S</var>/<var>n</var>) · <var>R</var><sub>H</sub><sup>2/3</sup> · <var>i</var><sup>1/2</sup>' +
      (g ? ' = 60 000 · (' + nf(g.S, 5) + '/' + nf(c.n, 3) + ') · ' + nf(g.R, 4) + '<sup>2/3</sup> · ' + nf(c.i, 4) + '<sup>1/2</sup> = <b>' + nf(R.Qcalha, 1) + ' L/min</b>' : '') +
      '<span class="ref">5.5.7</span></p>';
    const itens = [
      ['Material', esc(c.mat.rotulo) + ' <small>n = ' + nf(c.n, 3) + '</small>'],
      ['Vazão da calha', nf(R.Qcalha, 1) + ' <small>L/min</small>'],
      ['Capacidade no limite', nf(c.Qlim, 0) + ' <small>L/min</small>'],
      ['Uso da capacidade', nf(c.uso * 100, 0) + ' <small>%</small>'],
    ];
    if (g) {
      itens.push(
        ['Área molhada S', nf(g.S * 1e4, 1) + ' <small>cm²</small>'],
        ['Raio hidráulico', nf(g.R * 1000, 1) + ' <small>mm</small>'],
        ['Velocidade', nf(g.V, 2) + ' <small>m/s</small>'],
        ['Bordo livre', nf(g.bordoLivre * 1000, 0) + ' <small>mm</small>'],
      );
    }
    if (c.desnivel != null) itens.push(['Desnível no maior trecho', nf(c.desnivel * 100, 1) + ' <small>cm em ' + na(R.dist.trecho) + ' m</small>']);
    h += pares(itens);
    if (c.chapa) {
      h += '<p class="rotulo-bloco">Chapa de ' + esc(c.chapa.metal) + '</p>' + pares([
        ['Desenvolvimento', nf(c.chapa.dev * 1000, 0) + ' <small>mm</small>'],
        ['Corte usual', c.chapa.corte ? c.chapa.corte + ' <small>mm</small>' : 'acima de 600 <small>mm</small>'],
        ['Massa aproximada', nf(c.chapa.massa, 2) + ' <small>kg/m</small>'],
      ]);
    }
    if (c.tabela3) {
      h += '<p class="aviso ok">Conferência com a Tabela 3' + (c.tabela3.exata ? '' : ' (interpolada)') + ': calha semicircular D = ' + nf(c.tabela3.D) + ' mm, i = ' +
        na(c.tabela3.i * 100) + '% → ' + nf(c.tabela3.Q) + ' L/min pela norma (seção cheia); o cálculo por Manning dá ' + nf(c.Qcheia, 0) + ' L/min.</p>';
    }
    const av = c.avisos.slice();
    if (c.y == null) av.unshift({ nivel: 'erro', texto: 'Mesmo cheia até a borda, a seção escoa ' + nf(c.Qcheia, 0) + ' L/min, menos que os ' + nf(R.Qcalha, 0) + ' L/min de projeto. Use "' + $('#btn-dimensionar').textContent + '" ou distribua mais saídas.' });
    else if (!c.ok) av.unshift({ nivel: 'erro', texto: 'A lâmina passa do limite adotado (' + nf(c.yLim * 1000) + ' mm): a calha não atende ao critério escolhido. Aumente a seção, a declividade ou o número de saídas.' });
    h += avisosHtml(av);
    $('#r55').innerHTML = h;
  }


  function render56(R) {
    const v = R.vert;
    const e = R.c;
    const sugestao = function () {
      return {
        nivel: 'atencao',
        html: 'Com <b>' + v.sugestao.n + ' saídas espaçadas</b>, cada condutor recebe ' + nf(v.sugestao.Q, 0) + ' L/min e cabe em ' +
          esc(rotuloTubo(v.sugestao.tubo)) + '. <button type="button" class="btn" data-usar-saidas="' + v.sugestao.n + '">Usar ' + v.sugestao.n + ' saídas</button>',
      };
    };
    if (!v.pronto) {
      const falta = v.invalido ? 'Corrija o dado indicado abaixo.' :
        v.faltando === 'H' ? 'A lâmina H é a lâmina máxima admitida da calha: complete o passo B.3.' :
        v.faltando === 'L' ? 'Informe o comprimento L do condutor vertical.' : 'O condutor é dimensionado quando houver vazão.';
      $('#r56').innerHTML = aguardando(falta) + avisosHtml(v.avisos) + '<div class="abaco-quadro">' + svgAbaco(e.saida, 0, 0, 0, null) + '</div>';
      return;
    }
    if (v.fora) {
      const avFora = v.avisos.slice();
      if (v.sugestao) avFora.push(sugestao());
      if (v.fora === 'H') {
        avFora.push({ nivel: 'atencao', texto: 'No passo B.3, use "' + $('#btn-dimensionar').textContent + '": o botão escolhe a menor seção comercial que também deixa a lâmina em pelo menos 50 mm, onde o ábaco começa.' });
      }
      $('#r56').innerHTML = cabecalho(grande('D', '—', 'fora do ábaco (' + e.saida + ')'), '<span class="selo fora">Sem leitura</span>') +
        '<div class="abaco-quadro">' + svgAbaco(e.saida, 0, 0, 0, null) + '</div>' + avisosHtml(avFora);
      return;
    }
    const a = v.adocao;
    const curto = function (t) { return t.dn ? 'DN ' + t.dn : 'Di ' + na(t.di) + ' mm'; };
    const selo = a.tubo ? '<span class="selo ok">' + curto(a.tubo) + (R.dist.n > 1 ? ' × ' + R.dist.n : '') + '</span>' :
      a.semTubos ? '<span class="selo">Faltam os tubos</span>' : '<span class="selo erro">Sem tubo</span>';
    let h = cabecalho(grande('D', v.D < 50 ? '&lt; 50' : nf(v.D), 'mm pelo ábaco (' + e.saida + ')'), selo);
    h += '<div class="abaco-quadro">' + svgAbaco(e.saida, R.Qcond, R.H, num(e.Lcond), v) + '</div>';
    h += '<div class="legenda-abaco"><span><i></i>curva H interpolada</span><span><i class="l"></i>curva L interpolada</span><span><i class="d"></i>interseção mais alta → D</span></div>';
    h += pares([
      ['Vazão no condutor', nf(R.Qcond, 1) + ' <small>L/min</small>'],
      ['Lâmina H', nf(R.H) + ' <small>mm, ' + TEXTO_FONTE_H.limite + '</small>'],
      ['D pela curva H', (v.DH < 50 ? '&lt; 50' : nf(v.DH)) + ' <small>mm</small>'],
      ['D pela curva L', (v.DL < 50 ? '&lt; 50' : nf(v.DL)) + ' <small>mm</small>'],
      ['Governa', v.governa === 'H' ? 'entrada <small>(H)</small>' : 'tubo <small>(L)</small>'],
      ['Adotado', a.tubo ? curto(a.tubo) + ' <small>Dᵢ ' + nf(a.tubo.di, 1) + ' mm · ' + esc(v.linha === 'usuario' ? 'tubo informado' : linhaTubo(v.linha).curto) + '</small>' : '—'],
      ['Folga de diâmetro', a.tubo ? (v.folga >= 0 ? '+' : '') + nf(v.folga * 100, 0) + ' <small>% sobre ' + nf(a.minimo) + ' mm exigidos</small>' : '—'],
    ]);
    const av = v.avisos.slice();
    if (a.peloMinimo) av.push({ nivel: 'info', texto: 'O ábaco pede menos de 70 mm; vale o diâmetro interno mínimo da norma (5.6.3).' });
    if (!a.tubo && !a.semTubos) av.push({ nivel: 'erro', texto: 'Nenhum tubo da linha tem diâmetro interno ≥ ' + nf(a.minimo) + ' mm.' });
    if (v.sugestao) {
      av.push(sugestao());
    } else if (!a.tubo && !a.semTubos) {
      av.push({ nivel: 'erro', texto: 'Nem com 12 saídas os condutores cabem: reveja a lâmina H, o comprimento L ou use funil de saída.' });
    }
    h += avisosHtml(av);
    $('#r56').innerHTML = h;
  }

  function renderColetores(P) {
    P.calhas.forEach(function (r) {
      $$('[data-q-calha="' + r.c.id + '"]').forEach(function (el) { el.textContent = r.Q > 0 ? nf(r.Q, 0) + ' L/min' : ''; });
    });
    P.trechos.forEach(function (T, i) {
      const el = document.querySelector('[data-trecho-res="' + i + '"]');
      if (!el) return;
      if (T.pronto) {
        el.innerHTML = 'Q = <b>' + nf(T.Q, 1) + ' L/min</b> → <b>' + (T.escolhido ? esc(rotuloTubo(T.escolhido)) : 'nenhum tubo da linha basta') + '</b>' +
          (T.escolhido ? ' (uso de ' + nf(T.uso * 100, 0) + '% da capacidade)' : '') +
          (T.desnivel != null ? ' · desnível ' + nf(T.desnivel * 100, 1) + ' cm' : '');
      } else {
        el.textContent = !(T.Q > 0) ? (T.recebe.length ? 'Aguarda a vazão das calhas que recebe (passo B).' : 'Marque as calhas que chegam neste trecho.') :
          T.linha === 'usuario' && !T.tubos.length ? 'Informe os diâmetros internos dos tubos.' : 'Informe a declividade.';
      }
    });
    if (!P.trechos.length) {
      $('#r57').innerHTML = aguardando('Adicione um trecho de coletor.');
      return;
    }
    const prontos = P.trechos.filter(function (T) { return T.pronto; });
    const principal = prontos.slice().sort(function (a, b) { return b.Q - a.Q; })[0];
    let h = '';
    if (principal) {
      const e1 = principal.escolhido;
      h += cabecalho(grande('⌀', e1 ? (e1.dn ? 'DN ' + e1.dn : nf(e1.di, 1)) : '—', e1 ? 'Dᵢ ' + nf(e1.di, 1) + ' mm no trecho mais carregado' : 'nenhum tubo da linha basta'), seloStatus(principal.status));
      h += '<p class="formula">lâmina = 2/3 <var>D</var><sub>i</sub> · ' + esc(principal.linhaInfo.curto) + ' · ' + esc(principal.mat.rotulo) + ', <var>n</var> = ' + nf(principal.n, 3) + ' · <var>i</var> = ' +
        na(principal.i * 100) + '% · <var>Q</var> = ' + nf(principal.Q, 1) + ' L/min<span class="ref">5.7.2</span></p>';
    }
    h += '<div class="rolagem"><table class="tabela"><thead><tr><th>Trecho</th><th>Q (L/min)</th><th>i</th><th>Tubo adotado</th><th>Capacidade</th><th>Uso</th><th>Desnível</th></tr></thead><tbody>' +
      P.trechos.map(function (T) {
        return '<tr' + (T === principal ? ' class="escolhida"' : '') + '><td>' + esc(T.t.nome || 'Trecho') + '</td><td>' + (T.Q > 0 ? nf(T.Q, 0) : '—') + '</td><td>' +
          (T.i > 0 ? na(T.i * 100) + '%' : '—') + '</td><td>' + (T.pronto ? (T.escolhido ? esc(rotuloTubo(T.escolhido)) : 'nenhum') : '—') + '</td><td>' +
          (T.escolhido ? nf(T.escolhido.Q, 0) + ' L/min' : '—') + '</td><td>' + (T.escolhido ? nf(T.uso * 100, 0) + '%' : '—') + '</td><td>' +
          (T.desnivel != null ? nf(T.desnivel * 100, 1) + ' cm' : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (principal) {
      const c = principal;
      const temT4 = c.linhas.some(function (l) { return l.fonteQ === 'Tabela 4'; });
      h += '<div class="rolagem"><table class="tabela"><caption>Tubos da linha "' + esc(c.linhaInfo.curto) + '" para "' + esc(c.t.nome || 'Trecho') + '": capacidade por Manning a 2/3 do diâmetro interno' +
        (temT4 ? '; onde o Di, o n e a declividade coincidem com a Tabela 4, vale o valor impresso' : '') +
        '</caption><thead><tr><th>Tubo</th><th>Capacidade (L/min)</th><th>Base</th><th>Q / capacidade</th></tr></thead><tbody>' +
        c.linhas.map(function (l) {
          const sel = c.escolhido && l === c.escolhido;
          const insuf = l.Q < c.Q;
          return '<tr' + (sel ? ' class="escolhida"' : '') + '><td>' + esc(rotuloTubo(l)) + '</td><td' + (insuf ? ' class="insuf"' : '') + '>' + nf(l.Q, 0) + '</td><td>' +
            (l.fonteQ === 'Tabela 4' ? 'Tabela 4' : 'Manning') + '</td><td' + (insuf ? ' class="insuf"' : '') + '>' + nf((c.Q / l.Q) * 100, 0) + '%</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    const av = [];
    P.trechos.forEach(function (T) {
      T.avisos.forEach(function (a) { av.push({ nivel: a.nivel, texto: (T.t.nome || 'Trecho') + ': ' + a.texto }); });
    });
    P.semColetor.forEach(function (r) {
      av.push({ nivel: 'info', texto: 'A calha "' + (r.c.nome || 'sem nome') + '" não chega a nenhum trecho. Marque-a no trecho que recebe seus condutores.' });
    });
    h += avisosHtml(av);
    $('#r57').innerHTML = h;
  }

  function renderAbasEstado(P) {
    montarBarraCalha();
    P.calhas.forEach(function (r) {
      $$('[data-nome-calha="' + r.c.id + '"]').forEach(function (el) { el.textContent = r.c.nome || 'Calha sem nome'; });
      const p = document.querySelector('[data-ponto-calha="' + r.c.id + '"]');
      if (p) p.className = 'ponto ' + r.status;
    });
  }

  function renderEsquema(P) {
    $('#esquema').innerHTML = svgEsquema(P.ativa, P);
  }

  function renderQuadro(P) {
    let h = '<div class="rolagem"><table class="tabela quadro"><caption>Calhas: área, vazões, seção, lâmina e condutores</caption><thead><tr><th>Calha</th><th>Área (m²)</th><th>Q (L/min)</th><th>Q calha</th><th>Seção (mm)</th><th>Lâmina / limite</th><th>Uso</th><th>Condutores</th><th>Folga do condutor</th><th>Situação</th></tr></thead><tbody>' +
      P.calhas.map(function (r) {
        const c = r.calha;
        const v = r.vert;
        return '<tr><td><button type="button" class="link-calha" data-ativar-calha="' + r.c.id + '">' + esc(r.c.nome || 'Calha sem nome') + '</button></td>' +
          '<td>' + nf(r.A, 1) + '</td><td>' + nf(r.Q, 0) + '</td><td>' + nf(r.Qcalha, 0) + '</td>' +
          '<td>' + (c.pronta ? descSecao(c) : '—') + '</td>' +
          '<td>' + (c.pronta ? (c.y != null ? nf(c.y * 1000) : '&gt; h') + ' / ' + nf(c.yLim * 1000) : '—') + '</td>' +
          '<td>' + (c.pronta ? nf(c.uso * 100, 0) + '%' : '—') + '</td>' +
          '<td>' + (v.pronto && v.adocao.tubo ? r.dist.n + ' × ' + esc(rotuloTubo(v.adocao.tubo)) : '—') + '</td>' +
          '<td>' + (v.pronto && v.adocao.tubo ? '+' + nf(v.folga * 100, 0) + '%' : '—') + '</td>' +
          '<td>' + seloStatus(r.status) + '</td></tr>';
      }).join('') +
      '<tr class="total"><td>Total</td><td>' + nf(P.A, 1) + '</td><td>' + nf(P.Q, 0) + '</td><td colspan="7"></td></tr></tbody></table></div>';
    if (P.trechos.length) {
      h += '<div class="rolagem"><table class="tabela quadro"><caption>Coletores horizontais por trecho</caption><thead><tr><th>Trecho</th><th>Recebe</th><th>Q (L/min)</th><th>Material</th><th>i</th><th>Tubo adotado</th><th>Uso</th><th>Desnível</th><th>Situação</th></tr></thead><tbody>' +
        P.trechos.map(function (T) {
          return '<tr><td>' + esc(T.t.nome || 'Trecho') + '</td><td>' + (T.recebe.length ? T.recebe.map(function (r) { return esc(r.c.nome || 'sem nome'); }).join(', ') : '—') +
            (z(num(T.t.Qextra)) > 0 ? ' + extra' : '') + '</td><td>' + (T.Q > 0 ? nf(T.Q, 0) : '—') + '</td><td>' + esc(T.mat.rotulo) + '</td><td>' +
            (T.i > 0 ? na(T.i * 100) + '%' : '—') + '</td><td>' + (T.pronto ? (T.escolhido ? esc(rotuloTubo(T.escolhido)) + (T.linha === 'tabela4' ? ' <small>Tabela 4</small>' : '') : 'nenhum') : '—') + '</td><td>' +
            (T.escolhido ? nf(T.uso * 100, 0) + '%' : '—') + '</td><td>' + (T.desnivel != null ? nf(T.desnivel * 100, 1) + ' cm' : '—') + '</td><td>' +
            seloStatus(T.status) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += '<p class="legenda-margens">Uso = vazão de projeto ÷ capacidade (a calha na lâmina limite adotada; o coletor com lâmina a 2/3 do diâmetro interno). ' +
      'Folga do condutor = Di adotado ÷ D exigido − 1, com D exigido pelo ábaco ou pelo mínimo de 70 mm.</p>';
    $('#quadro-corpo').innerHTML = h;
  }

  // Mesma precedência dos estados do projeto, na forma de exibição ('' = incompleta).
  const ORDEM_EXIBICAO = ['ok', 'ressalva', 'atencao', 'erro', 'fora', 'semsuporte', '', 'invalida'];
  function piorStatus(lista) {
    if (!lista.length) return '';
    return lista.reduce(function (a, s) { return ORDEM_EXIBICAO.indexOf(s) > ORDEM_EXIBICAO.indexOf(a) ? s : a; }, 'ok');
  }

  function renderResumo(P) {
    const set = function (id, html) { document.getElementById(id).innerHTML = html; };
    const ponto = function (k, cls) { document.querySelector('[data-ponto="' + k + '"]').className = 'ponto ' + (cls || ''); };
    const ch = P.chuva;
    set('res-I', ch.I.I > 0 ? nf(ch.I.I) + '<small>mm/h</small>' : '—');
    ponto('I', ch.I.I > 0 ? PJ.EXIBICAO[ch.estado] : '');
    set('res-A', P.A > 0 ? nf(P.A, 1) + '<small>m²</small>' : '—');
    ponto('A', P.A > 0 ? 'ok' : '');
    set('res-Q', P.Q > 0 ? nf(P.Q, 0) + '<small>L/min</small>' : '—');
    ponto('Q', P.Q > 0 ? 'ok' : '');
    const c = P.ativa.calha;
    set('res-calha', c.pronta ? descSecao(c) + '<small>mm</small>' : '—');
    ponto('calha', P.ativa.status);
    const contagem = {};
    const ordem = [];
    P.calhas.forEach(function (r) {
      const t = r.vert.pronto && r.vert.adocao.tubo;
      if (!t) return;
      const k = t.dn ? 'DN' + t.dn : 'Di' + nf(t.di);
      if (!(k in contagem)) { contagem[k] = 0; ordem.push([t.di, k]); }
      contagem[k] += r.dist.n;
    });
    ordem.sort(function (a, b) { return a[0] - b[0]; });
    set('res-vertical', ordem.length ? ordem.map(function (x) { return contagem[x[1]] + '×' + x[1]; }).join(' · ') : '—');
    ponto('vertical', piorStatus(P.calhas.map(function (r) { return r.status; })));
    const prontos = P.trechos.filter(function (T) { return T.pronto; });
    const maior = prontos.slice().sort(function (a, b) { return b.Q - a.Q; })[0];
    const em = maior && maior.escolhido;
    set('res-horizontal', maior ? (em ? (em.dn ? 'DN ' + em.dn : nf(em.di) + '<small>mm</small>') : 'revisar') : '—');
    ponto('horizontal', piorStatus(P.trechos.map(function (T) { return T.status; })));
  }

  /* ------------------------------------------------------------------ */
  /* Próximo passo, resposta direta e lista de materiais                */
  /* ------------------------------------------------------------------ */

  let pendAtual = [];

  function renderCoach(P) {
    pendAtual = PJ.pendencias(P, estado);
    const el = $('#coach');
    if (!pendAtual.length) {
      // A mesma situação do quadro e do PDF: "tudo atende" só quando o projeto atende.
      const st = P.status;
      const ressalvas = (P.diagnosticos || []).filter(function (d) { return d.classe === 'ressalva'; }).length;
      el.className = 'coach ' + (st === 'ok' ? 'ok' : 'atencao');
      el.innerHTML = '<p><b>' + (st === 'ok' ? 'Projeto completo: tudo atende.' : st === 'ressalva' ? 'Tudo calculado: atende com ressalva' +
        (ressalvas ? ' (' + ressalvas + (ressalvas > 1 ? ' ressalvas' : ' ressalva') + ' no quadro e no PDF).' : '.') : 'Tudo calculado, com avisos para revisar.') +
        '</b> Veja o <a href="#quadro">quadro-resumo</a>, a <a href="#materiais">lista de materiais</a> e o <a href="#memorial">memorial</a>.</p>';
      return;
    }
    const p = pendAtual[0];
    const resto = pendAtual.length - 1;
    el.className = 'coach';
    el.innerHTML = '<p><span class="coach-item">' + esc(p.passo || p.item) + '</span><b>Próximo passo:</b> ' + esc(p.texto) +
      (resto ? ' <small>(e mais ' + resto + (resto > 1 ? ' pendências)' : ' pendência)') + '</small>' : '') + '</p>' +
      '<button type="button" class="btn primario" id="btn-coach">Ir até lá</button>';
  }

  // "Como usar" como painel de situação: cada passo diz se está pronto, o que falta ou que só
  // espera o anterior; clicar no nome leva ao campo da pendência (trocando de calha se preciso).
  const ROTULO_PASSO = {
    atende: 'Pronto', ressalva: 'Pronto, com ressalva', nao_atende: 'Não atende', fora_do_dominio: 'Fora do ábaco',
    sem_suporte: 'Sem dado válido', incompleta: 'Falta', invalida: 'Entrada inválida', aguarda: 'Aguarda o passo anterior',
  };
  let passosAtual = {};
  function renderPassos(P) {
    passosAtual = P.passos || {};
    $$('[data-estado-passo]').forEach(function (el) {
      const s = passosAtual[el.dataset.estadoPasso];
      if (!s) { el.innerHTML = ''; return; }
      const cls = s.estado === 'aguarda' ? '' : PJ.EXIBICAO[s.estado];
      const txt = s.texto && s.estado !== 'atende' && s.estado !== 'aguarda' ? ': ' + esc(s.texto) : '';
      el.className = 'passo-estado ' + (s.estado === 'atende' ? 'ok' : s.estado === 'aguarda' ? 'aguarda' : 'pendente');
      el.innerHTML = '<i class="ponto ' + cls + '"></i><span><b>' + ROTULO_PASSO[s.estado] + '</b>' + txt + '</span>';
    });
  }

  // "Como escolher": a opção escolhida em destaque e, recolhidas, todas as opções para comparar.
  function montarGuias() {
    $$('[data-guia]').forEach(function (el) {
      const g = GUIAS[el.dataset.guia];
      if (!g) return;
      const ops = g.opcoes ? Object.keys(g.opcoes) : [];
      el.innerHTML = (g.intro ? '<p class="guia-intro">' + esc(g.intro) + '</p>' : '') +
        (ops.length && g.atual !== false ? '<p class="guia-atual" data-guia-atual></p>' : '') +
        (ops.length ? '<details class="guia-todas"><summary>' + (g.atual === false ? 'Como escolher cada opção' : 'Quando escolher cada opção') + '</summary><dl>' +
          ops.map(function (k) { return '<div data-guia-op="' + esc(k) + '"><dt>' + esc(g.opcoes[k][0]) + '</dt><dd>' + esc(g.opcoes[k][1]) + '</dd></div>'; }).join('') +
          '</dl></details>' : '');
    });
  }
  // Calhas cujo transbordamento entra na construção: a norma pede 25 anos (5.1.2 c).
  function alertaT() {
    if (Number(estado.T) >= 25) return '';
    const cr = estado.calhas.filter(function (c) { return c.tipoCalha === 'platibanda' || c.tipoCalha === 'agua-furtada'; });
    if (!cr.length) return '';
    return '<span class="guia-alerta">Neste projeto, ' + cr.map(function (c) { return '"' + esc(c.nome || 'calha sem nome') + '"'; }).join(', ') +
      (cr.length > 1 ? ' ficam' : ' fica') + ' em platibanda ou água-furtada: se transbordar, a água entra na construção. Considere 25 anos.</span>';
  }
  function renderGuias() {
    const c = calhaAtiva();
    const atual = {
      modoI: estado.modoI, T: String(estado.T), saidas: c.saidas, curva: c.curva, forma: c.forma,
      fracLamina: String(c.fracLamina), saida: c.saida, linhaV: PJ.linhaVertical(estado),
    };
    $$('[data-guia]').forEach(function (el) {
      const k = el.dataset.guia;
      const g = GUIAS[k];
      if (!g || !g.opcoes) return;
      const v = atual[k];
      el.querySelectorAll('[data-guia-op]').forEach(function (d) { d.classList.toggle('on', d.dataset.guiaOp === v); });
      const p = el.querySelector('[data-guia-atual]');
      if (!p) return;
      const o = g.opcoes[v];
      p.innerHTML = o ? '<b>' + esc(o[0]) + ':</b> ' + esc(o[1]) + (k === 'T' ? alertaT() : '') : '';
    });
  }

  // Deixa visível o que falta ou está inválido: os campos das pendências da calha ativa e do
  // projeto, as medidas de superfície vazias e todo número digitado que não se lê.
  function marcarPendencias() {
    $$('.pendente, .invalido').forEach(function (el) { el.classList.remove('pendente', 'invalido'); });
    const marcar = function (el) {
      if (el.type === 'radio') { const g = el.closest('fieldset'); if (g) g.classList.add('pendente'); return; }
      el.classList.add('pendente');
    };
    const marcarInvalido = function (el) { el.classList.remove('pendente'); el.classList.add('invalido'); };
    pendAtual.forEach(function (p) {
      if (p.calhaId && p.calhaId !== estado.ativa) return;
      const cands = $$(p.alvo).filter(function (x) { return x.offsetParent !== null && !x.disabled; });
      if (p.classe === 'invalida') { cands.slice(0, 1).forEach(function (x) { if (x.tagName === 'INPUT' && x.type === 'text') marcarInvalido(x); else marcar(x); }); return; }
      const vazios = cands.filter(function (x) { return x.tagName === 'INPUT' && x.type === 'text' && !x.value.trim(); });
      (vazios.length ? vazios : cands.slice(0, 1)).forEach(marcar);
    });
    // Medida de superfície vazia ou zerada falta (só a altura h pode ser zero); nenhum campo
    // numérico aceita valor negativo ou texto que não é número.
    $$('#superficies input').forEach(function (x) {
      if (!x.value.trim() || (lerNum(x.value) === 0 && x.dataset.var !== 'h')) x.classList.add('pendente');
    });
    $$('.folha input.num').forEach(function (x) {
      const v = lerNum(x.value);
      if (x.value.trim() && (v === '' || v < 0)) marcarInvalido(x);
    });
  }

  // Leva ao campo da pendência: troca de calha se preciso e foca o primeiro campo vazio.
  function irPara(p) {
    if (!p) return;
    if (p.calhaId && p.calhaId !== estado.ativa) ativarCalha(p.calhaId, false);
    const cands = $$(p.alvo);
    const el = cands.find(function (x) { return x.tagName === 'INPUT' && x.type === 'text' && !x.value; }) || cands[0];
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  }

  function renderResposta(P) {
    const r = PJ.respostaCalha(P.ativa);
    const el = $('#resposta-calha');
    el.hidden = !r;
    if (!r) return;
    el.className = 'resposta ' + r.status;
    el.innerHTML = seloStatus(r.status) + '<p>' + esc(r.texto) + '</p>';
  }

  let ultimaLista = [];

  function renderMateriais(P) {
    ultimaLista = PJ.listaMateriais(P, estado).filter(function (g) { return g.itens.length; });
    const ressalva = P.status !== 'ok' && ultimaLista.length
      ? '<p class="aviso ' + (P.status === 'ressalva' ? 'atencao' : 'erro') + '">Situação do projeto: ' + ROTULO_STATUS[P.status] +
        '. As quantidades valem como estimativa até as pendências e ressalvas serem resolvidas.</p>'
      : '';
    $('#materiais-corpo').innerHTML = ultimaLista.length
      ? ressalva + '<div class="rolagem"><table class="tabela materiais"><thead><tr><th>Peça</th><th>Qtd.</th><th>Un.</th><th>Base</th></tr></thead>' +
        ultimaLista.map(function (g) {
          return '<tbody><tr class="grupo"><th colspan="4">' + esc(g.titulo) + '</th></tr>' + g.itens.map(function (it) {
            return '<tr><td>' + esc(it.peca) + '</td><td>' + esc(it.qtd) + '</td><td>' + esc(it.un) + '</td><td>' + esc(it.ref) + '</td></tr>';
          }).join('') + '</tbody>';
        }).join('') + '</table></div>'
      : aguardando('A lista aparece quando houver calhas calculadas.');
  }

  function textoMateriais() {
    const linhas = ['LISTA DE MATERIAIS — ' + (estado.projeto || 'Obra sem nome'), 'Quantidades mínimas tiradas do cálculo (NBR 10844:1989).', ''];
    ultimaLista.forEach(function (g) {
      linhas.push('== ' + g.titulo + ' ==');
      g.itens.forEach(function (it) { linhas.push('- ' + it.peca + ': ' + it.qtd + (it.un ? ' ' + it.un : '') + ' (' + it.ref + ')'); });
      linhas.push('');
    });
    return linhas.join('\n');
  }

  function renderMemorial(P) {
    const m = MEM.memorial(P, estado);
    const titulo = estado.projeto ? esc(estado.projeto) : 'Obra sem nome';
    $('#memorial-corpo').innerHTML = '<header><p class="sobrescrito">Memorial de cálculo · NBR 10844:1989</p><h3>' + titulo + '</h3></header>' +
      m.grupos.map(function (g) {
        return '<section class="mem-grupo"><p class="mem-grupo-t">' + esc(g.titulo) + '</p><ol>' + g.passos.map(function (p) {
          return '<li><h4><span>' + p[0] + '</span>' + esc(p[1]) + '</h4>' + p[2].map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</li>';
        }).join('') + '</ol></section>';
      }).join('') + (m.conclusao ? '<p class="conclusao">' + esc(m.conclusao) + '</p>' : '');
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Relatório do projeto: pré-visualização e impressão (PDF)           */
  /* ------------------------------------------------------------------ */

  let focoAntes = null;

  function abrirRelatorio() {
    ler();
    const P = PJ.calcularProjeto(estado);
    $('#relatorio-corpo').innerHTML = REL.relatorio(P, estado, {
      data: new Date().toLocaleDateString('pt-BR'),
      verificacoes: listaVerificacoes(),
    });
    focoAntes = document.activeElement;
    $('#relatorio').hidden = false;
    document.documentElement.classList.add('com-relatorio');
    $('#relatorio').scrollTop = 0;
    $('#btn-rel-imprimir').focus();
  }

  function fecharRelatorio() {
    $('#relatorio').hidden = true;
    document.documentElement.classList.remove('com-relatorio');
    if (focoAntes && typeof focoAntes.focus === 'function') focoAntes.focus();
  }

  // O navegador sugere o título da página como nome do PDF.
  function imprimirRelatorio() {
    const titulo = document.title;
    document.title = REL.tituloArquivo(estado);
    const volta = function () { document.title = titulo; window.removeEventListener('afterprint', volta); };
    window.addEventListener('afterprint', volta);
    try { window.print(); } catch (e) { volta(); toast('A impressão está bloqueada nesta janela: abra o site direto no navegador'); }
  }

  /* ------------------------------------------------------------------ */
  /* Ciclo principal                                                    */
  /* ------------------------------------------------------------------ */

  let ultimoMemorial = null;

  function atualizar() {
    visibilidade();
    const P = PJ.calcularProjeto(estado);
    const R = P.ativa;
    render51(P.chuva);
    render52(R);
    render53(R);
    render55(R);
    render56(R);
    renderColetores(P);
    renderAbasEstado(P);
    renderEsquema(P);
    renderQuadro(P);
    renderResumo(P);
    renderCoach(P);
    renderPassos(P);
    renderGuias();
    renderCatalogoV();
    marcarPendencias();
    renderResposta(P);
    renderMateriais(P);
    ultimoMemorial = renderMemorial(P);
    salvar();
    return P;
  }

  let timerToast = null;
  function toast(msg, acao) {
    const t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (acao ? '<button type="button" class="btn toast-acao">' + esc(acao.rotulo) + '</button>' : '');
    t.hidden = false;
    if (acao) t.querySelector('.toast-acao').addEventListener('click', function () { t.hidden = true; acao.fn(); });
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { t.hidden = true; }, acao ? 7000 : 2800);
  }

  function copiar(texto, ok, falha) {
    const alternativa = function () {
      try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const r = document.execCommand('copy');
        ta.remove();
        toast(r ? ok : falha);
      } catch (e) { toast(falha); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { toast(ok); }, alternativa);
    } else alternativa();
  }

  /* Tema: botão sol/lua do Engenharia Nata. Sem escolha salva, respeita o sistema. */
  const ICONE_SOL = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5" fill="currentColor" />' +
    '<g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1.5" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22.5" />' +
    '<line x1="1.5" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22.5" y2="12" /><line x1="4.2" y1="4.2" x2="6" y2="6" /><line x1="18" y1="18" x2="19.8" y2="19.8" />' +
    '<line x1="19.8" y1="4.2" x2="18" y2="6" /><line x1="6" y1="18" x2="4.2" y2="19.8" /></g></svg>';
  const ICONE_LUA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M21 13.2A9.2 9.2 0 0 1 10.8 3a9 9 0 1 0 10.2 10.2Z" fill="currentColor" /></svg>';
  const escuroNoSistema = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function aplicarTema(v) {
    const r = document.documentElement;
    if (v === 'claro') r.setAttribute('data-theme', 'light');
    else if (v === 'escuro') r.setAttribute('data-theme', 'dark');
    else r.removeAttribute('data-theme');
  }
  function temaEfetivo() {
    const d = document.documentElement.getAttribute('data-theme');
    if (d === 'dark' || d === 'light') return d === 'dark' ? 'escuro' : 'claro';
    return escuroNoSistema && escuroNoSistema.matches ? 'escuro' : 'claro';
  }
  // O botão mostra o tema de destino: no escuro, o sol (clicar → claro).
  function desenharBotaoTema() {
    const escuro = temaEfetivo() === 'escuro';
    const b = $('#btn-tema');
    const rotulo = escuro ? 'Ativar tema claro' : 'Ativar tema escuro';
    b.innerHTML = escuro ? ICONE_SOL : ICONE_LUA;
    b.setAttribute('aria-label', rotulo);
    b.title = rotulo;
  }
  function alternarTema() {
    const novo = temaEfetivo() === 'escuro' ? 'claro' : 'escuro';
    aplicarTema(novo);
    try {
      localStorage.setItem(CHAVE_TEMA, novo);
      localStorage.setItem(CHAVE_TEMA_SITE, JSON.stringify(novo === 'escuro' ? 'dark' : 'light'));
    } catch (e) { /* sem armazenamento */ }
    desenharBotaoTema();
  }
  function iniciarTema() {
    let v = null;
    try { v = localStorage.getItem(CHAVE_TEMA); } catch (e) { v = null; }
    if (v !== 'claro' && v !== 'escuro') {
      // Sem escolha própria, segue o tema do portfólio Engenharia Nata (mesma chave dos outros apps).
      v = null;
      try {
        const s = JSON.parse(localStorage.getItem(CHAVE_TEMA_SITE));
        if (s === 'dark' || s === 'light') v = s === 'dark' ? 'escuro' : 'claro';
      } catch (e) { v = null; }
    }
    if (v) aplicarTema(v);
    desenharBotaoTema();
    if (escuroNoSistema && escuroNoSistema.addEventListener) escuroNoSistema.addEventListener('change', desenharBotaoTema);
  }

  /* Guia de uso aberto ou recolhido: preferência do visitante. */
  function iniciarPreferencias() {
    // Dentro do portfólio (engnata.eu/calha/) aparece o caminho de volta ao catálogo.
    $('#voltar-portfolio').hidden = location.pathname.indexOf('/calha/') < 0;
    const guia = $('#como-usar');
    try { if (localStorage.getItem(CHAVE_GUIA) === 'fechado') guia.open = false; } catch (e) { /* sem armazenamento */ }
    guia.addEventListener('toggle', function () {
      try { localStorage.setItem(CHAVE_GUIA, guia.open ? 'aberto' : 'fechado'); } catch (e) { /* sem armazenamento */ }
    });
  }

  /* Itens da norma que a conta não verifica: marcas salvas neste navegador. */
  function iniciarVerificacoes() {
    let marcas = {};
    try { marcas = JSON.parse(localStorage.getItem(CHAVE_VERIF)) || {}; } catch (e) { marcas = {}; }
    $$('[data-verif]').forEach(function (c) { c.checked = marcas[c.dataset.verif] === true; });
  }
  function salvarVerificacoes() {
    const marcas = {};
    $$('[data-verif]').forEach(function (c) { if (c.checked) marcas[c.dataset.verif] = true; });
    try { localStorage.setItem(CHAVE_VERIF, JSON.stringify(marcas)); } catch (e) { /* sem armazenamento */ }
  }
  function listaVerificacoes() {
    return $$('[data-verif]').map(function (c) {
      const l = c.closest('label');
      return { ref: l.querySelector('.ref').textContent, texto: l.querySelector('.verif-texto').textContent.trim(), ok: c.checked };
    });
  }

  // Pelo painel das calhas, foca o nome da nova; pela barra do topo, leva ao passo B.1.
  function criarCalha(focarNome) {
    ler();
    const c = novaCalha('Calha ' + (estado.calhas.length + 1));
    estado.calhas.push(c);
    estado.ativa = c.id;
    nomeExemplo = null;
    preencher();
    atualizar();
    if (focarNome) $('#nome-calha').focus();
    else $('#s52').scrollIntoView();
    toast('Nova calha criada. Marque-a no trecho de coletor que recebe seus condutores (passo C).');
  }

  function ativarCalha(id, rolar) {
    ler();
    estado.ativa = id;
    preencher();
    atualizar();
    if (rolar) $('#calhas').scrollIntoView();
  }

  function carregarEstado(novo, exemplo) {
    estado = novo;
    nomeExemplo = exemplo || null;
    $('#busca-local').value = '';
    preencher();
    atualizar();
  }

  function ligarEventos() {
    document.addEventListener('input', function (ev) {
      const t = ev.target;
      // A posição é tratada no change, que precisa ver a posição anterior antes de ler().
      if (t.id === 'exemplo' || t.dataset.verif || t.name === 'posicao') return;
      if (!t.closest('.folha, .carimbo')) return;
      nomeExemplo = null;
      if (t.id === 'busca-local') {
        const lista = montarLocais();
        if (lista.length === 1) {
          estado.localId = lista[0].id;
          $('#local').value = String(lista[0].id);
        }
        montarOpcoesT();
        atualizar();
        return;
      }
      ler();
      if (t.id === 'local' || t.name === 'modoI' || /^idf/.test(t.id)) montarOpcoesT();
      atualizar();
    });
    document.addEventListener('change', function (ev) {
      const t = ev.target;
      if (t.dataset.verif) { salvarVerificacoes(); return; }
      if (t.id === 'barra-calha-sel') { ativarCalha(t.value, false); return; }
      if (t.id === 'exemplo') {
        const f = EXEMPLOS[t.value];
        t.value = '';
        if (f) {
          const r = f();
          carregarEstado(r.estado, r.nome);
          toast('Exemplo carregado: ' + r.nome);
        }
        return;
      }
      if (t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox') {
        nomeExemplo = null;
        const posAntes = calhaAtiva().posicao;
        const linhaAntes = PJ.linhaVertical(estado);
        ler();
        if (t.name === 'posicao') aplicarPosicao(calhaAtiva(), posAntes);
        normalizarOpcoes();
        if (t.id === 'local' || t.name === 'modoI') montarOpcoesT();
        if (t.id === 'materialV') montarLinhaV();
        // "Meus tubos" começa com a linha que estava escolhida, para editar em vez de digitar do zero.
        if (t.id === 'linhaV' && t.value === 'usuario' && !estado.tubos.length && linhaAntes !== 'usuario') {
          estado.tubos = tubosDaLinha(linhaAntes, 'vertical').map(function (x) { return { dn: x.dn, di: x.di }; });
          montarTubos();
          toast('Lista copiada de "' + linhaTubo(linhaAntes).curto + '": troque pelos DN e Di do seu tubo');
        }
        if (t.dataset.trecho !== undefined && ['material', 'linha', 'instalacao'].indexOf(t.dataset.campo) >= 0) montarTrechos();
        atualizar();
      }
    });
    document.addEventListener('click', function (ev) {
      if (ev.target.closest('#btn-tema')) { alternarTema(); return; }
      const acao = ev.target.closest('[data-acao-calha]');
      if (acao) {
        const a = acao.dataset.acaoCalha;
        if (a === 'nova') criarCalha(false);
        else $(a === 'duplicar' ? '#btn-duplicar-calha' : '#btn-remover-calha').click();
        return;
      }
      if (ev.target.closest('#btn-coach')) { irPara(pendAtual[0]); return; }
      const passo = ev.target.closest('[data-ir-passo]');
      if (passo) {
        const s = passosAtual[passo.dataset.irPasso];
        if (s && s.pend) { ev.preventDefault(); irPara(s.pend); }
        return;
      }
      const remTubo = ev.target.closest('[data-remover-tubo]');
      if (remTubo) {
        ler();
        estado.tubos.splice(Number(remTubo.dataset.removerTubo), 1);
        montarTubos();
        atualizar();
        return;
      }
      const aba = ev.target.closest('[data-calha-id]');
      if (aba) { ativarCalha(aba.dataset.calhaId, false); return; }
      const link = ev.target.closest('[data-ativar-calha]');
      if (link) { ativarCalha(link.dataset.ativarCalha, true); return; }
      const rem = ev.target.closest('[data-remover]');
      if (rem) {
        ler();
        calhaAtiva().superficies.splice(Number(rem.dataset.remover), 1);
        nomeExemplo = null;
        montarSuperficies();
        atualizar();
        return;
      }
      const remT = ev.target.closest('[data-remover-trecho]');
      if (remT) {
        ler();
        const i = Number(remT.dataset.removerTrecho);
        const tirado = estado.trechos.splice(i, 1)[0];
        montarTrechos();
        atualizar();
        toast('Trecho removido', { rotulo: 'Desfazer', fn: function () { estado.trechos.splice(i, 0, tirado); montarTrechos(); atualizar(); } });
        return;
      }
      const usar = ev.target.closest('[data-usar-saidas]');
      if (usar) {
        ler();
        const c = calhaAtiva();
        c.saidas = 'espacadas';
        c.nSaidas = Number(usar.dataset.usarSaidas);
        nomeExemplo = null;
        preencher();
        atualizar();
        toast('Calha com ' + c.nSaidas + ' saídas espaçadas');
        $('#s53').scrollIntoView();
      }
    });
    $('#abas-calhas').addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const k = estado.calhas.findIndex(function (c) { return c.id === estado.ativa; });
      const j = (k + (ev.key === 'ArrowRight' ? 1 : -1) + estado.calhas.length) % estado.calhas.length;
      ativarCalha(estado.calhas[j].id, false);
      const b = document.querySelector('[data-calha-id="' + estado.calhas[j].id + '"]');
      if (b) b.focus();
      ev.preventDefault();
    });
    $('#btn-nova-calha').addEventListener('click', function () { criarCalha(true); });
    $('#btn-duplicar-calha').addEventListener('click', function () {
      ler();
      const orig = calhaAtiva();
      const c = Object.assign(copia(orig), { id: uid(), nome: (orig.nome || 'Calha') + ' (cópia)' });
      estado.calhas.splice(estado.calhas.indexOf(orig) + 1, 0, c);
      estado.ativa = c.id;
      nomeExemplo = null;
      preencher();
      atualizar();
      toast('Calha duplicada. Marque a cópia no trecho de coletor que a recebe (passo C).');
    });
    $('#btn-remover-calha').addEventListener('click', function () {
      if (estado.calhas.length < 2) return;
      ler();
      const c = calhaAtiva();
      const i = estado.calhas.indexOf(c);
      const emTrechos = estado.trechos.filter(function (t) { return t.calhas.indexOf(c.id) >= 0; });
      estado.calhas.splice(i, 1);
      emTrechos.forEach(function (t) { t.calhas = t.calhas.filter(function (id) { return id !== c.id; }); });
      estado.ativa = estado.calhas[Math.max(0, i - 1)].id;
      nomeExemplo = null;
      preencher();
      atualizar();
      toast('Calha "' + (c.nome || 'sem nome') + '" removida', {
        rotulo: 'Desfazer',
        fn: function () {
          estado.calhas.splice(i, 0, c);
          emTrechos.forEach(function (t) { t.calhas.push(c.id); });
          estado.ativa = c.id;
          preencher();
          atualizar();
        },
      });
    });
    $('#btn-add-trecho').addEventListener('click', function () {
      ler();
      estado.trechos.push(novoTrecho('Trecho ' + (estado.trechos.length + 1), []));
      montarTrechos();
      atualizar();
    });
    $('#btn-add-tubo').addEventListener('click', function () {
      ler();
      estado.tubos.push({ dn: '', di: '' });
      montarTubos();
      const campos = $$('#tubos [data-tcampo="dn"]');
      if (campos.length) campos[campos.length - 1].focus();
    });
    $('#btn-tubos-padrao').addEventListener('click', function () {
      estado.tubos = tubosPadrao();
      montarTubos();
      atualizar();
      toast('Lista copiada da Série Normal (Tigre e Amanco): troque pelos valores do seu tubo');
    });
    $('#btn-copiar-materiais').addEventListener('click', function () {
      copiar(textoMateriais(), 'Lista de materiais copiada', 'Não deu para copiar a lista');
    });
    $('#btn-add').addEventListener('click', function () {
      ler();
      const tipo = $('#add-tipo').value;
      const v = {};
      N.SUPERFICIES[tipo].campos.forEach(function (c) { v[c[0]] = ''; });
      calhaAtiva().superficies.push({ tipo: tipo, v: v });
      nomeExemplo = null;
      montarSuperficies();
      atualizar();
      const ult = $$('#superficies .sup').pop();
      if (ult) { const inp = ult.querySelector('input'); if (inp) inp.focus(); }
    });
    $('#btn-limpar').addEventListener('click', function () {
      carregarEstado(estadoVazio(), null);
      toast('Folha em branco. Comece pelo local da obra.');
      $('#busca-local').focus();
    });
    $('#btn-link').addEventListener('click', function () {
      ler();
      const hash = '#s=' + encodeURIComponent(codificar(estado));
      try { history.replaceState(null, '', hash); } catch (e) { location.hash = hash; }
      const url = location.href.split('#')[0] + hash;
      copiar(url, 'Link copiado: quem abrir verá este mesmo cálculo', 'Não deu para copiar; o link está na barra de endereço');
    });
    $('#btn-dimensionar').addEventListener('click', function () {
      ler();
      const c = calhaAtiva();
      const R = PJ.calcularCalha(estado, c, PJ.calcularChuva(estado));
      if (!(R.Qcalha > 0) || !(R.calha.i > 0)) { toast('Falta a vazão da calha ou a declividade'); return; }
      const d = R.calha.dims;
      const r = N.dimensionarCalha({ forma: c.forma, dims: d, Q: R.Qcalha, n: R.calha.n, i: R.calha.i, fracLamina: R.calha.frac, otima: c.otima });
      const porAbaco = ' (a menor que deixa a lâmina em 50 mm, o início do ábaco do condutor)';
      if (c.forma === 'retangular') {
        if (!c.otima && !(d.b > 0)) { toast('Informe a largura b ou libere a largura'); return; }
        c.b = Math.round(r.dims.b * 1000);
        c.h = Math.round(r.dims.h * 1000);
        toast('Seção ajustada: ' + c.b + ' × ' + c.h + ' mm' + (r.peloAbaco ? porAbaco : ''));
      } else if (c.forma === 'semicircular') {
        if (!r.dims) {
          toast('Nenhum diâmetro da Tabela 3 serve: ' + (r.Dmin > 0.2 + 1e-9 ? 'a vazão pede ' + nf(r.Dmin * 1000) + ' mm' :
            'com essa lâmina máxima, só D ≥ ' + nf(r.DminAbaco * 1000) + ' mm deixa H em 50 mm para o ábaco') +
            '. Ponha mais saídas, escolha uma lâmina maior ou use a seção retangular');
          return;
        }
        c.Dcalha = Math.round(r.dims.D * 1000);
        const foraI = R.calha.i < 0.005 - 1e-12 || R.calha.i > 0.02 + 1e-12;
        toast('Diâmetro da Tabela 3: ' + c.Dcalha + ' mm' + (r.peloAbaco ? ' (o menor que deixa a lâmina em 50 mm, o início do ábaco do condutor)' : '') +
          (foraI ? '; declividade fora da tabela: conferência só por Manning' : ''));
      } else {
        if (!(d.b > 0)) { toast('Informe o fundo b da seção trapezoidal'); return; }
        c.ht = Math.round(r.dims.h * 1000);
        toast('Altura ajustada: ' + c.ht + ' mm' + (r.peloAbaco ? porAbaco : ''));
      }
      nomeExemplo = null;
      preencher();
      atualizar();
    });
    $('#btn-copiar').addEventListener('click', function () {
      if (ultimoMemorial) copiar(MEM.textoMemorial(ultimoMemorial, estado), 'Memorial copiado', 'Não deu para copiar o memorial');
    });
    $('#btn-imprimir').addEventListener('click', abrirRelatorio);
    $('#btn-pdf').addEventListener('click', abrirRelatorio);
    $('#btn-pdf-topo').addEventListener('click', abrirRelatorio);
    $('#btn-rel-fechar').addEventListener('click', fecharRelatorio);
    $('#btn-rel-imprimir').addEventListener('click', imprimirRelatorio);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('#relatorio').hidden) fecharRelatorio();
    });
  }

  function iniciar() {
    iniciarTema();
    iniciarPreferencias();
    iniciarVerificacoes();
    iniciarBarraCalha();
    montarSelects();
    montarGuias();
    const ini = carregarInicial();
    estado = ini.estado;
    nomeExemplo = ini.exemplo;
    preencher();
    ligarEventos();
    atualizar();
  }

  iniciar();
})();
