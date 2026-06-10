// Visualizador do guia do usuário (PDF) — BR 12C Niobium
// Abre um modal responsivo com o manual oficial (HP 12C Platinum, EN).
// O PDF (~2,3 MB) só é carregado na primeira abertura.
(function () {
  'use strict';

  const overlay = document.getElementById('guideOverlay');
  const frame = document.getElementById('guideFrame');
  const openBtn = document.querySelector('[data-action="guide"]');
  if (!overlay || !frame || !openBtn) return;

  let ultimoFoco = null;

  // Navegadores móveis não renderizam PDF utilizável dentro de <iframe> (iOS mostra
  // só a 1ª página congelada, sem scroll/zoom; Android idem ou pior). Nesses casos
  // o 📖 abre o PDF direto no visualizador nativo (nova aba), que rola e dá zoom.
  // iPadOS 13+ se identifica como Mac, mas tem multi-touch (maxTouchPoints > 1).
  const PDF_EM_IFRAME_OK = !(
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent))
  );

  function abrir() {
    if (!PDF_EM_IFRAME_OK) {
      const url = (frame.dataset.src || frame.getAttribute('src') || '').split('#')[0];
      if (url) window.open(url, '_blank', 'noopener');
      return;
    }
    if (document.body.classList.contains('guide-open')) return;
    // Carrega o PDF só agora, evitando baixar o arquivo grande sem necessidade.
    if (!frame.getAttribute('src') && frame.dataset.src) {
      frame.setAttribute('src', frame.dataset.src);
    }
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

  openBtn.addEventListener('click', abrir);

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
