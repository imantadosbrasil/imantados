(() => {
  const listEl = document.getElementById('cart-list');
  const emptyEl = document.getElementById('empty-cart');
  const subEl = document.getElementById('sum-subtotal');
  const itemsEl = document.getElementById('sum-items');
  const totalEl = document.getElementById('sum-total');
  const sumShippingEl = document.getElementById('sum-shipping');
  const shippingNoteEl = document.getElementById('shipping-note');
  const cepInput = document.getElementById('cep-input');
  const btnCalcCep = document.getElementById('btn-calc-cep');
  const btnClear = document.getElementById('btn-clear');
  const btnCheckout = document.getElementById('btn-checkout');

  const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let cart = [];
  let shippingInfo = null; // { cep: string, price: number, eta: string }

  // Placeholder para imagens inválidas (ex. blobs antigos revogados)
  const BROKEN_IMG_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 84 84"><rect width="84" height="84" rx="10" fill="%23f1f5f9"/><path d="M20 28h44v28H20z" fill="none" stroke="%2394a3b8" stroke-width="2"/><circle cx="30" cy="38" r="6" fill="none" stroke="%2394a3b8" stroke-width="2"/><path d="M20 56l12-12 8 8 10-10 14 14" fill="none" stroke="%2394a3b8" stroke-width="2"/></svg>';

  function loadCart() {
    try {
      cart = JSON.parse(localStorage.getItem('emojiCart') || '[]');
    } catch {
      cart = [];
    }
    // recuperar frete salvo
    try {
      const raw = localStorage.getItem('shippingInfo');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.cep) shippingInfo = parsed;
      }
    } catch {}
    render();
  }

  function saveCart() {
    localStorage.setItem('emojiCart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  }

  function removeItem(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart();
    render();
  }

  function changeQuantity(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const q = Math.max(1, (item.quantity || 1) + delta);
    item.quantity = q;
    item.total = Number((item.unitPrice || 0) * q);
    saveCart();
    render();
  }

  function setQuantity(id, value) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const q = Math.max(1, Math.min(99, parseInt(value || '1')));
    item.quantity = q;
    item.total = Number((item.unitPrice || 0) * q);
    saveCart();
    render();
  }

  function render() {
    const hasItems = Array.isArray(cart) && cart.length > 0;
    listEl.innerHTML = '';
    emptyEl.hidden = hasItems;

    if (!hasItems) {
      subEl.textContent = formatBRL(0);
      itemsEl.textContent = '0';
      totalEl.textContent = formatBRL(0);
      if (sumShippingEl) sumShippingEl.textContent = '—';
      if (shippingNoteEl) shippingNoteEl.textContent = '';
      return;
    }

    let subtotal = 0;

    cart.forEach((item) => {
      const li = document.createElement('div');
      li.className = 'cart-item';

      const thumb = document.createElement('div');
      thumb.className = 'cart-thumb';
      let thumbUrl = item.url || item.displayUrl;
      if (thumbUrl && typeof thumbUrl === 'string' && thumbUrl.startsWith('blob:')) {
        // Substitui blobs antigos por um placeholder amigável
        thumbUrl = BROKEN_IMG_PLACEHOLDER;
      }
      if (thumbUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.alt = (item.name || 'Item');
        thumb.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'cart-thumb-placeholder';
        placeholder.textContent = 'sem imagem';
        thumb.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'cart-info';
      const title = document.createElement('div');
      title.className = 'cart-title';
      title.textContent = item.name || 'Item';
      const meta = document.createElement('div');
      meta.className = 'cart-meta';
      if (item.size && item.material) {
        meta.textContent = `${item.size} • ${item.material}`;
      } else if (item.sizeCm && item.sizeCm.width && item.sizeCm.height) {
        meta.textContent = `${item.sizeCm.width}×${item.sizeCm.height}cm`;
      } else {
        meta.textContent = '';
      }
      info.append(title, meta);

      const price = document.createElement('div');
      price.className = 'cart-price';
      const unit = document.createElement('div');
      unit.className = 'unit-price';
      unit.textContent = `Unitário: ${formatBRL(item.unitPrice || 0)}`;
      const total = document.createElement('div');
      total.className = 'total-price';
      total.textContent = `Total: ${formatBRL(item.total || (item.unitPrice || 0) * (item.quantity || 1))}`;
      price.append(unit, total);

      const actions = document.createElement('div');
      actions.className = 'cart-actions';
      const minus = document.createElement('button'); minus.className = 'qty-btn'; minus.textContent = '−';
      const qty = document.createElement('input'); qty.className = 'qty-input'; qty.type = 'number'; qty.min = '1'; qty.max = '99'; qty.value = String(item.quantity || 1);
      const plus = document.createElement('button'); plus.className = 'qty-btn'; plus.textContent = '+';
      const remove = document.createElement('button'); remove.className = 'remove-btn'; remove.textContent = 'Remover';
      actions.append(minus, qty, plus, remove);

      minus.addEventListener('click', () => changeQuantity(item.id, -1));
      plus.addEventListener('click', () => changeQuantity(item.id, +1));
      qty.addEventListener('change', () => setQuantity(item.id, qty.value));
      remove.addEventListener('click', () => removeItem(item.id));

      li.append(thumb, info, price, actions);
      listEl.appendChild(li);

      subtotal += Number(item.total || (item.unitPrice || 0) * (item.quantity || 1));
    });

    subEl.textContent = formatBRL(subtotal);
    itemsEl.textContent = String(cart.length);

    // calcular frete se houver CEP
    let shippingValue = 0;
    if (shippingInfo && shippingInfo.cep) {
      const calc = calculateShipping(shippingInfo.cep, subtotal, cart.reduce((acc, i) => acc + (i.quantity || 1), 0));
      shippingInfo = calc;
      shippingValue = calc.price;
      if (sumShippingEl) sumShippingEl.textContent = shippingValue === 0 ? 'Grátis' : formatBRL(shippingValue);
      if (shippingNoteEl) shippingNoteEl.textContent = `Estimativa para CEP ${maskCep(calc.cep)}: ${calc.eta}`;
    } else {
      if (sumShippingEl) sumShippingEl.textContent = '—';
      if (shippingNoteEl) shippingNoteEl.textContent = '';
    }

    totalEl.textContent = formatBRL(subtotal + shippingValue);
  }

  btnClear?.addEventListener('click', () => {
    if (!cart.length) return;
    if (confirm('Deseja limpar o carrinho?')) {
      cart = [];
      saveCart();
      shippingInfo = null;
      localStorage.removeItem('shippingInfo');
      render();
    }
  });

  btnCheckout?.addEventListener('click', () => {
    if (!cart.length) {
      alert('Adicione itens ao carrinho antes de finalizar.');
      return;
    }
    window.location.href = '/endereco.html';
  });

  // CEP input mask and calculation
  cepInput?.addEventListener('input', () => {
    const digits = (cepInput.value || '').replace(/\D/g, '').slice(0, 8);
    cepInput.value = maskCep(digits);
  });

  btnCalcCep?.addEventListener('click', () => {
    const cepDigits = (cepInput?.value || '').replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      alert('Informe um CEP válido com 8 dígitos.');
      return;
    }
    const subtotal = cart.reduce((acc, i) => acc + Number(i.total || (i.unitPrice || 0) * (i.quantity || 1)), 0);
    const itemsCount = cart.reduce((acc, i) => acc + (i.quantity || 1), 0);
    shippingInfo = calculateShipping(cepDigits, subtotal, itemsCount);
    localStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));
    render();
  });


  loadCart();
})();

function maskCep(digits) {
  if (!digits) return '';
  const d = String(digits).replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

function calculateShipping(cepDigits, subtotal, itemsCount) {
  const first = Number(String(cepDigits)[0]);
  let base = 19.9; // Sudeste/Centro-Sul
  let eta = '3–5 dias úteis';
  if (first >= 4 && first <= 6) {
    base = 24.9; // Sul/Centro-Oeste
    eta = '4–8 dias úteis';
  } else if (first >= 7) {
    base = 29.9; // Norte/Nordeste
    eta = '7–14 dias úteis';
  }

  if (subtotal >= 95) {
    base = 0; // frete grátis por valor
  }
  if (itemsCount > 10) {
    base = 0;
  }
  const surcharge = base === 0 ? 0 : Math.max(0, itemsCount - 3) * 1.5;
  const price = Math.max(0, base + surcharge);

  return { cep: cepDigits, price, eta };
}
