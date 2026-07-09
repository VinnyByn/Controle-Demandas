/**
 * Login → Esteira Projetos: não depende do fim do app.js para iniciar.
 */
(function () {
  const LINHA_OPERACIONAL = "operacional";
  const LINHA_B2B = "b2b";

  function resolveUserHome(user) {
    if (window.DemandasUserHome?.resolve) {
      return window.DemandasUserHome.resolve(user);
    }
    return { tab: "esteira", esteira: LINHA_OPERACIONAL };
  }

  function hideLoader() {
    const loader = document.getElementById("appLoader");
    if (loader) loader.hidden = true;
  }

  function patchSyncBadge(text, status) {
    const el = document.getElementById("syncBadge");
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.title = text;
    el.dataset.status = status || "connecting";
  }

  /** Abre a aba Esteira na linha configurada para o usuário (antes do app.js terminar). */
  function showEsteiraHomeForUser(user) {
    const home = resolveUserHome(user);
    const linha = home.esteira === LINHA_B2B ? LINHA_B2B : LINHA_OPERACIONAL;
    const isB2b = linha === LINHA_B2B;

    document.querySelectorAll(".panel").forEach((p) => {
      const isEsteira = p.id === "panelEsteira";
      p.hidden = !isEsteira;
      p.classList.toggle("is-visible", isEsteira);
    });
    document.querySelectorAll(".tabs__btn[data-tab]").forEach((b) => {
      const on = b.dataset.tab === "esteira" || b.id === "btnTabEsteira";
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    const viewOp = document.getElementById("esteiraViewOperacional");
    const viewB2b = document.getElementById("esteiraViewB2b");
    if (viewOp) viewOp.hidden = isB2b;
    if (viewB2b) viewB2b.hidden = !isB2b;
    const label = document.getElementById("esteiraTabLabel");
    if (label) label.textContent = isB2b ? "· B2B" : "· Projetos";
    document.querySelectorAll("[data-esteira-linha]").forEach((item) => {
      item.classList.toggle("is-active", item.dataset.esteiraLinha === linha);
    });
  }

  function showAppShell(user) {
    const loginScreen = document.getElementById("loginScreen");
    const appRoot = document.getElementById("appRoot");
    const emailEl = document.getElementById("authUserEmail");
    const btnOut = document.getElementById("btnSignOut");

    if (loginScreen) loginScreen.hidden = true;
    if (appRoot) appRoot.hidden = false;
    hideLoader();
    showEsteiraHomeForUser(user);
    patchSyncBadge("Conectando…", "connecting");

    if (emailEl && user) {
      emailEl.textContent = user.email || "Usuário";
      emailEl.hidden = false;
    }
    if (btnOut) btnOut.hidden = false;
  }

  async function finishLoginWhenAppReady(user) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (typeof window.__demandasFinishLoginFull === "function") {
        await window.__demandasFinishLoginFull(user);
        return;
      }
      if (typeof window.setSyncStatus === "function") {
        window.setSyncStatus("connecting");
      } else {
        patchSyncBadge("Conectando…", "connecting");
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    patchSyncBadge("Erro ao carregar app.js — Ctrl+F5", "error");
    throw new Error("O painel não terminou de carregar. Recarregue com Ctrl+F5.");
  }

  window.__demandasFinishLogin = finishLoginWhenAppReady;

  window.onDemandasAuthReady = async function (user) {
    if (!user) {
      const loginScreen = document.getElementById("loginScreen");
      const appRoot = document.getElementById("appRoot");
      if (loginScreen) loginScreen.hidden = false;
      if (appRoot) appRoot.hidden = true;
      hideLoader();
      return;
    }

    showAppShell(user);

    try {
      await finishLoginWhenAppReady(user);
    } catch (e) {
      console.error(e);
      patchSyncBadge("Erro — recarregue a página", "error");
    }
  };
})();
