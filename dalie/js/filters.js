/* =========================================================
   DALIÉ — FILTROS
   Gerencia estado, UI e aplicação dos filtros
   ========================================================= */

/* ── Mapas de apoio ── */
const COR_CSS = {
  'Preto':         '#111111',
  'Branco':        '#F8F8F8',
  'Bege':          '#D4B896',
  'Rosa':          '#F4A7B9',
  'Azul':          '#4A90D9',
  'Verde':         '#5DAA68',
  'Vermelho':      '#D93B3B',
  'Amarelo':       '#F5D03B',
  'Marrom':        '#795548',
  'Cinza':         '#9E9E9E',
  'Lilás':         '#B39DDB',
  'Laranja':       '#F4813B',
  'Vinho':         '#7B1B2C',
  'Nude':          '#D4A882',
  'Off-white':     '#F0EDE6',
  'Azul Marinho':  '#1A3A5C',
  'Verde Militar': '#4A5E3A',
  'Caramelo':      '#C68642',
  'Terracota':     '#C4703C',
  'Mostarda':      '#C9A23C',
};

const SEXO_LABEL = { feminino: 'Feminino', masculino: 'Masculino', unissex: 'Unissex' };

const ESTACAO_META = {
  verao:    { label: 'Verão',    icon: '☀' },
  outono:   { label: 'Outono',   icon: '🍂' },
  inverno:  { label: 'Inverno',  icon: '❄' },
  primavera:{ label: 'Primavera',icon: '🌸' },
};

const TAM_ORDEM = ['PP','P','M','G','GG','XGG','34','36','38','40','42','44','46'];

const DalieFilters = (function () {

  /* ── Estado dos filtros ── */
  const state = {
    categorias:    [],
    sexo:          [],
    tamanhos:      [],
    estacoes:      [],
    cores:         [],
    precoMin:      0,
    precoMax:      9999,
    apenasPromocao: false,
    apenasEstoque:  false,
    search:        '',
    sortBy:        'destaque',
  };

  /* Limites reais de preço (definidos em init) */
  let _priceMin = 0;
  let _priceMax = 9999;
  function _priceChanged() {
    return state.precoMin > _priceMin || state.precoMax < _priceMax;
  }

  /* ── Contagem de filtros ativos ── */
  function activeCount() {
    return (
      state.categorias.length +
      state.sexo.length +
      state.tamanhos.length +
      state.estacoes.length +
      state.cores.length +
      (state.apenasPromocao ? 1 : 0) +
      (state.apenasEstoque ? 1 : 0) +
      (_priceChanged() ? 1 : 0)
    );
  }

  /* ── Aplicar filtros a um array de produtos ── */
  function apply(products) {
    let result = products.filter(p => {
      /* Categoria */
      if (state.categorias.length && !state.categorias.includes(p.categoria)) return false;

      /* Sexo */
      if (state.sexo.length) {
        const match = state.sexo.some(s => s === p.sexo || p.sexo === 'unissex');
        if (!match) return false;
      }

      /* Tamanho */
      if (state.tamanhos.length) {
        const match = state.tamanhos.some(t => p.tamanhos.includes(t));
        if (!match) return false;
      }

      /* Estação */
      if (state.estacoes.length) {
        const match = state.estacoes.some(e => p.estacao.includes(e));
        if (!match) return false;
      }

      /* Cor */
      if (state.cores.length && !state.cores.includes(p.cor)) return false;

      /* Faixa de preço */
      if (p.preco < state.precoMin || p.preco > state.precoMax) return false;

      /* Apenas promoção */
      if (state.apenasPromocao && !p.precoAntigo) return false;

      /* Em estoque */
      if (state.apenasEstoque && !p.emEstoque) return false;

      /* Busca */
      if (state.search) {
        const q = state.search.toLowerCase();
        const haystack = [p.nome, p.categoria, p.cor, p.sexo, ...p.tags].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    /* Ordenação */
    switch (state.sortBy) {
      case 'menor':    result.sort((a, b) => a.preco - b.preco); break;
      case 'maior':    result.sort((a, b) => b.preco - a.preco); break;
      case 'vendidos': result.sort((a, b) => b.vendidos - a.vendidos); break;
      case 'recentes': result.sort((a, b) => b.id - a.id); break;
      case 'desconto': result.sort((a, b) => {
        const da = a.precoAntigo ? (1 - a.preco / a.precoAntigo) : 0;
        const db = b.precoAntigo ? (1 - b.preco / b.precoAntigo) : 0;
        return db - da;
      }); break;
      case 'az':       result.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); break;
      case 'za':       result.sort((a, b) => b.nome.localeCompare(a.nome, 'pt-BR')); break;
      default: /* destaque */
        result.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0)
          || b.avaliacao - a.avaliacao);
    }

    return result;
  }

  /* ── Toggle de valor em array ── */
  function toggleArr(arr, val) {
    const idx = arr.indexOf(val);
    if (idx === -1) arr.push(val);
    else arr.splice(idx, 1);
  }

  /* ── Price range slider ── */
  function initPriceSlider(minPrice, maxPrice) {
    const sliderMin = document.getElementById('range-min');
    const sliderMax = document.getElementById('range-max');
    const fill      = document.getElementById('range-fill');
    const dispMin   = document.getElementById('price-min-display');
    const dispMax   = document.getElementById('price-max-display');
    if (!sliderMin || !sliderMax) return;

    sliderMin.min = sliderMax.min = minPrice;
    sliderMin.max = sliderMax.max = maxPrice;
    sliderMin.value = minPrice;
    sliderMax.value = maxPrice;
    state.precoMax = maxPrice;

    function updateFill() {
      const mn = Number(sliderMin.value);
      const mx = Number(sliderMax.value);
      const range = maxPrice - minPrice;
      const left  = ((mn - minPrice) / range) * 100;
      const right = ((maxPrice - mx) / range) * 100;
      fill.style.left  = left + '%';
      fill.style.right = right + '%';
      dispMin.textContent = mn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      dispMax.textContent = mx.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    sliderMin.addEventListener('input', () => {
      if (Number(sliderMin.value) > Number(sliderMax.value) - 10)
        sliderMin.value = Number(sliderMax.value) - 10;
      state.precoMin = Number(sliderMin.value);
      updateFill();
      DalieApp.refresh();
    });

    sliderMax.addEventListener('input', () => {
      if (Number(sliderMax.value) < Number(sliderMin.value) + 10)
        sliderMax.value = Number(sliderMin.value) + 10;
      state.precoMax = Number(sliderMax.value);
      updateFill();
      DalieApp.refresh();
    });

    updateFill();
  }

  /* ── Chips: toggle active ── */
  function bindChips(container, stateKey) {
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.value;
        toggleArr(state[stateKey], val);
        chip.classList.toggle('active', state[stateKey].includes(val));
        updateFilterCount();
        DalieApp.refresh();
      });
    });
  }

  /* ── Color chips ── */
  function bindColorChips() {
    document.querySelectorAll('.color-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.cor;
        toggleArr(state.cores, val);
        chip.classList.toggle('active', state.cores.includes(val));
        updateFilterCount();
        DalieApp.refresh();
      });
    });
  }

  /* ── Atualiza contador de filtros no botão mobile ── */
  function updateFilterCount() {
    const cnt = activeCount();
    const el = document.querySelector('.filter-count');
    if (el) el.textContent = cnt > 0 ? cnt : '';
  }

  /* ── Painel mobile (abrir/fechar) ── */
  function openPanel() {
    document.getElementById('filters-panel').classList.add('open');
    document.getElementById('filters-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    document.getElementById('filters-panel').classList.remove('open');
    document.getElementById('filters-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Limpar todos os filtros ── */
  function clear() {
    state.categorias    = [];
    state.sexo          = [];
    state.tamanhos      = [];
    state.estacoes      = [];
    state.cores         = [];
    state.apenasPromocao = false;
    state.apenasEstoque  = false;

    /* Resetar controles */
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
    const cbPromo = document.getElementById('cb-promo');
    const cbEstoque = document.getElementById('cb-estoque');
    if (cbPromo) cbPromo.checked = false;
    if (cbEstoque) cbEstoque.checked = false;

    /* Resetar price slider */
    const sliderMin = document.getElementById('range-min');
    const sliderMax = document.getElementById('range-max');
    if (sliderMin && sliderMax) {
      sliderMin.value = sliderMin.min;
      sliderMax.value = sliderMax.max;
      state.precoMin = Number(sliderMin.min);
      state.precoMax = Number(sliderMax.max);
      sliderMin.dispatchEvent(new Event('input'));
      sliderMax.dispatchEvent(new Event('input'));
    }

    updateFilterCount();
    DalieApp.refresh();
  }

  /* ── Accordion de grupo de filtro ── */
  function initAccordions() {
    document.querySelectorAll('.filter-label').forEach(label => {
      const group = label.closest('.filter-group');
      if (!group) return;
      label.addEventListener('click', () => {
        group.classList.toggle('collapsed');
      });
    });
  }

  /* ── Gera chips a partir dos valores únicos dos produtos ── */
  function buildChips(wrap, values, stateKey) {
    if (!wrap) return;
    wrap.innerHTML = values
      .map(v => `<button class="chip" data-value="${v}">${v}</button>`)
      .join('');
    bindChips(wrap, stateKey);
  }

  function buildColorChips(wrap, colors) {
    if (!wrap) return;
    wrap.innerHTML = colors.map(cor => {
      const bg = COR_CSS[cor] || '#ccc';
      return `<button class="color-chip" data-cor="${cor}"
        aria-label="${cor}" title="${cor}"
        style="background:${bg};border-color:${bg}"></button>`;
    }).join('');
    bindColorChips();
  }

  /* ── Init ── */
  function init(products) {
    /* Faixa de preço dinâmica */
    const prices = products.map(p => p.preco);
    const minP = Math.floor(Math.min(...prices));
    const maxP = Math.ceil(Math.max(...prices));
    _priceMin = minP;
    _priceMax = maxP;
    state.precoMax = maxP;
    initPriceSlider(minP, maxP);

    /* Categorias — únicas e ordenadas */
    const cats = [...new Set(products.map(p => p.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    buildChips(document.getElementById('filter-categorias'), cats, 'categorias');

    /* Sexo */
    const sexos = [...new Set(products.map(p => p.sexo))];
    const sexoOrder = ['feminino','masculino','unissex'];
    sexos.sort((a, b) => sexoOrder.indexOf(a) - sexoOrder.indexOf(b));
    const sexoWrap = document.getElementById('filter-sexo');
    if (sexoWrap) {
      sexoWrap.innerHTML = sexos
        .map(s => `<button class="chip" data-value="${s}">${SEXO_LABEL[s] || s}</button>`)
        .join('');
      bindChips(sexoWrap, 'sexo');
    }

    /* Tamanhos — todos únicos, na ordem correta */
    const allTams = new Set(products.flatMap(p => p.tamanhos));
    const tams = TAM_ORDEM.filter(t => allTams.has(t));
    buildChips(document.getElementById('filter-tamanhos'), tams, 'tamanhos');

    /* Estações — na ordem: verão, outono, inverno, primavera */
    const allEst = new Set(products.flatMap(p => p.estacao));
    const estWrap = document.getElementById('filter-estacoes');
    if (estWrap) {
      const estOrder = ['verao','outono','inverno','primavera'].filter(e => allEst.has(e));
      estWrap.innerHTML = estOrder.map(e => {
        const m = ESTACAO_META[e];
        return `<button class="chip" data-value="${e}">${m.icon} ${m.label}</button>`;
      }).join('');
      bindChips(estWrap, 'estacoes');
    }

    /* Cores — únicas, ordenadas por nome */
    const allCores = [...new Set(products.map(p => p.cor))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    buildColorChips(document.getElementById('filter-cores'), allCores);

    /* Checkboxes */
    document.getElementById('cb-promo')?.addEventListener('change', e => {
      state.apenasPromocao = e.target.checked;
      updateFilterCount();
      DalieApp.refresh();
    });
    document.getElementById('cb-estoque')?.addEventListener('change', e => {
      state.apenasEstoque = e.target.checked;
      updateFilterCount();
      DalieApp.refresh();
    });

    /* Busca */
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    searchInput?.addEventListener('input', e => {
      state.search = e.target.value.trim();
      searchClear?.classList.toggle('visible', state.search.length > 0);
      DalieApp.refresh();
    });
    searchClear?.addEventListener('click', () => {
      searchInput.value = '';
      state.search = '';
      searchClear.classList.remove('visible');
      DalieApp.refresh();
      searchInput.focus();
    });

    /* Ordenação */
    document.getElementById('sort-select')?.addEventListener('change', e => {
      state.sortBy = e.target.value;
      DalieApp.refresh();
    });

    /* Limpar filtros */
    document.getElementById('filters-clear')?.addEventListener('click', clear);

    /* Toggle painel mobile */
    document.getElementById('filter-toggle-btn')?.addEventListener('click', openPanel);
    document.getElementById('filters-close')?.addEventListener('click', closePanel);
    document.getElementById('filters-overlay')?.addEventListener('click', closePanel);
    document.getElementById('filters-apply')?.addEventListener('click', closePanel);

    /* Accordions */
    initAccordions();
  }

  return { init, apply, state, activeCount };
})();
