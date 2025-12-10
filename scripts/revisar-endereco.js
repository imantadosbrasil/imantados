document.addEventListener('DOMContentLoaded', function() {
    initReviewMap();
});

function carregarEndereco() {
    const enderecoData = localStorage.getItem('enderecoEntrega');
    
    if (!enderecoData) {
        alert('Nenhum endereço encontrado. Por favor, adicione um endereço.');
        window.location.href = '/endereco.html';
        return;
    }
    
    const endereco = JSON.parse(enderecoData);
    
    const enderecoCompleto = document.getElementById('enderecoCompleto');
    const numero = endereco.semNumero ? 'S/N' : endereco.numero;
    const complemento = endereco.complemento ? `, ${endereco.complemento}` : '';
    
    enderecoCompleto.innerHTML = `
        <div class="address-line">${endereco.rua}, ${numero}${complemento}</div>
        <div class="address-line">${endereco.bairro}</div>
        <div class="address-line">${endereco.cidade} - ${endereco.estado}</div>
        <div class="address-line">CEP: ${endereco.cep}</div>
        ${endereco.infoAdicional ? `<div class="address-note">${endereco.infoAdicional}</div>` : ''}
    `;
    
    const tipoIcon = document.getElementById('tipoIcon');
    const tipoTexto = document.getElementById('tipoTexto');
    
    if (endereco.tipoEndereco === 'trabalho') {
        tipoIcon.className = 'fas fa-briefcase';
        tipoTexto.textContent = 'Trabalho';
    } else {
        tipoIcon.className = 'fas fa-home';
        tipoTexto.textContent = 'Casa';
    }
    
    document.getElementById('nomeCompleto').textContent = endereco.nome;
    document.getElementById('telefoneContato').textContent = endereco.telefone;
}

function confirmarEndereco() {
  localStorage.setItem('enderecoConfirmado', 'true');
  window.location.href = '/checkout.html';
}

const style = document.createElement('style');
style.textContent = `
    .address-review {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }
    
    .review-card {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 24px;
    }
    
    .review-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .review-title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin: 0;
    }
    
    .btn-edit {
        background: transparent;
        border: 1px solid #3483fa;
        color: #3483fa;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
    }
    
    .btn-edit:hover {
        background: #3483fa;
        color: white;
    }
    
    .address-details {
        margin-bottom: 16px;
    }
    
    .address-line {
        font-size: 14px;
        color: #333;
        line-height: 1.5;
    }
    
    .address-note {
        font-size: 14px;
        color: #666;
        font-style: italic;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #e9ecef;
    }
    
    .address-type {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding: 12px;
        background: white;
        border-radius: 6px;
        border: 1px solid #e9ecef;
    }
    
    .address-type i {
        color: #3483fa;
        font-size: 16px;
    }
    
    .contact-info {
        background: white;
        border-radius: 6px;
        padding: 16px;
        border: 1px solid #e9ecef;
    }
    
    .contact-item {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }
    
    .contact-item:last-child {
        margin-bottom: 0;
    }
    
    .contact-item i {
        color: #666;
        font-size: 14px;
        width: 16px;
        text-align: center;
    }
    
    .review-actions {
        display: flex;
        justify-content: space-between;
        gap: 16px;
    }
    
    .btn-secondary {
        background: transparent;
        border: 1px solid #ddd;
        color: #333;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        flex: 1;
        max-width: 200px;
    }
    
    .btn-secondary:hover {
        background: #f5f5f5;
        border-color: #ccc;
    }
    
    @media (max-width: 768px) {
        .review-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
        }
        
        .review-actions {
            flex-direction: column;
        }
        
        .btn-secondary,
        .btn-primary {
            max-width: none;
            width: 100%;
        }
    }
`;

document.head.appendChild(style);

function initReviewMap() {
  const data = localStorage.getItem('enderecoEntrega');
  if (!data) { alert('Nenhum endereço encontrado.'); window.location.href = 'endereco.html'; return; }
  const e = JSON.parse(data);
  const n = e.semNumero ? 'S/N' : e.numero;
  const comp = e.complemento ? ', ' + e.complemento : '';
  const text = [e.rua, n].filter(Boolean).join(', ') + comp + ', ' + [e.bairro, e.cidade].filter(Boolean).join(', ') + ' - ' + (e.estado || '') + (e.cep ? ', ' + e.cep : '');
  const t = document.getElementById('addressText');
  if (t) t.textContent = text;
  let lat = null; let lng = null;
  function setCoord(a, b) { lat = a; lng = b; }
  const gkey = new URLSearchParams(location.search).get('gmaps') || localStorage.getItem('mapsApiKey') || (window.GMAPS_KEY || '');
  function loadGoogle(cb) {
    if (!gkey) { cb(false); return; }
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(gkey);
    s.onload = function() { cb(true); };
    s.onerror = function() { cb(false); };
    document.head.appendChild(s);
  }
  function initGoogle(center) {
    const m = new google.maps.Map(document.getElementById('map'), { center, zoom: 17 });
    const mk = new google.maps.Marker({ position: center, map: m, draggable: true });
    mk.addListener('dragend', function() { const p = mk.getPosition(); setCoord(p.lat(), p.lng()); });
    setCoord(center.lat, center.lng);
  }
  function initLeaflet(center) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = function() {
      const m = L.map('map').setView([center.lat, center.lng], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
      const mk = L.marker([center.lat, center.lng], { draggable: true }).addTo(m);
      mk.on('dragend', function() { const p = mk.getLatLng(); setCoord(p.lat, p.lng); });
      setCoord(center.lat, center.lng);
    };
    document.head.appendChild(s);
  }
  async function geocode() {
    const q = [e.rua, n, e.bairro, e.cidade, e.estado, 'Brasil'].filter(Boolean).join(', ');
    const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    try {
      const r = await fetch(u, { headers: { 'Accept': 'application/json' } });
      const d = await r.json();
      if (d && d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
    } catch {}
    return { lat: -23.55052, lng: -46.633308 };
  }
  (async function() {
    const c = await geocode();
    loadGoogle(function(ok) { if (ok && window.google && google.maps) { initGoogle(c); } else { initLeaflet(c); } });
  })();
  const btnSave = document.getElementById('btnSave');
  const btnHide = document.getElementById('btnHide');
  const btnEdit = document.getElementById('btnEdit');
  btnSave?.addEventListener('click', function() {
    const v = JSON.parse(localStorage.getItem('enderecoEntrega') || '{}');
    if (lat && lng) { v.lat = lat; v.lng = lng; }
    localStorage.setItem('enderecoEntrega', JSON.stringify(v));
    localStorage.setItem('enderecoConfirmado', 'true');
    window.location.href = '/frete.html';
  });
  btnHide?.addEventListener('click', function() {
    const c = document.querySelector('.map-container');
    if (c) c.style.display = c.style.display === 'none' ? 'block' : 'none';
  });
  btnEdit?.addEventListener('click', function() { window.location.href = '/endereco.html'; });
}

const reviewStyle = document.createElement('style');
reviewStyle.textContent = `
.map-card{background:#fff;border:1px solid #e9ecef;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden}
.map-container{position:relative;height:420px}
#map{width:100%;height:100%}
.map-hint{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;padding:8px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15);font-weight:600}
.review-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-top:1px solid #e9ecef}
.review-bar .address-text{display:flex;align-items:center;gap:8px;color:#374151}
.review-bar .btn-edit{background:transparent;border:1px solid #3483fa;color:#3483fa;padding:8px 16px;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer}
.review-bar .btn-edit:hover{background:#3483fa;color:#fff}
.map-actions{display:flex;justify-content:flex-end;gap:12px;padding:12px;border-top:1px solid #e9ecef}
.btn-secondary{background:transparent;border:1px solid #ddd;color:#333;padding:12px 24px;border-radius:6px;font-size:16px;font-weight:500;cursor:pointer;transition:all .2s ease}
.btn-secondary:hover{background:#f5f5f5;border-color:#ccc}
@media (max-width:768px){.map-container{height:340px}}
`;
document.head.appendChild(reviewStyle);
