// Inicialização e provedores do Firebase Auth (compat)
// Requer: firebase-app-compat.js, firebase-auth-compat.js e (opcional) auth.config.js

(function () {
  const hasConfig = typeof window.FIREBASE_CONFIG !== 'undefined';
  let app = null;
  let auth = null;
  let phoneAppVerifier = null;
  // Persistência de estado de redirect (usa localStorage com fallback a sessionStorage)
  const setPending = (name) => {
    try { localStorage.setItem('authPending', name); return; } catch {}
    try { sessionStorage.setItem('authPending', name); } catch {}
  };
  const clearPending = () => {
    try { localStorage.removeItem('authPending'); } catch {}
    try { sessionStorage.removeItem('authPending'); } catch {}
  };
  const getPending = () => {
    try { const v = localStorage.getItem('authPending'); if (v) return v; } catch {}
    try { return sessionStorage.getItem('authPending') || null; } catch { return null; }
  };

  function init() {
    if (!hasConfig) return false;
    if (!app) {
      app = firebase.initializeApp(window.FIREBASE_CONFIG);
      auth = firebase.auth();
      // Usa persistência de sessão: login dura apenas na aba/sessão atual
      try { auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch {}
    }
    return true;
  }

  function ensureInit() {
    const ok = init();
    if (!ok) throw new Error('Firebase não configurado. Crie auth.config.js com FIREBASE_CONFIG.');
  }

  function providerFor(name) {
    switch (name) {
      case 'google':
        return new firebase.auth.GoogleAuthProvider();
      case 'apple':
        {
          const provider = new firebase.auth.OAuthProvider('apple.com');
          // Solicita e-mail e nome (Apple só entrega nome na primeira vez)
          try {
            provider.addScope('email');
            provider.addScope('name');
          } catch {}
          return provider;
        }
      case 'microsoft':
        return new firebase.auth.OAuthProvider('microsoft.com');
      default:
        throw new Error('Provider desconhecido: ' + name);
    }
  }

  async function signInWithProvider(name) {
    ensureInit();
    const provider = providerFor(name);
    // Opcional: força popup
    return auth.signInWithPopup(provider);
  }

  // Apple via redirect – evita bloqueios de popup em alguns navegadores
  async function signInWithRedirectProvider(name) {
    ensureInit();
    const provider = providerFor(name);
    setPending(name);
    return auth.signInWithRedirect(provider);
  }

  // Google via redirect – para cenários onde popup é bloqueado
  async function signInWithGoogleRedirect() {
    ensureInit();
    const provider = providerFor('google');
    setPending('google');
    return auth.signInWithRedirect(provider);
  }

  // Recupera resultado de redirect após retorno do provedor
  function getRedirectResult() {
    ensureInit();
    return auth.getRedirectResult()
      .then((res) => { clearPending(); return res; })
      .catch((e) => { clearPending(); throw e; });
  }

  function getPhoneVerifier(containerId) {
    ensureInit();
    if (!phoneAppVerifier) {
      phoneAppVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
        size: 'invisible',
      });
    }
    return phoneAppVerifier;
  }

  async function startPhoneSignIn(phoneNumber, containerId) {
    const verifier = getPhoneVerifier(containerId);
    return auth.signInWithPhoneNumber(phoneNumber, verifier);
  }

  function confirmPhoneCode(confirmationResult, code) {
    return confirmationResult.confirm(code);
  }

  function onStateChange(cb) {
    ensureInit();
    return auth.onAuthStateChanged(cb);
  }

  // Exponho uma API simples no window
  window.Auth = {
    isReady: () => !!hasConfig && !!auth,
    init,
    signInWithGoogle: () => signInWithProvider('google'),
    signInWithGoogleRedirect,
    signInWithApple: () => signInWithProvider('apple'),
    signInWithMicrosoft: () => signInWithProvider('microsoft'),
    signInWithAppleRedirect: () => signInWithRedirectProvider('apple'),
    getRedirectResult,
    startPhoneSignIn,
    confirmPhoneCode,
    onStateChange,
    // Tokens
    getIdToken: (force) => { ensureInit(); const u = auth.currentUser; return u ? u.getIdToken(!!force) : Promise.reject(new Error('Nenhum usuário autenticado')); },
    getIdTokenResult: (force) => { ensureInit(); const u = auth.currentUser; return u ? u.getIdTokenResult(!!force) : Promise.reject(new Error('Nenhum usuário autenticado')); },
    // Auxiliares para debug e tratamento de casos especiais
    getPending,
    firebase: { app: () => app, auth: () => auth },
    getSignInMethodsForEmail: (email) => { ensureInit(); return auth.fetchSignInMethodsForEmail(email); },
  };

  // Inicializa e persiste estado básico
  try {
    if (init()) {
      onStateChange((user) => {
        const data = user
          ? { uid: user.uid, email: user.email, name: user.displayName, phone: user.phoneNumber, photo: user.photoURL }
          : null;
        try {
          sessionStorage.setItem('authUser', JSON.stringify(data));
        } catch (e) {
          try { localStorage.setItem('authUser', JSON.stringify(data)); } catch {}
        }
        // Atualiza token e expiração
        if (user) {
          user.getIdTokenResult()
            .then((res) => {
              const token = res && res.token;
              const expMs = res && res.expirationTime ? new Date(res.expirationTime).getTime() : 0;
              try { sessionStorage.setItem('authToken', token || ''); sessionStorage.setItem('authTokenExp', String(expMs || 0)); } catch {}
              try { localStorage.setItem('authToken', token || ''); localStorage.setItem('authTokenExp', String(expMs || 0)); } catch {}
            })
            .catch(() => {
              try { sessionStorage.removeItem('authToken'); sessionStorage.removeItem('authTokenExp'); } catch {}
              try { localStorage.removeItem('authToken'); localStorage.removeItem('authTokenExp'); } catch {}
            });
        } else {
          try { sessionStorage.removeItem('authToken'); sessionStorage.removeItem('authTokenExp'); } catch {}
          try { localStorage.removeItem('authToken'); localStorage.removeItem('authTokenExp'); } catch {}
        }
      });
    }
  } catch (e) {
    console.warn('Auth init aviso:', e.message);
  }
})();
