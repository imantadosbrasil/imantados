// Firestore (compat) – base de clientes
// Requer: firebase-app-compat.js, firebase-firestore-compat.js e (opcional) auth.config.js

(function () {
  const hasConfig = typeof window.FIREBASE_CONFIG !== 'undefined';
  let db = null;

  function init() {
    if (!hasConfig) return false;
    try {
      // Usa o app já inicializado pelo Auth ou inicializa se necessário
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
      }
      db = firebase.firestore();
      // Ajustes para ambientes com proxies/firewalls (reduz XHR abortados do Listen)
      try {
        db.settings({
          // Detecta automaticamente quando precisa usar long‑polling
          experimentalAutoDetectLongPolling: true,
          // Força long‑polling (mitiga ERR_ABORTED em ambientes locais/proxy)
          experimentalForceLongPolling: true,
          // Desativa fetch streams para maior compatibilidade com proxies
          useFetchStreams: false,
        });
      } catch (e) {
        // Em versões antigas do SDK pode não suportar estas flags
      }
      return true;
    } catch (e) {
      console.warn('Firestore init aviso:', e.message);
      return false;
    }
  }

  function ensureInit() {
    const ok = init();
    if (!ok) throw new Error('Firebase não configurado. Crie auth.config.js com FIREBASE_CONFIG.');
  }

  function clientsCol() { ensureInit(); return db.collection('clientes'); }

  // Catálogo público de modelos por categoria
  function categoriesCol() { ensureInit(); return db.collection('categorias'); }

  async function getCategoryModels(category) {
    ensureInit();
    if (!category) return [];
    const col = categoriesCol().doc(category).collection('modelos');
    try {
      const snap = await col.orderBy('ordem', 'asc').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (_) {
      // Se não existir campo 'ordem', tenta sem ordenação
      const snap = await col.get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  }

  async function ensureClientRecord(user) {
    ensureInit();
    if (!user || !user.uid) return null;
    const ref = clientsCol().doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();
    const data = {
      uid: user.uid,
      email: user.email || null,
      name: user.displayName || null,
      phone: user.phoneNumber || null,
      photo: user.photoURL || ((user.providerData && user.providerData[0] && user.providerData[0].photoURL) || null),
      role: 'client',
      status: 'pending', // admin pode aprovar depois no Console
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(data, { merge: true });
    return data;
  }

  async function getClient(uid) {
    ensureInit();
    const ref = clientsCol().doc(uid);
    const snap = await ref.get();
    return snap.exists ? snap.data() : null;
  }

  async function isClientActive(uid) {
    const data = await getClient(uid);
    return !!(data && data.status === 'active');
  }

  async function updateSelf(uid, partial) {
    ensureInit();
    const ref = clientsCol().doc(uid);
    await ref.set(partial, { merge: true });
  }

  function onClientSnapshot(uid, cb, onError) {
    ensureInit();
    const ref = clientsCol().doc(uid);
    return ref.onSnapshot({
      next: (snap) => cb(snap.exists ? snap.data() : null),
      error: (err) => {
        try { console.warn('Firestore snapshot erro:', err && err.code, err && err.message); } catch {}
        if (typeof onError === 'function') {
          try { onError(err); } catch {}
        }
      },
    });
  }

  window.DB = {
    isReady: () => hasConfig,
    init,
    ensureClientRecord,
    getClient,
    isClientActive,
    updateSelf,
    onClientSnapshot,
    getCategoryModels,
  };
})();
