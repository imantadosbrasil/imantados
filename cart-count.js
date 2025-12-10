(() => {
  function getCount() {
    try {
      const arr = JSON.parse(localStorage.getItem('emojiCart') || '[]');
      if (!Array.isArray(arr)) return 0;
      return arr.reduce((acc, i) => acc + (i.quantity || 1), 0);
    } catch {
      return 0;
    }
  }

  function updateCount() {
    const els = document.querySelectorAll('[data-cart-count]');
    const c = getCount();
    els.forEach(el => { el.textContent = String(c); });
  }

  // Garante que o status de autenticação (menu de conta) esteja ativo em todas as páginas
  function ensureAuthStatusLoaded() {
    try {
      const already = !!document.querySelector('script[data-role="auth-status"]') || !!window.__authStatusLoaded;
      if (already) return;
      const s = document.createElement('script');
      s.src = 'auth-status.js';
      s.defer = true;
      s.dataset.role = 'auth-status';
      s.onload = () => { try { window.__authStatusLoaded = true; } catch {} };
      document.head.appendChild(s);
    } catch {}
  }

  window.addEventListener('storage', updateCount);
  window.addEventListener('cart-updated', updateCount);
  document.addEventListener('DOMContentLoaded', () => { updateCount(); ensureAuthStatusLoaded(); });
})();