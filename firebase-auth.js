/**
 * Login e-mail/senha — Firebase Authentication.
 */
const DemandasAuth = (function () {
  let auth = null;
  let onUserCallback = () => {};

  function isConfigured() {
    const c = window.FIREBASE_CONFIG || {};
    return !!(c.apiKey && c.projectId && !String(c.apiKey).includes("COLOQUE"));
  }

  function mapAuthError(err) {
    const code = err?.code || "";
    const map = {
      "auth/invalid-email": "E-mail inválido.",
      "auth/user-disabled": "Usuário desativado. Fale com o administrador.",
      "auth/user-not-found": "E-mail ou senha incorretos.",
      "auth/wrong-password": "E-mail ou senha incorretos.",
      "auth/invalid-credential": "E-mail ou senha incorretos.",
      "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
      "auth/operation-not-allowed":
        "Login por e-mail/senha não está ativo no Firebase. Ative em Authentication → Sign-in method.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
      "auth/network-request-failed": "Sem conexão. Verifique a internet.",
      "auth/missing-password": "Informe a senha.",
    };
    return map[code] || err?.message || "Não foi possível entrar. Tente novamente.";
  }

  function getAuth() {
    if (typeof firebase === "undefined") return null;
    if (!isConfigured()) return null;
    if (!auth) {
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
      auth = firebase.auth(app);
    }
    return auth;
  }

  /** Registra callback e espera o primeiro estado de auth. */
  function init(onUser) {
    if (typeof onUser === "function") onUserCallback = onUser;
    const a = getAuth();
    if (!a) {
      onUserCallback(null);
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const unsub = a.onAuthStateChanged(
        (user) => {
          onUserCallback(user);
          resolve(a);
        },
        (err) => {
          console.error("Auth listener:", err);
          reject(err);
        },
      );
      void unsub;
    });
  }

  function currentUser() {
    return getAuth()?.currentUser || null;
  }

  async function signIn(email, password) {
    const a = getAuth();
    if (!a) throw new Error("Firebase Auth não carregou. Recarregue a página (Ctrl+F5).");
    return await a.signInWithEmailAndPassword(String(email).trim(), password);
  }

  async function signOut() {
    const a = getAuth();
    if (!a) return;
    if (typeof DemandasFirebase?.teardown === "function") DemandasFirebase.teardown();
    await a.signOut();
    onUserCallback(null);
  }

  return {
    isConfigured,
    init,
    currentUser,
    signIn,
    signOut,
    mapAuthError,
  };
})();
