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

  function abrir() {
    // Carrega o PDF só agora, evitando baixar o arquivo grande sem necessidade.
    if (!frame.getAttribute('src') && frame.dataset.src) {
      frame.setAttribute('src', frame.dataset.src);
    }
    ultimoFoco = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    const fechar = overlay.querySelector('[data-action="guide-close"]');
    if (fechar) fechar.focus();
  }

  function fechar() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (ultimoFoco && typeof ultimoFoco.focus === 'function') {
      ultimoFoco.focus();
    }
  }

  openBtn.addEventListener('click', abrir);

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

  // Registra o Service Worker do guia (escopo /hp12c/) para funcionar offline
  // depois do primeiro acesso online.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        /* sem SW: o guia segue funcionando online normalmente */
      });
    });
  }
})();
