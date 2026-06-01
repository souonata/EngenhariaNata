/* =========================================================
   DALIÉ — CARRINHO DE COMPRAS
   Gerencia estado, desconto automático e UI do drawer
   ========================================================= */

const DalieCart = (function () {

  /* ── Regras de desconto por quantidade ── */
  const DISCOUNT_TIERS = [
    { min: 5, pct: 15 },
    { min: 3, pct: 10 },
    { min: 2, pct: 5  },
  ];

  /* Próximo tier acima do atual */
  function nextTier(totalQty) {
    const tiers = [...DISCOUNT_TIERS].reverse(); // ascendente
    for (const t of tiers) {
      if (totalQty < t.min) return t;
    }
    return null;
  }

  /* Desconto atual */
  function currentDiscount(totalQty) {
    for (const t of DISCOUNT_TIERS) {
      if (totalQty >= t.min) return t.pct;
    }
    return 0;
  }

  /* ── Estado ── */
  let items = [];

  function load() {
    try {
      items = JSON.parse(localStorage.getItem('dalie_cart') || '[]');
    } catch { items = []; }
  }

  function save() {
    localStorage.setItem('dalie_cart', JSON.stringify(items));
  }

  /* ── API pública ── */
  function add(product, tamanho) {
    const existing = items.find(i => i.id === product.id && i.tamanho === tamanho);
    if (existing) {
      existing.qty++;
    } else {
      items.push({
        id:      product.id,
        nome:    product.nome,
        imagem:  product.imagem,
        preco:   product.preco,
        tamanho: tamanho,
        qty:     1,
      });
    }
    save();
    render();
    updateCount();
    showDiscountMessage();
    DalieApp.toast(`✓ ${product.nome} adicionado ao carrinho`);

    /* Recomendações após adicionar */
    DalieRecommendations.show(product);
  }

  function remove(id, tamanho) {
    items = items.filter(i => !(i.id === id && i.tamanho === tamanho));
    save();
    render();
    updateCount();
    showDiscountMessage();
  }

  function changeQty(id, tamanho, delta) {
    const item = items.find(i => i.id === id && i.tamanho === tamanho);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    save();
    render();
    updateCount();
    showDiscountMessage();
  }

  function totalQty() {
    return items.reduce((s, i) => s + i.qty, 0);
  }

  function subtotal() {
    return items.reduce((s, i) => s + i.preco * i.qty, 0);
  }

  function discountAmount() {
    const pct = currentDiscount(totalQty());
    return subtotal() * pct / 100;
  }

  function total() {
    return subtotal() - discountAmount();
  }

  function isEmpty() { return items.length === 0; }

  /* ── Formatar moeda BRL ── */
  function fmt(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /* ── Estrelas HTML ── */
  function stars(r) {
    const full = Math.floor(r);
    const half = r % 1 >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  }

  /* ── Renderizar drawer ── */
  function render() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (isEmpty()) {
      container.innerHTML = `
        <div class="cart-empty" role="status">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <p>Seu carrinho está vazio</p>
        </div>`;
      document.getElementById('cart-footer').style.display = 'none';
      return;
    }

    document.getElementById('cart-footer').style.display = 'flex';

    container.innerHTML = items.map(item => `
      <div class="cart-item" role="article" aria-label="${item.nome}, tamanho ${item.tamanho}">
        <img src="${item.imagem}" alt="${item.nome}" class="cart-item-img" loading="lazy" width="72" height="88">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.nome}</span>
          <span class="cart-item-size">Tamanho: ${item.tamanho}</span>
          <div class="cart-qty">
            <button class="qty-btn" onclick="DalieCart.changeQty(${item.id}, '${item.tamanho}', -1)"
              aria-label="Diminuir quantidade">−</button>
            <span class="qty-num" aria-live="polite">${item.qty}</span>
            <button class="qty-btn" onclick="DalieCart.changeQty(${item.id}, '${item.tamanho}', 1)"
              aria-label="Aumentar quantidade">+</button>
          </div>
          <span class="cart-item-price">${fmt(item.preco * item.qty)}</span>
        </div>
        <button class="cart-item-remove" onclick="DalieCart.remove(${item.id}, '${item.tamanho}')"
          aria-label="Remover ${item.nome}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>`).join('');

    /* Totais */
    const pct = currentDiscount(totalQty());
    document.getElementById('cart-subtotal').textContent = fmt(subtotal());
    document.getElementById('cart-discount-row').style.display = pct > 0 ? 'flex' : 'none';
    document.getElementById('cart-discount-val').textContent = `− ${fmt(discountAmount())} (${pct}%)`;
    document.getElementById('cart-total').textContent = fmt(total());
  }

  /* ── Mensagem de desconto progressivo ── */
  function showDiscountMessage() {
    const el = document.getElementById('cart-discount-msg');
    if (!el) return;
    const qty = totalQty();
    const pct = currentDiscount(qty);
    const next = nextTier(qty);

    if (pct > 0 && !next) {
      el.textContent = `🎉 Parabéns! Você desbloqueou ${pct}% de desconto!`;
      el.classList.add('visible');
    } else if (next) {
      const diff = next.min - qty;
      el.textContent = `Adicione mais ${diff} ${diff === 1 ? 'produto' : 'produtos'} e ganhe ${next.pct}% de desconto!`;
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  }

  /* ── Contagem no ícone ── */
  function updateCount() {
    const el = document.getElementById('cart-count');
    if (!el) return;
    const qty = totalQty();
    el.textContent = qty > 0 ? qty : '';
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 300);
  }

  /* ── Abrir / fechar drawer ── */
  function open() {
    render();
    document.getElementById('cart-drawer').classList.add('open');
    document.getElementById('cart-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('cart-drawer').focus();
  }

  function close() {
    document.getElementById('cart-drawer').classList.remove('open');
    document.getElementById('cart-overlay').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('cart-btn').focus();
  }

  /* ── Checkout via WhatsApp ── */
  function checkout() {
    if (isEmpty()) return;
    const config = window.DALIE_CONFIG || {};
    const number = config.whatsapp || '5511999999999';
    const pct = currentDiscount(totalQty());

    let msg = `Olá! Gostaria de fazer um pedido na *Dalié*:\n\n`;

    items.forEach(item => {
      msg += `• *${item.nome}* (Tam: ${item.tamanho}) × ${item.qty} — ${fmt(item.preco * item.qty)}\n`;
    });

    msg += `\n*Subtotal:* ${fmt(subtotal())}`;
    if (pct > 0) msg += `\n*Desconto (${pct}%):* − ${fmt(discountAmount())}`;
    msg += `\n*Total:* ${fmt(total())}`;
    msg += `\n\nPode confirmar a disponibilidade? 😊`;

    const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  /* ── Init ── */
  function init() {
    load();
    updateCount();
    render();
    showDiscountMessage();

    /* Eventos */
    document.getElementById('cart-btn')?.addEventListener('click', open);
    document.getElementById('cart-close')?.addEventListener('click', close);
    document.getElementById('cart-overlay')?.addEventListener('click', close);
    document.getElementById('btn-checkout')?.addEventListener('click', checkout);
    document.getElementById('btn-continue')?.addEventListener('click', close);

    /* Fechar com Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  return { init, add, remove, changeQty, open, close, isEmpty, fmt, stars };
})();
