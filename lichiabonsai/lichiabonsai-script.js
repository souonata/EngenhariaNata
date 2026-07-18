/**
 * lichiabonsai-script.js — renderiza o GUIA INTERATIVO + DIÁRIO de cultivo.
 * Conteúdo é data-driven e bilíngue: re-renderiza ao trocar de idioma.
 *
 * Dados do diário (você edita): lichiabonsai-data.js
 * Conteúdo do guia (referência): guia-fases.js, guia-tecnicas.js,
 *   guia-calendario.js, guia-diagramas.js
 *
 * As fotos (./fotos/*.webp) são resolvidas pelo Vite via import.meta.glob,
 * então entram no build hasheadas (sem fetch em runtime, sem cópia no deploy).
 */

import { App, i18n } from '../src/core/app.js';
import {
  META, STATUS, PLANO_PET, TIMELINE, METAS, CHECKLIST, MEDICOES,
  ESTACAO_CULTIVO, FASE_REGISTROS,
} from './lichiabonsai-data.js';
import { GUIA_INTRO, GUIA_FASES } from './guia-fases.js';
import { TECNICAS } from './guia-tecnicas.js';
import { CALENDARIO, PRAGAS, MATERIAIS } from './guia-calendario.js';
import { DIAGRAMAS } from './guia-diagramas.js';

// filename "x.webp" -> URL final (hasheada no build)
const FOTOS = import.meta.glob('./fotos/*.webp', { eager: true, query: '?url', import: 'default' });
const fotoUrl = (nome) => FOTOS['./fotos/' + nome] || '';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MS_ANO = 365.25 * 24 * 3600 * 1000;

class LichiaApp extends App {
  constructor() {
    // Diário pt-first: abre em português por padrão, mas respeita a escolha
    // anterior do visitante (sessão compartilhada do portfólio).
    const escolheu = sessionStorage.getItem('engnata_idioma');
    super({
      appName: 'lichiabonsai',
      idiomaInicial: escolheu ? null : 'pt-BR',
      callbacks: {
        aoInicializar: () => this.renderTudo(),
        aoTrocarIdioma: () => this.renderTudo(),
      },
    });
    // Estado de UI preservado entre re-renders (troca de idioma):
    this.fasesAbertas = null;          // Set de chaves de fase abertas
    this.tecnicasAbertas = new Set();  // chaves de técnicas abertas
    this.calMes = null;                // mês selecionado no calendário (0–11)

    // Lightbox de fotos: construído uma vez, fora do ciclo de re-render.
    this.lb = { scale: 1, x: 0, y: 0, startX: 0, startY: 0, dragging: false, pinching: false, pinchStartDist: 0, pinchStartScale: 1, pinchCenter: { x: 0, y: 0 }, suppressClick: false };
    this.criarLightbox();
  }

  lang() {
    const l = typeof i18n.obterIdiomaAtual === 'function' ? i18n.obterIdiomaAtual() : 'pt-BR';
    return l.startsWith('it') ? 'it' : 'pt';
  }

  // texto bilíngue { pt, it } -> string no idioma atual
  tx(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    const l = this.lang();
    return obj[l] ?? obj.pt ?? obj.it ?? '';
  }

  // lista bilíngue: aceita { pt:[], it:[] } OU [{pt,it}, ...]
  txList(obj) {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.map((o) => this.tx(o));
    const l = this.lang();
    return obj[l] || obj.pt || obj.it || [];
  }

  fmtData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const locale = this.lang() === 'it' ? 'it-IT' : 'pt-BR';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(date).replace('.', '');
  }

  // anos decorridos (fracionários) desde uma data ISO
  anosDesde(iso) {
    if (!iso) return 0;
    const [y, m, d] = iso.split('-').map(Number);
    return (Date.now() - Date.UTC(y, m - 1, d)) / MS_ANO;
  }

  // índice da fase atual no roteiro (a partir da data de início)
  faseAtualIndex() {
    const anos = this.anosDesde(META.dataInicial);
    for (let i = 0; i < GUIA_FASES.length; i++) {
      const f = GUIA_FASES[i];
      if (anos >= f.anoDe && anos < f.anoAte) return i;
    }
    return anos < 0 ? 0 : GUIA_FASES.length - 1;
  }

  // nome do mês no idioma atual (estilo 'short' | 'long')
  nomeMes(mes, estilo) {
    const locale = this.lang() === 'it' ? 'it-IT' : 'pt-BR';
    return new Intl.DateTimeFormat(locale, { month: estilo })
      .format(new Date(2001, mes, 1)).replace('.', '');
  }

  // ---- helpers de criação de elementos -----------------------------------
  el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  chevron(cls) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M6 9l6 6 6-6');
    svg.appendChild(p);
    return svg;
  }

  // injeta um diagrama SVG (string estática própria) num container
  diagrama(chave) {
    const svg = chave && DIAGRAMAS[chave];
    if (!svg) return null;
    const div = this.el('div', 'lichia-diagrama');
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = svg;
    return div;
  }

  // galeria de fotos (reutilizada por linha do tempo e registros das fases)
  galeria(fotos) {
    if (!Array.isArray(fotos) || !fotos.length) return null;
    const gal = this.el('div', 'lichia-gallery');
    fotos.forEach((f) => {
      const url = fotoUrl(f.arquivo);
      if (!url) return;
      const legenda = this.tx(f.legenda);
      const fig = document.createElement('figure');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lichia-gallery__btn';
      btn.setAttribute('aria-label', legenda ? `${i18n.t('lightbox.ampliar')}: ${legenda}` : i18n.t('lightbox.ampliar'));
      const img = document.createElement('img');
      img.src = url;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = legenda;
      btn.appendChild(img);
      btn.addEventListener('click', () => this.abrirLightbox(url, legenda));
      const cap = this.el('figcaption', null, legenda);
      fig.append(btn, cap);
      gal.appendChild(fig);
    });
    return gal.childElementCount ? gal : null;
  }

  // ---- lightbox (zoom em tela cheia) -------------------------------------
  // Construído uma única vez fora do ciclo de re-render (troca de idioma
  // não recria o overlay, só atualiza os textos via atualizarI18nLightbox()).
  criarLightbox() {
    const root = this.el('div', 'lichia-lightbox');
    root.id = 'lichiaLightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.hidden = true;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lichia-lightbox__close';
    close.textContent = '×';
    close.setAttribute('aria-hidden', 'false');

    const stage = document.createElement('figure');
    stage.className = 'lichia-lightbox__stage';
    const img = document.createElement('img');
    img.className = 'lichia-lightbox__img';
    img.alt = '';
    img.draggable = false;
    const caption = this.el('figcaption', 'lichia-lightbox__caption');
    const dica = this.el('p', 'lichia-lightbox__hint');
    stage.append(img, caption, dica);

    root.append(close, stage);
    document.body.appendChild(root);
    this.lightboxEls = { root, close, stage, img, caption, dica };

    // fechar: botão, clique fora da imagem (no fundo), Esc
    close.addEventListener('click', () => this.fecharLightbox());
    root.addEventListener('click', (e) => { if (e.target === root) this.fecharLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !root.hidden) this.fecharLightbox();
    });

    // zoom: clique alterna, roda do mouse ajusta, pinça (touch) ajusta
    img.addEventListener('click', (e) => {
      if (this.lb.suppressClick) { this.lb.suppressClick = false; return; }
      if (this.lb.scale > 1) {
        this.lb.scale = 1; this.lb.x = 0; this.lb.y = 0;
        this.lbAplicar();
      } else {
        this.lbZoomEm(e.clientX, e.clientY, 2.5);
      }
    });
    img.addEventListener('wheel', (e) => {
      e.preventDefault();
      const fator = 1 - e.deltaY * 0.0018;
      this.lbZoomEm(e.clientX, e.clientY, this.lb.scale * fator);
    }, { passive: false });

    // pan por arraste (mouse)
    img.addEventListener('mousedown', (e) => {
      if (this.lb.scale <= 1) return;
      e.preventDefault();
      this.lb.dragging = true;
      this.lb.startX = e.clientX - this.lb.x;
      this.lb.startY = e.clientY - this.lb.y;
      img.style.transition = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.lb.dragging) return;
      this.lb.x = e.clientX - this.lb.startX;
      this.lb.y = e.clientY - this.lb.startY;
      this.lbClamp();
      this.lbAplicar();
    });
    window.addEventListener('mouseup', () => {
      if (!this.lb.dragging) return;
      this.lb.dragging = false;
      img.style.transition = '';
      this.lb.suppressClick = true;
      setTimeout(() => { this.lb.suppressClick = false; }, 0);
    });

    // pinça (zoom) e arraste com um dedo (touch)
    img.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.lb.pinching = true;
        this.lb.pinchStartDist = this.lbDistToque(e.touches);
        this.lb.pinchStartScale = this.lb.scale;
        const [t1, t2] = e.touches;
        this.lb.pinchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      } else if (e.touches.length === 1 && this.lb.scale > 1) {
        this.lb.dragging = true;
        this.lb.startX = e.touches[0].clientX - this.lb.x;
        this.lb.startY = e.touches[0].clientY - this.lb.y;
      }
      img.style.transition = 'none';
    }, { passive: true });
    img.addEventListener('touchmove', (e) => {
      if (this.lb.pinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = this.lbDistToque(e.touches);
        const novaEscala = this.lb.pinchStartScale * (dist / this.lb.pinchStartDist);
        this.lbZoomEm(this.lb.pinchCenter.x, this.lb.pinchCenter.y, novaEscala);
      } else if (this.lb.dragging && e.touches.length === 1) {
        e.preventDefault();
        this.lb.x = e.touches[0].clientX - this.lb.startX;
        this.lb.y = e.touches[0].clientY - this.lb.startY;
        this.lbClamp();
        this.lbAplicar();
      }
    }, { passive: false });
    img.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) this.lb.pinching = false;
      if (e.touches.length === 0) { this.lb.dragging = false; img.style.transition = ''; }
    });
  }

  atualizarI18nLightbox() {
    if (!this.lightboxEls) return;
    const { close, dica } = this.lightboxEls;
    close.setAttribute('aria-label', i18n.t('lightbox.fechar'));
    dica.textContent = i18n.t('lightbox.dica');
  }

  lbDistToque(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  // aplica o zoom mantendo o ponto (clientX, clientY) parado na tela
  lbZoomEm(clientX, clientY, novaEscalaAlvo) {
    const img = this.lightboxEls.img;
    const rect = img.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    const baseW = img.offsetWidth;
    const baseH = img.offsetHeight;
    const localX = (relX - 0.5) * baseW;
    const localY = (relY - 0.5) * baseH;
    const novaEscala = Math.min(4, Math.max(1, novaEscalaAlvo));
    this.lb.x -= localX * (novaEscala - this.lb.scale);
    this.lb.y -= localY * (novaEscala - this.lb.scale);
    this.lb.scale = novaEscala;
    if (this.lb.scale === 1) { this.lb.x = 0; this.lb.y = 0; }
    this.lbClamp();
    this.lbAplicar();
  }

  lbClamp() {
    const img = this.lightboxEls.img;
    const maxX = Math.max(0, (this.lb.scale - 1) * img.offsetWidth / 2);
    const maxY = Math.max(0, (this.lb.scale - 1) * img.offsetHeight / 2);
    this.lb.x = Math.min(maxX, Math.max(-maxX, this.lb.x));
    this.lb.y = Math.min(maxY, Math.max(-maxY, this.lb.y));
  }

  lbAplicar() {
    const img = this.lightboxEls.img;
    img.style.transform = `translate(${this.lb.x}px, ${this.lb.y}px) scale(${this.lb.scale})`;
    img.classList.toggle('is-zoomed', this.lb.scale > 1);
  }

  abrirLightbox(url, legenda) {
    const { root, img, caption } = this.lightboxEls;
    this.lb.scale = 1; this.lb.x = 0; this.lb.y = 0; this.lb.dragging = false; this.lb.pinching = false;
    img.style.transition = '';
    img.src = url;
    img.alt = legenda || '';
    caption.textContent = legenda || '';
    this.lbAplicar();
    this.atualizarI18nLightbox();
    root.hidden = false;
    document.body.classList.add('lichia-no-scroll');
    this._lbFocoAnterior = document.activeElement;
    // força um reflow entre tirar o "hidden" e ligar a classe, senão a
    // transição de opacidade é pulada (não depende do agendador de animação,
    // que fica pausado em abas em segundo plano/pouco ativas).
    void root.offsetHeight;
    root.classList.add('is-open');
    this.lightboxEls.close.focus();
  }

  fecharLightbox() {
    const { root } = this.lightboxEls;
    root.classList.remove('is-open');
    document.body.classList.remove('lichia-no-scroll');
    const finalizar = () => { root.hidden = true; };
    root.addEventListener('transitionend', finalizar, { once: true });
    setTimeout(finalizar, 260);
    if (this._lbFocoAnterior && typeof this._lbFocoAnterior.focus === 'function') {
      this._lbFocoAnterior.focus();
    }
  }

  // ---- orquestração ------------------------------------------------------
  renderTudo() {
    document.title = i18n.t('meta.tabTitle');
    this.atualizarI18nLightbox();
    this.renderHero();
    this.renderStatus();
    this.renderPlano();
    this.renderGuia();
    this.renderCalendario();
    this.renderTecnicas();
    this.renderTimeline();
    this.renderMedicoes();
    this.renderMetas();
    this.renderChecklist();
    this.renderInfra();
    this.renderPragas();
    this.renderMateriais();
    this.renderRodape();
  }

  renderHero() {
    const esp = document.getElementById('heroEspecie');
    if (esp) esp.textContent = META.especie || '';
    const local = document.getElementById('heroLocal');
    if (local) local.textContent = this.tx(META.local);

    const h1 = document.getElementById('heroTitulo');
    if (h1) {
      const titulo = this.tx(META.titulo);
      // realça a palavra Lichia / Litchi com a sublinhada-folha
      h1.innerHTML = titulo.replace(/(Lichia|Litchi)/i, '<span class="leafword">$1</span>');
    }
    const sub = document.getElementById('heroSub');
    if (sub) sub.textContent = this.tx(META.subtitulo);

    const img = document.getElementById('heroImg');
    if (img && META.heroFoto) {
      const url = fotoUrl(META.heroFoto.arquivo);
      if (url) {
        img.src = url;
        const alt = this.tx(META.heroFoto.alt);
        img.alt = alt;
        img.classList.add('is-clicavel');
        img.setAttribute('role', 'button');
        img.tabIndex = 0;
        img.onclick = () => this.abrirLightbox(url, alt);
        img.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.abrirLightbox(url, alt); }
        };
      } else {
        img.closest('figure')?.remove();
      }
    }
  }

  renderStatus() {
    const dl = document.getElementById('status');
    if (!dl) return;
    dl.textContent = '';
    const campos = [
      { ...STATUS.fase },
      { ...STATUS.inicio },
      { ...STATUS.objetivo },
      { ...STATUS.proximoPasso, next: true },
    ];
    campos.forEach((c) => {
      const div = document.createElement('div');
      if (c.next) div.className = 'is-next';
      div.append(
        this.el('dt', null, this.tx(c.rotulo)),
        this.el('dd', null, c.isData ? this.fmtData(c.valor) : this.tx(c.valor)),
      );
      dl.appendChild(div);
    });
  }

  renderPlano() {
    const ul = document.getElementById('planoLista');
    if (ul) {
      ul.textContent = '';
      this.txList(PLANO_PET.itens).forEach((t) => ul.appendChild(this.el('li', null, t)));
    }
    const regra = document.getElementById('planoRegra');
    if (regra) regra.textContent = this.tx(PLANO_PET.regra);
  }

  // ---- O GUIA EM FASES ---------------------------------------------------
  renderGuia() {
    this.renderGuiaIntro();
    this.renderFases();
  }

  renderGuiaIntro() {
    const wrap = document.getElementById('guiaIntro');
    if (!wrap) return;
    wrap.textContent = '';
    const notas = [
      { chave: 'diagnostico', cls: '', tag: i18n.t('guia.diagnostico') },
      { chave: 'regraOuro', cls: 'is-regra', tag: i18n.t('guia.regraOuro') },
      { chave: 'marco', cls: 'is-marco', tag: i18n.t('guia.marco') },
    ];
    notas.forEach((n) => {
      const txt = this.tx(GUIA_INTRO[n.chave]);
      if (!txt) return;
      const div = this.el('div', 'lichia-note' + (n.cls ? ' ' + n.cls : ''));
      div.append(this.el('span', 'lichia-note__tag', n.tag), document.createTextNode(txt));
      wrap.appendChild(div);
    });
  }

  renderFases() {
    const ol = document.getElementById('fases');
    if (!ol) return;
    const atual = this.faseAtualIndex();
    if (this.fasesAbertas === null) {
      this.fasesAbertas = new Set([GUIA_FASES[atual]?.chave]);
    }
    ol.textContent = '';

    GUIA_FASES.forEach((f, i) => {
      const estado = i < atual ? 'feita' : (i === atual ? 'atual' : 'futura');
      const aberta = this.fasesAbertas.has(f.chave);
      const li = this.el('li', `lichia-fase is-${estado}` + (aberta ? ' is-open' : ''));

      const btn = this.el('button', 'lichia-fase__btn');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', aberta ? 'true' : 'false');
      btn.setAttribute('aria-label', i18n.t('aria.abrirFase'));
      btn.append(
        this.el('span', 'lichia-fase__periodo', this.tx(f.periodo)),
        this.el('h3', 'lichia-fase__title', this.tx(f.titulo)),
        this.el('span', 'lichia-fase__badge', i18n.t('guia.' + estado)),
        this.chevron('lichia-fase__chevron'),
      );
      btn.addEventListener('click', () => {
        if (this.fasesAbertas.has(f.chave)) this.fasesAbertas.delete(f.chave);
        else this.fasesAbertas.add(f.chave);
        this.renderFases();
      });

      const body = this.el('div', 'lichia-fase__body');
      body.appendChild(this.el('p', 'lichia-fase__obj', this.tx(f.objetivo)));

      body.appendChild(this.el('p', 'lichia-sub', i18n.t('guia.fazer')));
      const ulF = this.el('ul', 'lichia-fase__fazer');
      this.txList(f.fazer).forEach((t) => ulF.appendChild(this.el('li', null, t)));
      body.appendChild(ulF);

      const res = this.el('p', 'lichia-callout');
      res.append(this.el('b', null, i18n.t('guia.resultado')), document.createTextNode(this.tx(f.resultado)));
      body.appendChild(res);

      if (f.erroComum) {
        const err = this.el('p', 'lichia-callout is-erro');
        err.append(this.el('b', null, i18n.t('guia.erro')), document.createTextNode(this.tx(f.erroComum)));
        body.appendChild(err);
      }

      const dia = this.diagrama(f.diagrama);
      if (dia) body.appendChild(dia);

      // bloco "Seu registro" (loop de feedback) — só nas fases já alcançadas
      // ou nas que já têm registro real anexado.
      const reg = FASE_REGISTROS && FASE_REGISTROS[f.chave];
      if (i <= atual || reg) body.appendChild(this.blocoRegistro(reg));

      li.append(btn, body);
      ol.appendChild(li);
    });
  }

  blocoRegistro(reg) {
    const div = this.el('div', 'lichia-registro');
    div.appendChild(this.el('p', 'lichia-sub', i18n.t('guia.registro')));
    const temNota = reg && this.tx(reg.nota);
    const gal = reg && this.galeria(reg.fotos);
    if (temNota) div.appendChild(this.el('p', 'lichia-entry__text', this.tx(reg.nota)));
    if (gal) div.appendChild(gal);
    if (!temNota && !gal) div.appendChild(this.el('p', 'lichia-registro__empty', i18n.t('guia.semRegistro')));
    return div;
  }

  // ---- CALENDÁRIO ANUAL --------------------------------------------------
  renderCalendario() {
    const strip = document.getElementById('calStrip');
    const panel = document.getElementById('calPanel');
    if (!strip || !panel) return;
    const mesAtual = new Date().getMonth();
    if (this.calMes === null) this.calMes = mesAtual;

    strip.textContent = '';
    CALENDARIO.forEach((c) => {
      const sel = c.mes === this.calMes;
      const btn = this.el('button', `lichia-cal__mes is-${c.estacao}`
        + (sel ? ' is-sel' : '') + (c.mes === mesAtual ? ' is-now' : ''));
      btn.type = 'button';
      btn.textContent = this.nomeMes(c.mes, 'short');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', sel ? 'true' : 'false');
      btn.setAttribute('aria-label', this.nomeMes(c.mes, 'long'));
      btn.addEventListener('click', () => {
        this.calMes = c.mes;
        this.renderCalendario();
      });
      strip.appendChild(btn);
    });

    const c = CALENDARIO[this.calMes] || CALENDARIO[0];
    panel.className = `lichia-cal__panel is-${c.estacao}`;
    panel.textContent = '';
    const head = this.el('div', 'lichia-cal__head');
    head.append(
      this.el('span', 'lichia-cal__mesnome', this.nomeMes(c.mes, 'long')),
      this.el('span', 'lichia-cal__foco', this.tx(c.foco)),
    );
    if (c.mes === mesAtual) head.appendChild(this.el('span', 'lichia-cal__nowtag', i18n.t('calendario.agora')));
    panel.appendChild(head);
    const ul = document.createElement('ul');
    (c.tarefas || []).forEach((t) => ul.appendChild(this.el('li', null, this.tx(t))));
    panel.appendChild(ul);
  }

  // ---- TÉCNICAS ILUSTRADAS ----------------------------------------------
  renderTecnicas() {
    const wrap = document.getElementById('tecnicas');
    if (!wrap) return;
    wrap.textContent = '';

    TECNICAS.forEach((t) => {
      const aberta = this.tecnicasAbertas.has(t.chave);
      const card = this.el('div', 'lichia-tecnica' + (aberta ? ' is-open' : ''));

      const btn = this.el('button', 'lichia-tecnica__btn');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', aberta ? 'true' : 'false');
      btn.setAttribute('aria-label', i18n.t('aria.abrirTecnica'));
      btn.append(
        this.el('span', 'lichia-tecnica__nome', this.tx(t.titulo)),
        this.el('span', 'lichia-tecnica__resumo', this.tx(t.resumo)),
        this.chevron('lichia-tecnica__chevron'),
      );
      btn.addEventListener('click', () => {
        if (this.tecnicasAbertas.has(t.chave)) this.tecnicasAbertas.delete(t.chave);
        else this.tecnicasAbertas.add(t.chave);
        this.renderTecnicas();
      });

      const body = this.el('div', 'lichia-tecnica__body');
      const dia = this.diagrama(t.diagrama);
      if (dia) body.appendChild(dia);

      body.appendChild(this.el('p', 'lichia-sub', i18n.t('tecnicas.passos')));
      const ol = this.el('ol', 'lichia-passos');
      this.txList(t.passos).forEach((p) => ol.appendChild(this.el('li', null, p)));
      body.appendChild(ol);

      const meta = this.el('div', 'lichia-meta-tec');
      const linha = (label, valor, erro) => {
        if (!valor) return;
        const div = this.el('div', erro ? 'is-erro' : null);
        div.append(this.el('b', null, label), document.createTextNode(valor));
        meta.appendChild(div);
      };
      linha(i18n.t('tecnicas.porque'), this.tx(t.porque));
      linha(i18n.t('tecnicas.quando'), this.tx(t.quando));
      linha(i18n.t('tecnicas.erro'), this.tx(t.erro), true);
      body.appendChild(meta);

      card.append(btn, body);
      wrap.appendChild(card);
    });
  }

  // ---- LINHA DO TEMPO (diário) ------------------------------------------
  renderTimeline() {
    const ol = document.getElementById('timeline');
    if (!ol) return;
    ol.textContent = '';
    TIMELINE.forEach((e, i) => {
      const li = this.el('li', 'lichia-entry' + (i === 0 ? ' is-current' : ''));
      li.append(
        this.el('p', 'lichia-entry__date', this.fmtData(e.data)),
        this.el('h3', 'lichia-entry__title', this.tx(e.titulo)),
        this.el('p', 'lichia-entry__text', this.tx(e.texto)),
      );
      const gal = this.galeria(e.fotos);
      if (gal) li.appendChild(gal);
      ol.appendChild(li);
    });
  }

  renderMetas() {
    const ul = document.getElementById('metas');
    if (!ul) return;
    ul.textContent = '';
    METAS.forEach((m) => {
      const li = document.createElement('li');
      if (String(m.ano).includes('+')) li.className = 'is-far';
      li.append(this.el('span', 'ano', m.ano), this.el('span', 'obj', this.tx(m.texto)));
      ul.appendChild(li);
    });
  }

  renderChecklist() {
    const ul = document.getElementById('checklist');
    if (!ul) return;
    ul.textContent = '';
    CHECKLIST.forEach((c) => {
      const li = this.el('li', c.done ? 'is-done' : '');
      const bead = this.el('span', 'lichia-bead');
      bead.setAttribute('aria-hidden', 'true');
      if (c.done) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '3.2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', 'M5 13l4 4L19 7');
        svg.appendChild(p);
        bead.appendChild(svg);
      }
      const estado = i18n.t(c.done ? 'aria.feito' : 'aria.pendente');
      li.setAttribute('aria-label', `${this.tx(c.label)} — ${estado}`);
      li.append(bead, this.el('span', 'rotulo', this.tx(c.label)));
      ul.appendChild(li);
    });
  }

  renderMedicoes() {
    const tbody = document.getElementById('medicoes');
    if (tbody) {
      tbody.textContent = '';
      const cm = i18n.t('unidades.cm');
      MEDICOES.forEach((m) => {
        const tr = document.createElement('tr');
        tr.append(
          this.el('td', null, this.fmtData(m.data)),
          this.el('td', null, `${m.alturaCm} ${cm}`),
          this.el('td', null, String(m.folhas)),
        );
        tbody.appendChild(tr);
      });
    }
    const now = document.getElementById('sparkNow');
    if (now && MEDICOES.length) {
      const ult = MEDICOES[MEDICOES.length - 1];
      now.textContent = `${ult.alturaCm} ${i18n.t('unidades.cm')}`;
    }
    this.renderSpark();
  }

  renderSpark() {
    const svg = document.getElementById('spark');
    if (!svg) return;
    svg.textContent = '';
    const pts = MEDICOES.map((m) => m.alturaCm).filter((v) => typeof v === 'number');
    if (!pts.length) return;

    const W = 100, H = 40, pad = 3;
    const n = pts.length;
    const min = Math.min(...pts), max = Math.max(...pts);
    const range = max - min || 1;
    const x = (i) => (n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
    const y = (v) => H - pad - ((v - min) / range) * (H - 2 * pad);

    const mk = (tag, attrs) => {
      const e = document.createElementNS(SVG_NS, tag);
      Object.entries(attrs).forEach(([k, val]) => e.setAttribute(k, val));
      return e;
    };

    if (n === 1) {
      svg.appendChild(mk('line', {
        x1: pad, x2: W - pad, y1: H / 2, y2: H / 2,
        stroke: 'var(--hair)', 'stroke-width': 1, 'stroke-dasharray': '2 3',
      }));
      svg.appendChild(mk('circle', { cx: x(0), cy: H / 2, r: 2.6, fill: 'var(--litchi)' }));
      return;
    }
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
    svg.appendChild(mk('path', {
      d, fill: 'none', stroke: 'var(--leaf)', 'stroke-width': 1.6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
    svg.appendChild(mk('circle', { cx: x(n - 1), cy: y(pts[n - 1]), r: 2.2, fill: 'var(--litchi)' }));
  }

  // ---- ESTAÇÃO DE CULTIVO (infraestrutura) ------------------------------
  renderInfra() {
    const wrap = document.getElementById('infra');
    if (!wrap) return;
    const ICONES = {
      vaso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M6.2 7l1.3 12.1a1.6 1.6 0 0 0 1.6 1.4h5.8a1.6 1.6 0 0 0 1.6-1.4L17.8 7"/></svg>',
      irrigacao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 5.2 6.3 8.2 6.3 11.2A6.3 6.3 0 0 1 5.7 14.2C5.7 11.2 8 8.2 12 3Z"/></svg>',
      luz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 18.5h5M10.2 21h3.6"/><path d="M12 2.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1.1 2h4.8c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 2.5Z"/></svg>',
    };
    wrap.textContent = '';
    ESTACAO_CULTIVO.forEach((it) => {
      const card = this.el('div', `lichia-infra__card is-${it.chave}`);
      const head = this.el('div', 'lichia-infra__head');
      const icon = this.el('span', 'lichia-infra__icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = ICONES[it.chave] || '';
      head.append(
        icon,
        this.el('span', 'lichia-infra__nome', this.tx(it.rotulo)),
        this.el('span', 'lichia-infra__tag', i18n.t('infra.planejado')),
      );
      const ul = document.createElement('ul');
      this.txList(it.itens).forEach((t) => ul.appendChild(this.el('li', null, t)));
      card.append(head, this.el('p', 'lichia-infra__resumo', this.tx(it.resumo)), ul);
      wrap.appendChild(card);
    });
  }

  // ---- PRAGAS E CUIDADOS -------------------------------------------------
  renderPragas() {
    const wrap = document.getElementById('pragas');
    if (!wrap) return;
    wrap.textContent = '';
    PRAGAS.forEach((p) => {
      const card = this.el('div', 'lichia-praga');
      card.appendChild(this.el('div', 'lichia-praga__nome', this.tx(p.nome)));
      const grid = this.el('div', 'lichia-praga__grid');
      const linha = (label, valor) => {
        const div = document.createElement('div');
        div.append(this.el('b', null, label), document.createTextNode(this.tx(valor)));
        grid.appendChild(div);
      };
      linha(i18n.t('pragas.sinal'), p.sinal);
      linha(i18n.t('pragas.causa'), p.causa);
      linha(i18n.t('pragas.acao'), p.acao);
      card.appendChild(grid);
      wrap.appendChild(card);
    });
  }

  // ---- MATERIAIS POR ETAPA ----------------------------------------------
  renderMateriais() {
    const wrap = document.getElementById('materiais');
    if (!wrap) return;
    wrap.textContent = '';
    MATERIAIS.forEach((m) => {
      const card = this.el('div', 'lichia-mat');
      const head = this.el('div', 'lichia-mat__head');
      head.append(
        this.el('span', 'lichia-mat__etapa', this.tx(m.etapa)),
        this.el('span', 'lichia-mat__quando', this.tx(m.quando)),
      );
      const ul = this.el('ul', 'lichia-mat__itens');
      (m.itens || []).forEach((it) => ul.appendChild(this.el('li', null, this.tx(it))));
      card.append(head, ul);
      wrap.appendChild(card);
    });
  }

  renderRodape() {
    const d = document.getElementById('rodapeData');
    if (d) d.textContent = this.fmtData(TIMELINE[0]?.data || META.dataInicial);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LichiaApp().inicializar());
} else {
  new LichiaApp().inicializar();
}
