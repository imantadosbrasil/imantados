(() => {
  const form = document.getElementById('muralForm');
  const inputImage = document.getElementById('muralImage');
  const inputName = document.getElementById('customerName');
  const inputCity = document.getElementById('customerCity');
  const inputComment = document.getElementById('muralComment');
  const ratingBar = document.getElementById('ratingBar');
  const recommend = document.getElementById('recommend');
  const postOnImantados = document.getElementById('postOnImantados');
  const gallery = document.getElementById('muralGallery');
  const toastEl = document.getElementById('toast');
  const fileNameEl = document.getElementById('fileName');

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    setTimeout(() => toastEl.classList.remove('visible'), 2500);
  }

  // Atualiza texto com nome do arquivo escolhido
  if (inputImage) {
    inputImage.addEventListener('change', () => {
      const name = inputImage.files && inputImage.files[0] ? inputImage.files[0].name : 'Nenhum arquivo';
      if (fileNameEl) fileNameEl.textContent = name;
    });
  }

  // Rating UI state
  let currentRating = 5;
  if (ratingBar) {
    ratingBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.star');
      if (!btn) return;
      currentRating = Number(btn.dataset.value || 0);
      const children = Array.from(ratingBar.querySelectorAll('.star'));
      children.forEach((c, i) => {
        c.textContent = i <= currentRating ? '★' : '☆';
        if (i <= currentRating) c.classList.add('selected');
        else c.classList.remove('selected');
      });
    });
    const children = Array.from(ratingBar.querySelectorAll('.star'));
    children.forEach((c, i) => {
      c.textContent = i <= currentRating ? '★' : '☆';
      if (i <= currentRating) c.classList.add('selected');
      else c.classList.remove('selected');
    });
  }

  // IndexedDB helpers
  let dbPromise;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('muralDB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('posts')) {
          db.createObjectStore('posts', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function addPost(post) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readwrite');
      tx.objectStore('posts').put(post);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllPosts() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('posts', 'readonly');
      const req = tx.objectStore('posts').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Utilities
  function uid() {
    try { return crypto.randomUUID(); } catch { return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderPosts(posts) {
    if (!gallery) return;
    gallery.innerHTML = '';
    const sorted = posts.slice().sort((a, b) => b.createdAt - a.createdAt);
    for (const p of sorted) {
      const card = document.createElement('div');
      card.className = 'model-card mural-card-row';

      // Painel branco com conteúdo (esquerda)
      const panel = document.createElement('div');
      panel.className = 'mural-panel';
      const panelHeader = document.createElement('div');
      panelHeader.className = 'panel-header';

      // Avatar pequeno ao lado do nome
      const avatar = document.createElement('div');
      avatar.className = 'mural-avatar';
      const img = document.createElement('img');
      img.alt = 'Foto do cliente';
      img.src = p.imageData;
      avatar.appendChild(img);

      const title = document.createElement('h3');
      title.className = 'mural-title';
      const nameText = (p.name || '').trim();
      title.textContent = nameText || 'Cliente';
      panelHeader.appendChild(avatar);
      panelHeader.appendChild(title);

      const starsBar = document.createElement('div');
      starsBar.className = 'mural-stars';
      for (let i = 0; i < 5; i++) {
        const s = document.createElement('span');
        s.className = 'star-icon' + (i < (p.rating || 0) ? '' : ' hollow');
        s.textContent = i < (p.rating || 0) ? '★' : '☆';
        starsBar.appendChild(s);
      }

      const desc = document.createElement('p');
      desc.className = 'mural-text';
      desc.textContent = p.comment || 'Sem comentário';

      const footer = document.createElement('div');
      footer.className = 'mural-footer';
      const author = document.createElement('span');
      author.className = 'author';
      const cityText = (p.city || '').trim();
      author.textContent = (nameText || cityText) ? `${nameText || 'Cliente'}${cityText ? ' — ' + cityText : ''}` : 'Cliente';
      const reco = document.createElement('span');
      reco.className = 'reco';
      reco.textContent = `Recomenda: ${p.recommend ? 'Sim' : 'Não'}`;
      footer.appendChild(author);
      footer.appendChild(reco);

      panel.appendChild(panelHeader);
      panel.appendChild(starsBar);
      panel.appendChild(desc);
      panel.appendChild(footer);

      // Foto grande à direita
      const sidePhoto = document.createElement('div');
      sidePhoto.className = 'mural-side-photo';
      const sideImg = document.createElement('img');
      sideImg.alt = 'Foto postada';
      sideImg.src = p.imageData;
      sidePhoto.appendChild(sideImg);

      card.appendChild(panel);
      card.appendChild(sidePhoto);
      gallery.appendChild(card);
    }
  }

  async function refresh() {
    const posts = await getAllPosts();
    renderPosts(posts);
  }

  // Submit handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = inputImage?.files?.[0];
      if (!file) { showToast('Escolha uma imagem.'); return; }
      try {
        const imageData = await fileToDataUrl(file);
        const post = {
          id: uid(),
          createdAt: Date.now(),
          imageData,
          rating: currentRating || 0,
          recommend: !!recommend?.checked,
          postOnImantados: !!postOnImantados?.checked,
          comment: (inputComment?.value || '').trim(),
          name: (inputName?.value || '').trim(),
          city: (inputCity?.value || '').trim(),
        };
        await addPost(post);
        showToast('Post publicado no mural!');
        // Reset form
        if (form) form.reset();
        if (fileNameEl) fileNameEl.textContent = 'Nenhum arquivo';
        currentRating = 5;
        const children = Array.from(ratingBar.querySelectorAll('.star'));
        children.forEach((c, i) => {
          c.textContent = i <= currentRating ? '★' : '☆';
          if (i <= currentRating) c.classList.add('selected');
          else c.classList.remove('selected');
        });
        await refresh();
      } catch (err) {
        showToast('Falha ao publicar. Tente novamente.');
      }
    });
  }

  // Inicializa grade
  refresh().catch(() => {});

  // Rolagem lateral por clique e arraste (mouse) e toque (touch)
  if (gallery) {
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;

    const getPageX = (e) => {
      if (typeof e.pageX === 'number') return e.pageX;
      const t = e.touches && e.touches[0];
      return t ? t.pageX : 0;
    };

    const onDown = (e) => {
      isDown = true;
      gallery.classList.add('dragging');
      startX = getPageX(e) - gallery.offsetLeft;
      scrollStart = gallery.scrollLeft;
    };
    const onMove = (e) => {
      if (!isDown) return;
      // Evita seleção de texto e scroll vertical enquanto arrasta
      e.preventDefault();
      const x = getPageX(e) - gallery.offsetLeft;
      const walk = x - startX;
      gallery.scrollLeft = scrollStart - walk;
    };
    const onUp = () => {
      isDown = false;
      gallery.classList.remove('dragging');
    };

    gallery.addEventListener('mousedown', onDown);
    gallery.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    gallery.addEventListener('mouseleave', onUp);

    gallery.addEventListener('touchstart', onDown, { passive: true });
    gallery.addEventListener('touchmove', onMove, { passive: false });
    gallery.addEventListener('touchend', onUp);
  }
})();
