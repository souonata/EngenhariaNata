// Painéis colapsáveis do BR 12C Niobium (TVM e Estado).
// Clicar no título minimiza/expande o painel; o estado é lembrado por painel.
(function () {
  'use strict';

  var PREFIX = 'engnata_hp12c_panel_';
  var toggles = document.querySelectorAll('.panel-block .panel-toggle');

  function aplicar(bloco, botao, colapsado) {
    bloco.classList.toggle('is-collapsed', colapsado);
    botao.setAttribute('aria-expanded', colapsado ? 'false' : 'true');
  }

  toggles.forEach(function (botao) {
    var bloco = botao.closest('.panel-block');
    if (!bloco) return;
    var id = bloco.getAttribute('data-panel') || '';

    // Restaura o estado salvo (se houver).
    if (id) {
      var salvo = null;
      try {
        salvo = localStorage.getItem(PREFIX + id);
      } catch (e) {
        salvo = null;
      }
      if (salvo === 'collapsed') {
        aplicar(bloco, botao, true);
      }
    }

    botao.addEventListener('click', function () {
      var colapsado = !bloco.classList.contains('is-collapsed');
      aplicar(bloco, botao, colapsado);
      if (id) {
        try {
          localStorage.setItem(PREFIX + id, colapsado ? 'collapsed' : 'expanded');
        } catch (e) {
          /* localStorage indisponível: ignora a persistência */
        }
      }
    });
  });
})();
