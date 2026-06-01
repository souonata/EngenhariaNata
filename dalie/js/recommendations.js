/* =========================================================
   DALIÉ — RECOMENDAÇÕES
   Exibe "Clientes também compraram" após adicionar ao carrinho
   ========================================================= */

const DalieRecommendations = (function () {

  /* Pontuação de similaridade entre dois produtos */
  function score(a, b) {
    if (a.id === b.id) return -1; // nunca recomendar o mesmo
    let s = 0;
    if (a.categoria === b.categoria) s += 3;
    if (a.sexo === b.sexo || b.sexo === 'Unissex' || a.sexo === 'Unissex') s += 2;
    const estCommon = a.estacao.filter(e => b.estacao.includes(e)).length;
    s += estCommon;
    if (a.tags.some(t => b.tags.includes(t))) s += 1;
    return s;
  }

  /* Encontra os N produtos mais relacionados */
  function findRelated(product, allProducts, n = 4) {
    return allProducts
      .map(p => ({ product: p, score: score(product, p) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(x => x.product);
  }

  /* Renderiza um mini-card de recomendação */
  function renderCard(p) {
    const discount = p.precoAntigo
      ? Math.round((1 - p.preco / p.precoAntigo) * 100)
      : null;

    return `
      <article class="product-card" data-id="${p.id}" style="animation-delay:0s">
        <div class="card-img-wrap">
          <img src="${p.imagem}" alt="${p.nome}" class="card-img" loading="lazy" width="400" height="520">
          ${discount ? `<div class="card-badges"><span class="badge badge-sale">−${discount}%</span></div>` : ''}
          <div class="card-quick-actions">
            <button class="btn-quick btn-view-quick" onclick="DalieApp.openModal(${p.id})" aria-label="Ver detalhes de ${p.nome}">
              Ver detalhes
            </button>
          </div>
        </div>
        <div class="card-body">
          <span class="card-category">${p.categoria}</span>
          <h3 class="card-name">${p.nome}</h3>
          <div class="card-price">
            <span class="price-current${p.precoAntigo ? ' sale' : ''}">${DalieCart.fmt(p.preco)}</span>
            ${p.precoAntigo ? `<span class="price-old">${DalieCart.fmt(p.precoAntigo)}</span>` : ''}
          </div>
          <button class="btn-card-add" onclick="DalieApp.addToCart(${p.id}, event)" aria-label="Adicionar ${p.nome} ao carrinho">
            Adicionar ao carrinho
          </button>
        </div>
      </article>`;
  }

  /* Exibe a seção de recomendações */
  function show(triggerProduct) {
    const section = document.getElementById('recommendations');
    const grid = document.getElementById('rec-grid');
    const allProducts = window.DALIE_PRODUCTS || [];
    if (!section || !grid || !allProducts.length) return;

    const related = findRelated(triggerProduct, allProducts, 4);
    if (!related.length) return;

    grid.innerHTML = related.map(renderCard).join('');
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hide() {
    const section = document.getElementById('recommendations');
    if (section) section.style.display = 'none';
  }

  return { show, hide };
})();
