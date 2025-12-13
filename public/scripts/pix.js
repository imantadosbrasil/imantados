(() => {
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let order = null;
  try { order = JSON.parse(localStorage.getItem('lastOrder') || 'null'); } catch {}
  if (!order) {
    let cart = []; let shipping = null; let sel = null;
    try { cart = JSON.parse(localStorage.getItem('emojiCart')||'[]'); } catch {}
    try { shipping = JSON.parse(localStorage.getItem('shippingInfo')||'null'); } catch {}
    try { sel = JSON.parse(localStorage.getItem('paymentSelection')||'null'); } catch {}
    const subtotal = cart.reduce((s,i)=> s + Number(i.total || (i.unitPrice||0) * (i.quantity||1)), 0);
    order = { items: cart, subtotal, shipping: shipping || { price: 0 }, total: subtotal + Number(shipping?.price||0), customer: {}, payment: { method: sel?.method || 'pix' } };
  }

  const billName = document.getElementById('bill-name');
  const billEmail = document.getElementById('bill-email');
  const addrText = document.getElementById('addr-text');
  const addrCep = document.getElementById('addr-cep');
  const shippingPrazo = document.getElementById('shipping-prazo');
  const itemsList = document.getElementById('items-list');
  const sumProducts = document.getElementById('sum-products');
  const sumFrete = document.getElementById('sum-frete');
  const sumTotal = document.getElementById('sum-total');
  const pixAmount = document.getElementById('pix-amount');
  const btnConfirm = document.getElementById('btn-confirm');
  const pixMsg = document.getElementById('pix-msg');
  const pixBrickEl = document.getElementById('mp-pix-brick');

  if (billName) billName.textContent = order?.customer?.name || '';
  if (billEmail) billEmail.textContent = order?.customer?.email || '';
  const addr = order?.customer?.fullAddress || [order?.customer?.address, order?.customer?.number, order?.customer?.complement].filter(Boolean).join(', ');
  if (addrText) addrText.textContent = addr || '';
  if (addrCep) addrCep.textContent = (order?.customer?.cep ? `CEP ${order.customer.cep}` : '');
  const prazo = order?.shipping?.prazo ? String(order.shipping.prazo) : '';
  if (shippingPrazo) shippingPrazo.textContent = prazo ? `Chegará em ${prazo}` : '';

  if (itemsList) {
    itemsList.innerHTML = '';
    for (const it of (order.items || [])) {
      const li = document.createElement('li');
      li.className = 'item';
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = it.url || it.imageUrl || 'assets/botao.png';
      img.alt = it.name || 'Item';
      const meta = document.createElement('div');
      const name = document.createElement('div');
      name.textContent = `${it.name || 'Ímã personalizado'} • Quantidade: ${it.quantity || 1}`;
      const note = document.createElement('div');
      note.className = 'note';
      const dims = [it.material, `${it.width || ''}x${it.height || ''}`].filter(Boolean).join(' • ');
      note.textContent = dims;
      meta.append(name, note);
      li.append(img, meta);
      itemsList.appendChild(li);
    }
  }

  if (sumProducts) sumProducts.textContent = fmt(order.subtotal || 0);
  const frete = Number(order?.shipping?.price || 0);
  if (sumFrete) { sumFrete.textContent = frete === 0 ? 'Grátis' : fmt(frete); if (frete === 0) sumFrete.style.color = '#16a34a'; }
  if (sumTotal) sumTotal.textContent = fmt((order.subtotal || 0) + frete);
  if (pixAmount) pixAmount.textContent = fmt(order.total || ((order.subtotal||0)+frete));

  let MP_PUBLIC_KEY = window.MP_PUBLIC_KEY || '';
  let mp = null; let bricks = null;
  (async function initMP(){
    try {
      if (!MP_PUBLIC_KEY) {
        const r = await fetch('/api/mp-config');
        const j = await r.json();
        MP_PUBLIC_KEY = j.public_key || 'APP_USR-8678873e-c851-468c-9dcd-c50dd3cc0f7a';
      }
      if (window.MercadoPago) {
        mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
        bricks = mp && typeof mp.bricks === 'function' ? mp.bricks() : null;
      }
    } catch {
      if (window.MercadoPago) {
        mp = new window.MercadoPago(MP_PUBLIC_KEY || 'APP_USR-8678873e-c851-468c-9dcd-c50dd3cc0f7a', { locale: 'pt-BR' });
        bricks = mp && typeof mp.bricks === 'function' ? mp.bricks() : null;
      }
    }
  })();

  btnConfirm?.addEventListener('click', async () => {
    try { localStorage.setItem('lastOrder', JSON.stringify(order)); } catch {}
    window.location.href = '/pix-pagar.html';
  });
})();
