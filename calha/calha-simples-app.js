/*
 * Calha 10844 — modo simples: a tela. Lê as entradas, guarda-as neste navegador (chave própria,
 * para não mexer no projeto do modo avançado) e mostra o resultado de calha-simples.js.
 */
(function () {
  'use strict';

  const S = window.CalhaSimples;
  const { esc, nf, lerNum, mostrarNum } = window.CalhaUtil;
  const CHAVE = 'calha10844:simples:v1';
  const CHAVE_AVANCADO = 'calha10844:estado:v1';
  const CHAVE_TEMA = 'calha10844:tema';
  const CHAVE_TEMA_SITE = 'engnata_theme_mode';

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };

  // Campo numérico da tela → entrada.
  const NUMS = { 's-area': 'areaProj', 's-ilocal': 'Ilocal', 's-Lc': 'Lc', 's-largura': 'largura', 's-altura': 'altura', 's-mureta': 'mureta', 's-Lcond': 'Lcond', 's-n': 'nDescidas' };
  const RADIOS = { 's-posicao': 'posicao', 's-descidas': 'descidas', 's-forma': 'forma', 's-sem': 'semTabela' };

  let ent = null;
  let ultimo = null;

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(ent)); } catch (e) { /* sem armazenamento */ }
  }
  function carregar() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && typeof s === 'object') return Object.assign(S.entradasVazias(), s);
    } catch (e) { /* sem armazenamento */ }
    return S.entradasVazias();
  }

  /* ------------------------------------------------------------------ */
  /* Formulário                                                         */
  /* ------------------------------------------------------------------ */

  function preencher() {
    Object.keys(NUMS).forEach(function (id) { $('#' + id).value = mostrarNum(ent[NUMS[id]]); });
    $('#s-fonte').value = ent.fonteChuva || '';
    const c = S.cidade(ent.localId);
    $('#s-busca').value = c ? c.local : '';
    Object.keys(RADIOS).forEach(function (nome) {
      $$('input[name="' + nome + '"]').forEach(function (r) { r.checked = r.value === ent[RADIOS[nome]]; });
    });
    abrirAlternativa(!!ent.semTabela);
    mostrarCidades();
  }

  function abrirAlternativa(aberta) {
    $('#s-alt').hidden = !aberta;
    $('#s-sem-lista').setAttribute('aria-expanded', aberta ? 'true' : 'false');
  }

  function mostrarCidades() {
    const q = $('#s-busca').value;
    const ul = $('#s-cidades');
    const escolhida = S.cidade(ent.localId);
    const lista = escolhida && escolhida.local === q ? [] : S.buscarCidades(q, 8);
    ul.innerHTML = lista.map(function (l) {
      return '<li><button type="button" data-cidade="' + l.id + '">' + esc(l.local) + '</button></li>';
    }).join('');
    ul.hidden = !lista.length;
    let msg = '';
    if (escolhida && escolhida.local === q) msg = 'Chuva da tabela da norma para ' + escolhida.local + '.';
    else if (q.trim().length >= 2) msg = lista.length ? '' : 'Nenhuma cidade da tabela com esse nome. Veja "Minha cidade não está na lista".';
    $('#s-cidades-status').textContent = msg;
  }

  function escolherCidade(id) {
    const c = S.cidade(id);
    if (!c) return;
    ent.localId = c.id;
    ent.semTabela = '';
    $('#s-busca').value = c.local;
    $$('input[name="s-sem"]').forEach(function (r) { r.checked = false; });
    abrirAlternativa(false);
    mostrarCidades();
    atualizar();
  }

  function algumaMedida() {
    return ['Lc', 'largura', 'altura', 'Lcond'].some(function (k) { return ent[k] !== '' && ent[k] != null; });
  }

  function visibilidade(res) {
    const p1 = S.passo1Pronto(ent);
    $('#s-passo2').hidden = !p1;
    $('#s-passo3').hidden = !(p1 && algumaMedida());
    $('[data-so="platibanda"]').hidden = ent.posicao !== 'platibanda';
    $('[data-so="varias"]').hidden = ent.descidas !== 'varias';
    $('#s-alt-pequena').hidden = ent.semTabela !== 'pequena';
    $('#s-alt-local').hidden = ent.semTabela !== 'local';
    $$('[data-periodo]').forEach(function (el) { el.textContent = S.periodo(ent); });
    $('#s-figura').setAttribute('data-posicao', ent.posicao);
    const doPasso2 = ['Lc', 'largura', 'altura', 'mureta', 'Lcond', 'nDescidas'];
    $('[data-feito="1"]').hidden = !p1;
    $('[data-feito="2"]').hidden = res.faltas.some(function (f) { return doPasso2.indexOf(f.campo) >= 0; });
  }

  /* ------------------------------------------------------------------ */
  /* Resultado                                                          */
  /* ------------------------------------------------------------------ */

  // Seção da calha em escala, com a água na altura calculada e o limite de ⅔ tracejado.
  function desenhoSecao(r) {
    let corpo;
    if (r.forma === 'semicircular') {
      const raio = 48;
      const s = raio / (r.secao.D / 2);
      const fundo = 62;
      const nivel = function (y) { return fundo - y * s; };
      const meia = function (y) { const d = raio - y * s; return Math.sqrt(Math.max(raio * raio - d * d, 0)); };
      const yA = nivel(r.y);
      const wA = meia(r.y);
      const yL = nivel(r.yLim);
      const wL = meia(r.yLim);
      corpo = '<path class="agua" d="M' + (60 - wA).toFixed(1) + ' ' + yA.toFixed(1) + ' A' + raio + ' ' + raio + ' 0 0 0 ' + (60 + wA).toFixed(1) + ' ' + yA.toFixed(1) + ' Z" />' +
        '<path class="limite" d="M' + (60 - wL).toFixed(1) + ' ' + yL.toFixed(1) + ' H' + (60 + wL).toFixed(1) + '" />' +
        '<path class="contorno" d="M12 14 A48 48 0 0 0 108 14" />';
    } else {
      const s = Math.min(96 / r.secao.b, 56 / r.secao.h);
      const w = r.secao.b * s;
      const h = r.secao.h * s;
      const x0 = 60 - w / 2;
      const base = 8 + h;
      corpo = '<rect class="agua" x="' + x0.toFixed(1) + '" y="' + (base - r.y * s).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (r.y * s).toFixed(1) + '" />' +
        '<path class="limite" d="M' + x0.toFixed(1) + ' ' + (base - r.yLim * s).toFixed(1) + ' h' + w.toFixed(1) + '" />' +
        '<path class="contorno" d="M' + x0.toFixed(1) + ' 8 V' + base.toFixed(1) + ' H' + (x0 + w).toFixed(1) + ' V8" />';
    }
    return '<svg class="s-desenho" viewBox="0 0 120 70" role="img" aria-label="Seção da calha em escala, com a água na altura calculada e o limite tracejado">' + corpo + '</svg>';
  }

  function item(x, extra) {
    return '<div class="s-res-item"><p class="s-res-rot">' + esc(x.rotulo) + '</p><p class="s-res-valor">' + esc(x.valor) + '</p>' +
      '<p class="s-res-det">' + esc(x.detalhe) + '</p>' + (extra || '') + '</div>';
  }

  function renderResultado(res) {
    let acao = '';
    if (res.alvo) acao = '<button class="btn" type="button" data-ir="' + res.alvo + '">Ir ao campo</button>';
    else if (res.acao && res.acao.tipo === 'descidas') acao = '<button class="btn primario" type="button" data-usar-descidas="' + res.acao.n + '">' + esc(res.acao.rotulo) + '</button>';
    else if (res.acao && res.acao.tipo === 'forma') acao = '<button class="btn primario" type="button" data-usar-forma="' + res.acao.forma + '">' + esc(res.acao.rotulo) + '</button>';
    let html = '<div class="s-veredito s-' + res.tom + '"><p class="s-veredito-t">' + esc(res.titulo) + '</p>' +
      (res.mensagens.length ? '<ul>' + res.mensagens.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') +
      (acao ? '<div class="s-veredito-acao">' + acao + '</div>' : '') + '</div>';
    if (res.mostrarResultado) {
      const r = res.resultado;
      html += '<div class="s-res">' + item(r.calha, desenhoSecao(r)) + item(r.descida) + item(r.caimento) + '</div>' +
        '<p class="s-agua">' + esc(r.agua) + '</p>' +
        '<details class="s-numeros"><summary>Os números da conta</summary><ul>' +
        r.numeros.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></details>' +
        '<div class="s-padroes"><p>O que o modo simples adota:</p><ul>' +
        S.PADROES.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
    }
    $('#s-resultado').innerHTML = html;
  }

  function atualizar() {
    const res = S.resolver(ent);
    ultimo = res;
    visibilidade(res);
    renderResultado(res);
    $('#s-confirma').hidden = true;
    salvar();
  }

  /* ------------------------------------------------------------------ */
  /* Modo avançado, recomeçar, aviso breve                              */
  /* ------------------------------------------------------------------ */

  // Projeto guardado pelo modo avançado que não é um dos exemplos: abrir outro o substituiria.
  function projetoAvancado() {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE_AVANCADO));
      if (s && s.estado && !s.exemplo) return s.estado;
    } catch (e) { /* sem armazenamento */ }
    return null;
  }

  function abrirAvancado(confirmado) {
    const res = ultimo || S.resolver(ent);
    const salvo = projetoAvancado();
    if (salvo && !confirmado) {
      const n = (salvo.calhas || []).length;
      const nome = String(salvo.projeto || '').trim();
      $('#s-confirma-texto').textContent = 'O modo avançado já tem um projeto salvo neste navegador (' + (nome ? '"' + nome + '", ' : '') +
        (n === 1 ? '1 calha' : n + ' calhas') + '). Abrir estes dados substitui esse projeto. Para guardá-lo, abra o modo avançado e use "Copiar link do cálculo" antes.';
      $('#s-confirma').hidden = false;
      $('#s-confirma-sim').focus();
      return;
    }
    location.href = S.linkAvancado(res.estado);
  }

  let timerToast = null;
  function toast(msg, desfazer) {
    const t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (desfazer ? '<button class="btn toast-acao" type="button" id="toast-desfazer">Desfazer</button>' : '');
    t.hidden = false;
    if (desfazer) $('#toast-desfazer').addEventListener('click', function () { desfazer(); t.hidden = true; });
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { t.hidden = true; }, desfazer ? 7000 : 3500);
  }

  function carregarEntradas(novas) {
    ent = novas;
    preencher();
    atualizar();
  }

  /* ------------------------------------------------------------------ */
  /* Tema: o mesmo botão e as mesmas chaves do modo avançado            */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /* Eventos                                                            */
  /* ------------------------------------------------------------------ */

  function irPara(sel) {
    const el = $(sel);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
  }

  function ligarEventos() {
    const form = $('#s-form');
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    form.addEventListener('input', function (ev) {
      const t = ev.target;
      if (t.id === 's-busca') {
        const c = S.cidade(ent.localId);
        if (!c || c.local !== t.value) ent.localId = '';
        mostrarCidades();
        atualizar();
        return;
      }
      if (NUMS[t.id]) ent[NUMS[t.id]] = lerNum(t.value);
      else if (t.id === 's-fonte') ent.fonteChuva = t.value;
      else if (RADIOS[t.name]) {
        ent[RADIOS[t.name]] = t.value;
        if (t.name === 's-sem') {
          ent.localId = '';
          $('#s-busca').value = '';
          mostrarCidades();
        }
      } else return;
      atualizar();
    });
    $('#s-busca').addEventListener('keydown', function (ev) {
      const primeiro = $('#s-cidades button');
      if (ev.key === 'Enter' && primeiro) { ev.preventDefault(); escolherCidade(primeiro.dataset.cidade); }
      else if (ev.key === 'ArrowDown' && primeiro) { ev.preventDefault(); primeiro.focus(); }
    });
    $('#s-cidades').addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      const bs = $$('#s-cidades button');
      const k = bs.indexOf(document.activeElement);
      ev.preventDefault();
      if (ev.key === 'ArrowUp' && k <= 0) $('#s-busca').focus();
      else if (bs[k + (ev.key === 'ArrowDown' ? 1 : -1)]) bs[k + (ev.key === 'ArrowDown' ? 1 : -1)].focus();
    });
    document.addEventListener('click', function (ev) {
      const t = ev.target;
      if (t.closest('#btn-tema')) { alternarTema(); return; }
      const cid = t.closest('[data-cidade]');
      if (cid) { escolherCidade(cid.dataset.cidade); $('input[name="s-posicao"]:checked').focus(); return; }
      if (t.closest('#s-sem-lista')) { abrirAlternativa($('#s-alt').hidden); return; }
      const ir = t.closest('[data-ir]');
      if (ir) { irPara(ir.dataset.ir); return; }
      const usarN = t.closest('[data-usar-descidas]');
      if (usarN) {
        ent.descidas = 'varias';
        ent.nDescidas = Number(usarN.dataset.usarDescidas);
        preencher();
        atualizar();
        toast('Calha com ' + ent.nDescidas + ' descidas espaçadas');
        return;
      }
      const usarF = t.closest('[data-usar-forma]');
      if (usarF) {
        ent.forma = usarF.dataset.usarForma;
        preencher();
        atualizar();
        toast('Calha retangular');
        return;
      }
      if (t.closest('#s-exemplo')) {
        const antes = ent;
        carregarEntradas(S.exemplo());
        toast('Exemplo: uma casa em Curitiba. Troque pelos dados da sua obra.', function () { carregarEntradas(antes); });
        $('#s-passo3').scrollIntoView({ block: 'start' });
        return;
      }
      if (t.closest('#s-recomecar')) {
        const antes = ent;
        carregarEntradas(S.entradasVazias());
        toast('Tudo em branco. Comece pela cidade.', function () { carregarEntradas(antes); });
        $('#s-busca').focus();
        return;
      }
      if (t.closest('#s-avancado')) { abrirAvancado(false); return; }
      if (t.closest('#s-confirma-sim')) { abrirAvancado(true); return; }
      if (t.closest('#s-confirma-nao')) { $('#s-confirma').hidden = true; $('#s-avancado').focus(); }
    });
  }

  function iniciar() {
    iniciarTema();
    // Dentro do portfólio (engnata.eu/calha/) aparece o caminho de volta ao catálogo.
    $('#voltar-portfolio').hidden = location.pathname.indexOf('/calha/') < 0;
    ent = carregar();
    preencher();
    ligarEventos();
    atualizar();
  }

  iniciar();
})();
