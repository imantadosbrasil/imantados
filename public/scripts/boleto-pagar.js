(() => {
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const API_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') ? 'http://localhost:3000/api' : '/api';
  let order = null;
  try { order = JSON.parse(localStorage.getItem('lastOrder') || 'null'); } catch {}
  
  const heroTitle = document.getElementById('hero-title');
  const boletoValor = document.getElementById('boleto-valor');
  const boletoVencimento = document.getElementById('boleto-vencimento');
  const boletoStatus = document.getElementById('boleto-status');
  const boletoBarcode = document.getElementById('boleto-barcode');
  const boletoCodeInput = document.getElementById('boleto-code');
  const btnCopy = document.getElementById('btn-copy');
  const btnDownload = document.getElementById('btn-download');
  const boletoMsg = document.getElementById('boleto-msg');
  
  if (heroTitle && order) { 
    heroTitle.textContent = `Pague ${fmt(order.total || 0)} via Boleto para concluir sua compra`; 
  }
  if (boletoValor && order) {
    boletoValor.textContent = fmt(order.total || 0);
  }
  
  async function createBoleto() {
    try {
      const res = await fetch(`${API_BASE}/mp-create-boleto`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(order || {}) 
      });
      const data = await res.json();
      
      if (!res.ok) {
        const details = data && (data.details || data.error || data.message);
        const extra = Array.isArray(details) ? (details[0]?.description || details[0]?.message || '') : (typeof details === 'string' ? details : '');
        if (boletoMsg) { 
          boletoMsg.textContent = `Não foi possível gerar o boleto: ${(data && data.error) || 'Falha'}${extra ? ' — ' + extra : ''}`; 
        }
        return;
      }
      
      const barcodeContent = data.barcode || '';
      const pdfUrl = data.pdf_url || '';
      const dueDate = data.due_date || '';
      
      try { 
        localStorage.setItem('lastBoletoPayment', JSON.stringify({ 
          id: data.id, 
          status: data.status, 
          barcode: barcodeContent,
          pdf_url: pdfUrl 
        })); 
      } catch {}
      
      if (boletoCodeInput && barcodeContent) { 
        boletoCodeInput.value = barcodeContent; 
      }
      
      if (boletoBarcode && barcodeContent) {
        boletoBarcode.textContent = barcodeContent;
        boletoBarcode.style.fontSize = '11px';
        boletoBarcode.style.fontFamily = 'monospace';
      }
      
      if (btnDownload && pdfUrl) {
        btnDownload.href = pdfUrl;
        btnDownload.style.display = 'inline-flex';
      }
      
      if (boletoVencimento && dueDate) {
        try {
          const date = new Date(dueDate);
          boletoVencimento.textContent = date.toLocaleDateString('pt-BR');
        } catch {
          boletoVencimento.textContent = dueDate;
        }
      }
      
      if (boletoMsg) { 
        boletoMsg.textContent = 'Boleto gerado com sucesso. Confirmaremos a entrega após a compensação do pagamento.'; 
      }
      
      startPollingStatus(data.id);
    } catch (e) {
      if (boletoMsg) { 
        boletoMsg.textContent = (e && e.message) ? ('Não foi possível gerar o boleto: ' + e.message) : 'Não foi possível gerar o boleto. Tente novamente.'; 
      }
    }
  }
  
  btnCopy?.addEventListener('click', () => {
    if (!boletoCodeInput?.value) return;
    try { 
      navigator.clipboard.writeText(boletoCodeInput.value).then(() => { 
        if (boletoMsg) boletoMsg.textContent = 'Código de barras copiado.'; 
      }).catch(() => {}); 
    } catch {}
  });
  
  createBoleto();
  
  function startPollingStatus(id) {
    if (!id) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      if (tries > 180) { clearInterval(timer); return; } // 30 minutos (180 * 10s)
      try {
        const res = await fetch(`${API_BASE}/mp-payment-status?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (res.ok && data?.status) {
          const status = String(data.status).toLowerCase();
          if (boletoStatus) {
            if (status === 'approved') {
              boletoStatus.textContent = 'Pago';
              boletoStatus.style.color = '#16a34a';
            } else if (status === 'pending') {
              boletoStatus.textContent = 'Aguardando pagamento';
              boletoStatus.style.color = '#d97706';
            } else if (status === 'rejected' || status === 'cancelled') {
              boletoStatus.textContent = 'Cancelado';
              boletoStatus.style.color = '#dc2626';
            }
          }
          
          if (status === 'approved') {
            clearInterval(timer);
            if (boletoMsg) { 
              boletoMsg.textContent = 'Pagamento confirmado. Seu pedido está sendo preparado.'; 
            }
          } else if (status === 'rejected' || status === 'cancelled') {
            clearInterval(timer);
            if (boletoMsg) { 
              boletoMsg.textContent = 'Pagamento não foi efetuado. Entre em contato se tiver dúvidas.'; 
            }
          }
        }
      } catch {}
    }, 10000); // 10 segundos
  }
})();

