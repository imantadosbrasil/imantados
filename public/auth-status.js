(() => {
  // Helpers de storage
  function getAuthToken() {
    try { return sessionStorage.getItem('authToken') || null; } catch {}
    try { return localStorage.getItem('authToken') || null; } catch { return null; }
  }
  function getAuthTokenExp() {
    let v = null;
    try { v = sessionStorage.getItem('authTokenExp'); } catch {}
    if (!v) { try { v = localStorage.getItem('authTokenExp'); } catch {} }
    const ms = v ? parseInt(v, 10) : 0;
    return isNaN(ms) ? 0 : ms;
  }
  function setAuthToken(token, expMs) {
    try { sessionStorage.setItem('authToken', token || ''); sessionStorage.setItem('authTokenExp', String(expMs || 0)); } catch {}
    try { localStorage.setItem('authToken', token || ''); localStorage.setItem('authTokenExp', String(expMs || 0)); } catch {}
  }
  function clearAuthToken() {
    try { sessionStorage.removeItem('authToken'); sessionStorage.removeItem('authTokenExp'); } catch {}
    try { localStorage.removeItem('authToken'); localStorage.removeItem('authTokenExp'); } catch {}
  }

  function getAuthUser() {
    try { return JSON.parse(sessionStorage.getItem('authUser') || 'null'); } catch {}
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
  }

  // Mantém fallback: se não houver authUser em sessão, usa localStorage
  // Não apagamos localStorage para permitir persistência entre abas e reinícios.

  function signOutRedirect() {
    try {
      // Se o SDK compat estiver disponível, faz signOut
      if (window.firebase && window.firebase.auth) {
        try { window.firebase.auth().signOut().catch(() => {}); } catch {}
      }
    } catch {}
    try { sessionStorage.removeItem('authUser'); } catch {}
    try { localStorage.removeItem('authUser'); } catch {}
    clearAuthToken();
    window.location.href = 'index.html';
  }

  // UI: loading overlay minimalista
  function setLoading(show, text) {
    let el = document.getElementById('auth-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'auth-loading';
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.35);z-index:9999';
      const box = document.createElement('div');
      box.style.cssText = 'display:flex;gap:10px;align-items:center;background:#131316;color:#fff;border:1px solid #2a2a32;padding:12px 16px;border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.35)';
      const spinner = document.createElement('div');
      spinner.style.cssText = 'width:18px;height:18px;border:3px solid #888;border-top-color:#fff;border-radius:50%;animation:authSpin .8s linear infinite';
      const label = document.createElement('span'); label.textContent = text || 'Carregando...'; label.id = 'auth-loading-label';
      box.append(spinner, label); el.append(box);
      const style = document.createElement('style');
      style.textContent = '@keyframes authSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
      document.body.appendChild(el);
    }
    const label = el.querySelector('#auth-loading-label'); if (label && text) label.textContent = text;
    el.style.display = show ? 'grid' : 'none';
  }

  function showToast(msg) {
    try {
      const t = document.getElementById('toast');
      if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
    } catch {}
  }

  async function verifySession() {
    const user = getAuthUser();
    if (!user) { clearAuthToken(); return; }
    const exp = getAuthTokenExp();
    const now = Date.now();
    const nearExpiry = exp && now > (exp - 30000); // expira em 30s
    const missing = !getAuthToken();
    if (missing || nearExpiry) {
      setLoading(true, 'Verificando sessão...');
      try {
        if (window.Auth && window.Auth.getIdTokenResult) {
          const res = await window.Auth.getIdTokenResult(true);
          const token = res && res.token;
          const expMs = res && res.expirationTime ? new Date(res.expirationTime).getTime() : 0;
          if (!token || !expMs) throw new Error('Token inválido');
          setAuthToken(token, expMs);
        }
      } catch (e) {
        const msg = (e && e.code) ? String(e.code) : (e && e.message) || '';
        if (msg.includes('auth') || msg.toLowerCase().includes('token')) {
          showToast('Sessão expirada. Entre novamente.');
        } else {
          showToast('Falha ao verificar sessão. Tente novamente.');
        }
        signOutRedirect();
      } finally {
        setLoading(false);
      }
    }
  }

  // Wrapper para fetch: mostra loading em requisições autenticadas
  try {
    if (window.fetch && !window.__authFetchWrapped) {
      const orig = window.fetch.bind(window);
      window.__authFetchWrapped = true;
      window.fetch = async function () {
        let show = false;
        try {
          const arg1 = arguments[0];
          const arg2 = arguments[1] || {};
          const hdrs = (arg2 && arg2.headers) || (arg1 && arg1.headers) || {};
          const urlStr = typeof arg1 === 'string' ? arg1 : (arg1 && arg1.url) || '';
          let isSameOrigin = false;
          let isApi = false;
          try {
            const u = new URL(urlStr, location.href);
            isSameOrigin = u.origin === location.origin;
            isApi = /^\/api\//.test(u.pathname);
          } catch {}
          const isFirestore = typeof urlStr === 'string' && (urlStr.indexOf('firestore.googleapis.com') >= 0 || urlStr.indexOf('/google.firestore.v1.Firestore/') >= 0);
          const authHeader = hdrs['Authorization'] || hdrs['authorization'] || (typeof hdrs.get === 'function' ? (hdrs.get('Authorization') || hdrs.get('authorization')) : null);
          show = !!authHeader && isSameOrigin && isApi && !isFirestore;
        } catch {}
        if (show) setLoading(true, 'Carregando...');
        try { return await orig.apply(this, arguments); }
        finally { if (show) setLoading(false); }
      };
    }
  } catch {}

  function updateHeader() {
    const user = getAuthUser();
    const loginLink = document.querySelector('a.nav-link[href="login.html"]');
    if (!loginLink) return;

    if (!user) {
      loginLink.innerHTML = '<span>Entrar</span>';
      loginLink.setAttribute('href', 'login.html');
      loginLink.classList.remove('account-trigger');
      const dd = loginLink.querySelector('.account-dropdown');
      if (dd) dd.remove();
      return;
    }

    // Usuário logado: transformar em gatilho de menu de conta
    const photo = user.photo || user.photoURL || 'assets/avatar6.png';
    const nome = user.name || user.displayName || 'Cliente';
    const primeiroNome = (nome || '').split(' ')[0] || nome;

    loginLink.classList.add('account-trigger');
    loginLink.setAttribute('href', '#');
    loginLink.innerHTML = `
      <img class="user-avatar" src="${photo}" alt="Perfil" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/avatar6.png'" />
      <span>Olá, ${primeiroNome}</span>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    // Cria dropdown se ainda não existir
    let dropdown = loginLink.querySelector('.account-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'account-dropdown';
      dropdown.innerHTML = `
        <div class="account-header">
          <img class="user-avatar" src="${photo}" alt="Avatar" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='assets/avatar6.png'" />
          <div class="account-meta">
            <div class="account-name">${nome}</div>
            <div class="account-email">${user.email || ''}</div>
          </div>
        </div>
        <a class="account-item" href="conta.html">Sua Conta</a>
        <button class="account-item" data-action="signout" type="button">Log out</button>
      `;
      loginLink.appendChild(dropdown);
      // Eventos específicos do dropdown
      dropdown.addEventListener('click', (e) => e.stopPropagation());
      dropdown.querySelector('[data-action="signout"]').addEventListener('click', (e) => { e.preventDefault(); dropdown.classList.remove('open'); signOutRedirect(); });
    }

    // Garante que o clique sempre abre/fecha o menu (uma vez só)
    if (!loginLink.__accountEventsBound) {
      const toggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dd = loginLink.querySelector('.account-dropdown');
        if (dd) dd.classList.toggle('open');
      };
      const close = () => {
        const dd = loginLink.querySelector('.account-dropdown');
        if (dd) dd.classList.remove('open');
      };
      const onOutsideClick = (e) => {
        const dd = loginLink.querySelector('.account-dropdown');
        if (!dd) return;
        if (!dd.contains(e.target) && !loginLink.contains(e.target)) close();
      };
      loginLink.addEventListener('click', toggle);
      // Acessibilidade: abrir com Enter/Espaço
      loginLink.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); }
      });
      document.addEventListener('click', onOutsideClick);
      loginLink.__accountEventsBound = true;
    }
  }

  function requireAuthOnCheckout() {
    const isCheckout = /checkout\.html$/i.test(location.pathname);
    if (!isCheckout) return;
    const user = getAuthUser();
    if (!user) {
      // preserva intenção do usuário: volta à página de login
      window.location.href = 'login.html';
      return;
    }
    // Se houver DB, exige status ativo
    try {
      if (window.DB && window.DB.isReady()) {
        window.DB.isClientActive(user.uid).then((ok) => {
          if (!ok) {
            alert('Seu acesso ainda não foi aprovado. Aguarde liberação.');
            window.location.href = 'empresa.html';
          }
        }).catch(() => {});
      }
    } catch {}
  }

  function initAuthUI() {
    setLoading(true, 'Carregando sessão...');
    verifySession().finally(() => {
      setLoading(false);
      updateHeader();
    });
    requireAuthOnCheckout();

    // Drag-scroll lateral no cabeçalho (mouse/touch)
    try {
      const nav = document.querySelector('.site-header .nav');
      if (nav && nav.scrollWidth > nav.clientWidth) {
        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;
        const onPointerDown = (e) => {
          isDown = true;
          startX = e.clientX;
          startScrollLeft = nav.scrollLeft;
          nav.style.cursor = 'grabbing';
          nav.style.userSelect = 'none';
          try { nav.setPointerCapture && nav.setPointerCapture(e.pointerId); } catch {}
        };
        const onPointerMove = (e) => {
          if (!isDown) return;
          const delta = e.clientX - startX;
          nav.scrollLeft = startScrollLeft - delta;
        };
        const onPointerUp = (e) => {
          if (!isDown) return;
          isDown = false;
          nav.style.cursor = '';
          nav.style.userSelect = '';
          try { nav.releasePointerCapture && nav.releasePointerCapture(e.pointerId); } catch {}
        };
        nav.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        // Prevenir seleção ao arrastar rápido
        nav.addEventListener('dragstart', (e) => e.preventDefault());
      }
    } catch {}
  }

  // Executa mesmo se o script for carregado após DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthUI);
  } else {
    initAuthUI();
  }
})();
