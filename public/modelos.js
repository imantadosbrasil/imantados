// JavaScript específico para a página de modelos
(() => {
  // Funcionalidade dos filtros
  const filterButtons = document.querySelectorAll('.filter-btn');
  const modelCards = document.querySelectorAll('.model-card');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Se for o botão "Emojis", redireciona para a página de emojis
      if ((btn.dataset.filter || '').toLowerCase() === 'emojis') {
        window.location.href = 'emojis.html';
        return;
      }
      // Remove active de todos os botões
      filterButtons.forEach(b => b.classList.remove('active'));
      // Adiciona active ao botão clicado
      btn.classList.add('active');

      const filter = (btn.dataset.filter || 'todos').toLowerCase();

      // Mostra/esconde cards baseado no filtro
      modelCards.forEach(card => {
        const category = (card.dataset.category || '').toLowerCase();
        if (filter === 'todos' || category === filter) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Funcionalidade dos botões dos cards
  document.addEventListener('click', (e) => {
    if (e.target.matches('.btn-preview')) {
      e.preventDefault();
      const card = e.target.closest('.model-card');
      const category = (card?.dataset?.category || '').toLowerCase();
      const pageMap = {
        'emojis': 'emojis.html',
        'frases-whatsapp': 'frases-whatsapp.html',
        'empresas': 'empresa.html',
        'threads': 'threads.html',
        'instagram': 'instagram.html',
        'comemorativas': 'comemorativas.html'
      };
      const url = pageMap[category];
      if (url) {
        window.location.href = url;
      } else {
        const title = card?.querySelector('h3')?.textContent || category || 'Modelo';
        alert(`Página de "${title}" não encontrada.`);
      }
    }

    if (e.target.matches('.btn-customize')) {
      e.preventDefault();
      const card = e.target.closest('.model-card');
      const title = card.querySelector('h3').textContent;
      alert(`Usando modelo: ${title}`);
    }
  });
})();