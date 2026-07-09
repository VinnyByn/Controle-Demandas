/**
 * Firestore — uma demanda por documento em `demandas/{id}`.
 * Diárias e projetistas em `demandasSistema/meta`.
 * Legado: `demandasSistema/state` (payload) — só leitura + migração manual.
 */
const DemandasFirebase = (function () {
  const STORAGE_KEY = "demandasProjetos_v1";
  const COL_DEMANDAS = "demandas";
  const COL_SYSTEM = "demandasSistema";
  const DOC_META = "meta";
  const DOC_LEGACY = "state";
  const BATCH_SIZE = 450;
  const REQ_TIMEOUT_MS = 15000;
  const LISTENER_TIMEOUT_MS = 12000;

  let db = null;
  let metaRef = null;
  let legacyRef = null;
  let onStatusFn = () => {};
  let onDataFn = null;
  let unsubDemandas = null;
  let unsubMeta = null;
  let snapDemandas = [];
  let snapMeta = { diarias: [], projetistas: {}, deletedDemandaIds: [], deletedDiariaIds: [] };
  let metaLoaded = false;
  let demandasLoaded = false;
  let legacyHintChecked = false;
  let autoMigrateAttempted = false;
  let listenerTimeoutId = null;
  /** Demandas com upsert em andamento — não devem ser dropadas pelo merge mesmo
   * que ainda não estejam no snapshot. Após confirmação do servidor, aguardamos
   * uma janela curta para o listener entregar a versão antes de remover daqui. */
  const inflightUpserts = new Set();
  const INFLIGHT_LINGER_MS = 1500;
  /** Meta (diárias/projetistas) com persistMeta em voo — evita perder gravação recente no merge. */
  let inflightMeta = null;
  const INFLIGHT_META_MS = 3000;

  function cfg() {
    return window.FIREBASE_CONFIG || {};
  }

  function isConfigured() {
    const c = cfg();
    if (!c.apiKey || !c.projectId) return false;
    return !String(c.apiKey).includes("COLOQUE");
  }

  function emptyState() {
    return {
      demandas: [],
      diarias: [],
      projetistas: {},
      pendingDeleteDemandaIds: [],
      deletedDemandaIds: [],
      deletedDiariaIds: [],
    };
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveLocal(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Cópia local:", e);
    }
  }

  function normalizePayload(data) {
    if (!data || typeof data !== "object") return emptyState();
    return {
      demandas: Array.isArray(data.demandas) ? data.demandas : [],
      diarias: Array.isArray(data.diarias) ? data.diarias : [],
      projetistas: data.projetistas && typeof data.projetistas === "object" ? data.projetistas : {},
      pendingDeleteDemandaIds: Array.isArray(data.pendingDeleteDemandaIds)
        ? data.pendingDeleteDemandaIds.filter((id) => id)
        : [],
      deletedDemandaIds: Array.isArray(data.deletedDemandaIds)
        ? data.deletedDemandaIds.filter((id) => id)
        : [],
      deletedDiariaIds: Array.isArray(data.deletedDiariaIds)
        ? data.deletedDiariaIds.filter((id) => id)
        : [],
    };
  }

  function deleteTombstoneSet(local) {
    const n = normalizePayload(local);
    return new Set([...(n.pendingDeleteDemandaIds || []), ...(n.deletedDemandaIds || [])]);
  }

  function pendingDeleteSet(local) {
    return deleteTombstoneSet(local);
  }

  function filterDemandasNotPendingDelete(demandas, pending) {
    if (!pending?.size) return demandas || [];
    return (demandas || []).filter((d) => d?.id && !pending.has(d.id));
  }

  function itemTime(item) {
    const t = Date.parse(item?.updatedAt || item?.createdAt || 0);
    return Number.isFinite(t) ? t : 0;
  }

  function mergeById(a, b) {
    const map = new Map();
    for (const item of [...(b || []), ...(a || [])]) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      if (!prev || itemTime(item) >= itemTime(prev)) map.set(item.id, item);
    }
    return [...map.values()];
  }

  function syncPresenceFieldsFromRemote(merged, remote) {
    if (remote.editingBy) merged.editingBy = remote.editingBy;
    else delete merged.editingBy;
    if (remote.editingAt) merged.editingAt = remote.editingAt;
    else delete merged.editingAt;
  }

  /** Demandas: em empate de updatedAt, a nuvem ganha; presença segue sempre o remoto. */
  function mergeDemandaById(local, remote, pendingDeletes = new Set(), opts = {}) {
    const trustRemote = !!opts.trustRemote;
    const map = new Map();
    const remoteIds = new Set();
    for (const d of remote || []) {
      if (d?.id) remoteIds.add(d.id);
    }
    for (const d of local || []) {
      if (!d?.id) continue;
      if (pendingDeletes.has(d.id)) continue;
      if (trustRemote && !remoteIds.has(d.id) && !inflightUpserts.has(d.id)) {
        // Documento não está no snapshot da nuvem e não há upsert em voo:
        // foi excluído remotamente. Não preserva a cópia local.
        continue;
      }
      map.set(d.id, d);
    }
    for (const d of remote || []) {
      if (!d?.id) continue;
      if (pendingDeletes.has(d.id)) continue;
      const prev = map.get(d.id);
      if (!prev) {
        map.set(d.id, d);
        continue;
      }
      const tr = itemTime(d);
      const tl = itemTime(prev);
      if (tr > tl) {
        map.set(d.id, d);
      } else if (tr === tl) {
        const merged = { ...prev, ...d };
        syncPresenceFieldsFromRemote(merged, d);
        map.set(d.id, merged);
      }
    }
    return [...map.values()];
  }

  function projetistaEntryTime(entry) {
    if (!entry) return 0;
    const t = itemTime(entry);
    if (t) return t;
    const d = Date.parse(entry.desde || 0);
    return Number.isFinite(d) ? d : 0;
  }

  function filterDiariasNotDeleted(diarias, tombstones) {
    if (!tombstones?.size) return diarias || [];
    return (diarias || []).filter((d) => d?.id && !tombstones.has(d.id));
  }

  /** Diárias: última alteração vence; tombstones impedem ressurreição de excluídas. */
  function mergeDiariasById(local, remote, tombstones = new Set(), opts = {}) {
    const map = new Map();
    const inflight = filterDiariasNotDeleted(inflightMeta?.diarias, tombstones);
    const inflightIds = new Set(inflight.map((d) => d.id));
    const remoteList = filterDiariasNotDeleted(remote, tombstones);
    const localList = filterDiariasNotDeleted(local, tombstones);

    for (const d of remoteList) {
      map.set(d.id, d);
    }

    for (const d of localList) {
      const prev = map.get(d.id);
      if (prev) {
        if (itemTime(d) >= itemTime(prev)) map.set(d.id, d);
        continue;
      }
      if (opts.trustRemote && !inflightIds.has(d.id) && !itemTime(d)) continue;
      map.set(d.id, d);
    }

    for (const d of inflight) {
      const prev = map.get(d.id);
      if (!prev || itemTime(d) >= itemTime(prev)) map.set(d.id, d);
    }

    return [...map.values()];
  }

  /** Projetistas: última alteração vence por nome (nuvem + local + gravação em voo). */
  function mergeProjetistasByNome(local, remote) {
    const out = {};
    const names = new Set([
      ...Object.keys(remote || {}),
      ...Object.keys(local || {}),
      ...Object.keys(inflightMeta?.projetistas || {}),
    ]);
    for (const nome of names) {
      const candidates = [
        remote?.[nome],
        local?.[nome],
        inflightMeta?.projetistas?.[nome],
      ].filter(Boolean);
      if (!candidates.length) continue;
      let best = candidates[0];
      for (let i = 1; i < candidates.length; i += 1) {
        if (projetistaEntryTime(candidates[i]) >= projetistaEntryTime(best)) best = candidates[i];
      }
      out[nome] = best;
    }
    return out;
  }

  function mergeState(remote, local, opts = {}) {
    const r = normalizePayload(remote);
    const l = normalizePayload(local);
    if (!local) {
      return {
        ...r,
        demandas: filterDemandasNotPendingDelete(r.demandas, pendingDeleteSet(r)),
      };
    }
    if (!remote) return l;
    const remoteTombstones = new Set(r.deletedDemandaIds || []);
    const localTombstones = pendingDeleteSet(l);
    const allTombstones = new Set([...localTombstones, ...remoteTombstones]);
    const mergedDeleted = [...new Set([...(l.deletedDemandaIds || []), ...remoteTombstones])];
    const mergedDeletedDiarias = [...new Set([...(l.deletedDiariaIds || []), ...(r.deletedDiariaIds || [])])];
    const diariaTombstones = new Set(mergedDeletedDiarias);
    return {
      demandas: mergeDemandaById(l.demandas, r.demandas, allTombstones, opts),
      diarias: mergeDiariasById(l.diarias, r.diarias, diariaTombstones, opts),
      projetistas: mergeProjetistasByNome(l.projetistas, r.projetistas),
      pendingDeleteDemandaIds: l.pendingDeleteDemandaIds,
      deletedDemandaIds: mergedDeleted,
      deletedDiariaIds: mergedDeletedDiarias,
    };
  }

  function pruneConfirmedDeletes(payload, remoteDemandas) {
    const remoteIds = new Set((remoteDemandas || []).map((d) => d.id));
    const wasPending = payload.pendingDeleteDemandaIds || [];
    const stillPending = wasPending.filter((id) => remoteIds.has(id));
    const confirmed = wasPending.filter((id) => !remoteIds.has(id));
    const deletedDemandaIds = [...new Set([...(payload.deletedDemandaIds || []), ...confirmed])];
    const tombstones = new Set([...stillPending, ...deletedDemandaIds]);
    return {
      ...payload,
      pendingDeleteDemandaIds: stillPending,
      deletedDemandaIds,
      demandas: filterDemandasNotPendingDelete(payload.demandas, tombstones),
    };
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);
  }

  function demandaToFirestore(d) {
    const copy = { ...d };
    delete copy.id;
    delete copy.editingBy;
    delete copy.editingAt;
    return copy;
  }

  function demandaFromFirestore(id, data) {
    if (!data || typeof data !== "object") return null;
    return { id, ...data };
  }

  async function checkLegacyHint() {
    if (legacyHintChecked || snapDemandas.length > 0 || !legacyRef) return;
    legacyHintChecked = true;
    try {
      const legacy = await readLegacyPayload();
      if (legacy?.demandas?.length) {
        window.__demandasSyncHint =
          "Dados no formato antigo (state). Clique 5× em «Projetos» no topo para migrar.";
      }
    } catch (_) {}
  }

  async function tryAutoMigrateLegacy() {
    if (autoMigrateAttempted || snapDemandas.length > 0) return;
    autoMigrateAttempted = true;
    try {
      const res = await migrateLegacyPayload({ force: false });
      if (res.migrated > 0) window.__demandasSyncHint = "";
    } catch (e) {
      console.warn("Migração automática legado:", e);
    }
  }

  function clearListenerTimeout() {
    if (listenerTimeoutId) {
      clearTimeout(listenerTimeoutId);
      listenerTimeoutId = null;
    }
  }

  function scheduleListenerTimeout() {
    clearListenerTimeout();
    listenerTimeoutId = setTimeout(() => {
      if (demandasLoaded && metaLoaded) return;
      console.warn("Firestore: timeout aguardando snapshots", {
        demandasLoaded,
        metaLoaded,
      });
      demandasLoaded = true;
      metaLoaded = true;
      onStatusFn("error");
      window.__demandasSyncHint =
        window.__demandasSyncHint ||
        "Tempo esgotado ao carregar a nuvem. Exibindo cópia local; verifique rede e permissões.";
      emitLocalFallback();
    }, LISTENER_TIMEOUT_MS);
  }

  function emitToUi() {
    if (!onDataFn) return;
    if (!demandasLoaded || !metaLoaded) return;
    clearListenerTimeout();
    const remote = { demandas: snapDemandas, ...snapMeta };
    const merged = pruneConfirmedDeletes(
      mergeState(remote, loadLocal(), { trustRemote: true }),
      snapDemandas,
    );
    onDataFn(merged);
    saveLocal(merged);
    onStatusFn("synced");
    if (snapDemandas.length === 0 && deleteTombstoneSet(loadLocal()).size === 0) {
      void checkLegacyHint();
      // Migração legado é manual (5 cliques na marca «Projetos»). Não restauramos automaticamente
      // demandas antigas do payload legado para evitar ressurreição de itens já excluídos.
    }
  }

  function emitLocalFallback() {
    if (!onDataFn) return;
    const merged = pruneConfirmedDeletes(
      mergeState({ demandas: snapDemandas, ...snapMeta }, loadLocal()),
      snapDemandas,
    );
    onDataFn(merged);
    saveLocal(merged);
  }

  function getDb() {
    if (db) return db;
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg());
    db = firebase.firestore(app);
    try {
      db.settings({ experimentalForceLongPolling: true });
    } catch (_) {}
    metaRef = db.collection(COL_SYSTEM).doc(DOC_META);
    legacyRef = db.collection(COL_SYSTEM).doc(DOC_LEGACY);
    return db;
  }

  function waitForAuthUser(timeoutMs = 8000) {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg());
    const auth = firebase.auth(app);
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error("Faça login para acessar os dados."));
      }, timeoutMs);
      const unsub = auth.onAuthStateChanged((user) => {
        if (!user) return;
        clearTimeout(timer);
        unsub();
        resolve(user);
      });
    });
  }

  async function ensureAuth() {
    await waitForAuthUser();
  }

  function startListeners(onData) {
    onDataFn = onData;
    const database = getDb();
    demandasLoaded = false;
    metaLoaded = false;
    scheduleListenerTimeout();

    if (unsubDemandas) unsubDemandas();
    unsubDemandas = database.collection(COL_DEMANDAS).onSnapshot(
      (snap) => {
        snapDemandas = [];
        snap.forEach((doc) => {
          const d = demandaFromFirestore(doc.id, doc.data());
          if (d) snapDemandas.push(d);
        });
        demandasLoaded = true;
        emitToUi();
      },
      (err) => {
        console.warn("Listener demandas:", err);
        demandasLoaded = true;
        onStatusFn("error");
        window.__demandasSyncHint = err.message || "Erro ao sincronizar demandas";
        emitLocalFallback();
      },
    );

    if (unsubMeta) unsubMeta();
    unsubMeta = metaRef.onSnapshot(
      (snap) => {
        if (snap.exists) {
          const d = snap.data();
          snapMeta = {
            diarias: Array.isArray(d.diarias) ? d.diarias : [],
            projetistas: d.projetistas && typeof d.projetistas === "object" ? d.projetistas : {},
            deletedDemandaIds: Array.isArray(d.deletedDemandaIds)
              ? d.deletedDemandaIds.filter((id) => typeof id === "string" && id)
              : [],
            deletedDiariaIds: Array.isArray(d.deletedDiariaIds)
              ? d.deletedDiariaIds.filter((id) => typeof id === "string" && id)
              : [],
          };
          if (inflightMeta && Date.now() < inflightMeta.until) {
            /* mantém inflight até timeout — merge usa inflightMeta */
          } else {
            inflightMeta = null;
          }
        } else {
          snapMeta = { diarias: [], projetistas: {}, deletedDemandaIds: [], deletedDiariaIds: [] };
        }
        metaLoaded = true;
        emitToUi();
      },
      (err) => {
        console.warn("Listener meta:", err);
        metaLoaded = true;
        snapMeta = { diarias: [], projetistas: {}, deletedDemandaIds: [], deletedDiariaIds: [] };
        onStatusFn("error");
        window.__demandasSyncHint =
          window.__demandasSyncHint || err.message || "Erro ao sincronizar meta";
        emitLocalFallback();
      },
    );
  }

  async function ensureMetaDoc(initial) {
    const snap = await withTimeout(metaRef.get(), REQ_TIMEOUT_MS);
    if (snap.exists) return;
    await metaRef.set({
      diarias: initial.diarias || [],
      projetistas: initial.projetistas || {},
      deletedDiariaIds: initial.deletedDiariaIds || [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function readLegacyPayload() {
    const snap = await withTimeout(legacyRef.get(), REQ_TIMEOUT_MS);
    if (!snap.exists) return null;
    const d = snap.data();
    if (d.payload) {
      try {
        return normalizePayload(JSON.parse(d.payload));
      } catch {
        return emptyState();
      }
    }
    return normalizePayload(d);
  }

  async function upsertDemanda(demanda) {
    if (!demanda?.id) return;
    inflightUpserts.add(demanda.id);
    try {
      await ensureAuth();
      onStatusFn("saving");
      const ref = getDb().collection(COL_DEMANDAS).doc(demanda.id);
      await withTimeout(
        ref.set(
          {
            ...demandaToFirestore(demanda),
            updatedAt: demanda.updatedAt || new Date().toISOString(),
            editingBy: firebase.firestore.FieldValue.delete(),
            editingAt: firebase.firestore.FieldValue.delete(),
          },
          { merge: true },
        ),
        REQ_TIMEOUT_MS,
      );
      onStatusFn("synced");
    } finally {
      // Mantém a marca por mais um instante para o listener entregar a versão
      // sincronizada antes da próxima passagem de merge.
      setTimeout(() => inflightUpserts.delete(demanda.id), INFLIGHT_LINGER_MS);
    }
  }

  async function deleteDemanda(id) {
    if (!id) return;
    const local = loadLocal() || emptyState();
    const norm = normalizePayload(local);
    if (!norm.pendingDeleteDemandaIds.includes(id)) norm.pendingDeleteDemandaIds.push(id);
    if (!norm.deletedDemandaIds.includes(id)) norm.deletedDemandaIds.push(id);
    norm.demandas = (norm.demandas || []).filter((d) => d.id !== id);
    saveLocal(norm);
    await ensureAuth();
    onStatusFn("saving");
    await withTimeout(getDb().collection(COL_DEMANDAS).doc(id).delete(), REQ_TIMEOUT_MS);
    try {
      await withTimeout(
        metaRef.set(
          {
            deletedDemandaIds: firebase.firestore.FieldValue.arrayUnion(id),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
        REQ_TIMEOUT_MS,
      );
    } catch (e) {
      console.warn("Tombstone na nuvem:", e);
    }
    onStatusFn("synced");
  }

  /** Presença de edição — não altera updatedAt da demanda. */
  async function patchDemandaPresence(demandaId, editingBy) {
    if (!demandaId) return;
    try {
      await ensureAuth();
      const ref = getDb().collection(COL_DEMANDAS).doc(demandaId);
      const data = editingBy
        ? {
            editingBy,
            editingAt: editingBy.since || new Date().toISOString(),
          }
        : {
            editingBy: firebase.firestore.FieldValue.delete(),
            editingAt: firebase.firestore.FieldValue.delete(),
          };
      await withTimeout(ref.set(data, { merge: true }), REQ_TIMEOUT_MS);
    } catch (e) {
      console.warn("patchDemandaPresence:", e);
      throw e;
    }
  }

  async function persistMeta(meta) {
    await ensureAuth();
    onStatusFn("saving");
    inflightMeta = {
      diarias: meta.diarias || [],
      projetistas: meta.projetistas || {},
      deletedDiariaIds: meta.deletedDiariaIds || [],
      until: Date.now() + INFLIGHT_META_MS,
    };
    try {
      await withTimeout(
        metaRef.set(
          {
            diarias: meta.diarias || [],
            projetistas: meta.projetistas || {},
            deletedDiariaIds: meta.deletedDiariaIds || [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
        REQ_TIMEOUT_MS,
      );
      onStatusFn("synced");
    } finally {
      setTimeout(() => {
        if (inflightMeta && Date.now() >= inflightMeta.until) inflightMeta = null;
      }, INFLIGHT_META_MS);
    }
  }

  async function importFullState(data) {
    const n = normalizePayload(data);
    for (const d of n.demandas) {
      if (d?.id) await upsertDemanda(d);
    }
    await persistMeta({ diarias: n.diarias, projetistas: n.projetistas, deletedDiariaIds: n.deletedDiariaIds || [] });
  }

  async function migrateLegacyPayload({ force = false } = {}) {
    await ensureAuth();
    if (!force && snapDemandas.length > 0) {
      return { migrated: 0, skipped: snapDemandas.length, message: "A coleção demandas já tem documentos. Use forçar no console se necessário." };
    }

    const legacy = await readLegacyPayload();
    if (!legacy || !legacy.demandas.length) {
      return { migrated: 0, skipped: 0, message: "Nenhum payload legado encontrado em demandasSistema/state." };
    }

    const localTombstones = deleteTombstoneSet(loadLocal());
    const remoteTombstones = new Set((snapMeta.deletedDemandaIds || []).filter(Boolean));
    const tombstones = new Set([...localTombstones, ...remoteTombstones]);
    const toMigrate = legacy.demandas.filter((d) => d?.id && !tombstones.has(d.id));
    if (!toMigrate.length) {
      return { migrated: 0, skipped: legacy.demandas.length, message: "Nenhuma demanda legada para migrar (excluídas ou já na nuvem)." };
    }

    const database = getDb();
    let migrated = 0;
    for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
      const chunk = toMigrate.slice(i, i + BATCH_SIZE);
      const batch = database.batch();
      for (const d of chunk) {
        if (!d?.id) continue;
        const ref = database.collection(COL_DEMANDAS).doc(d.id);
        batch.set(ref, demandaToFirestore(d), { merge: true });
        migrated += 1;
      }
      await withTimeout(batch.commit(), REQ_TIMEOUT_MS * 2);
    }

    const metaSnap = await metaRef.get();
    if (!metaSnap.exists) {
      await persistMeta({
        diarias: legacy.diarias,
        projetistas: legacy.projetistas,
        deletedDiariaIds: legacy.deletedDiariaIds || [],
      });
    }

    await legacyRef.set(
      {
        migratedAt: new Date().toISOString(),
        migratedCount: migrated,
      },
      { merge: true },
    );

    return { migrated, skipped: 0, message: `${migrated} demanda(s) migrada(s) para a coleção demandas.` };
  }

  async function initFirebase({ onData, onStatus }) {
    onStatusFn = onStatus || (() => {});
    onStatusFn("connecting");
    window.__demandasSyncHint = "";

    await ensureAuth();
    getDb();

    const localBackup = loadLocal();
    if (localBackup && onData) {
      onData(mergeState({ demandas: [], ...snapMeta }, localBackup));
    }

    startListeners(onData);

    try {
      await ensureMetaDoc(localBackup || emptyState());
    } catch (e) {
      console.warn("ensureMetaDoc:", e);
      window.__demandasSyncHint =
        window.__demandasSyncHint || e.message || "Não foi possível preparar documento meta";
    }

    return {
      mode: "firebase",
      upsertDemanda,
      deleteDemanda,
      patchDemandaPresence,
      persistMeta,
      importFullState,
      migrateLegacyPayload,
    };
  }

  function initLocal({ onData, onStatus }) {
    onStatusFn = onStatus || (() => {});
    const data = loadLocal() || emptyState();
    onData(data);
    onStatusFn("local");
    const noop = async () => {};
    return {
      mode: "local",
      upsertDemanda: noop,
      deleteDemanda: noop,
      patchDemandaPresence: noop,
      persistMeta: noop,
      importFullState: noop,
      migrateLegacyPayload: async () => ({
        migrated: 0,
        message: "Disponível apenas com Firebase configurado.",
      }),
    };
  }

  function teardown() {
    clearListenerTimeout();
    if (unsubDemandas) {
      unsubDemandas();
      unsubDemandas = null;
    }
    if (unsubMeta) {
      unsubMeta();
      unsubMeta = null;
    }
    db = null;
    metaRef = null;
    legacyRef = null;
    onDataFn = null;
    snapDemandas = [];
    snapMeta = { diarias: [], projetistas: {}, deletedDemandaIds: [], deletedDiariaIds: [] };
    demandasLoaded = false;
    metaLoaded = false;
  }

  async function init({ onData, onStatus }) {
    if (!isConfigured()) {
      window.__demandasSyncHint = "Configure firebase-config.js";
      return initLocal({ onData, onStatus });
    }
    if (typeof DemandasAuth !== "undefined" && !DemandasAuth.currentUser()) {
      try {
        await waitForAuthUser();
      } catch (_) {
        window.__demandasSyncHint = "Faça login para acessar a nuvem.";
        throw new Error(window.__demandasSyncHint);
      }
    } else if (typeof firebase !== "undefined") {
      try {
        await waitForAuthUser();
      } catch (_) {
        window.__demandasSyncHint = "Faça login para acessar a nuvem.";
        throw new Error(window.__demandasSyncHint);
      }
    }
    try {
      return await initFirebase({ onData, onStatus });
    } catch (e) {
      console.error("Nuvem indisponível:", e);
      if (!window.__demandasSyncHint) window.__demandasSyncHint = e.message || "Erro de conexão";
      if (location.protocol === "file:") {
        window.__demandasSyncHint = "Use https://demproj-fdeac.web.app — não abra o arquivo da pasta.";
      }
      throw e;
    }
  }

  return { init, teardown, isConfigured, loadLocal, saveLocal, migrateLegacyPayload };
})();
