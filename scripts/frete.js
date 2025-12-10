(() => {
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('emojiCart') || '[]'); } catch {}
  let endereco = null;
  try { endereco = JSON.parse(localStorage.getItem('enderecoEntrega') || 'null'); } catch {}
  const q = cart.reduce((s,i)=> s + Number(i.quantity || 1), 0);
  const subtotal = cart.reduce((s,i)=> s + Number(i.total || (i.unitPrice||0) * (i.quantity||1)), 0);
  const tier = (q > 10 || subtotal >= 95) ? 0 : 18;
  const uf = (endereco?.estado || '').toUpperCase();
  const grupos = {
    SE: ['SP','RJ','ES','MG'],
    S: ['PR','SC','RS'],
    CO: ['DF','GO','MS','MT'],
    NE: ['BA','SE','AL','PE','PB','RN','CE','PI','MA'],
    N: ['PA','AM','RR','AP','AC','RO','TO']
  };
  function prazoNumeroPorUF(u){
    if (grupos.SE.includes(u)) return 3;
    if (grupos.S.includes(u)) return 4;
    if (grupos.CO.includes(u)) return 6;
    if (grupos.NE.includes(u)) return 8;
    if (grupos.N.includes(u)) return 12;
    return 6;
  }
  let prazo = prazoNumeroPorUF(uf);

  const addrEl = document.getElementById('deliver-address');
  const typeEl = document.getElementById('deliver-type');
  const tagEl = document.getElementById('frete-tag');
  const sumProducts = document.getElementById('sum-products');
  const sumFrete = document.getElementById('sum-frete');
  const sumTotal = document.getElementById('sum-total');
  const sumPrazo = document.getElementById('sum-prazo');
  const btnContinue = document.getElementById('btn-continue');

  const num = endereco?.semNumero ? 'S/N' : (endereco?.numero || '');
  const comp = endereco?.complemento ? ', ' + endereco.complemento : '';
  const full = [endereco?.rua, num].filter(Boolean).join(', ') + comp + ' - ' + [endereco?.bairro, endereco?.cidade].filter(Boolean).join(' - ') + (endereco?.cep ? ` - CEP ${endereco.cep}` : '');
  if (addrEl) addrEl.textContent = full;
  if (typeEl) typeEl.textContent = (endereco?.tipoEndereco === 'trabalho' ? 'Trabalho' : 'Casa');

  sumProducts.textContent = fmt(subtotal);
  sumFrete.textContent = fmt(tier);
  sumTotal.textContent = fmt(subtotal + tier);
  sumPrazo.textContent = `${prazo} dias úteis`;
  tagEl.textContent = tier === 0 ? 'Grátis' : fmt(tier);

  (async function(){
    const cep = (endereco?.cep || '').replace(/\D/g,'');
    if (!cep || cep.length !== 8) return;
    try {
      const res = await fetch(`/api/correios-prazo?cepDestino=${cep}&servico=mini`);
      const data = await res.json();
      if (data && Number(data.prazo) > 0) {
        prazo = Number(data.prazo);
        if (sumPrazo) sumPrazo.textContent = `${prazo} dias úteis`;
      }
    } catch {}
  })();

  btnContinue?.addEventListener('click', function(){
    const si = { price: tier, prazo, cep: (endereco?.cep || '').replace(/\D/g,'') || null, service: 'Correios Mini Envios' };
    try { localStorage.setItem('shippingInfo', JSON.stringify(si)); } catch {}
    window.location.href = '/pagamento.html';
  });
})();
