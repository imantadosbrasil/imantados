(() => {
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') ? 'http://localhost:3000/api' : '/api';
  let order = null;
  try { order = JSON.parse(localStorage.getItem('lastOrder') || 'null'); } catch {}
  const heroTitle = document.getElementById('hero-title');
  const pixQr = document.getElementById('pix-qr');
  const pixCodeInput = document.getElementById('pix-code');
  const btnCopy = document.getElementById('btn-copy');
  const pixMsg = document.getElementById('pix-msg');
  if (heroTitle && order) { heroTitle.textContent = `Pague ${fmt(order.total || 0)} via Pix para concluir sua compra`; }
  async function createPix() {
    try {
      const res = await fetch(`${API_BASE}/mp-create-pix`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(order || {}) });
      const data = await res.json();
      if (!res.ok) {
        const details = data && (data.details || data.error || data.message);
        const extra = Array.isArray(details) ? (details[0]?.description || details[0]?.message || '') : (typeof details === 'string' ? details : '');
        if (pixMsg) { pixMsg.textContent = `Não foi possível gerar o QR Pix: ${(data && data.error) || 'Falha'}${extra ? ' — ' + extra : ''}`; }
        try {
          const prefRes = await fetch(`${API_BASE}/mp-create-preference`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(order||{}), onlyPix: true }) });
          const pref = await prefRes.json();
          const url = pref.init_point || pref.sandbox_init_point || pref.href;
          if (prefRes.ok && url) { window.location.href = url; return; }
        } catch {}
        return;
      }
      const base64 = data.qr_code_base64 || '';
      const code = data.qr_code || '';
      try { localStorage.setItem('lastPixPayment', JSON.stringify({ id: data.id, status: data.status, code })); } catch {}
      if (pixQr && base64) { pixQr.src = `data:image/png;base64,${base64}`; }
      if (pixCodeInput && code) { pixCodeInput.value = code; }
      if (pixMsg) { pixMsg.textContent = 'Confirmaremos a data de entrega quando o pagamento for aprovado.'; }
      startPollingStatus(data.id);
    } catch (e) {
      if (pixMsg) { pixMsg.textContent = (e && e.message) ? ('Não foi possível gerar o QR Pix: ' + e.message) : 'Não foi possível gerar o QR Pix. Tente novamente.'; }
      try {
        const prefRes = await fetch(`${API_BASE}/mp-create-preference`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(order||{}), onlyPix: true }) });
        const pref = await prefRes.json();
        const url = pref.init_point || pref.sandbox_init_point || pref.href;
        if (prefRes.ok && url) { window.location.href = url; return; }
      } catch {}
    }
  }
  btnCopy?.addEventListener('click', () => {
    if (!pixCodeInput?.value) return;
    try { navigator.clipboard.writeText(pixCodeInput.value).then(() => { if (pixMsg) pixMsg.textContent = 'Código Pix copiado.'; }).catch(() => {}); } catch {}
  });
  createPix();

  function startPollingStatus(id) {
    if (!id) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      if (tries > 60) { clearInterval(timer); return; }
      try {
        const res = await fetch(`${API_BASE}/mp-payment-status?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (res.ok && data?.status) {
          if (String(data.status).toLowerCase() === 'approved') {
            clearInterval(timer);
            if (pixMsg) { pixMsg.textContent = 'Pagamento aprovado. Seu pedido está confirmado.'; }
          } else if (String(data.status).toLowerCase() === 'rejected') {
            clearInterval(timer);
            if (pixMsg) { pixMsg.textContent = 'Pagamento rejeitado. Tente novamente.'; }
          }
        }
      } catch {}
    }, 5000);
  }
})();
