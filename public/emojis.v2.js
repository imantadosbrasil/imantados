(() => {
  const grid = document.getElementById('emoji-grid');
  const modal = document.getElementById('emoji-modal');
  const modalImg = document.getElementById('modal-emoji-img');
  const totalPrice = document.getElementById('total-price');
  const quantityInput = document.getElementById('quantity-input');
  
  // Material controls
  const materialButtons = () => Array.from(document.querySelectorAll('.material-btn'));
  
  let currentEmoji = null;
  let cart = JSON.parse(localStorage.getItem('emojiCart') || '[]');

  const createCard = ({ name, url }) => {
    const card = document.createElement('div');
    card.className = 'emoji-card';
    card.dataset.name = name;
    card.dataset.url = url;
    
    const img = document.createElement('img');
    img.className = 'emoji-img';
    img.alt = name;
    img.src = url;
    card.appendChild(img);
    // Removida legenda
    
    // Adicionar evento de clique
    card.addEventListener('click', () => openModal({ name, url }));
    
    return card;
  };

  const openModal = ({ name, url }) => {
    currentEmoji = { name, url };
    modalImg.src = url;
    modalImg.alt = name;
    
    // Reset para valores padrão
    document.querySelector('.size-btn.active')?.classList.remove('active');
    document.querySelector('.size-btn[data-size="4cm"]').classList.add('active');
    quantityInput.value = 1;
    updateTotalPrice();
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    currentEmoji = null;
  };

  const updateTotalPrice = () => {
    const activeSize = document.querySelector('.size-btn.active');
    const activeMaterial = document.querySelector('.material-btn.active');
    const basePrice = parseFloat(activeSize.dataset.price);
    const addPrice = activeMaterial ? parseFloat(activeMaterial.dataset.add) : 0;
    const quantity = parseInt(quantityInput.value);
    const unit = basePrice + addPrice;
    const total = (unit * quantity).toFixed(2);
    totalPrice.textContent = `R$ ${total.replace('.', ',')}`;
  };

  const addToCart = () => {
    if (!currentEmoji) return;
    
    const activeSize = document.querySelector('.size-btn.active');
    const activeMaterial = document.querySelector('.material-btn.active');
    const size = activeSize.dataset.size;
    const basePrice = parseFloat(activeSize.dataset.price);
    const material = activeMaterial ? activeMaterial.dataset.material : 'adesivo';
    const addPrice = activeMaterial ? parseFloat(activeMaterial.dataset.add) : 0;
    const quantity = parseInt(quantityInput.value);
    const unitPrice = basePrice + addPrice;
    
    const cartItem = {
      id: Date.now(),
      name: currentEmoji.name,
      url: currentEmoji.url,
      size,
      material,
      basePrice,
      addPrice,
      unitPrice,
      quantity,
      total: unitPrice * quantity
    };
    
    cart.push(cartItem);
    localStorage.setItem('emojiCart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
    
    showToast(`${quantity}x ${currentEmoji.name.replace(/[_-]/g, ' ')} (${size}, ${material}) adicionado ao carrinho!`);
    closeModal();
  };

  const showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  };

  const renderList = (list) => {
    const loading = document.getElementById('emoji-loading');
    if (loading) loading.style.display = 'none';
    grid.textContent = '';
    list.forEach(item => {
      grid.appendChild(createCard(item));
    });
  };

  const showError = (msg) => {
    const div = document.createElement('div');
    div.className = 'error';
    div.textContent = msg;
    grid.textContent = '';
    grid.appendChild(div);
  };

  // Event listeners do modal
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.querySelector('.btn-cancel').addEventListener('click', closeModal);
  document.querySelector('.btn-add-cart').addEventListener('click', addToCart);
  
  // Fechar modal clicando fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Event listeners dos botões de tamanho
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.size-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      updateTotalPrice();
    });
  });

  // Event listeners dos botões de material
  materialButtons().forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.material-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      updateTotalPrice();
    });
  });

  // Event listeners da quantidade
  document.getElementById('qty-minus').addEventListener('click', () => {
    const current = parseInt(quantityInput.value);
    if (current > 1) {
      quantityInput.value = current - 1;
      updateTotalPrice();
    }
  });

  document.getElementById('qty-plus').addEventListener('click', () => {
    const current = parseInt(quantityInput.value);
    if (current < 99) {
      quantityInput.value = current + 1;
      updateTotalPrice();
    }
  });

  quantityInput.addEventListener('input', updateTotalPrice);

  // Carregar emojis com fallback para diretório local
  async function loadEmojis() {
    try {
      const r = await fetch('/api/emojis');
      if (r.ok) return await r.json();
      throw new Error('API não disponível');
    } catch {
      try {
        const res = await fetch('/assets/EMOJIS/');
        if (!res.ok) throw new Error('Listing não disponível');
        const html = await res.text();
        const files = [];
        const re = /href=["']([^"']+\.(?:png|webp))["']/gi;
        let m;
        while ((m = re.exec(html))) {
          files.push(m[1]);
        }
        if (files.length) {
          return files.map(f => ({
            name: decodeURIComponent(f).replace(/\.(png|webp)$/i, ''),
            url: '/assets/EMOJIS/' + f
          }));
        }
        // Fallback: lista mínima estática para garantir carregamento
        const defaults = [
          'rocket_1f680.png',
          'pizza_1f355.png',
          'dog-face_1f436.png',
          'cat-face_1f431.png',
          'rainbow_1f308.png',
          'yellow-heart_1f49b.png',
          'thumbs-up_1f44d.png',
          'smiling-face-with-heart-eyes_1f60d.png',
          'star-struck_1f929.png',
          'balloon_1f388.png',
          'beer-mug_1f37a.png',
          'lollipop_1f36d.png',
          'two-hearts_1f495.png',
          'eyes_1f440.png',
          'party-popper_1f389.png',
          'sunflower_1f33b.png',
          'shopping-bags_1f6cd-fe0f.png',
          'ghost_1f47b.png',
          'red-heart_2764-fe0f.png',
          'woman_1f469.png'
        ];
        return defaults.map(f => ({ name: f.replace(/\.(png|webp)$/i, ''), url: '/assets/EMOJIS/' + encodeURI(f) }));
      } catch (e) {
        const defaults = [
          'rocket_1f680.png',
          'pizza_1f355.png',
          'dog-face_1f436.png',
          'cat-face_1f431.png',
          'rainbow_1f308.png',
          'yellow-heart_1f49b.png',
          'thumbs-up_1f44d.png',
          'smiling-face-with-heart-eyes_1f60d.png',
          'star-struck_1f929.png',
          'balloon_1f388.png',
          'beer-mug_1f37a.png',
          'lollipop_1f36d.png',
          'two-hearts_1f495.png',
          'eyes_1f440.png',
          'party-popper_1f389.png',
          'sunflower_1f33b.png',
          'shopping-bags_1f6cd-fe0f.png',
          'ghost_1f47b.png',
          'red-heart_2764-fe0f.png',
          'woman_1f469.png'
        ];
        return defaults.map(f => ({ name: f.replace(/\.(png|webp)$/i, ''), url: '/assets/EMOJIS/' + encodeURI(f) }));
      }
    }
  }

  const loadingEl = document.getElementById('emoji-loading');
  if (loadingEl) loadingEl.style.display = 'block';
  loadEmojis().then(list => {
    if (Array.isArray(list) && list.length) {
      renderList(list);
    } else {
      if (loadingEl) loadingEl.style.display = 'none';
      showError('Não foi possível carregar a lista de emojis.');
    }
  }).catch(err => {
    if (loadingEl) loadingEl.style.display = 'none';
    showError('Não foi possível carregar a lista de emojis.');
    console.error(err);
  });
})();