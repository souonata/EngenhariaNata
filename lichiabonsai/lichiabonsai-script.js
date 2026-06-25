/**
 * lichiabonsai-script.js — renderiza o diário a partir de lichiabonsai-data.js.
 * Conteúdo é data-driven e bilíngue: re-renderiza ao trocar de idioma.
 * As fotos (./fotos/*.webp) são resolvidas pelo Vite via import.meta.glob,
 * então entram no build hasheadas (sem fetch em runtime, sem cópia no deploy).
 */

import { App, i18n } from '../src/core/app.js';
import {
  META, STATUS, PLANO_PET, TIMELINE, METAS, CHECKLIST, MEDICOES, ESTACOES, ESTACAO_CULTIVO,
} from './lichiabonsai-data.js';

// filename "x.webp" -> URL final (hasheada no build)
const FOTOS = import.meta.glob('./fotos/*.webp', { eager: true, query: '?url', import: 'default' });
const fotoUrl = (nome) => FOTOS['./fotos/' + nome] || '';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

  fmtData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const locale = this.lang() === 'it' ? 'it-IT' : 'pt-BR';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(date).replace('.', '');
  }

  renderTudo() {
    document.title = i18n.t('meta.tabTitle');
    this.renderHero();
    this.renderStatus();
    this.renderPlano();
    this.renderTimeline();
    this.renderMetas();
    this.renderChecklist();
    this.renderMedicoes();
    this.renderEstacoes();
    this.renderInfra();
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
        img.alt = this.tx(META.heroFoto.alt);
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
      const dt = document.createElement('dt');
      dt.textContent = this.tx(c.rotulo);
      const dd = document.createElement('dd');
      dd.textContent = c.isData ? this.fmtData(c.valor) : this.tx(c.valor);
      div.append(dt, dd);
      dl.appendChild(div);
    });
  }

  renderPlano() {
    const ul = document.getElementById('planoLista');
    if (ul) {
      ul.textContent = '';
      (PLANO_PET.itens[this.lang()] || PLANO_PET.itens.pt || []).forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.appendChild(li);
      });
    }
    const regra = document.getElementById('planoRegra');
    if (regra) regra.textContent = this.tx(PLANO_PET.regra);
  }

  renderTimeline() {
    const ol = document.getElementById('timeline');
    if (!ol) return;
    ol.textContent = '';
    TIMELINE.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'lichia-entry' + (i === 0 ? ' is-current' : '');

      const data = document.createElement('p');
      data.className = 'lichia-entry__date';
      data.textContent = this.fmtData(e.data);

      const tit = document.createElement('h3');
      tit.className = 'lichia-entry__title';
      tit.textContent = this.tx(e.titulo);

      const txt = document.createElement('p');
      txt.className = 'lichia-entry__text';
      txt.textContent = this.tx(e.texto);

      li.append(data, tit, txt);

      if (Array.isArray(e.fotos) && e.fotos.length) {
        const gal = document.createElement('div');
        gal.className = 'lichia-gallery';
        e.fotos.forEach((f) => {
          const url = fotoUrl(f.arquivo);
          if (!url) return;
          const fig = document.createElement('figure');
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          const img = document.createElement('img');
          img.src = url;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.alt = this.tx(f.legenda);
          a.appendChild(img);
          const cap = document.createElement('figcaption');
          cap.textContent = this.tx(f.legenda);
          fig.append(a, cap);
          gal.appendChild(fig);
        });
        if (gal.childElementCount) li.appendChild(gal);
      }
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
      const ano = document.createElement('span');
      ano.className = 'ano';
      ano.textContent = m.ano;
      const obj = document.createElement('span');
      obj.className = 'obj';
      obj.textContent = this.tx(m.texto);
      li.append(ano, obj);
      ul.appendChild(li);
    });
  }

  renderChecklist() {
    const ul = document.getElementById('checklist');
    if (!ul) return;
    ul.textContent = '';
    CHECKLIST.forEach((c) => {
      const li = document.createElement('li');
      li.className = c.done ? 'is-done' : '';
      const bead = document.createElement('span');
      bead.className = 'lichia-bead';
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
      const rot = document.createElement('span');
      rot.className = 'rotulo';
      rot.textContent = this.tx(c.label);
      const estado = i18n.t(c.done ? 'aria.feito' : 'aria.pendente');
      li.setAttribute('aria-label', `${this.tx(c.label)} — ${estado}`);
      li.append(bead, rot);
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
        const td1 = document.createElement('td');
        td1.textContent = this.fmtData(m.data);
        const td2 = document.createElement('td');
        td2.textContent = `${m.alturaCm} ${cm}`;
        const td3 = document.createElement('td');
        td3.textContent = m.folhas;
        tr.append(td1, td2, td3);
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
      // degrada graciosamente a 1 ponto: linha-guia + ponto
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

  renderEstacoes() {
    const wrap = document.getElementById('estacoes');
    if (!wrap) return;
    const ICONES = {
      primavera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V11"/><path d="M12 14c-4 0-6.4-2.6-6.8-7C9.6 7.4 12 9.8 12 14Z" fill="currentColor" stroke="none"/><path d="M12 11c3.6 0 5.7-2.1 6.1-6C14.1 5.4 12 7.5 12 11Z" fill="currentColor" stroke="none" opacity="0.85"/></svg>',
      verao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 1.5v2.6M12 19.9v2.6M1.5 12h2.6M19.9 12h2.6M4.6 4.6l1.85 1.85M17.55 17.55l1.85 1.85M19.4 4.6l-1.85 1.85M6.45 17.55 4.6 19.4"/></svg>',
      outono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c8-1.2 13.5-6.7 14.5-15C11.5 5 6 10.5 5 19Z" fill="currentColor" stroke="none" opacity="0.85"/><path d="M5 19C9.5 13.5 14 9 19.5 4"/></svg>',
      inverno: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/><path d="M12 5l-2.2 2.2M12 5l2.2 2.2M12 19l-2.2-2.2M12 19l2.2 2.2"/></svg>',
    };
    wrap.textContent = '';
    const mes = new Date().getMonth();
    ESTACOES.forEach((est) => {
      const card = document.createElement('div');
      card.className = `lichia-estacao is-${est.chave}`;
      const agora = Array.isArray(est.meses) && est.meses.includes(mes);
      if (agora) card.classList.add('is-now');

      const head = document.createElement('div');
      head.className = 'lichia-estacao__head';
      const icon = document.createElement('span');
      icon.className = 'lichia-estacao__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = ICONES[est.chave] || '';
      const nome = document.createElement('span');
      nome.className = 'lichia-estacao__nome';
      nome.textContent = this.tx(est.rotulo);
      head.append(icon, nome);
      if (agora) {
        const badge = document.createElement('span');
        badge.className = 'lichia-estacao__agora';
        badge.textContent = i18n.t('estacoes.agora');
        head.appendChild(badge);
      }

      const ul = document.createElement('ul');
      (est.dicas[this.lang()] || est.dicas.pt || []).forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.appendChild(li);
      });

      card.append(head, ul);
      wrap.appendChild(card);
    });
  }

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
      const card = document.createElement('div');
      card.className = `lichia-infra__card is-${it.chave}`;

      const head = document.createElement('div');
      head.className = 'lichia-infra__head';
      const icon = document.createElement('span');
      icon.className = 'lichia-infra__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = ICONES[it.chave] || '';
      const nome = document.createElement('span');
      nome.className = 'lichia-infra__nome';
      nome.textContent = this.tx(it.rotulo);
      const tag = document.createElement('span');
      tag.className = 'lichia-infra__tag';
      tag.textContent = i18n.t('infra.planejado');
      head.append(icon, nome, tag);

      const resumo = document.createElement('p');
      resumo.className = 'lichia-infra__resumo';
      resumo.textContent = this.tx(it.resumo);

      const ul = document.createElement('ul');
      (it.itens[this.lang()] || it.itens.pt || []).forEach((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        ul.appendChild(li);
      });

      card.append(head, resumo, ul);
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
