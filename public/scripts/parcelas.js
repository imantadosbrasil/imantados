(() => {
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const digitsOnly = (s) => (s || '').replace(/\D/g, '');
  const detectBrand = (num) => {
    const d = digitsOnly(num);
    if (/^4/.test(d)) return 'Visa';
    if (/^(?:5[1-5]|2(?:2[2-9]|[3-6][0-9]|7[01]|720))/.test(d)) return 'Mastercard';
    if (/^(4011|431274|438935|451416|4576(?:31|32)|504175|627780|636297|636369)/.test(d)) return 'Elo';
    return 'Cartão';
  };
  const brandToMethod = (brand) => {
    const b = String(brand || '').toLowerCase();
    if (b === 'visa') return 'visa';
    if (b === 'mastercard') return 'master';
    if (b === 'elo') return 'elo';
    return null;
  };

  let cart = []; let shipping = null; let order = null;
  try { cart = JSON.parse(localStorage.getItem('emojiCart') || '[]'); } catch {}
  try { shipping = JSON.parse(localStorage.getItem('shippingInfo') || 'null'); } catch {}
  try { order = JSON.parse(localStorage.getItem('lastOrder') || 'null'); } catch {}
  const subtotal = cart.reduce((s,i)=> s + Number(i.total || (i.unitPrice||0) * (i.quantity||1)), 0);
  const frete = Number(shipping?.price || order?.shipping?.price || 0);
  const total = Number(order?.total || (subtotal + frete));
  const sumProducts = document.getElementById('sum-products');
  const sumFrete = document.getElementById('sum-frete');
  const sumTotal = document.getElementById('sum-total');
  if (sumProducts) sumProducts.textContent = fmt(subtotal);
  if (sumFrete) { const v = frete === 0 ? 'Grátis' : fmt(frete); sumFrete.textContent = v; if (frete === 0) sumFrete.style.color = '#16a34a'; }
  if (sumTotal) sumTotal.textContent = fmt(total);

  let card = null; try { card = JSON.parse(localStorage.getItem('newCard') || 'null'); } catch {}
  const cvv = (() => { try { return sessionStorage.getItem('newCardCvv') || ''; } catch { return ''; } })();
  const cardSummaryEl = document.getElementById('card-summary');
  if (!card) { if (cardSummaryEl) cardSummaryEl.textContent = 'Nenhum cartão. Volte e preencha.'; return; }
  const brand = detectBrand(card.number);
  const last4 = digitsOnly(card.number).slice(-4);
  if (cardSummaryEl) cardSummaryEl.textContent = `${brand} •••• ${last4}`;

  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') ? 'http://localhost:3000/api' : '/api';
  
  // Detecta bandeira do cartão usando SDK do Mercado Pago
  async function detectCardBrand(cardNumber) {
    if (!mp || cardNumber.length < 6) return null;
    try {
      const bin = digitsOnly(cardNumber).slice(0, 6);
      const paymentMethods = await mp.getPaymentMethods({ bin });
      if (paymentMethods.results && paymentMethods.results.length > 0) {
        return paymentMethods.results[0];
      }
    } catch (error) {
      console.error('Erro ao detectar bandeira:', error);
    }
    return null;
  }

  // Busca emissor do cartão usando SDK do Mercado Pago
  async function getCardIssuer(paymentMethodId, bin) {
    if (!mp || !paymentMethodId) return null;
    try {
      const issuers = await mp.getIssuers({ paymentMethodId, bin });
      return issuers && issuers.length > 0 ? issuers[0].id : null;
    } catch (error) {
      console.error('Erro ao buscar emissor:', error);
    }
    return null;
  }

  // Busca parcelas usando SDK do Mercado Pago
  async function fetchInstallments(paymentMethodId, issuerId, bin) {
    if (!mp || !paymentMethodId || !bin) return [];
    try {
      const installments = await mp.getInstallments({
        amount: total.toString(),
        locale: 'pt-BR',
        processingMode: 'aggregator',
        paymentMethodId: paymentMethodId,
        issuerId: issuerId,
        bin: bin
      });
      return installments && installments.length > 0 ? installments[0].payer_costs : [];
    } catch (error) {
      console.error('Erro ao buscar parcelas:', error);
      return [];
    }
  }

  const msgEl = document.getElementById('parcelas-msg');
  let MP_PUBLIC_KEY = window.MP_PUBLIC_KEY || '';
  let mp = null;
  async function initMP(){
    try {
      if (!MP_PUBLIC_KEY) {
        const r = await fetch('/api/mp-config');
        const j = await r.json();
        MP_PUBLIC_KEY = j.public_key || 'APP_USR-8678873e-c851-468c-9dcd-c50dd3cc0f7a';
      }
      if (window.MercadoPago) { mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' }); }
    } catch {
      MP_PUBLIC_KEY = MP_PUBLIC_KEY || 'APP_USR-8678873e-c851-468c-9dcd-c50dd3cc0f7a';
      if (window.MercadoPago) { mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' }); }
    }
  }

  let selectedInstallments = 1; let issuer = null; let paymentMethodId = null;
  const box = document.getElementById('installments-box');
  const btnPay = document.getElementById('btn-pay');
  
  (async () => {
    try {
      // Inicializa MP primeiro
      await initMP();
      
      const bin = digitsOnly(card.number).slice(0, 6);
      
      // Detecta bandeira usando SDK
      const paymentMethod = await detectCardBrand(card.number);
      if (!paymentMethod) {
        // Fallback para detecção local se SDK falhar
        paymentMethodId = brandToMethod(brand);
      } else {
        paymentMethodId = paymentMethod.id;
      }
      
      // Busca emissor usando SDK
      issuer = await getCardIssuer(paymentMethodId, bin);
      
      // Busca parcelas usando SDK
      const costs = await fetchInstallments(paymentMethodId, issuer, bin);
      
      if (!box) return;
      box.innerHTML = '';
      const list = costs.length ? costs : [{ installments: 1, installment_amount: total, recommended_message: `1x ${fmt(total)}`, labels: ['no_interest'] }];
      if (!costs.length) { 
        const warn = document.createElement('div'); 
        warn.className = 'opt'; 
        const s = document.createElement('span'); 
        s.style.color = '#dc2626'; 
        s.textContent = 'Não foi possível carregar as parcelas.'; 
        warn.appendChild(s); 
        box.appendChild(warn);
        msgEl.textContent = 'Não foi possível carregar as opções de pagamento. Tente novamente.';
        msgEl.style.color = '#dc2626';
      } else {
        // Sucesso ao carregar parcelas
        msgEl.textContent = 'Selecione a quantidade de parcelas desejada.';
        msgEl.style.color = '#374151';
        if (btnPay) btnPay.disabled = false;
      }
      
      list.forEach((c, idx) => {
        const row = document.createElement('div'); row.className = 'opt';
        const left = document.createElement('div'); left.className = 'left';
        const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'installments'; radio.value = String(c.installments || c.recommended_message?.split('x')[0] || (idx+1));
        if (idx === 0) { radio.checked = true; selectedInstallments = Number(radio.value); }
        const price = document.createElement('div'); price.className = 'price'; price.textContent = c.recommended_message || `${radio.value}x ${fmt(c.installment_amount || (total / Number(radio.value || 1)))}`;
        const note = document.createElement('div'); note.className = 'note'; note.textContent = (c.labels && c.labels.includes('no_interest')) ? 'Sem juros' : '';
        left.append(radio, price);
        row.append(left, note);
        box.appendChild(row);
        radio.addEventListener('change', () => { selectedInstallments = Number(radio.value); });
      });
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
      if (msgEl) {
        msgEl.textContent = 'Erro ao carregar parcelas. Verifique sua conexão.';
        msgEl.style.color = '#dc2626';
      }
    }
  })();

  // Cria token do cartão usando SDK do Mercado Pago
  async function createCardToken() {
    if (!mp) { await initMP(); }
    if (!mp) throw new Error('Mercado Pago SDK indisponível');
    
    const cardData = {
      cardNumber: digitsOnly(card.number),
      cardholderName: card.holder,
      cardExpirationMonth: (card.expiry || '').split('/')[0],
      cardExpirationYear: '20' + ((card.expiry || '').split('/')[1] || ''),
      securityCode: digitsOnly(cvv || ''),
      identificationType: card.docType || 'CPF',
      identificationNumber: digitsOnly(card.docNumber || '')
    };
    
    try {
      const token = await mp.createCardToken(cardData);
      return token.id;
    } catch (error) {
      console.error('Erro ao criar token:', error);
      throw new Error('Erro ao processar dados do cartão: ' + (error.message || error));
    }
  }

  async function pay() {
    try {
      if (btnPay) btnPay.disabled = true;
      msgEl.textContent = 'Processando pagamento...'; msgEl.style.color = '#374151';
      const token = await createCardToken();
      let lastOrder = null; try { lastOrder = JSON.parse(localStorage.getItem('lastOrder') || 'null'); } catch {}
      const orderPayload = lastOrder || { items: cart, subtotal, shipping, total, customer: {} };
      // Capturar Device Session ID do Mercado Pago
      const deviceSessionId = window.MP_DEVICE_SESSION_ID || null;
      if (deviceSessionId) {
        console.log('🔷 Device Session ID capturado:', deviceSessionId.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ Device Session ID não encontrado');
      }
      
      const formData = {
        token,
        installments: selectedInstallments,
        payment_method_id: paymentMethodId || brandToMethod(brand) || 'visa',
        issuer_id: issuer,
        payer: { email: orderPayload.customer?.email, identification: { type: card.docType || 'CPF', number: digitsOnly(card.docNumber || '') } },
        transaction_amount: Number(total || 0),
        device_session_id: deviceSessionId // Adicionar no body
      };
      
      const headers = { 'Content-Type': 'application/json' };
      const res = await fetch(`${API_BASE}/mp-process-payment`, { method: 'POST', headers, body: JSON.stringify({ formData, order: orderPayload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro no pagamento');
      window.location.href = '/confirmacao.html?payment_id=' + encodeURIComponent(data?.id || '');
    } catch (e) {
      msgEl.textContent = 'Falha no pagamento. Verifique número, validade, CVV e documento.'; msgEl.style.color = '#dc2626';
      if (btnPay) btnPay.disabled = false;
    }
  }

  document.getElementById('btn-pay')?.addEventListener('click', pay);
})();
