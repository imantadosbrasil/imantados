(() => {
  const listEl = document.getElementById('order-list');
  const subtotalEl = document.getElementById('sum-subtotal');
  const shippingEl = document.getElementById('sum-shipping');
  const totalEl = document.getElementById('sum-total');
  const formEl = document.getElementById('checkout-form');
  const msgEl = document.getElementById('order-msg');

  const formatBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  let MP_PUBLIC_KEY = window.MP_PUBLIC_KEY || '';
  let mp = null;
  async function initMP(){
    try {
      if (!MP_PUBLIC_KEY) {
        const r = await fetch('/api/mp-config');
        const j = await r.json();
        MP_PUBLIC_KEY = j.public_key || 'TEST-fa34b6f1-e0c0-4c60-b0e8-249c52a3c616';
      }
      if (window.MercadoPago) { mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' }); window.mp = mp; }
    } catch {
      if (window.MercadoPago) { mp = new window.MercadoPago(MP_PUBLIC_KEY || 'TEST-fa34b6f1-e0c0-4c60-b0e8-249c52a3c616', { locale: 'pt-BR' }); window.mp = mp; }
    }
  }
  initMP();

  const mpBrickEl = document.getElementById('mp-payment-brick');
  let paymentBrickController = null;

  const hidePaymentBrick = () => {
    if (mpBrickEl) mpBrickEl.style.display = 'none';
    try {
      const bricks = mp && typeof mp.bricks === 'function' ? mp.bricks() : null;
      if (bricks && paymentBrickController) { bricks.unmount(paymentBrickController); paymentBrickController = null; }
    } catch {}
  };

  const showPaymentBrick = async (order) => {
    await initMP();
    const bricks = mp && typeof mp.bricks === 'function' ? mp.bricks() : null;
    if (!bricks || !mpBrickEl) return false;
    mpBrickEl.style.display = 'block';
    const initialization = { amount: Number(order.total || 0) };
    let pref = null;
    try { pref = JSON.parse(localStorage.getItem('paymentSelection')||'null'); } catch {}
    const onlyPix = !!pref && pref.method === 'pix';
    const customization = {
      paymentMethods: {
        ticket: onlyPix ? 'none' : 'all',
        bankTransfer: 'all',
        creditCard: onlyPix ? 'none' : 'all',
        prepaidCard: onlyPix ? 'none' : 'all',
        debitCard: onlyPix ? 'none' : 'all',
        mercadoPago: onlyPix ? 'none' : 'all'
      }
    };
    const callbacks = {
      onSubmit: async ({ selectedPaymentMethod, formData }) => {
        return new Promise(async (resolve, reject) => {
          try {
            const res = await fetch('/api/mp-process-payment', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formData, order })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              resolve();
              if (selectedPaymentMethod === 'pix') {
                if (msgEl) { msgEl.textContent = 'Pagamento Pix iniciado. Siga as instruções na tela.'; msgEl.style.color = '#374151'; }
                return;
              }
              window.location.href = '/confirmacao.html';
            } else {
              reject(data);
            }
          } catch (error) { reject(error); }
        });
      },
      onError: async (error) => { try { console.error(error); } catch {} },
      onReady: async () => {}
    };
    try {
      paymentBrickController = await bricks.create('payment', 'mp-payment-brick', { initialization, customization, callbacks });
      return true;
    } catch (e) {
      try { console.error('Falha ao montar Brick:', e); } catch {}
      hidePaymentBrick();
      return false;
    }
  };

  let cart = [];
  let shippingInfo = null;
  try { cart = JSON.parse(localStorage.getItem('emojiCart') || '[]'); } catch {}
  try { shippingInfo = JSON.parse(localStorage.getItem('shippingInfo') || 'null'); } catch {}
  let savedAddress = null;
  try { savedAddress = JSON.parse(localStorage.getItem('enderecoEntrega') || 'null'); } catch {}

  const render = () => {
    if (!cart || cart.length === 0) {
      listEl.innerHTML = '<li class="empty">Seu carrinho está vazio. <a href="index.html">Voltar à loja</a></li>';
      subtotalEl.textContent = formatBRL(0);
      shippingEl.textContent = formatBRL(0);
      totalEl.textContent = formatBRL(0);
      return;
    }
    listEl.innerHTML = '';
    let subtotal = 0;
    for (const item of cart) {
      const li = document.createElement('li');
      li.className = 'cart-item';
      const thumb = document.createElement('img');
      thumb.src = item.url || item.imageUrl || 'assets/botao.png';
      thumb.alt = item.name || 'Item';
      thumb.width = 64; thumb.height = 64; thumb.loading = 'lazy';

      const info = document.createElement('div');
      info.className = 'cart-info';
      const title = document.createElement('h3');
      title.textContent = item.name || 'Ímã personalizado';
      const qty = document.createElement('p');
      qty.textContent = `Qtd: ${item.quantity || 1}`;
      info.append(title, qty);

      const price = document.createElement('div');
      price.className = 'cart-price';
      const unit = document.createElement('div');
      unit.className = 'unit-price';
      unit.textContent = `Unitário: ${formatBRL(item.unitPrice || 0)}`;
      const total = document.createElement('div');
      total.className = 'total-price';
      const tt = Number(item.total || (item.unitPrice || 0) * (item.quantity || 1));
      total.textContent = `Total: ${formatBRL(tt)}`;
      price.append(unit, total);

      li.append(thumb, info, price);
      listEl.appendChild(li);
      subtotal += tt;
    }
    const frete = shippingInfo?.price || 0;
    subtotalEl.textContent = formatBRL(subtotal);
    shippingEl.textContent = formatBRL(frete);
    totalEl.textContent = formatBRL(subtotal + frete);
  };

  render();

  (function prefillFromSaved(){
    if (!savedAddress) return;
    const num = savedAddress.semNumero ? 'S/N' : (savedAddress.numero || '');
    if (cepInput && savedAddress.cep) { cepInput.value = String(savedAddress.cep); }
    if (addressInput && savedAddress.rua) { addressInput.value = savedAddress.rua; }
    const numberInput = document.getElementById('cust-number'); if (numberInput && (num || savedAddress.semNumero)) { numberInput.value = num; }
    const compInput = document.getElementById('cust-complement'); if (compInput && savedAddress.complemento) { compInput.value = savedAddress.complemento; }
    if (bairroInput && savedAddress.bairro) { bairroInput.value = savedAddress.bairro; }
    if (cityInput && savedAddress.cidade) { cityInput.value = savedAddress.cidade; }
    if (stateInput && savedAddress.estado) { stateInput.value = String(savedAddress.estado).toUpperCase(); }
    const nameInput = document.getElementById('cust-name'); if (nameInput && savedAddress.nome) { nameInput.value = savedAddress.nome; }
    const phoneInput = document.getElementById('cust-phone'); if (phoneInput && savedAddress.telefone) { phoneInput.value = savedAddress.telefone; }
  })();

  // Auto-preenchimento de endereço pelo CEP (ViaCEP)
  const cepInput = document.getElementById('cust-cep');
  const addressInput = document.getElementById('cust-address');
  const cepMsgEl = document.getElementById('cep-msg');
  const bairroInput = document.getElementById('cust-bairro');
  const cityInput = document.getElementById('cust-city');
  const stateInput = document.getElementById('cust-state');
  const countrySelect = document.getElementById('cust-country');

  // Pagamentos: cartões e modal
  const cardBox = document.getElementById('card-box');
  const cardListEl = document.getElementById('card-list');
  const addCardBtn = document.getElementById('btn-add-card');
  const cardModal = document.getElementById('card-modal');
  const cardForm = document.getElementById('card-form');
  const cardCloseBtn = document.getElementById('card-close');
  const cardCancelBtn = document.getElementById('card-cancel');
  const cardSelectedEl = document.getElementById('card-selected');

  const digitsOnly = (s) => (s || '').replace(/\D/g, '');
  const formatCepMask = (d) => d.length > 5 ? `${d.slice(0,5)}-${d.slice(5,8)}` : d;

  // ====== Cards storage ======
  const getCards = () => { try { return JSON.parse(localStorage.getItem('savedCards') || '[]'); } catch { return []; } };
  const setCards = (cards) => { try { localStorage.setItem('savedCards', JSON.stringify(cards)); } catch {} };

  const detectBrand = (num) => {
    const d = digitsOnly(num);
    if (/^4/.test(d)) return 'Visa';
    if (/^(?:5[1-5]|2(?:2[2-9]|[3-6][0-9]|7[01]|720))/.test(d)) return 'Mastercard';
    if (/^(4011|431274|438935|451416|4576(?:31|32)|504175|627780|636297|636369)/.test(d)) return 'Elo';
    return 'Cartão';
  };

  const brandClass = (b) => ({ Visa: 'visa', Mastercard: 'mastercard', Elo: 'elo' }[b] || 'card');

  const renderCards = () => {
    if (!cardListEl) return;
    const cards = getCards();
    cardListEl.innerHTML = '';
    if (!cards.length) {
      const li = document.createElement('li');
      li.className = 'card-item';
      li.innerHTML = '<span class="card-meta">Nenhum cartão cadastrado.</span>';
      cardListEl.appendChild(li);
      updateSelectedCardSummary();
      return;
    }
    for (const c of cards) {
      const li = document.createElement('li');
      li.className = 'card-item';
      const radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'card'; radio.value = c.id;
      const brand = document.createElement('span');
      brand.className = `card-brand ${brandClass(c.brand)}`;
      const meta = document.createElement('div');
      meta.className = 'card-meta';
      meta.textContent = `(${c.brand}) ${c.holder} •••• ${c.last4}  ${c.expMonth}/${c.expYear}`;
      li.append(radio, brand, meta);
      cardListEl.appendChild(li);
      radio.addEventListener('change', updateSelectedCardSummary);
    }
    updateSelectedCardSummary();
  };

  const updateSelectedCardSummary = () => {
    if (!cardSelectedEl) return;
    const cardId = formEl.querySelector('input[name="card"]:checked')?.value || '';
    const cards = getCards();
    const c = cards.find(x => x.id === cardId);
    if (!c) { cardSelectedEl.style.display = 'none'; cardSelectedEl.innerHTML = ''; return; }
    cardSelectedEl.style.display = 'flex';
    cardSelectedEl.innerHTML = `
      <span class="card-brand ${brandClass(c.brand)}"></span>
      <div>
        <div class="card-meta">(${c.brand}) ${c.holder} •••• ${c.last4}</div>
        <small class="card-note">Vencimento: ${c.expMonth}/${c.expYear}</small>
      </div>
    `;
  };

  const toggleCardBox = () => {
    const pay = (formEl.querySelector('input[name="pay"]:checked')?.value) || 'pix';
    if (cardBox) cardBox.style.display = pay === 'cartao' ? 'block' : 'none';
  };

  const initPayOptions = () => {
    const payRadios = formEl.querySelectorAll('input[name="pay"]');
    const providerRadios = formEl.querySelectorAll('input[name="provider"]');
    payRadios.forEach(r => r.addEventListener('change', () => { hidePaymentBrick(); toggleCardBox(); }));
    providerRadios.forEach(r => r.addEventListener('change', () => { hidePaymentBrick(); toggleCardBox(); }));
    toggleCardBox();
  };

  const openCardModal = () => {
    if (!cardModal) return;
    // Abrir somente no contexto de cadastro de cartão,
    // garantindo que o método de pagamento seja "cartao"
    const payCardRadio = formEl.querySelector('input[name="pay"][value="cartao"]');
    if (payCardRadio) { payCardRadio.checked = true; }
    toggleCardBox();
    cardModal.hidden = false;
    cardModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };
  const closeCardModal = () => {
    if (!cardModal) return;
    cardModal.hidden = true;
    cardModal.style.display = 'none';
    document.body.style.overflow = '';
  };

  addCardBtn?.addEventListener('click', openCardModal);
  cardCloseBtn?.addEventListener('click', closeCardModal);
  cardCancelBtn?.addEventListener('click', closeCardModal);
  // Fechar clicando fora
  cardModal?.addEventListener('click', (e) => { if (e.target === cardModal) closeCardModal(); });
  // Fechar com Esc
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cardModal?.hidden) closeCardModal(); });

  // Populate years select
  (function fillYears(){
    const ySel = document.getElementById('card-year');
    if (!ySel) return;
    const y = new Date().getFullYear();
    for (let i = 0; i < 15; i++) {
      const opt = document.createElement('option');
      opt.value = String(y + i);
      opt.textContent = String(y + i);
      ySel.appendChild(opt);
    }
  })();

  cardForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const number = document.getElementById('card-number')?.value || '';
    const holder = document.getElementById('card-name')?.value?.trim() || '';
    const expMonth = document.getElementById('card-month')?.value || '';
    const expYear = document.getElementById('card-year')?.value || '';
    const brandSel = document.getElementById('card-brand')?.value || 'auto';
    const vv = digitsOnly(number);
    if (vv.length < 12 || !holder || !expMonth || !expYear) { if (msgEl) { msgEl.textContent = 'Preencha número, nome e validade do cartão.'; msgEl.style.color = '#dc2626'; } return; }
    const brand = brandSel === 'auto' ? detectBrand(vv) : brandSel;
    const card = {
      id: 'CARD' + Date.now().toString(36),
      brand,
      holder,
      last4: vv.slice(-4),
      expMonth,
      expYear
    };
    const cards = getCards(); cards.push(card); setCards(cards);
    closeCardModal();
    // Garantir que método seja cartão e exibir box
    const payCardRadio = formEl.querySelector('input[name="pay"][value="cartao"]');
    if (payCardRadio) { payCardRadio.checked = true; }
    toggleCardBox();
    renderCards();
    // Seleciona o recém adicionado
    const r = cardListEl.querySelector(`input[name="card"][value="${card.id}"]`); r?.click();
    updateSelectedCardSummary();
    // Focar a área de pagamento
    cardBox?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  async function fillAddressByCep() {
    const raw = cepInput?.value || '';
    const d = digitsOnly(raw).slice(0, 8);
    if (cepInput) cepInput.value = formatCepMask(d);
    if (d.length !== 8) {
      if (cepMsgEl) cepMsgEl.textContent = 'CEP deve ter 8 dígitos.';
      return;
    }
    try {
      if (addressInput) addressInput.disabled = true;
      if (cepMsgEl) cepMsgEl.textContent = 'Buscando endereço pelo CEP...';
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (data?.erro) {
        if (cepMsgEl) cepMsgEl.textContent = 'CEP não encontrado. Preencha o endereço manualmente.';
        if (addressInput) addressInput.disabled = false;
        return;
      }
      const composed = [data.logradouro, data.bairro, `${data.localidade}/${data.uf}`].filter(Boolean).join(', ');
      if (addressInput) {
        addressInput.value = composed;
        addressInput.disabled = false;
      }
      if (bairroInput) bairroInput.value = data.bairro || '';
      if (cityInput) cityInput.value = data.localidade || '';
      if (stateInput) stateInput.value = (data.uf || '').toUpperCase();
      if (cepMsgEl) cepMsgEl.textContent = 'Endereço preenchido. Confira número e complemento.';
    } catch (e) {
      if (cepMsgEl) cepMsgEl.textContent = 'Não foi possível buscar o CEP. Preencha manualmente.';
      if (addressInput) addressInput.disabled = false;
    }
  }

  cepInput?.addEventListener('input', () => {
    const d = digitsOnly(cepInput.value);
    cepInput.value = formatCepMask(d);
    if (d.length >= 8) { fillAddressByCep(); }
  });
  cepInput?.addEventListener('blur', fillAddressByCep);

  // Inicializa pagamentos
  initPayOptions();
  (function preselectFromPayment(){
    let sel = null;
    try { sel = JSON.parse(localStorage.getItem('paymentSelection')||'null'); } catch {}
    if (!sel) return;
    const payRadio = formEl.querySelector(`input[name="pay"][value="${sel.method}"]`);
    const provRadio = formEl.querySelector(`input[name="provider"][value="${sel.provider}"]`);
    if (payRadio) payRadio.checked = true;
    if (provRadio) provRadio.checked = true;
    hidePaymentBrick();
    toggleCardBox();
  })();
  renderCards();

  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cust-name')?.value?.trim();
    const email = document.getElementById('cust-email')?.value?.trim();
    const phone = document.getElementById('cust-phone')?.value?.trim();
    const cep = document.getElementById('cust-cep')?.value?.trim();
    const address = document.getElementById('cust-address')?.value?.trim();
    const number = document.getElementById('cust-number')?.value?.trim();
    const complement = document.getElementById('cust-complement')?.value?.trim();
    const bairro = document.getElementById('cust-bairro')?.value?.trim();
    const city = document.getElementById('cust-city')?.value?.trim();
    const state = document.getElementById('cust-state')?.value?.trim();
    const country = countrySelect?.value || 'Brasil';
    const addrDefault = document.getElementById('addr-default')?.checked || false;
    const pay = (formEl.querySelector('input[name="pay"]:checked')?.value) || 'pix';
    const provider = (formEl.querySelector('input[name="provider"]:checked')?.value) || 'mercado';

    let payment = { method: pay, status: 'pending' };

    if (!name || !email || !address || !number || !city || !state) {
      if (savedAddress) {
        const nameFallback = name || savedAddress.nome || '';
        const addrFallback = address || savedAddress.rua || '';
        const numberFallback = number || (savedAddress.semNumero ? 'S/N' : (savedAddress.numero || ''));
        const bairroFallback = bairro || savedAddress.bairro || '';
        const cityFallback = city || savedAddress.cidade || '';
        const stateFallback = state || String(savedAddress.estado || '');
        const cepFallback = cep || savedAddress.cep || '';
        if (nameFallback && email && addrFallback && numberFallback && cityFallback && stateFallback) {
          const subtotal = cart.reduce((acc, i) => acc + Number(i.total || (i.unitPrice || 0) * (i.quantity || 1)), 0);
          const frete = shippingInfo?.price || 0;
          const fullAddress = [
            `${addrFallback}${numberFallback ? ', ' + numberFallback : ''}${complement ? ' - ' + complement : ''}`,
            `${bairroFallback || ''}`,
            `${cityFallback || ''}/${(stateFallback || '').toUpperCase()}`
          ].filter(Boolean).join(', ');
          const order = {
            id: 'IM' + Date.now().toString(36).toUpperCase(),
            items: cart,
            subtotal,
            shipping: shippingInfo || { price: 0, cep: cepFallback ? String(cepFallback).replace(/\D/g,'') : null },
            total: subtotal + frete,
            customer: {
              name: nameFallback, email, phone,
              country, cep: cepFallback,
              address: addrFallback, number: numberFallback, complement,
              bairro: bairroFallback, city: cityFallback, state: stateFallback,
              fullAddress,
              default: addrDefault
            },
            payment,
            createdAt: new Date().toISOString(),
          };
          try { localStorage.setItem('lastOrder', JSON.stringify(order)); } catch {}
          try { localStorage.removeItem('emojiCart'); } catch {}
          if (provider === 'mercado') {
            if (pay === 'pix') { window.location.href = '/pix.html'; return; }
            try {
              const brickMounted = await showPaymentBrick(order);
              if (brickMounted) { msgEl.textContent = 'Finalize o pagamento no Mercado Pago.'; msgEl.style.color = '#374151'; return; }
              const res = await fetch('/api/mp-create-preference', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
              });
              if (res.ok) {
                const data = await res.json();
                const url = data.init_point || data.sandbox_init_point || data.href;
                if (url) { window.location.href = url; return; }
              }
            } catch (err) {}
          }
          window.location.href = '/confirmacao.html';
          return;
        }
      }
      msgEl.textContent = 'Preencha nome, e-mail, endereço, número, cidade e estado.';
      msgEl.style.color = '#dc2626';
      return;
    }

    const subtotal = cart.reduce((acc, i) => acc + Number(i.total || (i.unitPrice || 0) * (i.quantity || 1)), 0);
    const frete = shippingInfo?.price || 0;

    const fullAddress = [
      `${address}${number ? ', ' + number : ''}${complement ? ' - ' + complement : ''}`,
      `${bairro || ''}`,
      `${city || ''}/${(state || '').toUpperCase()}`
    ].filter(Boolean).join(', ');

    const order = {
      id: 'IM' + Date.now().toString(36).toUpperCase(),
      items: cart,
      subtotal,
      shipping: shippingInfo || { price: 0, cep: cep || null },
      total: subtotal + frete,
      customer: {
        name, email, phone,
        country, cep,
        address, number, complement,
        bairro, city, state,
        fullAddress,
        default: addrDefault
      },
      payment,
      createdAt: new Date().toISOString(),
    };
    try { localStorage.setItem('lastOrder', JSON.stringify(order)); } catch {}
    try { localStorage.removeItem('emojiCart'); } catch {}

    // Integrações de pagamento (Firebase Functions via Hosting rewrites)
    // Mercado Pago – Pix redireciona para página dedicada; caso contrário Brick/Checkout Pro
    if (provider === 'mercado') {
      if (pay === 'pix') { window.location.href = '/pix.html'; return; }
      try {
        const brickMounted = await showPaymentBrick(order);
        if (brickMounted) { msgEl.textContent = 'Finalize o pagamento no Mercado Pago.'; msgEl.style.color = '#374151'; return; }
        const res = await fetch('/api/mp-create-preference', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order)
        });
        if (res.ok) {
          const data = await res.json();
          const url = data.init_point || data.sandbox_init_point || data.href;
          if (url) { window.location.href = url; return; }
        }
      } catch (err) { /* fallback abaixo */ }
    }

    // Fallback: sem backend/config, mostrar confirmação local
    window.location.href = '/confirmacao.html';
  });
})();
