(() => {
  const qs = (sel) => document.querySelector(sel);
  const loadScript = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.defer = true; s.onload = resolve; s.onerror = () => reject(new Error('Falha ao carregar ' + src)); document.head.appendChild(s); });

  // Traduz códigos comuns de erro do Firebase Auth em mensagens mais úteis
  const friendlyAuthError = (e, providerName) => {
    const code = e && (e.code || (e.error && e.error.code));
    switch (code) {
      case 'auth/configuration-not-found':
        return `${providerName}: provedor não configurado para este projeto. Ative e configure em Firebase Console → Authentication → Sign-in method. Também confira Authentication → Settings → Authorized domains e inclua o domínio atual (${location.hostname}).`;
      case 'auth/operation-not-allowed':
        return `${providerName}: provedor desativado. Ative em Authentication → Sign-in method.`;
      case 'auth/unauthorized-domain':
        return `${providerName}: domínio não autorizado para OAuth. Verifique se ${location.hostname} está em Authentication → Settings → Authorized domains e se o authDomain do app corresponde ao projeto correto.`;
      case 'auth/popup-blocked':
      case 'auth/popup-closed-by-user':
        return `${providerName}: o popup foi bloqueado ou fechado. Permita popups para este site e tente novamente.`;
      case 'auth/cancelled-popup-request':
        return `${providerName}: outra tentativa de login estava em andamento. Aguarde e tente novamente.`;
      case 'auth/account-exists-with-different-credential':
        return `${providerName}: essa conta já existe com outro provedor. Entre com o provedor original (ex.: Google/Microsoft) e depois vincule o Apple nas configurações da conta.`;
      case 'auth/network-request-failed':
        return `${providerName}: falha de rede. Verifique sua conexão e desative bloqueadores que interfiram nos domínios *.google.com e *.firebaseapp.com.`;
      default:
        return `${providerName}: ${e && e.message ? e.message : 'Erro inesperado.'}`;
    }
  };

  // Mapeia providerId → nome amigável
  const providerNameFromId = (id) => {
    switch (id) {
      case 'google.com': return 'Google';
      case 'microsoft.com': return 'Microsoft';
      case 'apple.com': return 'Apple';
      case 'password': return 'E-mail e senha';
      default: return id || 'outro provedor';
    }
  };

  // Detecta iOS (inclui iPad em modo desktop)
  const isIOS = (() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const iOSUA = /iPad|iPhone|iPod/.test(ua);
    const iPadDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return iOSUA || iPadDesktop;
  })();

  // Detecta se sessionStorage está acessível (evita erro de estado inicial ausente)
  const canUseSessionStorage = (() => {
    try {
      const k = '__auth_test__';
      sessionStorage.setItem(k, '1');
      sessionStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  })();

  // Sugere o provedor correto e prepara vinculação automática da credencial
  async function handleAccountExists(err, currentProviderName) {
    try {
      const cred = (firebase && firebase.auth && firebase.auth.OAuthProvider && firebase.auth.OAuthProvider.credentialFromError)
        ? firebase.auth.OAuthProvider.credentialFromError(err)
        : (err && err.credential) || null;
      if (cred) {
        window.__pendingLinkCredential = cred;
      }
    } catch {}
    const email = (err && err.customData && err.customData.email) || err?.email || null;
    let suggestedName = 'o provedor original';
    try {
      if (window.Auth && email) {
        const methods = await window.Auth.getSignInMethodsForEmail(email);
        if (methods && methods.length) {
          suggestedName = providerNameFromId(methods[0]);
        }
      }
    } catch {}
    alert(`${currentProviderName}: essa conta já existe com outro provedor. Entre com ${suggestedName} usando o botão correspondente e, depois, vincularemos ${currentProviderName} automaticamente.`);
  }

  // Google Identity – sem Firebase
  async function signInWithGoogle() {
    try {
      if (!window.GOOGLE_CLIENT_ID) { alert('Google não configurado. Defina GOOGLE_CLIENT_ID em auth.config.js'); return; }
      if (!window.google || !window.google.accounts) {
        await loadScript('https://accounts.google.com/gsi/client');
      }
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: window.GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        prompt: '',
        callback: async (tokenResponse) => {
          try {
            const at = tokenResponse && tokenResponse.access_token;
            if (!at) throw new Error('Sem access_token');
            const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + at } });
            const u = await r.json();
            const user = { uid: u.sub, email: u.email, name: u.name, photo: u.picture };
            try { sessionStorage.setItem('authUser', JSON.stringify(user)); localStorage.setItem('authUser', JSON.stringify(user)); } catch {}
            try { sessionStorage.setItem('authToken', at); localStorage.setItem('authToken', at); } catch {}
            window.location.href = 'index.html';
          } catch (e) {
            alert('Google: ' + (e && e.message ? e.message : 'Falha ao obter perfil'));
          }
        },
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      alert('Google: ' + (e && e.message ? e.message : 'Erro inesperado'));
    }
  }

  const afterLogin = async (user, overrides = {}) => {
    if (!user) return;
    // Carrega Firestore/DB somente após autenticação para evitar conexões Listen na tela de login
    async function ensureDBLoaded() {
      if (window.DB && typeof window.DB.isReady === 'function') return;
      const loadScript = (src) => new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.defer = true;
        s.onload = resolve; s.onerror = () => reject(new Error('Falha ao carregar ' + src));
        document.head.appendChild(s);
      });
      // Firestore compat e módulo DB local
      await loadScript('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js');
      await loadScript('firebase-db.js');
    }

    try { await ensureDBLoaded(); } catch {}
    const name = overrides.name ?? user.displayName ?? null;
    const email = overrides.email ?? user.email ?? null;
    const phone = user.phoneNumber ?? null;
    const photo = overrides.photo ?? user.photoURL ?? ((user.providerData && user.providerData[0] && user.providerData[0].photoURL) || null);
    try {
      sessionStorage.setItem('authUser', JSON.stringify({ uid: user.uid, email, name, phone, photo }));
    } catch {
      try { localStorage.setItem('authUser', JSON.stringify({ uid: user.uid, email, name, phone, photo })); } catch {}
    }
    // Captura e persiste token de ID e expiração
    try {
      if (window.Auth && window.Auth.getIdTokenResult) {
        const res = await window.Auth.getIdTokenResult(false);
        const token = res && res.token;
        const expMs = res && res.expirationTime ? new Date(res.expirationTime).getTime() : 0;
        try { sessionStorage.setItem('authToken', token || ''); sessionStorage.setItem('authTokenExp', String(expMs || 0)); } catch {}
        try { localStorage.setItem('authToken', token || ''); localStorage.setItem('authTokenExp', String(expMs || 0)); } catch {}
      }
    } catch {}
    // Se houver credencial pendente para vincular (ex.: Apple), tenta linkar antes de redirecionar
    try {
      const pending = window.__pendingLinkCredential;
      if (pending && window.Auth && window.Auth.firebase?.auth()) {
        const cu = window.Auth.firebase.auth().currentUser;
        if (cu) {
          await cu.linkWithCredential(pending);
          console.log('Conta vinculada com', pending.providerId);
          window.__pendingLinkCredential = null;
        }
      }
    } catch (e) {
      console.warn('Falha ao vincular credencial pendente:', e && e.code, e && e.message);
      window.__pendingLinkCredential = null;
    }
    // Cria/garante registro do cliente na base
    try {
      if (window.DB && window.DB.isReady()) {
        window.DB.ensureClientRecord(user).then(() => {
          const patch = {};
          if (name) patch.name = name;
          if (email) patch.email = email;
          if (photo) patch.photo = photo;
          if (Object.keys(patch).length) { window.DB.updateSelf(user.uid, patch).catch(() => {}); }
        }).catch(() => {});
      }
    } catch {}
    window.location.href = 'index.html';
  };

  qs('.auth-google')?.addEventListener('click', signInWithGoogle);

  ['.auth-apple','.auth-microsoft','.auth-phone'].forEach((sel) => {
    const btn = qs(sel);
    if (btn) btn.addEventListener('click', () => alert('Este provedor será habilitado em breve. Use Google por enquanto.'));
  });

  // Email/telefone – permanecem como placeholders

  qs('.auth-microsoft')?.addEventListener('click', async () => {
    if (!requireAuthConfig()) return;
    if (authFlowInProgress) return;
    authFlowInProgress = true;
    try { const res = await window.Auth.signInWithMicrosoft(); await afterLogin(res.user); }
    catch (e) {
      if ((e && e.code) === 'auth/account-exists-with-different-credential') {
        await handleAccountExists(e, 'Microsoft');
      } else {
        alert(friendlyAuthError(e, 'Erro no Microsoft'));
      }
    }
    finally { authFlowInProgress = false; }
  });

  // Telefone – fluxo de SMS
  const phoneLogin = qs('#phone-login');
  const phoneNumberInput = qs('#phone-number');
  const phoneCodeInput = qs('#phone-code');
  let confirmationResult = null;

  qs('.auth-phone')?.addEventListener('click', () => {
    phoneLogin.hidden = !phoneLogin.hidden;
    if (!phoneLogin.hidden) phoneNumberInput?.focus();
  });

  qs('#phone-send')?.addEventListener('click', async () => {
    if (!requireAuthConfig()) return;
    let input = (phoneNumberInput?.value || '').trim();
    // Normaliza para E.164: remove não dígitos e garante prefixo '+'
    let phone = input;
    if (!/^\+\d{7,}$/.test(input)) {
      const digits = input.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length >= 10) {
        phone = '+' + digits; // Brasil com DDI já presente
      } else if (digits.length >= 10 && digits.length <= 12) {
        // Assume Brasil quando não há DDI explícito
        phone = '+55' + digits;
      }
    }
    if (!/^\+\d{10,15}$/.test(phone)) { alert('Telefone inválido. Use formato +55DDDNÚMERO (somente dígitos).'); return; }
    try {
      confirmationResult = await window.Auth.startPhoneSignIn(phone, 'recaptcha-container');
      alert('Código enviado por SMS. Digite para verificar.');
      phoneCodeInput?.focus();
    } catch (e) {
      alert('Erro ao enviar código: ' + e.message);
    }
  });

  qs('#phone-verify')?.addEventListener('click', async () => {
    if (!requireAuthConfig()) return;
    if (!confirmationResult) { alert('Primeiro envie o código ao seu telefone.'); return; }
    const code = (phoneCodeInput?.value || '').trim();
    if (!/^[0-9]{4,8}$/.test(code)) { alert('Código inválido.'); return; }
    try { const res = await window.Auth.confirmPhoneCode(confirmationResult, code); await afterLogin(res.user); }
    catch (e) { alert('Erro ao verificar código: ' + e.message); }
  });

  // Email login
  const emailForm = qs('#auth-email-form');
  const emailInput = qs('#auth-email');
  emailForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (emailInput?.value || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Informe um e-mail válido.');
      return;
    }
    // Placeholder: aqui você pode enviar código mágico/link de login
    alert(`Enviaremos um link para: ${email}`);
  });

  // Navegação entre seções
  const signupSection = qs('#signup-section');
  const recoverSection = qs('#recover-section');
  const showMain = () => { signupSection.hidden = true; recoverSection.hidden = true; };
  const showSignup = () => { signupSection.hidden = false; recoverSection.hidden = true; };
  const showRecover = () => { signupSection.hidden = true; recoverSection.hidden = false; };

  qs('#link-signup')?.addEventListener('click', showSignup);
  qs('#link-recover')?.addEventListener('click', showRecover);
  qs('#signup-back')?.addEventListener('click', showMain);
  qs('#recover-back')?.addEventListener('click', showMain);

  // Form de cadastro – placeholder
  const signupForm = qs('#signup-form');
  signupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (qs('#signup-name')?.value || '').trim();
    const email = (qs('#signup-email')?.value || '').trim();
    const pwd = (qs('#signup-password')?.value || '').trim();
    if (!name || !email || !pwd) { alert('Preencha todos os campos.'); return; }
    alert(`Conta criada para ${name}. Confirme no e-mail: ${email}`);
    showMain();
  });

  // Form de recuperação – placeholder
  const recoverForm = qs('#recover-form');
  recoverForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (qs('#recover-email')?.value || '').trim();
    if (!email) { alert('Informe seu e-mail.'); return; }
    alert(`Se existir conta, enviaremos um link para: ${email}`);
    showMain();
  });
})();
