// Visualizador de manuais (PDF) — BR 12C Niobium
// Abre um modal responsivo com dois documentos oficiais complementares da HP 12C
// Platinum (EN): o Guia do usuário e o Manual do proprietário (Owner's Handbook).
// Cada PDF (~1,4–2,3 MB) só é carregado na primeira vez que é exibido.
(function () {
  'use strict';

  const overlay = document.getElementById('guideOverlay');
  const frame = document.getElementById('guideFrame');
  const tituloEl = document.getElementById('guideTitle');
  const openLink = document.getElementById('guideOpenLink');
  const openBtns = document.querySelectorAll('[data-action="guide"]');
  const tabs = overlay ? overlay.querySelectorAll('.guide-tab') : [];
  if (!overlay || !frame || !tituloEl || !openLink || !openBtns.length) return;

  const DOCS = {
    ug: {
      src: './assets/hp12cplatinum-ug-en.pdf#view=FitH',
      titleKey: 'guide.titleUg',
      title: '📘 Guia do usuário — HP 12C Platinum (EN)',
      frameTitleKey: 'guide.frameTitleUg',
      frameTitle: 'Guia do usuário HP 12C Platinum (PDF)'
    },
    handbook: {
      src: './assets/hp12c-platinum-owners-handbook.pdf#view=FitH',
      titleKey: 'guide.titleHandbook',
      title: '📕 Manual do proprietário — HP 12C Platinum (EN)',
      frameTitleKey: 'guide.frameTitleHandbook',
      frameTitle: 'Manual do proprietário HP 12C Platinum (PDF)'
    }
  };
  const LS_DOC = 'engnata_br12c_guide_doc';
  let docoAtual = 'ug';

  let ultimoFoco = null;

  // Navegadores móveis não renderizam PDF utilizável dentro de <iframe> (iOS mostra
  // só a 1ª página congelada, sem scroll/zoom; Android idem ou pior). Nesses casos
  // o botão abre o PDF direto no visualizador nativo (nova aba), que rola e dá zoom.
  // iPadOS 13+ se identifica como Mac, mas tem multi-touch (maxTouchPoints > 1).
  const PDF_EM_IFRAME_OK = !(
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent))
  );

  // Atualiza título, aba ativa, link "abrir em nova aba" e atributos de tradução
  // do documento selecionado. `carregar` decide se o PDF é buscado agora (só
  // deve acontecer quando o modal está visível) ou apenas referenciado.
  function aplicarDoc(id, carregar) {
    const doc = DOCS[id];
    if (!doc) return;
    docoAtual = id;
    tabs.forEach((tab) => {
      const ativo = tab.dataset.doc === id;
      tab.classList.toggle('is-active', ativo);
      tab.setAttribute('aria-selected', ativo ? 'true' : 'false');
    });
    tituloEl.setAttribute('data-i18n', doc.titleKey);
    tituloEl.textContent = doc.title;
    frame.setAttribute('data-i18n-title', doc.frameTitleKey);
    frame.title = doc.frameTitle;
    frame.dataset.src = doc.src;
    openLink.href = doc.src.split('#')[0];
    if (carregar && frame.getAttribute('src') !== doc.src) {
      frame.setAttribute('src', doc.src);
    }
    try { localStorage.setItem(LS_DOC, id); } catch (e) { /* ignora */ }
    // O chrome-boot.js é dono das traduções; pede pra ele reaplicar nos
    // atributos data-i18n/data-i18n-title que acabamos de trocar.
    document.dispatchEvent(new CustomEvent('br12c:retranslate'));
  }

  // Restaura o último documento visto (sem carregar o PDF ainda).
  let docoInicial = 'ug';
  try {
    const salvo = localStorage.getItem(LS_DOC);
    if (salvo && DOCS[salvo]) docoInicial = salvo;
  } catch (e) { /* ignora */ }
  aplicarDoc(docoInicial, false);

  function abrir(docId) {
    if (docId && DOCS[docId]) aplicarDoc(docId, false);
    const doc = DOCS[docoAtual];
    if (!PDF_EM_IFRAME_OK) {
      const url = (doc.src || '').split('#')[0];
      if (url) window.open(url, '_blank', 'noopener');
      return;
    }
    const jaAberto = document.body.classList.contains('guide-open');
    // Carrega o PDF só agora, evitando baixar o arquivo grande sem necessidade.
    if (frame.getAttribute('src') !== doc.src) {
      frame.setAttribute('src', doc.src);
    }
    if (jaAberto) return; // já visível: só trocou o PDF exibido no iframe
    ultimoFoco = document.activeElement;
    overlay.hidden = false;
    // Docado (não cobre a calc): NÃO trava o scroll do corpo.
    document.body.classList.add('guide-open');
    const fechar = overlay.querySelector('[data-action="guide-close"]');
    if (fechar) fechar.focus();
  }

  function fechar() {
    overlay.hidden = true;
    document.body.classList.remove('guide-open');
    if (ultimoFoco && typeof ultimoFoco.focus === 'function') {
      ultimoFoco.focus();
    }
  }

  openBtns.forEach((btn) => {
    btn.addEventListener('click', () => abrir(btn.dataset.guideDoc));
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => abrir(tab.dataset.doc));
  });

  // Abertura disparada pelo app.js (ex.: toque no botão Guia em telas touch).
  document.addEventListener('br12c:guide', abrir);

  // Fecha ao clicar no fundo escuro (fora da janela do modal).
  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) fechar();
  });

  overlay.querySelectorAll('[data-action="guide-close"]').forEach((botao) => {
    botao.addEventListener('click', fechar);
  });

  // Fecha com Esc.
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !overlay.hidden) fechar();
  });

  // Registra o Service Worker do guia (escopo /br12c/) para funcionar offline
  // depois do primeiro acesso online.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        /* sem SW: o guia segue funcionando online normalmente */
      });
    });
  }

  // --- Divisória arrastável entre a calculadora e o guia ---
  const resizer = document.getElementById('guideResizer');
  if (resizer) {
    const root = document.documentElement;
    const LS_W = 'engnata_br12c_guide_w';
    const LS_H = 'engnata_br12c_guide_h';

    const lerLS = (k) => {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    };
    const salvarLS = (k, v) => {
      try { localStorage.setItem(k, v); } catch (e) { /* ignora */ }
    };

    // Restaura tamanhos salvos (um para paisagem, outro para retrato).
    const savedW = lerLS(LS_W);
    const savedH = lerLS(LS_H);
    if (savedW) root.style.setProperty('--guide-w', savedW);
    if (savedH) root.style.setProperty('--guide-h', savedH);

    const dockH = () =>
      window.matchMedia('(min-width: 900px) and (min-height: 560px) and (orientation: landscape)').matches;
    const dockV = () =>
      window.matchMedia('(min-width: 700px) and (min-height: 760px) and (orientation: portrait)').matches;

    const setLargura = (px) => {
      px = Math.max(300, Math.min(window.innerWidth - 240, px));
      root.style.setProperty('--guide-w', px + 'px');
      salvarLS(LS_W, px + 'px');
    };
    const setAltura = (px) => {
      px = Math.max(180, Math.min(window.innerHeight - 280, px));
      root.style.setProperty('--guide-h', px + 'px');
      salvarLS(LS_H, px + 'px');
    };

    const fimResize = (evento) => {
      if (!document.body.classList.contains('guide-resizing')) return;
      document.body.classList.remove('guide-resizing');
      try { resizer.releasePointerCapture(evento.pointerId); } catch (_e) { /* ignora */ }
    };

    resizer.addEventListener('pointerdown', (evento) => {
      if (!dockH() && !dockV()) return; // tela cheia (celular): não redimensiona
      evento.preventDefault();
      try { resizer.setPointerCapture(evento.pointerId); } catch (_e) { /* ignora */ }
      document.body.classList.add('guide-resizing');
    });
    resizer.addEventListener('pointermove', (evento) => {
      if (!document.body.classList.contains('guide-resizing')) return;
      if (dockH()) setLargura(window.innerWidth - evento.clientX);
      else if (dockV()) setAltura(window.innerHeight - evento.clientY);
    });
    resizer.addEventListener('pointerup', fimResize);
    resizer.addEventListener('pointercancel', fimResize);

    // Acessibilidade: setas ajustam a divisória (Shift = passo maior).
    resizer.addEventListener('keydown', (evento) => {
      const passo = evento.shiftKey ? 48 : 16;
      const r = overlay.getBoundingClientRect();
      if (dockH()) {
        if (evento.key === 'ArrowLeft') { setLargura(r.width + passo); evento.preventDefault(); }
        else if (evento.key === 'ArrowRight') { setLargura(r.width - passo); evento.preventDefault(); }
      } else if (dockV()) {
        if (evento.key === 'ArrowUp') { setAltura(r.height + passo); evento.preventDefault(); }
        else if (evento.key === 'ArrowDown') { setAltura(r.height - passo); evento.preventDefault(); }
      }
    });
  }
})();
