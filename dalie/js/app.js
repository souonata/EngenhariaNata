/* =========================================================
   DALIÉ — APP PRINCIPAL
   Orquestra carregamento, renderização e interações
   =========================================================

   CONFIGURAÇÃO — edite os valores abaixo:
   ========================================================= */
const DALIE_CONFIG = {
  whatsapp:  '5511999999999',   // ← Seu número WhatsApp com DDI (ex: 5511999999999)
  instagram: '@dalie.moda',     // ← Seu Instagram (aparece no footer)
  storeName: 'Dalié',
  defaultTheme: 'luxury',       // 'luxury' | 'streetwear' | 'dark'
};

/* ── Produtos globais (preenchidos após fetch) ── */
window.DALIE_PRODUCTS = [];

/* ═══════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════ */
const DalieApp = (function () {

  /* ── Tema ── */
  function setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('dalie_theme', name);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === name);
      btn.setAttribute('aria-pressed', btn.dataset.theme === name);
    });
  }

  function initTheme() {
    const saved = localStorage.getItem('dalie_theme') || DALIE_CONFIG.defaultTheme;
    setTheme(saved);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
  }

  /* ── Carregar produtos ── */
  async function loadProducts() {
    try {
      const res = await fetch('data/products.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      window.DALIE_PRODUCTS = data;
      return data;
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      showError();
      return [];
    }
  }

  /* ── Renderizar grade ── */
  function render(products) {
    const grid = document.getElementById('products-grid');
    const info = document.getElementById('results-info');
    if (!grid) return;

    /* Info de resultado */
    if (info) {
      info.textContent = products.length === 0
        ? ''
        : `${products.length} ${products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" role="status">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <h3>Nenhum produto encontrado</h3>
          <p>Tente ajustar os filtros ou a busca.</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(renderCard).join('');
  }

  /* ── Card HTML ── */
  function renderCard(p) {
    const discount = p.precoAntigo
      ? Math.round((1 - p.preco / p.precoAntigo) * 100)
      : null;

    const starsHtml = renderStars(p.avaliacao);

    return `
      <article class="product-card" data-id="${p.id}" aria-label="${p.nome}">
        <div class="card-img-wrap">
          <img
            src="${p.imagem}"
            alt="${p.nome} — ${p.categoria} ${p.sexo}"
            class="card-img"
            loading="lazy"
            width="400"
            height="520">
          <div class="card-badges" aria-hidden="true">
            ${discount ? `<span class="badge badge-sale">−${discount}%</span>` : ''}
            ${p.vendidos > 200 ? '<span class="badge badge-new">Top</span>' : ''}
          </div>
          <div class="card-quick-actions">
            <button class="btn-quick btn-add-quick"
              onclick="DalieApp.addToCart(${p.id}, event)"
              aria-label="Adicionar ${p.nome} ao carrinho">
              + Carrinho
            </button>
            <button class="btn-quick btn-view-quick"
              onclick="DalieApp.openModal(${p.id})"
              aria-label="Ver detalhes de ${p.nome}">
              Ver
            </button>
          </div>
        </div>
        <div class="card-body">
          <span class="card-category">${p.categoria}</span>
          <h3 class="card-name">${p.nome}</h3>
          <div class="card-sizes" aria-label="Tamanhos disponíveis">
            ${p.tamanhos.map(t => `<span class="size-dot" aria-label="${t}">${t}</span>`).join('')}
          </div>
          <div class="card-rating" aria-label="Avaliação ${p.avaliacao} de 5, ${p.numAvaliacoes} avaliações">
            <span class="stars" aria-hidden="true">${starsHtml}</span>
            <span class="rating-count">(${p.numAvaliacoes})</span>
          </div>
          <div class="card-price">
            <span class="price-current${discount ? ' sale' : ''}">${DalieCart.fmt(p.preco)}</span>
            ${p.precoAntigo ? `<span class="price-old">${DalieCart.fmt(p.precoAntigo)}</span>` : ''}
          </div>
          <button class="btn-card-add"
            onclick="DalieApp.addToCart(${p.id}, event)"
            aria-label="Adicionar ${p.nome} ao carrinho">
            Adicionar ao carrinho
          </button>
        </div>
      </article>`;
  }

  /* ── Estrelas ── */
  function renderStars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) html += '★';
      else if (i - 0.5 <= rating) html += '½';
      else html += '☆';
    }
    return html;
  }

  /* ── Refresh (após filtros mudarem) ── */
  function refresh() {
    const filtered = DalieFilters.apply(window.DALIE_PRODUCTS);
    render(filtered);
    DalieRecommendations.hide();
  }

  /* ── Size picker popup ── */
  let activePicker = null;

  function onOutsideClick(e) {
    if (activePicker && !activePicker.contains(e.target)) {
      closePicker();
    }
  }

  function closePicker() {
    if (activePicker) {
      activePicker.remove();
      activePicker = null;
      document.removeEventListener('click', onOutsideClick);
    }
  }

  function addToCart(productId, event) {
    event && event.stopPropagation();
    const product = window.DALIE_PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    /* Se só tem um tamanho, adiciona direto */
    if (product.tamanhos.length === 1) {
      DalieCart.add(product, product.tamanhos[0]);
      return;
    }

    /* Fechar picker anterior */
    closePicker();

    /* Criar picker */
    const picker = document.createElement('div');
    picker.className = 'size-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Selecione o tamanho');
    picker.innerHTML = `
      <p class="size-picker-title">Selecione o tamanho</p>
      <div class="size-picker-options">
        ${product.tamanhos.map(t =>
          `<button class="size-option" data-size="${t}" aria-pressed="false">${t}</button>`
        ).join('')}
      </div>
      <button class="size-picker-confirm">Adicionar ao carrinho</button>`;

    /* Posicionar próximo ao botão clicado */
    const btn = event?.currentTarget || event?.target;
    document.body.appendChild(picker);

    if (btn) {
      const rect = btn.getBoundingClientRect();
      const pickerH = picker.offsetHeight || 160;
      const top = rect.top + window.scrollY - pickerH - 8;
      picker.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - picker.offsetWidth - 8)) + 'px';
      picker.style.top  = (top < 0 ? rect.bottom + window.scrollY + 8 : top) + 'px';
    }

    activePicker = picker;

    /* Selecionar tamanho */
    let selectedSize = null;
    picker.querySelectorAll('.size-option').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        picker.querySelectorAll('.size-option').forEach(o => {
          o.classList.remove('selected');
          o.setAttribute('aria-pressed', 'false');
        });
        opt.classList.add('selected');
        opt.setAttribute('aria-pressed', 'true');
        selectedSize = opt.dataset.size;
      });
    });

    /* Confirmar */
    picker.querySelector('.size-picker-confirm').addEventListener('click', e => {
      e.stopPropagation();
      if (!selectedSize) {
        toast('Por favor, selecione um tamanho');
        return;
      }
      DalieCart.add(product, selectedSize);
      closePicker();
    });

    /* Fechar ao clicar fora (verifica se clique é fora do picker) */
    setTimeout(() => {
      document.addEventListener('click', onOutsideClick);
    }, 0);
  }

  /* ── Modal de produto ── */
  let modalProduct = null;
  let modalSelectedSize = null;

  function openModal(productId) {
    const product = window.DALIE_PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    modalProduct = product;
    modalSelectedSize = product.tamanhos.length === 1 ? product.tamanhos[0] : null;

    const overlay = document.getElementById('modal-overlay');
    const img     = document.getElementById('modal-img');
    const cat     = document.getElementById('modal-category');
    const name    = document.getElementById('modal-name');
    const rating  = document.getElementById('modal-rating');
    const priceCur= document.getElementById('modal-price-current');
    const priceOld= document.getElementById('modal-price-old');
    const desc    = document.getElementById('modal-desc');
    const sizes   = document.getElementById('modal-sizes');

    if (!overlay) return;

    const discount = product.precoAntigo
      ? Math.round((1 - product.preco / product.precoAntigo) * 100)
      : null;

    img.src = product.imagem;
    img.alt = product.nome;
    cat.textContent = product.categoria + (discount ? ` · −${discount}%` : '');
    name.textContent = product.nome;
    rating.innerHTML = `<span class="stars">${renderStars(product.avaliacao)}</span>
      <span>${product.avaliacao} (${product.numAvaliacoes} avaliações)</span>`;
    priceCur.textContent = DalieCart.fmt(product.preco);
    priceCur.className   = 'modal-price-current' + (discount ? ' sale' : '');
    priceOld.textContent = product.precoAntigo ? DalieCart.fmt(product.precoAntigo) : '';
    priceOld.style.display = product.precoAntigo ? '' : 'none';
    desc.textContent = product.descricao;

    /* Tamanhos */
    sizes.innerHTML = product.tamanhos.map(t =>
      `<button class="modal-size-btn${modalSelectedSize === t ? ' selected' : ''}"
        data-size="${t}" aria-pressed="${modalSelectedSize === t}">${t}</button>`
    ).join('');

    sizes.querySelectorAll('.modal-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sizes.querySelectorAll('.modal-size-btn').forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
        modalSelectedSize = btn.dataset.size;
      });
    });

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-close')?.focus();
  }

  function closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
    modalProduct = null;
    modalSelectedSize = null;
  }

  function modalAddToCart() {
    if (!modalProduct) return;
    if (!modalSelectedSize) {
      toast('Por favor, selecione um tamanho');
      /* Shake nos botões de tamanho */
      document.getElementById('modal-sizes')?.classList.add('shake');
      setTimeout(() => document.getElementById('modal-sizes')?.classList.remove('shake'), 400);
      return;
    }
    DalieCart.add(modalProduct, modalSelectedSize);
    closeModal();
    DalieCart.open();
  }

  /* ── Toast ── */
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('aria-live', 'polite');
  toastContainer.setAttribute('aria-atomic', 'true');

  function toast(msg, duration = 3000) {
    if (!document.body.contains(toastContainer)) {
      document.body.appendChild(toastContainer);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  /* ── Loader ── */
  function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500);
    }
  }

  /* ── Mensagem de erro ── */
  function showError() {
    const grid = document.getElementById('products-grid');
    if (grid) grid.innerHTML = `
      <div class="empty-state">
        <p>Erro ao carregar produtos. Certifique-se de servir os arquivos via servidor HTTP.</p>
      </div>`;
    hideLoader();
  }

  /* ── Lazy loading polyfill mínimo ── */
  function initLazyLoad() {
    if ('loading' in HTMLImageElement.prototype) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          img.src = img.dataset.src || img.src;
          observer.unobserve(img);
        }
      });
    });
    document.querySelectorAll('img[loading="lazy"]').forEach(img => observer.observe(img));
  }

  /* ── Schema.org (SEO) ── */
  function injectSchema(products) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: 'Dalié',
      description: 'Loja de moda feminina com peças selecionadas.',
      url: window.location.href,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Catálogo Dalié',
        numberOfItems: products.length,
      }
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  /* ── Instagram footer ── */
  function updateFooterInstagram() {
    const el = document.getElementById('footer-instagram');
    if (el) el.textContent = DALIE_CONFIG.instagram;
  }

  /* ── Init principal ── */
  async function init() {
    initTheme();

    const products = await loadProducts();
    if (!products.length) return;

    injectSchema(products);
    DalieFilters.init(products);
    DalieCart.init();
    updateFooterInstagram();

    refresh();
    hideLoader();
    initLazyLoad();

    /* Eventos do modal */
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('btn-modal-add')?.addEventListener('click', modalAddToCart);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModal(); closePicker(); }
    });

    /* Botão voltar ao topo */
    const backBtn = document.getElementById('back-to-top');
    if (backBtn) {
      backBtn.hidden = false;
      window.addEventListener('scroll', () => {
        backBtn.classList.toggle('visible', window.scrollY > 320);
      }, { passive: true });
      backBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  return { init, refresh, toast, addToCart, openModal, closeModal };
})();

/* ── Inicializar quando DOM estiver pronto ── */
document.addEventListener('DOMContentLoaded', DalieApp.init);
