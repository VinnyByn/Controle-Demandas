/**
 * Login independente — carrega antes do app.js para o botão Entrar sempre funcionar.
 */
(function () {
  function showErr(msg) {
    const el = document.getElementById("loginError");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  }

  function setLoading(on) {
    const btn = document.getElementById("btnLoginSubmit");
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? "Entrando…" : "Entrar";
  }

  async function waitForAppHandler(user, maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (typeof window.onDemandasAuthReady === "function") {
        try {
          await window.onDemandasAuthReady(user);
          return true;
        } catch (err) {
          console.error("Pós-login:", err);
          showErr(err.message || "Erro ao abrir o painel.");
          return false;
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  async function doLoginSubmit(e) {
    e.preventDefault();
    showErr("");

    if (typeof DemandasAuth === "undefined") {
      showErr("Autenticação não carregou. Recarregue a página (Ctrl+F5).");
      return;
    }

    const email = document.getElementById("loginEmail")?.value?.trim() || "";
    const password = document.getElementById("loginPassword")?.value || "";
    if (!email || !password) {
      showErr("Informe e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      await DemandasAuth.signIn(email, password);
      const user = DemandasAuth.currentUser();
      if (!user) {
        showErr("Sessão não reconhecida. Tente novamente.");
        return;
      }
      const ok = await waitForAppHandler(user, 8000);
      if (!ok) {
        showErr(
          "Não foi possível abrir o painel. Confira se app-boot.js e app.js carregaram (F12 → Rede) e recarregue com Ctrl+F5.",
        );
      }
    } catch (err) {
      console.error("Login:", err);
      showErr(DemandasAuth.mapAuthError ? DemandasAuth.mapAuthError(err) : err.message || "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  function bindForm() {
    const form = document.getElementById("loginForm");
    if (!form || form.dataset.loginInit === "1") return;
    form.dataset.loginInit = "1";
    form.addEventListener("submit", (ev) => void doLoginSubmit(ev));
    document.getElementById("btnLoginSubmit")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      void doLoginSubmit(ev);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindForm);
  } else {
    bindForm();
  }

  window.demandasDoLogin = () => {
    const form = document.getElementById("loginForm");
    if (form) form.requestSubmit();
  };
})();
