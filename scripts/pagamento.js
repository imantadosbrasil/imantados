(() => {
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let cart = [];
  let shipping = null;
  try { cart = JSON.parse(localStorage.getItem('emojiCart') || '[]'); } catch {}
  try { shipping = JSON.parse(localStorage.getItem('shippingInfo') || 'null'); } catch {}
  const subtotal = cart.reduce((s,i)=> s + Number(i.total || (i.unitPrice||0) * (i.quantity||1)), 0);
  const frete = Number(shipping?.price || 0);
  const sumProducts = document.getElementById('sum-products');
  const sumFrete = document.getElementById('sum-frete');
  const sumTotal = document.getElementById('sum-total');
  const btn = document.getElementById('btn-continue');
  const couponLink = document.getElementById('coupon-link');
  const couponBox = document.getElementById('coupon-box');
  const couponInput = document.getElementById('coupon-input');
  const couponApply = document.getElementById('coupon-apply');
  if (sumProducts) sumProducts.textContent = fmt(subtotal);
  if (sumFrete) {
    const v = frete === 0 ? 'Grátis' : fmt(frete);
    sumFrete.textContent = v;
    if (frete === 0) sumFrete.style.color = '#16a34a';
  }
  if (sumTotal) sumTotal.textContent = fmt(subtotal + frete);
  const defaultOpt = document.querySelector('input[name="payopt"][value="pix_mercado"]');
  defaultOpt && (defaultOpt.checked = true);
  btn?.addEventListener('click', function(){
    const selected = document.querySelector('input[name="payopt"]:checked')?.value || '';
    let provider = 'mercado';
    let method = 'pix';
    if (selected === 'pix_mercado') { provider = 'mercado'; method = 'pix'; }
    else if (selected === 'card_mercado') { provider = 'mercado'; method = 'cartao'; }
    else if (selected === 'boleto_mercado') { provider = 'mercado'; method = 'boleto'; }
    else if (selected === 'applepay_stripe') { provider = 'stripe'; method = 'cartao'; }
    else if (selected === 'googlepay_stripe') { provider = 'stripe'; method = 'cartao'; }
    const selection = { provider, method };
    try { localStorage.setItem('paymentSelection', JSON.stringify(selection)); } catch {}
    if (provider === 'mercado' && method === 'pix') {
      let endereco = null;
      try { endereco = JSON.parse(localStorage.getItem('enderecoEntrega') || 'null'); } catch {}
      const nameFallback = endereco?.nome || '';
      const emailFallback = (endereco?.email || localStorage.getItem('custEmail') || '').toString();
      const addrFallback = endereco?.rua || '';
      const numberFallback = endereco?.semNumero ? 'S/N' : (endereco?.numero || '');
      const compFallback = endereco?.complemento || '';
      const bairroFallback = endereco?.bairro || '';
      const cityFallback = endereco?.cidade || '';
      const stateFallback = (endereco?.estado || '').toString();
      const cepFallback = (endereco?.cep || '').toString();
      const fullAddress = [
        `${addrFallback}${numberFallback ? ', ' + numberFallback : ''}${compFallback ? ' - ' + compFallback : ''}`,
        `${bairroFallback}`,
        `${cityFallback}/${(stateFallback || '').toUpperCase()}`
      ].filter(Boolean).join(', ');
      const order = {
        id: 'IM' + Date.now().toString(36).toUpperCase(),
        items: cart,
        subtotal,
        shipping: shipping || { price: 0, cep: cepFallback ? cepFallback.replace(/\D/g,'') : null },
        total: subtotal + frete,
        customer: {
          name: nameFallback, email: emailFallback, phone: endereco?.telefone || '',
          country: 'BR', cep: cepFallback,
          address: addrFallback, number: numberFallback, complement: compFallback,
          bairro: bairroFallback, city: cityFallback, state: stateFallback,
          fullAddress,
          default: true
        },
        payment: { provider: 'mercado', method: 'pix' },
        createdAt: new Date().toISOString(),
      };
      try { localStorage.setItem('lastOrder', JSON.stringify(order)); } catch {}
      window.location.href = '/pix-pagar.html';
      return;
    }
    if (provider === 'mercado' && method === 'cartao') {
      window.location.href = '/cartao-novo.html';
      return;
    }
    window.location.href = '/checkout.html';
  });

  couponLink?.addEventListener('click', function(){
    if (!couponBox) return;
    couponBox.style.display = couponBox.style.display === 'none' ? 'flex' : 'none';
  });
  couponApply?.addEventListener('click', function(){
    const code = (couponInput?.value || '').trim();
    try { localStorage.setItem('couponCode', code); } catch {}
    alert(code ? 'Cupom salvo.' : 'Informe um código.');
  });
  const cardNumberEl = document.getElementById('card-number');
  const cardHolderEl = document.getElementById('card-holder');
  const cardExpiryEl = document.getElementById('card-expiry');
  const cardCvvEl = document.getElementById('card-cvv');
  const docTypeEl = document.getElementById('doc-type');
  const docNumberEl = document.getElementById('doc-number');
  const btnCardContinue = document.getElementById('btn-card-continue');
  const btnCardSave = document.getElementById('btn-card-save');
  const errNumberEl = document.getElementById('err-card-number');
  const errHolderEl = document.getElementById('err-holder');
  const errExpiryEl = document.getElementById('err-expiry');
  const errCvvEl = document.getElementById('err-cvv');
  const errDocEl = document.getElementById('err-doc');

  const digitsOnly = (s) => (s || '').replace(/\D/g, '');
  const detectBrand = (num) => {
    const d = digitsOnly(num);
    if (/^4/.test(d)) return 'Visa';
    if (/^(?:5[1-5]|2(?:2[2-9]|[3-6][0-9]|7[01]|720))/.test(d)) return 'Mastercard';
    if (/^(4011|431274|438935|451416|4576(?:31|32)|504175|627780|636297|636369)/.test(d)) return 'Elo';
    return 'Cartão';
  };
  const formatCardNumber = (v) => {
    const d = digitsOnly(v).slice(0,19);
    return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };
  const formatExpiry = (v) => {
    const d = digitsOnly(v).slice(0,4);
    const mm = d.slice(0,2);
    const yy = d.slice(2,4);
    return yy ? mm + '/' + yy : mm;
  };
  const formatCPF = (v) => {
    const d = digitsOnly(v).slice(0,11);
    const p1 = d.slice(0,3);
    const p2 = d.slice(3,6);
    const p3 = d.slice(6,9);
    const p4 = d.slice(9,11);
    let out = p1; if (p2) out += '.' + p2; if (p3) out += '.' + p3; if (p4) out += '-' + p4; return out;
  };
  const formatCNPJ = (v) => {
    const d = digitsOnly(v).slice(0,14);
    const p1 = d.slice(0,2);
    const p2 = d.slice(2,5);
    const p3 = d.slice(5,8);
    const p4 = d.slice(8,12);
    const p5 = d.slice(12,14);
    let out = p1; if (p2) out += '.' + p2; if (p3) out += '.' + p3; if (p4) out += '/' + p4; if (p5) out += '-' + p5; return out;
  };

  function setInvalid(el, errEl) {
    if (el) el.style.borderColor = '#dc2626';
    if (errEl) errEl.style.display = 'block';
  }
  function clearInvalid(el, errEl) {
    if (el) el.style.borderColor = '#e5e7eb';
    if (errEl) errEl.style.display = 'none';
  }
  function validateCardForm() {
    let ok = true;
    const num = digitsOnly(cardNumberEl?.value || '');
    const holder = (cardHolderEl?.value || '').trim();
    const exp = cardExpiryEl?.value || '';
    const cvv = digitsOnly(cardCvvEl?.value || '');
    const docType = docTypeEl?.value || 'CPF';
    const docRaw = digitsOnly(docNumberEl?.value || '');
    clearInvalid(cardNumberEl, errNumberEl);
    clearInvalid(cardHolderEl, errHolderEl);
    clearInvalid(cardExpiryEl, errExpiryEl);
    clearInvalid(cardCvvEl, errCvvEl);
    clearInvalid(docNumberEl, errDocEl);
    if (!num || num.length < 13) { setInvalid(cardNumberEl, errNumberEl); ok = false; }
    if (!holder || holder.length < 3) { setInvalid(cardHolderEl, errHolderEl); ok = false; }
    const parts = String(exp).split('/');
    const mm = Number(parts[0] || 0); const yy = Number(parts[1] || 0);
    if (!(mm >= 1 && mm <= 12 && parts[1] && parts[1].length === 2)) { setInvalid(cardExpiryEl, errExpiryEl); ok = false; }
    if (!cvv || (cvv.length !== 3 && cvv.length !== 4)) { setInvalid(cardCvvEl, errCvvEl); ok = false; }
    if (docType === 'CPF' && docRaw.length !== 11) { setInvalid(docNumberEl, errDocEl); ok = false; }
    if (docType === 'CNPJ' && docRaw.length !== 14) { setInvalid(docNumberEl, errDocEl); ok = false; }
    if (docType === 'Passaporte' && docRaw.length < 5) { setInvalid(docNumberEl, errDocEl); ok = false; }
    return ok;
  }
  function saveCard() {
    const card = {
      number: digitsOnly(cardNumberEl?.value || ''),
      numberMasked: formatCardNumber(cardNumberEl?.value || ''),
      holder: (cardHolderEl?.value || '').trim(),
      expiry: formatExpiry(cardExpiryEl?.value || ''),
      docType: docTypeEl?.value || 'CPF',
      docNumber: digitsOnly(docNumberEl?.value || '')
    };
    try { localStorage.setItem('newCard', JSON.stringify(card)); } catch {}
  }

  cardNumberEl?.addEventListener('input', function(){ this.value = formatCardNumber(this.value); });
  cardExpiryEl?.addEventListener('input', function(){ this.value = formatExpiry(this.value); });
  docTypeEl?.addEventListener('change', function(){ if (!docNumberEl) return; docNumberEl.value = ''; docNumberEl.placeholder = this.value === 'CPF' ? '000.000.000-00' : this.value === 'CNPJ' ? '00.000.000/0000-00' : 'Número do documento'; });
  docNumberEl?.addEventListener('input', function(){ const t = docTypeEl?.value || 'CPF'; if (t === 'CPF') { this.value = formatCPF(this.value); } else if (t === 'CNPJ') { this.value = formatCNPJ(this.value); } });

  (function prefillIfExists(){
    let c = null; try { c = JSON.parse(localStorage.getItem('newCard') || 'null'); } catch {}
    if (!c) return;
    if (cardNumberEl && c.numberMasked) cardNumberEl.value = c.numberMasked;
    if (cardHolderEl && c.holder) cardHolderEl.value = c.holder;
    if (cardExpiryEl && c.expiry) cardExpiryEl.value = c.expiry;
    if (docTypeEl && c.docType) docTypeEl.value = c.docType;
    if (docNumberEl && c.docNumber) {
      const t = c.docType || 'CPF';
      docNumberEl.value = t === 'CPF' ? formatCPF(c.docNumber) : t === 'CNPJ' ? formatCNPJ(c.docNumber) : c.docNumber;
    }
  })();
  const pvBrand = document.getElementById('pv-brand');
  const pvNumber = document.getElementById('pv-number');
  const pvHolder = document.getElementById('pv-holder');
  const pvExp = document.getElementById('pv-exp');
  function updatePreview(){
    const numMasked = formatCardNumber(cardNumberEl?.value || '');
    const brand = detectBrand(cardNumberEl?.value || '');
    const holder = (cardHolderEl?.value || '').trim() || '—';
    const exp = formatExpiry(cardExpiryEl?.value || '') || 'MM/AA';
    if (pvBrand) pvBrand.textContent = brand;
    if (pvNumber) pvNumber.textContent = numMasked || '•••• •••• •••• ••••';
    if (pvHolder) pvHolder.textContent = holder;
    if (pvExp) pvExp.textContent = exp;
  }
  cardNumberEl?.addEventListener('input', updatePreview);
  cardHolderEl?.addEventListener('input', updatePreview);
  cardExpiryEl?.addEventListener('input', updatePreview);
  updatePreview();

  btnCardContinue?.addEventListener('click', function(){
    if (!validateCardForm()) return;
    saveCard();
    try { sessionStorage.setItem('newCardCvv', digitsOnly(cardCvvEl?.value || '')); } catch {}
    window.location.href = '/cartao-parcelas.html';
  });
  btnCardSave?.addEventListener('click', function(){
    if (!validateCardForm()) return;
    saveCard();
    try { sessionStorage.setItem('newCardCvv', digitsOnly(cardCvvEl?.value || '')); } catch {}
    window.location.href = '/cartao-parcelas.html';
  });
})();
