const STORAGE_KEY = "demandasProjetos_v1";
const APP_PUBLIC_URL = "https://demproj-fdeac.web.app";

const STATUS_ORDER = [
  ["novo", "Projetos novos"],
  ["analise", "Análise geral / desenho"],
  ["vistoria", "Vistoria"],
  ["custo", "Levantamento de custo"],
  ["revisao", "Revisão"],
  ["aprovacao", "Aprovação"],
  ["materiais", "Materiais"],
  ["execucao", "Execução Regional"],
  ["execucao_terceirizada", "Execução Terceirizada"],
  ["configuracao_op", "IP e Serviços"],
  ["transmissao_infra_op", "Transmissão e Infra"],
  ["documentacao_op", "Documentação"],
  ["conclusao", "Conclusão"],
];

const STATUS_EXTRA = [
  ["pausado", "Pausado"],
  ["reprovado", "Reprovado"],
];

const STATUS_LABEL = Object.fromEntries([...STATUS_ORDER, ...STATUS_EXTRA]);

/** Esteira B2B — fluxo comercial distinto. */
const LINHA_ESTEIRA_OPERACIONAL = "operacional";
const LINHA_ESTEIRA_B2B = "b2b";

const STATUS_ORDER_B2B = [
  ["pre_vendas", "Pré-Vendas"],
  ["analise_kmz", "Análise Geral / KMZ"],
  ["vistoria", "Vistoria"],
  ["custo", "Levantamento de Custo"],
  ["aprovacao_bp", "Aprovação BP"],
  ["projeto_final", "Projeto Final"],
  ["estoque", "Estoque"],
  ["configuracao", "Execução Regional"],
  ["execucao_terceirizada", "Execução Terceirizada"],
  ["documentacao", "Documentação / As-Builts"],
  ["pausado", "Pausados"],
];

const STATUS_LABEL_B2B = Object.fromEntries(STATUS_ORDER_B2B);

/** B2B: projeto concluído (esteira e indicadores). */
const STATUS_B2B_CONCLUIDOS = new Set(["projeto_final", "documentacao"]);

/** Pós-aprovação BP — estoque e projeto final (dashboard: Aprovados). */
const STATUS_B2B_APROVADOS = ["estoque", "projeto_final"];

/** Execução na esteira B2B — regional (configuração) e terceirizada. */
const STATUS_B2B_EXECUCAO_REGIONAL = ["configuracao"];
const STATUS_B2B_EXECUCAO_TERCEIRIZADA = ["execucao_terceirizada"];
const STATUS_B2B_EXECUCAO = [...STATUS_B2B_EXECUCAO_REGIONAL, ...STATUS_B2B_EXECUCAO_TERCEIRIZADA];

const MAP_STATUS_OPERACIONAL_PARA_B2B = {
  novo: "pre_vendas",
  analise: "analise_kmz",
  vistoria: "vistoria",
  custo: "custo",
  revisao: "aprovacao_bp",
  aprovacao: "aprovacao_bp",
  materiais: "estoque",
  execucao: "configuracao",
  execucao_terceirizada: "execucao_terceirizada",
  configuracao_op: "configuracao",
  transmissao_infra_op: "documentacao",
  documentacao_op: "documentacao",
  conclusao: "projeto_final",
  pausado: "pausado",
  reprovado: "pausado",
};

function buildEsteiraConfig(statusOrder, statusExtra, inboxStatus) {
  return {
    statusOrder,
    statusExtra,
    statusLabel: Object.fromEntries([...statusOrder, ...statusExtra]),
    inboxStatus,
  };
}

const ESTEIRA_CONFIG = {
  [LINHA_ESTEIRA_OPERACIONAL]: buildEsteiraConfig(STATUS_ORDER, STATUS_EXTRA, "novo"),
  [LINHA_ESTEIRA_B2B]: buildEsteiraConfig(STATUS_ORDER_B2B, [], "pre_vendas"),
};

function getEsteiraConfig(linha = activeEsteiraCanal) {
  return ESTEIRA_CONFIG[normalizeLinhaEsteira(linha)] || ESTEIRA_CONFIG[LINHA_ESTEIRA_OPERACIONAL];
}

function normalizeLinhaEsteira(v) {
  return v === LINHA_ESTEIRA_B2B ? LINHA_ESTEIRA_B2B : LINHA_ESTEIRA_OPERACIONAL;
}

function inferLinhaEsteira(d) {
  return normalizeTipo(d?.tipo) === "B2B" ? LINHA_ESTEIRA_B2B : LINHA_ESTEIRA_OPERACIONAL;
}

function mapStatusParaLinha(status, linha) {
  const cfg = getEsteiraConfig(linha);
  if (cfg.statusLabel[status]) return status;
  if (linha === LINHA_ESTEIRA_B2B && MAP_STATUS_OPERACIONAL_PARA_B2B[status]) {
    return MAP_STATUS_OPERACIONAL_PARA_B2B[status];
  }
  return cfg.inboxStatus;
}

function stripAccentsLower(text) {
  return String(text || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Resolve chave canônica a partir de slug ou rótulo exibido (ex.: «execução» → execucao). */
function resolveStatusKey(status, linha = activeEsteiraCanal) {
  const s = String(status || "").trim();
  if (!s) return s;
  const cfg = getEsteiraConfig(linha);
  if (cfg.statusLabel[s]) return s;
  if (linha === LINHA_ESTEIRA_B2B && MAP_STATUS_OPERACIONAL_PARA_B2B[s]) {
    return MAP_STATUS_OPERACIONAL_PARA_B2B[s];
  }
  const slug = stripAccentsLower(s);
  for (const [k] of [...cfg.statusOrder, ...(cfg.statusExtra || [])]) {
    if (k === s || stripAccentsLower(k) === slug) return k;
    const lab = cfg.statusLabel[k];
    if (lab && stripAccentsLower(lab) === slug) return k;
  }
  for (const [k, lab] of [...STATUS_ORDER, ...STATUS_EXTRA]) {
    if (k === s || stripAccentsLower(k) === slug) return k;
    if (stripAccentsLower(lab) === slug) return k;
  }
  for (const [k, lab] of STATUS_ORDER_B2B) {
    if (k === s || stripAccentsLower(k) === slug) return k;
    if (stripAccentsLower(lab) === slug) return k;
  }
  if (normalizeLinhaEsteira(linha) === LINHA_ESTEIRA_OPERACIONAL) {
    if (slug === "configuracao") return "configuracao_op";
    if (slug === "transmissao e infra") return "transmissao_infra_op";
  }
  return s;
}

function capitalizeStatusLabel(text) {
  const s = String(text || "").trim();
  if (!s) return "—";
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
}

function labelStatus(status, linha = activeEsteiraCanal) {
  const s = String(status || "").trim();
  if (!s) return "—";
  const key = resolveStatusKey(s, linha);
  const cfg = getEsteiraConfig(linha);
  if (cfg.statusLabel[key]) return cfg.statusLabel[key];
  if (STATUS_LABEL[key]) return STATUS_LABEL[key];
  return capitalizeStatusLabel(s);
}

function statusConcluidoKey(linha = activeEsteiraCanal) {
  return linha === LINHA_ESTEIRA_B2B ? "projeto_final" : "conclusao";
}

function isStatusConcluidoDemanda(dm) {
  if (!dm) return false;
  const linha = inferLinhaEsteira(dm);
  if (linha === LINHA_ESTEIRA_B2B) return STATUS_B2B_CONCLUIDOS.has(dm.status);
  return dm.status === "conclusao";
}

function isStatusConcluidoNoFormulario(status, linha = editingLinhaEsteira) {
  if (normalizeLinhaEsteira(linha) === LINHA_ESTEIRA_B2B) return STATUS_B2B_CONCLUIDOS.has(status);
  return status === "conclusao";
}

let activeEsteiraCanal = LINHA_ESTEIRA_OPERACIONAL;
let editingLinhaEsteira = LINHA_ESTEIRA_OPERACIONAL;

/** Declarados no topo — o login roda antes do restante do script terminar. */
let appBootstrapped = false;
let bootstrapPromise = null;
let handleAuthPromise = null;
let persistenceApi = null;
let persistenceReady = false;
let pendingCloudPatch = null;

/** Setor responsável por cada coluna da esteira (dashboard — tempo). */
const SETORES_ESTEIRA = ["Projetos", "Operação", "Diretoria", "CD", "IP e Serviços", "Transmissão e Infra", "Terceirizada"];
const STATUS_SETOR = {
  novo: "Projetos",
  analise: "Projetos",
  vistoria: "Operação",
  custo: "Projetos",
  revisao: "Projetos",
  aprovacao: "Diretoria",
  materiais: "CD",
  execucao: "Operação",
  execucao_terceirizada: "Terceirizada",
  configuracao_op: "IP e Serviços",
  transmissao_infra_op: "Transmissão e Infra",
  documentacao_op: "Projetos",
};
const SETOR_COLORS = {
  Projetos: "#6366f1",
  Operação: "#14b8a6",
  Diretoria: "#f59e0b",
  CD: "#a855f7",
  "IP e Serviços": "#0ea5e9",
  "Transmissão e Infra": "#eab308",
  Terceirizada: "#ec4899",
  Comercial: "#f59e0b",
  "Engenharia/Noc": "#0ea5e9",
  Engenharia: "#0ea5e9",
  Outros: "#94a3b8",
};

/** Setores da esteira B2B (dashboard — tempo por setor). */
const SETORES_ESTEIRA_B2B = ["Comercial", "Projetos", "Operação", "CD", "Engenharia/Noc", "Terceirizada"];
const STATUS_SETOR_B2B = {
  pre_vendas: "Comercial",
  analise_kmz: "Projetos",
  vistoria: "Operação",
  custo: "Projetos",
  aprovacao_bp: "Comercial", // cadastro / timeline — tempo SLA B2B exclui esta etapa (stand-by)
  projeto_final: "Projetos",
  estoque: "CD",
  configuracao: "Operação",
  execucao_terceirizada: "Terceirizada",
  documentacao: "Projetos",
};
const SETOR_COLORS_B2B = {
  Comercial: "#f59e0b",
  Projetos: "#6366f1",
  Operação: "#14b8a6",
  CD: "#a855f7",
  "Engenharia/Noc": "#0ea5e9",
  Terceirizada: "#ec4899",
  Outros: "#94a3b8",
};

/** Não entram no dashboard de tempo (só etapas operacionais da esteira). */
const TEMPO_STATUS_EXCLUIDOS = new Set(["conclusao", "pausado", "reprovado"]);
const TEMPO_FASES_ORDER = STATUS_ORDER.map(([k]) => k).filter((k) => !TEMPO_STATUS_EXCLUIDOS.has(k));
/** Sem "Projetos novos" no filtro de status do dashboard Tempo por setor. */
const TEMPO_FILTRO_STATUS_OPCOES = TEMPO_FASES_ORDER.filter((k) => k !== "novo");

function isTempoStatusExcluded(status) {
  return TEMPO_STATUS_EXCLUIDOS.has(status);
}

function setorForStatus(status) {
  return STATUS_SETOR[status] || null;
}

/** B2B: pausado e Aprovação BP (stand-by externo) não entram no tempo por setor / SLA. */
const TEMPO_STATUS_EXCLUIDOS_B2B = new Set(["pausado", "aprovacao_bp"]);
const TEMPO_FASES_ORDER_B2B = STATUS_ORDER_B2B.map(([k]) => k).filter((k) => !TEMPO_STATUS_EXCLUIDOS_B2B.has(k));
const TEMPO_FILTRO_STATUS_OPCOES_B2B = TEMPO_FASES_ORDER_B2B.filter((k) => k !== "pre_vendas");

function isTempoStatusExcludedB2b(status) {
  const key = normalizeTempoStatusB2b(status);
  return TEMPO_STATUS_EXCLUIDOS_B2B.has(key);
}

/** Converte status do histórico (incl. legado operacional) para chave B2B. */
function normalizeTempoStatusB2b(status) {
  return resolveStatusKey(status, LINHA_ESTEIRA_B2B);
}

function normalizeTempoStatusOp(status) {
  return resolveStatusKey(status, LINHA_ESTEIRA_OPERACIONAL);
}

/** Setor no dashboard de tempo B2B — Aprovação BP não entra em nenhum setor (SLA). */
function setorForStatusTempoB2b(status) {
  const key = resolveStatusKey(status, LINHA_ESTEIRA_B2B);
  if (TEMPO_STATUS_EXCLUIDOS_B2B.has(key)) return null;
  return STATUS_SETOR_B2B[key] || null;
}

function setorForStatusDemanda(status, linha = editingLinhaEsteira) {
  if (normalizeLinhaEsteira(linha) === LINHA_ESTEIRA_B2B) {
    const key = resolveStatusKey(status, LINHA_ESTEIRA_B2B);
    return STATUS_SETOR_B2B[key] || null;
  }
  return setorForStatus(status);
}

function isTempoStatusExcludedDemanda(status, linha = editingLinhaEsteira) {
  if (normalizeLinhaEsteira(linha) === LINHA_ESTEIRA_B2B) {
    return isTempoStatusExcludedB2b(status);
  }
  return isTempoStatusExcluded(status);
}

function setorColorFor(setor, cfg = DASH_TEMPO_CFG_OP) {
  return (cfg.setorColors || SETOR_COLORS)[setor] || SETOR_COLORS.Outros;
}

const TEMPO_CHART_IDS = ["chartTempoFase", "chartTempoSetor", "chartTempoSetorStack"];
const TEMPO_RESUMO_SETOR_CHART_ID = "chartTempoSetorResumo";
const TEMPO_CHART_IDS_B2B = ["chartTempoB2bFase", "chartTempoB2bSetor", "chartTempoB2bSetorStack"];
const TEMPO_RESUMO_SETOR_CHART_ID_B2B = "chartTempoB2bSetorResumo";

const DASH_TEMPO_CFG_OP = {
  linhaEsteira: LINHA_ESTEIRA_OPERACIONAL,
  statusOrder: STATUS_ORDER,
  statusLabel: STATUS_LABEL,
  isStatusExcluded: isTempoStatusExcluded,
  setorForStatus,
  normalizeTempoStatus: normalizeTempoStatusOp,
  setores: SETORES_ESTEIRA,
  setorColors: SETOR_COLORS,
  fasesOrder: TEMPO_FASES_ORDER,
  filtroStatusOpcoes: TEMPO_FILTRO_STATUS_OPCOES,
  listFn: demandasEsteiraOperacionalList,
  emptyEsteiraMsg: "Nenhum projeto na esteira operacional.",
  esteiraLabel: "esteira operacional",
  chartIds: TEMPO_CHART_IDS,
  resumoChartId: TEMPO_RESUMO_SETOR_CHART_ID,
  ids: {
    mapBody: "dashTempoSetorMapBody",
    resumoHint: "dashTempoResumoHint",
    resumoTable: "dashTempoSetorResumoTable",
    count: "dashTempoCount",
    chartsWrap: "dashTempoCharts",
    kpis: "dashTempoKpis",
    filterBusca: "filterDashTempoBusca",
    filterResp: "filterDashTempoResp",
    filterStatus: "filterDashTempoStatus",
    filterAno: "filterDashTempoAno",
    filterMes: "filterDashTempoMes",
    chartFase: "chartTempoFase",
    chartSetor: "chartTempoSetor",
    chartStack: "chartTempoSetorStack",
  },
};

const DASH_TEMPO_CFG_B2B = {
  linhaEsteira: LINHA_ESTEIRA_B2B,
  statusOrder: STATUS_ORDER_B2B,
  statusLabel: STATUS_LABEL_B2B,
  isStatusExcluded: isTempoStatusExcludedB2b,
  setorForStatus: setorForStatusTempoB2b,
  normalizeTempoStatus: normalizeTempoStatusB2b,
  setores: SETORES_ESTEIRA_B2B,
  setorColors: SETOR_COLORS_B2B,
  fasesOrder: TEMPO_FASES_ORDER_B2B,
  filtroStatusOpcoes: TEMPO_FILTRO_STATUS_OPCOES_B2B,
  listFn: demandasB2bDashboardList,
  emptyEsteiraMsg: "Nenhum projeto na esteira B2B.",
  esteiraLabel: "esteira B2B",
  chartIds: TEMPO_CHART_IDS_B2B,
  resumoChartId: TEMPO_RESUMO_SETOR_CHART_ID_B2B,
  ids: {
    mapBody: "dashTempoB2bSetorMapBody",
    resumoHint: "dashTempoB2bResumoHint",
    resumoTable: "dashTempoB2bSetorResumoTable",
    count: "dashTempoB2bCount",
    chartsWrap: "dashTempoB2bCharts",
    kpis: "dashTempoB2bKpis",
    filterBusca: "filterDashTempoB2bBusca",
    filterResp: "filterDashTempoB2bResp",
    filterStatus: "filterDashTempoB2bStatus",
    filterAno: "filterDashTempoB2bAno",
    filterMes: "filterDashTempoB2bMes",
    chartFase: "chartTempoB2bFase",
    chartSetor: "chartTempoB2bSetor",
    chartStack: "chartTempoB2bSetorStack",
  },
};

function setorBadgeHtml(setor) {
  if (!setor) return "";
  const cls =
    setor === "Projetos"
      ? "dash-setor--projetos"
      : setor === "Operação"
        ? "dash-setor--operacao"
        : setor === "Diretoria"
          ? "dash-setor--diretoria"
          : setor === "CD"
            ? "dash-setor--cd"
            : setor === "Engenharia"
              ? "dash-setor--engenharia"
              : setor === "IP e Serviços"
                ? "dash-setor--ip-servicos"
                : setor === "Transmissão e Infra"
                  ? "dash-setor--transmissao-infra"
                  : setor === "Comercial"
                    ? "dash-setor--comercial"
                    : setor === "Engenharia/Noc"
                      ? "dash-setor--eng-noc"
                      : setor === "Terceirizada"
                        ? "dash-setor--terceirizada"
                        : "dash-setor--outros";
  return `<span class="dash-setor ${cls}">${escapeHtml(setor)}</span>`;
}

function columnHeadHtml(status, linha, count) {
  const title = escapeHtml(labelStatus(status, linha));
  const setor = setorForStatusDemanda(status, linha);
  const setorHtml = setor ? `<span class="column__setor">${setorBadgeHtml(setor)}</span>` : "";
  return (
    `<div class="column__head">` +
    `<div class="column__title" title="${title}">${title}</div>` +
    `<div class="column__head-meta">${setorHtml}<span class="column__count">${count}</span></div>` +
    `</div>`
  );
}

function sortProjetistasNomes(list) {
  return [...list].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

/** Esteira operacional — ordem alfabética (pt-BR). */
const PROJETISTAS = sortProjetistasNomes(["Vinicius", "Matheus", "João", "Daniel"]);
const PROJETISTA_PADRAO = "Vinicius";
/** Esteira B2B. */
const PROJETISTAS_B2B = sortProjetistasNomes(["Alberto", "Rafael"]);
const PROJETISTA_PADRAO_B2B = "Alberto";

function allProjetistasNomes() {
  return sortProjetistasNomes([...PROJETISTAS, ...PROJETISTAS_B2B]);
}

function projetistasForLinha(linha = activeEsteiraCanal) {
  return linha === LINHA_ESTEIRA_B2B ? PROJETISTAS_B2B : PROJETISTAS;
}
/** Valor do select: visão geral sem filtrar por projetista. */
const FILTER_PROJETISTA_TODOS = "__all__";

function projetistaSlug(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchFilterProjetista(d, resp) {
  if (!resp || resp === FILTER_PROJETISTA_TODOS) return true;
  if (resp === "__none__") return !normalizeResponsavel(d.responsavel);
  return d.responsavel === resp;
}
const TIPOS_DEMANDA = ["B2C", "B2B", "SWAP", "Backbone", "Licenciamento"];

/** Tipos no filtro da Esteira Projetos (sem B2B — fluxo na aba Esteira B2B). */
function tiposFiltroEsteiraProjetos() {
  return TIPOS_DEMANDA.filter((t) => t !== "B2B");
}
const TIPO_DIARIA_LEGADO = "Diária";

/** Produtos da linha B2B (ordem alfabética pt-BR). */
const PRODUTOS_B2B = sortProjetistasNomes([
  "Evento IP",
  "IP Dedicado",
  "IP Trânsito",
  "Lan to Lan",
  "Projeto Especial",
  "Transporte PTT",
  "Wireless",
]);

function normalizeProdutoB2b(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return PRODUTOS_B2B.includes(s) ? s : "";
}

/** Setor e solicitantes comerciais B2B (ordem alfabética pt-BR). */
const SETORES_SOLICITANTE_B2B = ["Comercial"];
const SOLICITANTES_B2B_COMERCIAL = sortProjetistasNomes([
  "Christopher Kurt",
  "Igor Barreto",
  "Igor Raposo",
  "Lorrany Rodrigues",
  "Michel Dias",
  "Pedro Cardoso",
  "Thiago Miranda",
]);
const SOLICITANTE_B2B_SEM = "Sem solicitante";
const SOLICITANTE_B2B_OUTROS = "Outros";

function normalizeSetorSolicitanteB2b(v) {
  const s = String(v || "").trim();
  if (!s) return SETORES_SOLICITANTE_B2B[0];
  return SETORES_SOLICITANTE_B2B.includes(s) ? s : SETORES_SOLICITANTE_B2B[0];
}

function normalizeSolicitanteB2b(v) {
  const s = String(v || "").trim();
  if (!s) return SOLICITANTE_B2B_SEM;
  const match = SOLICITANTES_B2B_COMERCIAL.find((n) => n.toLowerCase() === s.toLowerCase());
  return match || SOLICITANTE_B2B_OUTROS;
}

function solicitanteB2bBucket(d) {
  return normalizeSolicitanteB2b(migrateDemanda(d).solicitante);
}

/** Nome do solicitante comercial cadastrado na demanda, ou null. */
function resolveSolicitanteB2bComercial(d) {
  const sol = String(migrateDemanda(d).solicitante || "").trim();
  if (!sol) return null;
  return SOLICITANTES_B2B_COMERCIAL.find((n) => n.toLowerCase() === sol.toLowerCase()) || null;
}

/** Segmento da linha B2C (ordem alfabética pt-BR). */
const SEGMENTOS_B2C = sortProjetistasNomes(["MDU", "TCR", "TCT"]);

function normalizeSegmentoB2c(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return SEGMENTOS_B2C.includes(s) ? s : "";
}

/** Regionais e cidades (ordem alfabética por regional e por cidade). */
const REGIONAIS_CIDADES = {
  "Regional Centro Oeste": [
    "Belo Horizonte - BHE",
    "Betim - BET",
    "Carmo do Cajuru - CCU",
    "Contagem - CEM",
    "Divinópolis - DVL",
    "Igarapé - IRP",
    "Itaúna - IAN",
    "Juatuba - JUAU",
    "Mateus Leme - MAL",
    "Pará de Minas - PRS",
    "Santo Antônio dos Campos - SADC",
    "São Sebastião do Oeste - SWO",
  ],
  "Regional Norte de Minas": ["Montes Claros - MCL", "Paracatu - PTU", "Unaí - UNI"],
  "Regional São Paulo": [
    "Campos do Jordão - CPJ",
    "Guaratinguetá - GTA",
    "Lorena - LNA",
    "Pindamonhangaba - PBA",
    "São José dos Campos - SJC",
    "Taubaté - TTE",
    "Tremembé - TMB",
  ],
  "Regional Sul de Minas": [
    "Itajubá - IJA",
    "Lavras - LAV",
    "Passos - PSO",
    "Piranguinho - PGH",
    "Piranguçu - PYU",
    "Poços de Caldas - PCS",
    "Pouso Alegre - PSA",
    "Santa Rita do Sapucaí - SRS",
    "São José do Alegre - SLK",
    "Três Corações - TCS",
    "Varginha - VGA",
  ],
};

const REGIONAIS_ORDER = Object.keys(REGIONAIS_CIDADES).sort((a, b) => a.localeCompare(b, "pt-BR"));

const TODAS_CIDADES_LISTA = REGIONAIS_ORDER.flatMap((reg) => REGIONAIS_CIDADES[reg]);

function findRegionalForCidade(cidade) {
  const t = String(cidade || "").trim();
  if (!t) return "";
  for (const reg of REGIONAIS_ORDER) {
    const hit = REGIONAIS_CIDADES[reg].find((c) => c.toLowerCase() === t.toLowerCase());
    if (hit) return reg;
  }
  return "";
}

function normalizeCidadeCadastro(cidade) {
  const t = String(cidade || "").trim();
  if (!t) return "";
  const hit = TODAS_CIDADES_LISTA.find((c) => c.toLowerCase() === t.toLowerCase());
  return hit || t;
}

function fillDemRegionalSelect() {
  const sel = document.getElementById("demRegional");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Selecione a regional…</option>';
  for (const reg of REGIONAIS_ORDER) {
    const o = document.createElement("option");
    o.value = reg;
    o.textContent = reg;
    sel.appendChild(o);
  }
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function fillDemCidadeSelect(regional, selectedCidade = "") {
  const sel = document.getElementById("demCidade");
  if (!sel) return;
  const norm = normalizeCidadeCadastro(selectedCidade);
  const reg = regional || findRegionalForCidade(norm);
  sel.innerHTML = "";
  if (!reg || !REGIONAIS_CIDADES[reg]) {
    const legacyOnly = norm && !findRegionalForCidade(norm);
    if (legacyOnly) {
      sel.disabled = false;
      const oHint = document.createElement("option");
      oHint.value = "";
      oHint.textContent = "Selecione a regional para atualizar…";
      sel.appendChild(oHint);
      const oLeg = document.createElement("option");
      oLeg.value = norm;
      oLeg.textContent = `${norm} (cadastro antigo)`;
      oLeg.selected = true;
      sel.appendChild(oLeg);
      return;
    }
    sel.disabled = true;
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Selecione a regional primeiro…";
    sel.appendChild(o);
    return;
  }
  sel.disabled = false;
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "Selecione a cidade…";
  sel.appendChild(o0);
  const cities = [...REGIONAIS_CIDADES[reg]];
  let legacy = norm;
  if (legacy && !cities.some((c) => c.toLowerCase() === legacy.toLowerCase())) {
    const oLeg = document.createElement("option");
    oLeg.value = legacy;
    oLeg.textContent = `${legacy} (cadastro antigo)`;
    sel.appendChild(oLeg);
  }
  for (const c of cities) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  }
  if (norm) {
    const match = [...sel.options].find((o) => o.value && o.value.toLowerCase() === norm.toLowerCase());
    sel.value = match ? match.value : legacy && [...sel.options].some((o) => o.value === legacy) ? legacy : "";
  } else {
    sel.value = "";
  }
}

function setDemCidadeUi(cidade) {
  const norm = normalizeCidadeCadastro(cidade);
  const reg = findRegionalForCidade(norm);
  const selReg = document.getElementById("demRegional");
  if (selReg) selReg.value = reg || "";
  fillDemCidadeSelect(reg || selReg?.value || "", norm || cidade);
}

function readCidadeFromForm() {
  return normalizeCidadeCadastro(document.getElementById("demCidade")?.value || "");
}

function initDemCidadeSelects() {
  fillDemRegionalSelect();
  fillDemCidadeSelect("");
  document.getElementById("demRegional")?.addEventListener("change", () => {
    const reg = document.getElementById("demRegional")?.value || "";
    fillDemCidadeSelect(reg, "");
  });
}

function cidadesLegadasNoSistema() {
  const set = new Set();
  for (const d of state.demandas || []) {
    const c = normalizeCidadeCadastro(d.cidade);
    if (!c) continue;
    if (!TODAS_CIDADES_LISTA.some((x) => x.toLowerCase() === c.toLowerCase())) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function fillFilterRegionalSelect() {
  const sel = document.getElementById("filterRegional");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas</option>';
  for (const reg of REGIONAIS_ORDER) {
    const o = document.createElement("option");
    o.value = reg;
    o.textContent = reg;
    sel.appendChild(o);
  }
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function fillFilterCidadeSelect(regional = "") {
  const sel = document.getElementById("filterCidade");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas</option>';
  const cities = regional
    ? [...(REGIONAIS_CIDADES[regional] || [])]
    : [...TODAS_CIDADES_LISTA];
  const legacies = cidadesLegadasNoSistema();
  for (const c of cities) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  }
  if (!regional && legacies.length) {
    const og = document.createElement("optgroup");
    og.label = "Outras (cadastro antigo)";
    for (const c of legacies) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  else if (cur && legacies.includes(cur)) sel.value = cur;
}

function fillFilterProjetistaSelect(linha = activeEsteiraCanal) {
  const sel = document.getElementById("filterProjetista");
  if (!sel) return;
  const cur = sel.value;
  const lista = projetistasForLinha(linha);
  sel.innerHTML =
    '<option value="">Todos</option>' +
    '<option value="__none__">Não atribuído</option>' +
    lista.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  else if (cur && cur !== "__none__") sel.value = "";
}

function fillDemResponsavelSelect(linha = editingLinhaEsteira) {
  const lista = projetistasForLinha(linha);
  const cur = document.getElementById("demResponsavel")?.value || "";
  fillSelectOptions(document.getElementById("demResponsavel"), [
    { value: "", label: "Não atribuído" },
    ...lista.map((n) => ({ value: n, label: n })),
  ]);
  const sel = document.getElementById("demResponsavel");
  if (sel && cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function fillFilterTipoSelect() {
  const sel = document.getElementById("filterTipo");
  if (!sel) return;
  const cur = sel.value;
  const tipos = tiposFiltroEsteiraProjetos();
  sel.innerHTML = '<option value="">Todos</option>';
  for (const t of tipos) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  }
  if (cur && tipos.includes(cur)) sel.value = cur;
  else sel.value = "";
}

function fillFilterProdutoSelect() {
  const sel = document.getElementById("filterTipo");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos</option>';
  for (const p of PRODUTOS_B2B) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  }
  if (cur && PRODUTOS_B2B.includes(cur)) sel.value = cur;
  else sel.value = "";
}

/** Esteira Projetos: filtro Tipo; Esteira B2B: filtro Produto (mesmo select). */
function syncEsteiraFiltroTipoProduto(linha = activeEsteiraCanal) {
  const label = document.getElementById("filterTipoLabel");
  if (label) label.textContent = linha === LINHA_ESTEIRA_B2B ? "Produto" : "Tipo";
  if (linha === LINHA_ESTEIRA_B2B) fillFilterProdutoSelect();
  else fillFilterTipoSelect();
}

function initEsteiraFilters() {
  fillFilterProjetistaSelect();
  syncEsteiraFiltroTipoProduto();
  fillFilterRegionalSelect();
  fillFilterCidadeSelect(document.getElementById("filterRegional")?.value || "");
  document.getElementById("filterRegional")?.addEventListener("change", () => {
    const reg = document.getElementById("filterRegional")?.value || "";
    fillFilterCidadeSelect(reg);
    renderBoard();
  });
  ["filterProjetista", "filterTipo", "filterCidade"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", renderBoard);
  });
  const inpBusca = document.getElementById("filterBusca");
  if (inpBusca) {
    let buscaTimer = null;
    const trigger = () => {
      if (buscaTimer) clearTimeout(buscaTimer);
      buscaTimer = setTimeout(() => {
        buscaTimer = null;
        renderBoard();
      }, 180);
    };
    inpBusca.addEventListener("input", trigger);
    inpBusca.addEventListener("search", trigger);
  }
}

function normalizeBuscaText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function readEsteiraFilters() {
  const selVal = document.getElementById("filterTipo")?.value || "";
  const base = {
    projetista: document.getElementById("filterProjetista")?.value || "",
    regional: document.getElementById("filterRegional")?.value || "",
    cidade: document.getElementById("filterCidade")?.value || "",
    busca: normalizeBuscaText(document.getElementById("filterBusca")?.value || ""),
  };
  if (activeEsteiraCanal === LINHA_ESTEIRA_B2B) {
    return { ...base, produto: selVal };
  }
  return { ...base, tipo: selVal };
}

function demandaMatchesEsteiraFilters(d, f) {
  if (f.produto) {
    if (normalizeProdutoB2b(d.produtoB2b) !== f.produto) return false;
  } else if (f.tipo && normalizeTipo(d.tipo) !== f.tipo) return false;
  if (f.projetista) {
    if (f.projetista === "__none__") {
      if (normalizeResponsavel(d.responsavel) !== "") return false;
    } else if (normalizeResponsavel(d.responsavel) !== f.projetista) return false;
  }
  const cid = normalizeCidadeCadastro(d.cidade);
  if (f.regional && findRegionalForCidade(cid) !== f.regional) return false;
  if (f.cidade && cid.toLowerCase() !== f.cidade.toLowerCase()) return false;
  if (f.busca) {
    const blob = normalizeBuscaText(
      [
        d.titulo,
        d.cidade,
        d.solicitante,
        d.responsavel,
        d.descricao,
        d.statusAtual,
        d.chamadoOcomon,
        d.osAniel,
        d.tipo,
        d.produtoB2b,
        d.segmentoB2c,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (!blob.includes(f.busca)) return false;
  }
  return true;
}

function normalizeResponsavel(v, linha) {
  const s = String(v || "").trim();
  if (!s) return "";
  const list = linha ? projetistasForLinha(linha) : allProjetistasNomes();
  if (list.includes(s)) return s;
  const slug = projetistaSlug(s);
  const byLen = [...list].sort((a, b) => b.length - a.length);
  for (const p of byLen) {
    if (projetistaSlug(p) === slug) return p;
  }
  for (const p of byLen) {
    if (slug.includes(projetistaSlug(p))) return p;
  }
  if (slug === "joao") return "João";
  return "";
}

function labelProjetista(v) {
  const n = normalizeResponsavel(v);
  return n || "Não atribuído";
}

function normalizeTipo(v) {
  const t = String(v || "").trim();
  const tl = t.toLowerCase();
  if (tl === "diaria" || tl === "diária") return TIPO_DIARIA_LEGADO;
  if (TIPOS_DEMANDA.includes(t)) return t;
  return "B2C";
}

function syncDemTipoSelect(tipo) {
  const sel = document.getElementById("demTipo");
  if (!sel) return;
  sel.querySelectorAll("option[data-legado-diaria]").forEach((o) => o.remove());
  const t = normalizeTipo(tipo);
  if (t === TIPO_DIARIA_LEGADO) {
    const opt = document.createElement("option");
    opt.value = TIPO_DIARIA_LEGADO;
    opt.textContent = TIPO_DIARIA_LEGADO;
    opt.dataset.legadoDiaria = "1";
    sel.appendChild(opt);
  }
  sel.value = t;
  syncDemCamposPorTipo();
}

function tipoCardClass(tipo) {
  const map = {
    B2C: "card--b2c",
    B2B: "card--b2b",
    SWAP: "card--swap",
    Backbone: "card--bb",
    Licenciamento: "card--licenciamento",
    "Diária": "card--diaria",
  };
  return map[normalizeTipo(tipo)] || "card--b2c";
}

function tipoBadgeClass(tipo) {
  const map = {
    B2C: "badge--b2c",
    B2B: "badge--b2b",
    SWAP: "badge--swap",
    Backbone: "badge--bb",
    Licenciamento: "badge--licenciamento",
    "Diária": "badge--diaria",
  };
  return map[normalizeTipo(tipo)] || "badge--b2c";
}

function statusBadgeClass(status) {
  const map = {
    novo: "badge--st-novo",
    analise: "badge--st-analise",
    vistoria: "badge--st-vistoria",
    custo: "badge--st-custo",
    revisao: "badge--st-revisao",
    aprovacao: "badge--st-aprovacao",
    materiais: "badge--st-materiais",
    execucao: "badge--st-execucao",
    execucao_terceirizada: "badge--st-execucao-terceirizada",
    configuracao_op: "badge--st-configuracao",
    transmissao_infra_op: "badge--st-transmissao-infra",
    documentacao_op: "badge--st-documentacao",
    conclusao: "badge--st-conclusao",
    pausado: "badge--st-pausado",
    reprovado: "badge--st-reprovado",
    pre_vendas: "badge--st-novo",
    analise_kmz: "badge--st-analise",
    aprovacao_bp: "badge--st-aprovacao",
    projeto_final: "badge--st-conclusao",
    estoque: "badge--st-materiais",
    configuracao: "badge--st-execucao",
    documentacao: "badge--st-documentacao",
  };
  return map[status] || "badge--st-novo";
}

function demandasDashboardList() {
  return state.demandas.map(migrateDemanda);
}

/** Projetos da esteira B2B (tipo B2B). */
function isDemandaB2b(d) {
  return inferLinhaEsteira(d) === LINHA_ESTEIRA_B2B;
}

/** Demandas da esteira operacional (exclui tipo B2B) — base do dashboard geral. */
function demandasEsteiraOperacionalList() {
  return demandasDashboardList().filter((d) => !isDemandaB2b(d));
}

function demandasDashOperacionalList() {
  return demandasEsteiraOperacionalList();
}

function demandasB2bDashboardList() {
  return demandasDashboardList().filter(isDemandaB2b);
}

function demandasB2cDashboardList() {
  return demandasDashOperacionalList().filter((d) => normalizeTipo(d.tipo) === "B2C");
}

function normalizeDiaria(d) {
  const resp = normalizeResponsavel(d?.responsavel) || PROJETISTA_PADRAO;
  return {
    id: d?.id || uid(),
    titulo: String(d?.titulo || "").trim(),
    descricao: String(d?.descricao || "").trim(),
    responsavel: PROJETISTAS.includes(resp) ? resp : PROJETISTA_PADRAO,
    updatedAt: d?.updatedAt || "",
  };
}

const TIPOS_CABO = ["FO-06", "FO-12", "FO-24", "FO-36", "FO-48", "FO-72", "FO-144"];
const CUSTO_EXECUCAO_NAO_APLICA = "Não se aplica";
const CUSTO_EXECUCAO_OPCOES = [
  CUSTO_EXECUCAO_NAO_APLICA,
  "Regional",
  "Terceirizada",
  "Regional + Terceirizada",
];

function normalizeExecucaoCusto(v) {
  const s = String(v || "").trim();
  const lower = s.toLowerCase();
  if (lower === "nao se aplica" || lower === "não se aplica" || lower === "nao" || s === CUSTO_EXECUCAO_NAO_APLICA) {
    return CUSTO_EXECUCAO_NAO_APLICA;
  }
  if (
    lower === "regional + terceirizada" ||
    lower === "regional e terceirizada" ||
    (lower.includes("regional") && lower.includes("terceirizada"))
  ) {
    return "Regional + Terceirizada";
  }
  if (s === "Regiona" || lower === "regional") return "Regional";
  if (lower === "terceirizada") return "Terceirizada";
  return CUSTO_EXECUCAO_OPCOES.includes(s) ? s : CUSTO_EXECUCAO_NAO_APLICA;
}

const emptyPortasCusto = () => ({
  qtdCasas: "",
  qtdPortasAtual: "",
  qtdNovasPortas: "",
  penetracaoAtual: "",
  novaPenetracao: "",
  valorPorPortaNova: "",
});

const emptyLancamentoCusto = () => ({
  cabos: [],
  totalMetragem: "",
});

const emptyExecucaoCustos = () => ({
  custoRegional: "",
  custoTerceirizada: "",
});

const emptyCusto = () => ({
  temLevantamento: false,
  temPortas: false,
  temLancamento: false,
  valorProjeto: "",
  valor5: "",
  valorFinal: "",
  ...emptyPortasCusto(),
  lancamento: emptyLancamentoCusto(),
  execucao: CUSTO_EXECUCAO_NAO_APLICA,
  ...emptyExecucaoCustos(),
});

function parseCustoMoney(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "";
}

function normalizeExecucaoCustos(custo, execucao) {
  const ex = normalizeExecucaoCusto(execucao);
  if (ex === CUSTO_EXECUCAO_NAO_APLICA) {
    return { custoRegional: "", custoTerceirizada: "" };
  }
  let custoRegional = parseCustoMoney(custo?.custoRegional);
  let custoTerceirizada = parseCustoMoney(custo?.custoTerceirizada);
  if (ex === "Terceirizada") custoRegional = "";
  else if (ex === "Regional") custoTerceirizada = "";
  return { custoRegional, custoTerceirizada };
}

function inferTemLevantamento(custo) {
  if (!custo || typeof custo !== "object") return false;
  const keys = ["valorProjeto", "valor5", "valorFinal"];
  const hasValores = keys.some((k) => custo[k] !== "" && custo[k] != null);
  if (typeof custo.temLevantamento === "boolean") return custo.temLevantamento || hasValores;
  return hasValores;
}

function inferTemLancamento(custo) {
  if (!custo || typeof custo !== "object") return false;
  if (typeof custo.temLancamento === "boolean") return custo.temLancamento;
  if (Array.isArray(custo.lancamento?.cabos) && custo.lancamento.cabos.length > 0) return true;
  if (custo.totalLancamento !== "" && custo.totalLancamento != null) return true;
  return false;
}

function sumMetragemCabos(cabos) {
  let total = 0;
  let has = false;
  for (const c of cabos || []) {
    const m = Number(c.metragem);
    if (Number.isFinite(m) && m > 0) {
      total += m;
      has = true;
    }
  }
  return has ? Math.round(total * 100) / 100 : "";
}

function normalizeLancamento(lancamento) {
  const cabos = (Array.isArray(lancamento?.cabos) ? lancamento.cabos : [])
    .map((c) => {
      const metragem = c.metragem === "" || c.metragem == null ? "" : Number(c.metragem);
      return {
        id: c.id || uid(),
        tipo: TIPOS_CABO.includes(c.tipo) ? c.tipo : TIPOS_CABO[0],
        metragem: Number.isFinite(metragem) ? metragem : "",
      };
    })
    .filter((c) => c.tipo);
  return { cabos, totalMetragem: sumMetragemCabos(cabos) };
}

function inferTemPortas(custo) {
  if (!custo || typeof custo !== "object") return false;
  if (typeof custo.temPortas === "boolean") return custo.temPortas;
  const keys = ["qtdCasas", "qtdPortasAtual", "qtdNovasPortas", "penetracaoAtual", "novaPenetracao", "portas"];
  return keys.some((k) => custo[k] !== "" && custo[k] != null);
}

function calcValorPorPortaNova(valorFinal, qtdNovasPortas) {
  if (valorFinal === "" || valorFinal == null || !qtdNovasPortas) return "";
  const total = Number(valorFinal);
  const qtd = Number(qtdNovasPortas);
  if (!Number.isFinite(total) || !Number.isFinite(qtd) || qtd <= 0) return "";
  return Math.round((total / qtd) * 100) / 100;
}

/** Taxa de penetração (%) = portas ÷ casas × 100 */
function calcTaxaPenetracao(portas, casas) {
  const p = portas === "" || portas == null ? NaN : Number(portas);
  const c = casas === "" || casas == null ? NaN : Number(casas);
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= 0) return "";
  return Math.round((p / c) * 10000) / 100;
}

function recalcPenetracaoPortas() {
  const elAtual = document.getElementById("custoPenetracaoAtual");
  const elNova = document.getElementById("custoNovaPenetracao");
  if (!elAtual || !elNova || document.getElementById("demTemPortas")?.value !== "sim") return;

  const num = (id) => {
    const v = document.getElementById(id)?.value;
    if (v === "" || v == null) return "";
    const n = parseNumBrInput(v);
    return n === "" ? "" : n;
  };

  const casas = num("custoQtdCasas");
  const existentes = num("custoQtdPortasAtual");
  const novas = num("custoQtdNovasPortas");

  const taxaAtual =
    casas !== "" && existentes !== "" ? calcTaxaPenetracao(existentes, casas) : "";
  elAtual.value = taxaAtual === "" ? "" : formatBr().formatPercentBr?.(taxaAtual) ?? `${taxaAtual}%`;

  if (casas !== "" && existentes !== "") {
    const totalPortas = Number(existentes) + (novas !== "" ? Number(novas) : 0);
    const taxaNova = calcTaxaPenetracao(totalPortas, casas);
    elNova.value = taxaNova === "" ? "" : formatBr().formatPercentBr?.(taxaNova) ?? `${taxaNova}%`;
  } else {
    elNova.value = "";
  }
}

function normalizeCusto(custo) {
  const raw = { ...emptyCusto(), ...(custo || {}) };
  if (raw.qtdCasas === "" && raw.portas !== "" && raw.portas != null) raw.qtdCasas = raw.portas;
  delete raw.portas;

  const execucao = normalizeExecucaoCusto(raw.execucao);
  const execucaoCustos = normalizeExecucaoCustos(raw, execucao);
  raw.temLevantamento = inferTemLevantamento(raw);
  if (!raw.temLevantamento) return { ...emptyCusto(), execucao, ...execucaoCustos };

  const valorProjeto = parseCustoMoney(raw.valorProjeto);
  const valorFinalSalvo = parseCustoMoney(raw.valorFinal);
  if (valorProjeto !== "") {
    const cinco = Math.round(valorProjeto * 0.05 * 100) / 100;
    raw.valor5 = cinco;
    raw.valorFinal = Math.round((valorProjeto + cinco) * 100) / 100;
  } else if (valorFinalSalvo !== "") {
    raw.valorFinal = valorFinalSalvo;
    raw.valor5 = parseCustoMoney(raw.valor5);
    raw.valorProjeto = parseCustoMoney(raw.valorProjeto);
  } else {
    raw.valorProjeto = "";
    raw.valor5 = "";
    raw.valorFinal = "";
  }

  raw.temPortas = inferTemPortas(raw);
  if (!raw.temPortas) Object.assign(raw, emptyPortasCusto());
  else {
    raw.penetracaoAtual = calcTaxaPenetracao(raw.qtdPortasAtual, raw.qtdCasas);
    const portasTotais =
      (raw.qtdPortasAtual === "" ? 0 : Number(raw.qtdPortasAtual)) +
      (raw.qtdNovasPortas === "" ? 0 : Number(raw.qtdNovasPortas));
    raw.novaPenetracao = calcTaxaPenetracao(portasTotais, raw.qtdCasas);
    raw.valorPorPortaNova = calcValorPorPortaNova(raw.valorFinal, raw.qtdNovasPortas);
  }

  raw.temLancamento = inferTemLancamento(raw);
  if (!raw.temLancamento) raw.lancamento = emptyLancamentoCusto();
  else raw.lancamento = normalizeLancamento(raw.lancamento);
  delete raw.totalLancamento;

  raw.execucao = execucao;
  Object.assign(raw, execucaoCustos);
  return raw;
}

const defaultState = () => ({
  demandas: [],
  diarias: [],
  deletedDiariaIds: [],
  projetistas: Object.fromEntries(
    allProjetistasNomes().map((nome) => [nome, { texto: "", demandaId: "", desde: "", updatedAt: "" }]),
  ),
});

function mergeLoadedState(data) {
  if (!data || typeof data !== "object") return defaultState();
  return {
    ...defaultState(),
    ...data,
    projetistas: { ...defaultState().projetistas, ...(data.projetistas || {}) },
    pendingDeleteDemandaIds: Array.isArray(data.pendingDeleteDemandaIds)
      ? [...data.pendingDeleteDemandaIds]
      : [],
    deletedDemandaIds: Array.isArray(data.deletedDemandaIds) ? [...data.deletedDemandaIds] : [],
    deletedDiariaIds: Array.isArray(data.deletedDiariaIds) ? [...data.deletedDiariaIds] : [],
  };
}

function demandaDeleteTombstones() {
  return new Set([...(state.pendingDeleteDemandaIds || []), ...(state.deletedDemandaIds || [])]);
}

function diariaDeleteTombstones() {
  return new Set(state.deletedDiariaIds || []);
}

function applyLoadedState(data) {
  state = mergeLoadedState(data);
  const tombstones = demandaDeleteTombstones();
  const diariaTombstones = diariaDeleteTombstones();
  state.demandas = (state.demandas || []).filter((d) => !tombstones.has(d.id)).map(migrateDemanda);
  state.diarias = (state.diarias || [])
    .filter((d) => !diariaTombstones.has(d.id))
    .map(normalizeDiaria);
}

function markDemandaPendingDelete(id) {
  if (!id) return;
  if (!Array.isArray(state.pendingDeleteDemandaIds)) state.pendingDeleteDemandaIds = [];
  if (!state.pendingDeleteDemandaIds.includes(id)) state.pendingDeleteDemandaIds.push(id);
  if (!Array.isArray(state.deletedDemandaIds)) state.deletedDemandaIds = [];
  if (!state.deletedDemandaIds.includes(id)) state.deletedDemandaIds.push(id);
  state.demandas = state.demandas.filter((x) => x.id !== id);
}

function applyCloudPatch(patch) {
  if (!persistenceReady || !persistenceApi) {
    pendingCloudPatch = { ...(pendingCloudPatch || {}), ...patch };
    return;
  }
  if (patch.deleteDemandaId && persistenceApi.deleteDemanda) {
    const deleteId = patch.deleteDemandaId;
    void persistenceApi.deleteDemanda(deleteId).catch((e) => {
      console.warn("Excluir demanda na nuvem:", e);
      state.pendingDeleteDemandaIds = (state.pendingDeleteDemandaIds || []).filter((x) => x !== deleteId);
      state.deletedDemandaIds = (state.deletedDemandaIds || []).filter((x) => x !== deleteId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (_) {}
      toast(e?.message || "Não foi possível excluir a demanda na nuvem");
      refreshAllViews();
    });
  }
  if (patch.demanda && persistenceApi.upsertDemanda) {
    void persistenceApi.upsertDemanda(patch.demanda).catch((e) => {
      console.warn("Salvar demanda na nuvem:", e);
      toast(e?.message || "Não foi possível salvar a demanda na nuvem");
    });
  }
  if (patch.presence?.id && persistenceApi.patchDemandaPresence) {
    void persistenceApi.patchDemandaPresence(patch.presence.id, patch.presence.editingBy).catch((e) => {
      console.warn("Presença na nuvem:", e);
    });
  }
  if (patch.meta && persistenceApi.persistMeta) {
    void persistenceApi.persistMeta({
      diarias: state.diarias,
      projetistas: state.projetistas,
      deletedDiariaIds: state.deletedDiariaIds || [],
    }).catch((e) => {
      console.warn("Salvar meta na nuvem:", e);
      toast(e?.message || "Não foi possível sincronizar diárias/projetistas na nuvem");
    });
  }
  if (patch.importFull && persistenceApi.importFullState) {
    void persistenceApi.importFullState(state);
  }
}

function saveState(patch = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Falha ao salvar cópia local:", e);
  }
  applyCloudPatch(patch);
}

function flushPendingCloudSave() {
  if (!pendingCloudPatch || !persistenceApi) return;
  const patch = pendingCloudPatch;
  pendingCloudPatch = null;
  applyCloudPatch(patch);
}

function setSyncStatus(status) {
  const el = document.getElementById("syncBadge");
  if (!el) return;
  const labels = {
    connecting: "Conectando…",
    saving: "Salvando…",
    synced: "Sincronizado (nuvem)",
    error: "Erro — não sincroniza",
    local: "Somente neste navegador",
    waiting: "Carregando dados…",
    empty: "Nenhuma demanda na nuvem",
  };
  if (location.protocol === "file:" && status === "local") {
    window.__demandasSyncHint =
      window.__demandasSyncHint || "Abra " + APP_PUBLIC_URL;
  }
  let text = labels[status] || status;
  if ((status === "local" || status === "error") && window.__demandasSyncHint) {
    text = labels[status] + " — " + window.__demandasSyncHint;
  }
  el.textContent = text;
  el.title = text;
  el.dataset.status = status;
  el.hidden = false;
}

window.setSyncStatus = setSyncStatus;

window.addEventListener("demandas-sync-error", (e) => {
  toast(e.detail?.message || "Erro ao sincronizar com a nuvem");
});

function refreshAllViews() {
  fillFilterCidadeSelect(document.getElementById("filterRegional")?.value || "");
  renderBoard();
  renderDiarias();
  updateEsteiraStatusLine();
  if (panels.projetistas && !panels.projetistas.hidden) renderProjetistas();
  if (panels.dashboard && !panels.dashboard.hidden) renderDashboard();
  syncDemandaModalAlerts();
}

function uid() {
  return crypto.randomUUID();
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(d) {
  if (!d) return null;
  const t = Date.parse(d + "T12:00:00");
  return Number.isNaN(t) ? null : t;
}

/** Data real de término (campo do formulário ou histórico ao concluir). */
function demandaDataTermino(d) {
  const dm = migrateDemanda(d);
  if (dm.dataTermino) return dm.dataTermino;
  if (isStatusConcluidoDemanda(dm)) return demandaDataConclusao(dm);
  return "";
}

function isDemandaEncerrada(dm) {
  const linha = inferLinhaEsteira(dm);
  if (linha === LINHA_ESTEIRA_B2B) return STATUS_B2B_CONCLUIDOS.has(dm.status);
  return ["conclusao", "reprovado"].includes(dm.status);
}

function isAtraso(d) {
  const dm = migrateDemanda(d);
  const prev = parseDate(dm.dataFimPrevista);
  if (!prev) return false;
  if (dm.linhaEsteira !== LINHA_ESTEIRA_B2B && dm.status === "reprovado") return false;
  if (isDemandaEncerrada(dm)) {
    const term = parseDate(demandaDataTermino(dm));
    return term != null && term > prev;
  }
  const hoje = parseDate(todayISODate());
  return hoje > prev;
}

/** Em atraso e ainda em andamento (obrigatório registrar motivos). */
function isAtrasoAtivo(d) {
  const dm = migrateDemanda(d);
  if (isDemandaEncerrada(dm)) return false;
  return isAtraso(dm);
}

function demandaPreviewFromForm() {
  return migrateDemanda({
    status: document.getElementById("demStatus")?.value || "novo",
    tipo: document.getElementById("demTipo")?.value || "",
    linhaEsteira: editingLinhaEsteira,
    dataChegada: document.getElementById("demDataChegada")?.value || "",
    dataFimPrevista: document.getElementById("demDataFimPrevista")?.value || "",
    dataTermino: document.getElementById("demDataTermino")?.value || "",
  });
}

function normalizeMotivoAtrasoDias(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "";
  return Math.round(n);
}

function normalizeMotivosAtrasoItens(d) {
  if (Array.isArray(d?.motivosAtrasoItens)) {
    return d.motivosAtrasoItens
      .map((item) => ({
        motivo: String(item?.motivo || "").trim(),
        dias: normalizeMotivoAtrasoDias(item?.dias),
      }))
      .filter((item) => item.motivo || item.dias !== "");
  }
  const legado = String(d?.motivosAtraso || "").trim();
  if (legado) return [{ motivo: legado.slice(0, 500), dias: "" }];
  return [];
}

function formatMotivosAtrasoTexto(itens) {
  const list = normalizeMotivosAtrasoItens({ motivosAtrasoItens: itens });
  if (!list.length) return "";
  return list
    .map((item, i) => {
      const n = i + 1;
      const dias =
        item.dias === "" ? "" : ` (${item.dias === 1 ? "1 dia" : `${item.dias} dias`})`;
      return `Motivo ${n}: ${item.motivo}${dias}`;
    })
    .join(" · ");
}

function motivosAtrasoItensPreenchidos(itens) {
  return normalizeMotivosAtrasoItens({ motivosAtrasoItens: itens }).some((item) => item.motivo);
}

function sameMotivosAtrasoItens(a, b) {
  const na = normalizeMotivosAtrasoItens({ motivosAtrasoItens: a });
  const nb = normalizeMotivosAtrasoItens({ motivosAtrasoItens: b });
  return JSON.stringify(na) === JSON.stringify(nb);
}

function readMotivosAtrasoFromDom(opts = {}) {
  const forSave = opts.forSave === true;
  const root = document.getElementById("motivosAtrasoLista");
  if (!root) return forSave ? [] : [{ motivo: "", dias: "" }];
  const rows = [...root.querySelectorAll(".motivo-atraso-row")];
  const items = rows.map((row) => ({
    motivo: (row.querySelector(".motivo-atraso-texto")?.value || "").trim(),
    dias: normalizeMotivoAtrasoDias(row.querySelector(".motivo-atraso-dias")?.value),
  }));
  if (forSave) {
    return items.filter((item) => item.motivo || item.dias !== "");
  }
  return items.length ? items : [{ motivo: "", dias: "" }];
}

function mapMotivosAtrasoItensParaUi(itens) {
  if (!Array.isArray(itens) || !itens.length) return [{ motivo: "", dias: "" }];
  return itens.map((item) => ({
    motivo: String(item?.motivo || "").trim(),
    dias: normalizeMotivoAtrasoDias(item?.dias),
  }));
}

function renderMotivosAtrasoLista(itens) {
  const root = document.getElementById("motivosAtrasoLista");
  if (!root) return;
  const rows = mapMotivosAtrasoItensParaUi(itens);
  root.innerHTML = "";
  rows.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "motivo-atraso-row";
    row.innerHTML =
      `<label class="field field--grow">` +
      `<span>Motivo ${i + 1}</span>` +
      `<input type="text" class="motivo-atraso-texto" maxlength="500" placeholder="Descreva o motivo do atraso…" value="${escapeHtml(item.motivo)}" />` +
      `</label>` +
      `<label class="field field--dias">` +
      `<span>Dias</span>` +
      `<input type="number" class="motivo-atraso-dias" min="0" max="9999" step="1" placeholder="0" value="${item.dias === "" ? "" : String(item.dias)}" />` +
      `</label>` +
      `<button type="button" class="motivo-atraso-remove" aria-label="Remover motivo ${i + 1}" title="Remover motivo"${rows.length <= 1 ? " disabled" : ""}>×</button>`;
    root.appendChild(row);
  });
  refreshMotivosAtrasoRemoveButtons();
}

function refreshMotivosAtrasoRemoveButtons() {
  const root = document.getElementById("motivosAtrasoLista");
  if (!root) return;
  const btns = [...root.querySelectorAll(".motivo-atraso-remove")];
  btns.forEach((btn) => {
    btn.disabled = btns.length <= 1;
  });
}

function addMotivoAtrasoRow() {
  const lista = document.getElementById("motivosAtrasoLista");
  if (!lista) return;
  const current = readMotivosAtrasoFromDom();
  current.push({ motivo: "", dias: "" });
  renderMotivosAtrasoLista(current);
  const inputs = lista.querySelectorAll(".motivo-atraso-texto");
  inputs[inputs.length - 1]?.focus();
}

function bindMotivosAtrasoUi() {
  const form = document.getElementById("formDemanda");
  if (!form || form.dataset.motivosBound === "1") return;
  form.dataset.motivosBound = "1";

  form.addEventListener("click", (e) => {
    if (e.target.closest("#btnAddMotivoAtraso")) {
      e.preventDefault();
      e.stopPropagation();
      addMotivoAtrasoRow();
      return;
    }
    const btn = e.target.closest(".motivo-atraso-remove");
    if (!btn || btn.disabled) return;
    const root = document.getElementById("motivosAtrasoLista");
    const row = btn.closest(".motivo-atraso-row");
    if (!root || !row) return;
    e.preventDefault();
    row.remove();
    if (!root.querySelector(".motivo-atraso-row")) {
      renderMotivosAtrasoLista([]);
    } else {
      renumberMotivosAtrasoRows();
      refreshMotivosAtrasoRemoveButtons();
    }
  });
}

function renumberMotivosAtrasoRows() {
  const root = document.getElementById("motivosAtrasoLista");
  if (!root) return;
  root.querySelectorAll(".motivo-atraso-row").forEach((row, i) => {
    const label = row.querySelector(".field--grow > span");
    if (label) label.textContent = `Motivo ${i + 1}`;
    const btn = row.querySelector(".motivo-atraso-remove");
    if (btn) {
      btn.setAttribute("aria-label", `Remover motivo ${i + 1}`);
      btn.title = "Remover motivo";
    }
  });
}

function syncMotivosAtrasoField() {
  const fs = document.getElementById("fieldsetMotivosAtraso");
  const hint = document.getElementById("motivosAtrasoHint");
  const diasEl = document.getElementById("demAtrasoDiasResumo");
  if (!fs) return;
  const d = demandaPreviewFromForm();
  const show = isAtraso(d);
  const ativo = isAtrasoAtivo(d);
  fs.hidden = !show;
  if (hint) {
    hint.textContent = ativo
      ? "O prazo previsto já passou. Registre cada motivo e quantos dias ele representa."
      : "Projeto concluído após o prazo. Registre os motivos do atraso para histórico.";
  }
  if (diasEl) {
    const dias = demandaDiasAtraso(d);
    if (show && dias > 0) {
      diasEl.hidden = false;
      diasEl.innerHTML = `<strong>Atraso:</strong> ${escapeHtml(formatDiasAtrasoLabel(dias))}`;
    } else {
      diasEl.hidden = true;
      diasEl.textContent = "";
    }
  }
  if (show) {
    const root = document.getElementById("motivosAtrasoLista");
    if (root && !root.querySelector(".motivo-atraso-row")) {
      renderMotivosAtrasoLista([]);
    }
  }
}

/** Dias entre duas datas ISO (b − a); zero se inválido. */
function diasEntreDatasISO(isoA, isoB) {
  const a = parseDate(isoA);
  const b = parseDate(isoB);
  if (a == null || b == null) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Projeto concluído após o prazo previsto; null se não aplicável. */
function demandaEntregaAtraso(d) {
  const dm = migrateDemanda(d);
  if (!isStatusConcluidoDemanda(dm)) return null;
  const prev = dm.dataFimPrevista;
  if (!prev) return null;
  const fim = demandaDataTermino(dm);
  if (!fim) return null;
  const prevMs = parseDate(prev);
  const fimMs = parseDate(fim);
  if (prevMs == null || fimMs == null || fimMs <= prevMs) return null;
  return {
    d: dm,
    dataPrevista: prev,
    dataTermino: fim,
    diasAtraso: diasEntreDatasISO(prev, fim),
  };
}

/** Dias de atraso em relação ao prazo previsto (andamento ou concluído). */
function demandaDiasAtraso(d) {
  const dm = migrateDemanda(d);
  if (!isAtraso(dm)) return 0;
  const prev = dm.dataFimPrevista;
  if (!prev) return 0;
  if (isDemandaEncerrada(dm)) {
    const fim = demandaDataTermino(dm);
    return fim ? diasEntreDatasISO(prev, fim) : 0;
  }
  return diasEntreDatasISO(prev, todayISODate());
}

function formatDiasAtrasoLabel(n) {
  const dias = Math.max(0, Number(n) || 0);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function demandaInicioContagemAberto(d) {
  const dm = migrateDemanda(d);
  return dm.dataChegada || (dm.createdAt || "").slice(0, 10);
}

/** Dias desde a chegada; congela na data de término ao concluir o projeto. */
function demandaDiasAberto(d) {
  const dm = migrateDemanda(d);
  const inicio = demandaInicioContagemAberto(dm);
  if (!inicio) return 0;
  if (isStatusConcluidoDemanda(dm)) {
    const fim = demandaDataTermino(dm) || demandaDataConclusao(dm);
    return fim ? diasEntreDatasISO(inicio, fim) : diasEntreDatasISO(inicio, todayISODate());
  }
  return diasEntreDatasISO(inicio, todayISODate());
}

function formatDiasAbertoLabel(n) {
  return formatDiasAtrasoLabel(n);
}

function syncDiasAbertoResumo() {
  const el = document.getElementById("demDiasAbertoResumo");
  if (!el) return;
  const d = demandaPreviewFromForm();
  const dias = demandaDiasAberto(d);
  const concluido = isStatusConcluidoDemanda(d);
  const inicio = demandaInicioContagemAberto(d);
  if (!inicio) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  const sufixo = concluido ? " (congelado na conclusão)" : " — atualiza a cada dia";
  el.innerHTML =
    `<strong>Dias aberto:</strong> ${escapeHtml(formatDiasAbertoLabel(dias))}` +
    `<span class="muted small">${escapeHtml(sufixo)}</span>`;
}

function statusHistoryPush(demanda, newStatus, now = new Date().toISOString()) {
  const hist = Array.isArray(demanda.historicoStatus) ? [...demanda.historicoStatus] : [];
  const last = hist[hist.length - 1];
  if (last && !last.fim) last.fim = now;
  if (!last || last.status !== newStatus) hist.push({ status: newStatus, inicio: now, fim: "", observacao: "" });
  return hist;
}

function normalizeHistoricoStatus(hist) {
  if (!Array.isArray(hist)) return [];
  return hist.map((seg) => ({
    status: seg.status,
    inicio: seg.inicio || "",
    fim: seg.fim || "",
    observacao: typeof seg.observacao === "string" ? seg.observacao : "",
  }));
}

/** Converte ISO → valor de `<input type="datetime-local">`. */
function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return "";
    return `${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}`;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function validateHistoricoStatus(hist, statusAtual, linha = editingLinhaEsteira) {
  const h = normalizeHistoricoStatus(hist);
  if (!h.length) return null;
  for (let i = 0; i < h.length; i++) {
    const seg = h[i];
    const lab = labelStatus(seg.status, linha);
    if (!seg.inicio) return `Informe a data de início em "${lab}".`;
    const start = Date.parse(seg.inicio);
    if (Number.isNaN(start)) return `Data de início inválida em "${lab}".`;
    const isLast = i === h.length - 1;
    const faseAberta = isLast && seg.status === statusAtual && !seg.fim;
    if (!seg.fim && !faseAberta) {
      return `Informe a data de fim em "${lab}" (ou deixe em branco só na fase atual em andamento).`;
    }
    if (seg.fim) {
      const end = Date.parse(seg.fim);
      if (Number.isNaN(end)) return `Data de fim inválida em "${lab}".`;
      if (end < start) return `Em "${lab}", a data de fim não pode ser anterior ao início.`;
    }
  }
  return null;
}

/** Nome exibido nos comentários — usuário logado, não o projetista da demanda. */
function getLoggedInComentarioAutor() {
  const user = typeof DemandasAuth !== "undefined" ? DemandasAuth.currentUser() : null;
  if (!user) return "Equipe";
  const name = String(user.displayName || "").trim();
  if (name) return name;
  const email = String(user.email || "").trim();
  if (!email) return "Equipe";
  const local = email.split("@")[0] || email;
  const label = local.replace(/[._-]+/g, " ").trim();
  if (!label) return email;
  return label.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const PRESENCE_TTL_MS = 3 * 60 * 1000;
const PRESENCE_HEARTBEAT_MS = 45 * 1000;

function getCurrentUserEmail() {
  const user = typeof DemandasAuth !== "undefined" ? DemandasAuth.currentUser?.() : null;
  return String(user?.email || "")
    .trim()
    .toLowerCase();
}

function normalizeEditingBy(v) {
  if (!v || typeof v !== "object") return null;
  const email = String(v.email || "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const since = v.since || "";
  const t = Date.parse(since);
  if (!Number.isFinite(t) || Date.now() - t > PRESENCE_TTL_MS) return null;
  const autor = String(v.autor || email).trim() || email;
  return { email, autor, since };
}

function buildEditingPresence() {
  const email = getCurrentUserEmail();
  if (!email) return null;
  return {
    email,
    autor: getLoggedInComentarioAutor(),
    since: new Date().toISOString(),
  };
}

function setDemandaEditingBy(id, editingBy) {
  if (!id) return;
  const idx = state.demandas.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const next = { ...state.demandas[idx] };
  if (editingBy) next.editingBy = editingBy;
  else {
    delete next.editingBy;
    delete next.editingAt;
  }
  state.demandas[idx] = migrateDemanda(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
  applyCloudPatch({ presence: { id, editingBy: editingBy || null } });
  if (panels.esteira && !panels.esteira.hidden) renderBoard();
  syncDemandaModalAlerts();
}

let editingDemandaOpenId = null;
let editingDemandaBaselineUpdatedAt = "";
let presenceHeartbeatTimer = null;

function stopPresenceHeartbeat() {
  if (presenceHeartbeatTimer) {
    clearInterval(presenceHeartbeatTimer);
    presenceHeartbeatTimer = null;
  }
}

function startPresenceHeartbeat(id) {
  stopPresenceHeartbeat();
  if (!id) return;
  presenceHeartbeatTimer = setInterval(() => {
    if (!modalDemanda?.open || editingDemandaOpenId !== id) return;
    const p = buildEditingPresence();
    if (p) setDemandaEditingBy(id, p);
  }, PRESENCE_HEARTBEAT_MS);
}

function releaseDemandaEditing(id) {
  if (!id) return;
  const dem = state.demandas.find((x) => x.id === id);
  if (!dem) {
    if (editingDemandaOpenId === id) {
      applyCloudPatch({ presence: { id, editingBy: null } });
    }
    return;
  }
  if (!dem.editingBy && editingDemandaOpenId !== id) return;
  const me = getCurrentUserEmail();
  const editorEmail = dem?.editingBy?.email ? String(dem.editingBy.email).toLowerCase() : "";
  if (!editorEmail || !me || editorEmail === me || editingDemandaOpenId === id) {
    setDemandaEditingBy(id, null);
  }
}

function hideDemandaModalAlerts() {
  const conflict = document.getElementById("demConflictBanner");
  const presence = document.getElementById("demPresenceBanner");
  const selfBanner = document.getElementById("demSelfEditingBanner");
  if (conflict) conflict.hidden = true;
  if (presence) presence.hidden = true;
  if (selfBanner) selfBanner.hidden = true;
}

function syncDemandaModalAlerts() {
  const id = editingDemandaOpenId;
  const conflict = document.getElementById("demConflictBanner");
  const presence = document.getElementById("demPresenceBanner");
  const presenceText = document.getElementById("demPresenceBannerText");
  const selfBanner = document.getElementById("demSelfEditingBanner");
  if (!id || !modalDemanda?.open) {
    hideDemandaModalAlerts();
    if (selfBanner) selfBanner.hidden = true;
    return;
  }
  const dem = state.demandas.find((x) => x.id === id);
  if (!dem) return;

  if (selfBanner) {
    const mine = normalizeEditingBy(dem.editingBy);
    const me = getCurrentUserEmail();
    selfBanner.hidden = !(mine && me && mine.email === me);
  }

  const remoteUpdated = dem.updatedAt || "";
  if (
    conflict &&
    editingDemandaBaselineUpdatedAt &&
    remoteUpdated &&
    remoteUpdated !== editingDemandaBaselineUpdatedAt
  ) {
    conflict.hidden = false;
  } else if (conflict) {
    conflict.hidden = true;
  }

  const other = normalizeEditingBy(dem.editingBy);
  const me = getCurrentUserEmail();
  if (presence && presenceText) {
    if (other && other.email !== me) {
      presence.hidden = false;
      presenceText.textContent = `${other.autor} está editando este projeto agora.`;
    } else {
      presence.hidden = true;
    }
  }
}

function closeDemandaModal() {
  const id = editingDemandaOpenId;
  stopPresenceHeartbeat();
  if (id) releaseDemandaEditing(id);
  editingDemandaOpenId = null;
  editingDemandaBaselineUpdatedAt = "";
  editingCustoBaseline = null;
  pdfCustoAppliedInSession = false;
  hideDemandaModalAlerts();
  setDemandaModalScrollLock(false);
  if (typeof setDemandaFootMenuOpen === "function") setDemandaFootMenuOpen(false);
  modalDemanda?.close();
  if (panels.esteira && !panels.esteira.hidden) renderBoard();
}

function cardEditingByHtml(d) {
  const eb = normalizeEditingBy(d.editingBy);
  const me = getCurrentUserEmail();
  if (!eb) return "";
  if (me && eb.email === me) {
    return `<p class="card__editing-by card__editing-by--self" title="Você está com este projeto aberto">✎ Você está editando</p>`;
  }
  return `<p class="card__editing-by" title="Edição em andamento">✎ ${escapeHtml(eb.autor)} editando…</p>`;
}

function normalizeComentario(c) {
  const texto = String(c?.texto || "").trim();
  if (!texto) return null;
  const autor = String(c?.autor || "").trim() || "Equipe";
  return {
    id: c?.id || uid(),
    texto,
    autor,
    createdAt: c?.createdAt || new Date().toISOString(),
  };
}

function normalizeComentarios(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeComentario).filter(Boolean);
}

const HISTORICO_EDICAO_LIMITE = 200;

const HISTORICO_EDICAO_CAMPOS = [
  { campo: "titulo", label: "Nome do projeto" },
  { campo: "status", label: "Status (esteira)", format: (v) => labelStatus(v) || v || "—" },
  { campo: "statusAtual", label: "Status atual" },
  { campo: "responsavel", label: "Projetista responsável", format: (v) => v || "Não atribuído" },
  { campo: "tipo", label: "Tipo" },
  { campo: "produtoB2b", label: "Produto B2B", format: (v) => v || "—" },
  { campo: "segmentoB2c", label: "Segmento B2C", format: (v) => v || "—" },
  { campo: "cidade", label: "Cidade", format: (v) => v || "—" },
  { campo: "solicitante", label: "Solicitante", format: (v) => v || "—" },
  { campo: "setorSolicitanteB2b", label: "Setor solicitante (B2B)", format: (v) => v || "—" },
  { campo: "dataChegada", label: "Data de chegada", format: formatDataCurta },
  { campo: "dataFimPrevista", label: "Previsão de término", format: formatDataCurta },
  { campo: "dataFimAtualizada", label: "Finalização atualizada", format: formatDataCurta },
  { campo: "dataTermino", label: "Data real de término", format: formatDataCurta },
  { campo: "motivosAtrasoItens", label: "Motivos do atraso", format: (v) => formatMotivosAtrasoTexto(v) || "—" },
  { campo: "valorProjetoRealizado", label: "Valor realizado", format: (v) => (v === "" || v == null ? "—" : formatBRL(v)) },
  { campo: "descricao", label: "Descrição", format: shortText },
  { campo: "chamadoOcomon", label: "Chamado Ocomon", format: (v) => v || "—" },
  { campo: "osAniel", label: "Nº O.S. Aniel", format: (v) => v || "—" },
];

function shortText(v) {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
}

function formatDataCurta(v) {
  if (!v) return "—";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function normalizeHistoricoEdicaoEntry(e) {
  if (!e || typeof e !== "object") return null;
  const tipo = e.tipo === "criacao" ? "criacao" : "edicao";
  const at = e.at || "";
  if (!at) return null;
  const by = {
    email: String(e.by?.email || "").trim().toLowerCase(),
    autor: String(e.by?.autor || "").trim() || "Equipe",
  };
  const alteracoes = Array.isArray(e.alteracoes)
    ? e.alteracoes
        .map((a) => ({
          campo: String(a?.campo || ""),
          label: String(a?.label || a?.campo || ""),
          de: a?.de ?? "",
          para: a?.para ?? "",
        }))
        .filter((a) => a.campo)
    : [];
  return {
    id: e.id || uid(),
    tipo,
    at,
    by,
    alteracoes,
    nota: typeof e.nota === "string" ? e.nota : "",
  };
}

function normalizeHistoricoEdicoes(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeHistoricoEdicaoEntry).filter(Boolean);
}

function buildEditorPresenceForLog() {
  return {
    email: getCurrentUserEmail() || "",
    autor: getLoggedInComentarioAutor(),
  };
}

function diffEditTracked(prev, next) {
  const out = [];
  for (const def of HISTORICO_EDICAO_CAMPOS) {
    const a = prev?.[def.campo];
    const b = next?.[def.campo];
    if (def.campo === "motivosAtrasoItens") {
      if (sameMotivosAtrasoItens(a, b)) continue;
    } else if (sameTrackedValue(a, b)) {
      continue;
    }
    const fmt = def.format || ((v) => (v === "" || v == null ? "—" : String(v)));
    out.push({ campo: def.campo, label: def.label, de: fmt(a), para: fmt(b) });
  }
  const cmtPrev = Array.isArray(prev?.comentarios) ? prev.comentarios.length : 0;
  const cmtNext = Array.isArray(next?.comentarios) ? next.comentarios.length : 0;
  if (cmtNext > cmtPrev) {
    const delta = cmtNext - cmtPrev;
    out.push({ campo: "comentarios", label: "Comentários", de: `${cmtPrev}`, para: `${cmtNext} (+${delta})` });
  } else if (cmtNext < cmtPrev) {
    out.push({ campo: "comentarios", label: "Comentários", de: `${cmtPrev}`, para: `${cmtNext}` });
  }
  const histPrev = Array.isArray(prev?.historicoStatus) ? prev.historicoStatus : [];
  const histNext = Array.isArray(next?.historicoStatus) ? next.historicoStatus : [];
  if (!sameTimeline(histPrev, histNext)) {
    out.push({
      campo: "historicoStatus",
      label: "Tempo na esteira",
      de: `${histPrev.length} fase(s)`,
      para: `${histNext.length} fase(s)`,
    });
  }
  const custoPrev = JSON.stringify(prev?.custo || null);
  const custoNext = JSON.stringify(next?.custo || null);
  if (custoPrev !== custoNext) {
    out.push({ campo: "custo", label: "Levantamento de custo", de: "—", para: "atualizado" });
  }
  const pdfPrev = prev?.pdfLevantamento?.id || "";
  const pdfNext = next?.pdfLevantamento?.id || "";
  if (pdfPrev !== pdfNext) {
    out.push({
      campo: "pdfLevantamento",
      label: "PDF de levantamento",
      de: pdfPrev ? "Anexado" : "—",
      para: pdfNext ? next.pdfLevantamento?.name || "Anexado" : "—",
    });
  }
  return out;
}

function sameTrackedValue(a, b) {
  const norm = (v) => (v === undefined || v === null ? "" : String(v));
  return norm(a) === norm(b);
}

function sameTimeline(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] || {};
    const y = b[i] || {};
    if (x.status !== y.status) return false;
    if ((x.inicio || "") !== (y.inicio || "")) return false;
    if ((x.fim || "") !== (y.fim || "")) return false;
    if ((x.observacao || "") !== (y.observacao || "")) return false;
  }
  return true;
}

function appendHistoricoEdicao(target, entry) {
  if (!target || !entry) return target;
  const list = Array.isArray(target.historicoEdicoes) ? [...target.historicoEdicoes] : [];
  list.push(entry);
  if (list.length > HISTORICO_EDICAO_LIMITE) list.splice(0, list.length - HISTORICO_EDICAO_LIMITE);
  target.historicoEdicoes = list;
  return target;
}

function registrarCriacaoNoHistoricoEdicao(payload) {
  const entry = normalizeHistoricoEdicaoEntry({
    id: uid(),
    tipo: "criacao",
    at: payload.updatedAt || new Date().toISOString(),
    by: buildEditorPresenceForLog(),
    nota: "Demanda criada",
  });
  appendHistoricoEdicao(payload, entry);
}

function registrarEdicaoNoHistoricoEdicao(prev, next) {
  const alt = diffEditTracked(prev, next);
  if (!alt.length) return false;
  const entry = normalizeHistoricoEdicaoEntry({
    id: uid(),
    tipo: "edicao",
    at: next.updatedAt || new Date().toISOString(),
    by: buildEditorPresenceForLog(),
    alteracoes: alt,
  });
  appendHistoricoEdicao(next, entry);
  return true;
}

function formatComentarioData(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatComentarioRelativo(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  if (h < 24) return h + " h";
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return d + " dias";
  return formatComentarioData(iso);
}

function comentarioGrupoDia(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function comentarioIniciais(autor) {
  const a = String(autor || "?").trim();
  const parts = a.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return a.slice(0, 2).toUpperCase();
}

function comentarioAvatarClass(autor) {
  const n = projetistaSlug(autor);
  if (n.includes("matheus")) return "comment-avatar--matheus";
  if (n.includes("vinicius")) return "comment-avatar--vinicius";
  if (n.includes("joao")) return "comment-avatar--joao";
  if (n.includes("daniel")) return "comment-avatar--daniel";
  if (n.includes("alberto")) return "comment-avatar--alberto";
  if (n.includes("rafael")) return "comment-avatar--rafael";
  return "comment-avatar--equipe";
}

function groupComentariosPorDia(items) {
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const groups = [];
  let lastLabel = null;
  for (const c of sorted) {
    const label = comentarioGrupoDia(c.createdAt);
    if (label !== lastLabel) {
      groups.push({ label, items: [] });
      lastLabel = label;
    }
    groups[groups.length - 1].items.push(c);
  }
  return groups;
}

function migrateDemanda(d) {
  const linha = inferLinhaEsteira(d);
  const cfg = getEsteiraConfig(linha);
  let status = mapStatusParaLinha(d.status || "", linha);
  if (!cfg.statusLabel[status]) status = cfg.inboxStatus;
  const motivosItens = normalizeMotivosAtrasoItens(d);
  const base = {
    id: d.id || uid(),
    titulo: d.titulo || "Sem título",
    descricao: d.descricao || "",
    comentarios: normalizeComentarios(d.comentarios),
    cidade: normalizeCidadeCadastro(d.cidade),
    dataChegada: d.dataChegada || "",
    dataFimPrevista: d.dataFimPrevista || "",
    dataFimAtualizada: d.dataFimAtualizada || "",
    dataTermino: d.dataTermino || "",
    statusAtual: d.statusAtual || "",
    motivosAtrasoItens: motivosItens,
    motivosAtraso: formatMotivosAtrasoTexto(motivosItens),
    valorProjetoRealizado: parseCustoMoney(d.valorProjetoRealizado),
    solicitante: d.solicitante || "",
    setorSolicitanteB2b: normalizeTipo(d.tipo) === "B2B" ? normalizeSetorSolicitanteB2b(d.setorSolicitanteB2b) : "",
    responsavel: normalizeResponsavel(d.responsavel, linha),
    tipo: normalizeTipo(d.tipo),
    produtoB2b: normalizeTipo(d.tipo) === "B2B" ? normalizeProdutoB2b(d.produtoB2b) : "",
    segmentoB2c: normalizeTipo(d.tipo) === "B2C" ? normalizeSegmentoB2c(d.segmentoB2c) : "",
    linhaEsteira: linha,
    status,
    ordemEsteira: (() => {
      const n = Number(d.ordemEsteira);
      return Number.isFinite(n) ? n : "";
    })(),
    custo: normalizeCusto(d.custo),
    pdfLevantamento: normalizePdfLevantamento(d.pdfLevantamento),
    imagens: Array.isArray(d.imagens) ? d.imagens : [],
    historicoStatus: normalizeHistoricoStatus(d.historicoStatus),
    historicoEdicoes: normalizeHistoricoEdicoes(d.historicoEdicoes),
    chamadoOcomon: String(d.chamadoOcomon || "").trim(),
    osAniel: String(d.osAniel || "").trim(),
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: d.updatedAt || new Date().toISOString(),
  };
  if (!base.historicoStatus.length) {
    const t = base.createdAt;
    base.historicoStatus = [{ status: base.status, inicio: t, fim: "", observacao: "" }];
  } else {
    const last = base.historicoStatus[base.historicoStatus.length - 1];
    if (last && last.status !== base.status) {
      base.historicoStatus = statusHistoryPush({ historicoStatus: base.historicoStatus.slice(0, -1) }, base.status, last.inicio);
    }
    if (!base.historicoStatus[base.historicoStatus.length - 1].fim && base.historicoStatus[base.historicoStatus.length - 1].status !== base.status) {
      /* noop */
    }
  }
  const eb = normalizeEditingBy(d.editingBy);
  if (eb) base.editingBy = eb;
  return base;
}

function formatDur(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function msToChartDays(ms) {
  return Math.round((ms / 86400000) * 10) / 10;
}

function demandaTempoPorFase(d, cfg = DASH_TEMPO_CFG_OP) {
  const dm = migrateDemanda(d);
  const linha = cfg.linhaEsteira || LINHA_ESTEIRA_OPERACIONAL;
  const statusAtual = resolveStatusKey(dm.status, linha);
  const map = {};

  for (const seg of dm.historicoStatus || []) {
    const statusKey = resolveStatusKey(seg.status, linha);
    if (cfg.isStatusExcluded(statusKey)) continue;

    /** Card em Aprovação BP: segmento aberto (stand-by) não entra no SLA — evita inflar Comercial. */
    if (linha === LINHA_ESTEIRA_B2B && !seg.fim && statusAtual === "aprovacao_bp") {
      continue;
    }

    const ms = timelineSegmentMs(seg);
    if (!ms) continue;
    map[statusKey] = (map[statusKey] || 0) + ms;
  }
  return map;
}

function aggregateTempoEsteira(rows, cfg = DASH_TEMPO_CFG_OP) {
  const setores = cfg.setores || SETORES_ESTEIRA;
  const byFase = {};
  const bySetor = Object.fromEntries(setores.map((s) => [s, 0]));
  const bySetorCount = Object.fromEntries(setores.map((s) => [s, 0]));
  const byFaseCount = {};

  for (const { d } of rows) {
    const porFase = demandaTempoPorFase(d, cfg);
    const touched = new Set();
    const setorMs = Object.fromEntries(setores.map((s) => [s, 0]));
    for (const [status, ms] of Object.entries(porFase)) {
      byFase[status] = (byFase[status] || 0) + ms;
      const setor = cfg.setorForStatus(status);
      if (setor) {
        bySetor[setor] += ms;
        setorMs[setor] += ms;
      }
      touched.add(status);
    }
    for (const s of touched) byFaseCount[s] = (byFaseCount[s] || 0) + 1;
    for (const s of setores) {
      if (setorMs[s] > 0) bySetorCount[s] += 1;
    }
  }

  const totalMs = Object.values(byFase).reduce((a, b) => a + b, 0);
  return { byFase, bySetor, bySetorCount, byFaseCount, totalMs, n: rows.length };
}

function timelineSegmentMs(seg) {
  const start = Date.parse(seg.inicio);
  if (!Number.isFinite(start)) return 0;
  const endRaw = seg.fim ? Date.parse(seg.fim) : Date.now();
  if (!Number.isFinite(endRaw)) return 0;
  const ms = Math.max(0, endRaw - start);
  const maxMs = 86400000 * 365 * 15;
  return ms > maxMs ? 0 : ms;
}

/* ---------- UI: toast, confirm, tabs ---------- */
const toastEl = document.getElementById("toast");

function getOpenDialog() {
  const list = document.querySelectorAll("dialog[open]");
  return list.length ? list[list.length - 1] : null;
}

/** `<dialog showModal>` fica acima de `position:fixed` — o toast entra no modal aberto. */
function syncToastHost() {
  if (!toastEl) return;
  const dlg = getOpenDialog();
  if (dlg) {
    const inner = dlg.querySelector(".modal__inner") || dlg;
    if (toastEl.parentElement !== inner) {
      inner.insertBefore(toastEl, inner.firstChild);
    }
    toastEl.classList.add("toast--in-modal");
  } else {
    if (toastEl.parentElement !== document.body) {
      document.body.appendChild(toastEl);
    }
    toastEl.classList.remove("toast--in-modal");
  }
}

function initToastDialogHosts() {
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("close", syncToastHost);
  });
}

function toast(msg) {
  if (!toastEl) return;
  syncToastHost();
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

let confirmDialogResolve = null;

function initConfirmDialog() {
  const dlg = document.getElementById("modalConfirm");
  const btnOk = document.getElementById("confirmDialogOk");
  const btnCancel = document.getElementById("confirmDialogCancel");
  if (!dlg || !btnOk || !btnCancel) return;

  const finish = (ok) => {
    if (!confirmDialogResolve) return;
    const resolve = confirmDialogResolve;
    confirmDialogResolve = null;
    dlg.close();
    resolve(ok);
  };

  btnOk.addEventListener("click", () => finish(true));
  btnCancel.addEventListener("click", () => finish(false));
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    finish(false);
  });
  dlg.addEventListener("close", () => {
    if (confirmDialogResolve) finish(false);
  });
}

/**
 * Diálogo de confirmação no estilo do sistema (substitui window.confirm).
 * @returns {Promise<boolean>}
 */
function confirmDialog({
  title = "Confirmar",
  message = "",
  hint = "",
  details = null,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
} = {}) {
  const dlg = document.getElementById("modalConfirm");
  const titleEl = document.getElementById("confirmDialogTitle");
  const msgEl = document.getElementById("confirmDialogMessage");
  const hintEl = document.getElementById("confirmDialogHint");
  const detailsEl = document.getElementById("confirmDialogDetails");
  const btnOk = document.getElementById("confirmDialogOk");
  const btnCancel = document.getElementById("confirmDialogCancel");
  if (!dlg || !titleEl || !btnOk || !btnCancel) {
    return Promise.resolve(window.confirm([title, message].filter(Boolean).join("\n\n")));
  }

  dlg.classList.remove("confirm-dialog--danger", "confirm-dialog--warn", "confirm-dialog--default");
  dlg.classList.add(
    variant === "warn" ? "confirm-dialog--warn" : variant === "default" ? "confirm-dialog--default" : "confirm-dialog--danger",
  );

  titleEl.textContent = title;
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.hidden = !message;
  }
  if (hintEl) {
    hintEl.textContent = hint;
    hintEl.hidden = !hint;
  }
  if (detailsEl) {
    const rows = Array.isArray(details) ? details.filter((d) => d && d.label) : [];
    if (rows.length) {
      detailsEl.innerHTML = rows
        .map(
          (d) =>
            "<div><dt>" +
            escapeHtml(d.label) +
            "</dt><dd>" +
            escapeHtml(String(d.value ?? "—")) +
            "</dd></div>",
        )
        .join("");
      detailsEl.hidden = false;
    } else {
      detailsEl.innerHTML = "";
      detailsEl.hidden = true;
    }
  }
  btnOk.textContent = confirmText;
  btnCancel.textContent = cancelText;
  btnOk.className = variant === "default" ? "btn btn--primary" : "btn btn--danger";

  return new Promise((resolve) => {
    confirmDialogResolve = resolve;
    dlg.showModal();
    requestAnimationFrame(() => btnOk.focus());
  });
}

initConfirmDialog();
initToastDialogHosts();

let state = defaultState();

const panels = {
  esteira: document.getElementById("panelEsteira"),
  diarias: document.getElementById("panelDiarias"),
  projetistas: document.getElementById("panelProjetistas"),
  dashboard: document.getElementById("panelDashboard"),
};

function switchMainTab(tab) {
  document.querySelectorAll(".tabs__btn[data-tab]").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  Object.entries(panels).forEach(([k, el]) => {
    if (!el) return;
    const on = k === tab;
    el.classList.toggle("is-visible", on);
    el.hidden = !on;
  });
  if (tab === "dashboard") renderDashboard();
  if (tab === "diarias") renderDiarias();
  if (tab === "projetistas") renderProjetistas();
  if (tab === "esteira") renderBoard();
}

document.querySelectorAll(".tabs__btn[data-tab]").forEach((btn) => {
  if (btn.id === "btnTabEsteira") return;
  btn.addEventListener("click", () => switchMainTab(btn.dataset.tab));
});

document.getElementById("btnTabEsteira")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("esteiraTabPanel");
  const willOpen = panel?.hidden !== false;
  setEsteiraTabMenuOpen(willOpen);
  if (willOpen) {
    setImportMenuOpen(false);
    setExportMenuOpen(false);
  }
  switchMainTab("esteira");
});

document.querySelectorAll("[data-esteira-linha]").forEach((btn) => {
  btn.addEventListener("click", () => {
    setActiveEsteiraCanal(btn.dataset.esteiraLinha);
    switchMainTab("esteira");
  });
});

updateEsteiraTabLabel();

/* ---------- Filters (esteira) ---------- */
initEsteiraFilters();

/* ---------- Arraste: rolagem horizontal automática na esteira ---------- */
const esteiraDragScroll = { active: false, x: 0, y: 0, raf: 0 };

function getEsteiraBoardsForDragScroll() {
  const panel = document.getElementById("panelEsteira");
  if (!panel || panel.hidden) return [];
  return [...panel.querySelectorAll(".board")].filter((el) => {
    if (el.closest("[hidden]")) return false;
    return el.scrollWidth > el.clientWidth + 4;
  });
}

function applyEsteiraBoardDragScroll(board, clientX, clientY) {
  const r = board.getBoundingClientRect();
  const edge = 72;
  const maxSpeed = 20;
  const yPad = 56;
  const xPad = 32;

  if (clientY < r.top - yPad || clientY > r.bottom + yPad) return;
  if (clientX < r.left - xPad || clientX > r.right + xPad) return;

  let speed = 0;
  if (clientX < r.left + edge) {
    const t = Math.max(0, Math.min(1, (clientX - r.left) / edge));
    speed = -maxSpeed * (1 - t);
  } else if (clientX > r.right - edge) {
    const t = Math.max(0, Math.min(1, (r.right - clientX) / edge));
    speed = maxSpeed * (1 - t);
  }

  if (!speed) return;
  const maxLeft = board.scrollWidth - board.clientWidth;
  if (speed < 0 && board.scrollLeft <= 0) return;
  if (speed > 0 && board.scrollLeft >= maxLeft) return;
  board.scrollLeft += speed;
}

function tickEsteiraDragScroll() {
  if (!esteiraDragScroll.active) return;
  const { x, y } = esteiraDragScroll;
  for (const board of getEsteiraBoardsForDragScroll()) {
    applyEsteiraBoardDragScroll(board, x, y);
  }
  esteiraDragScroll.raf = requestAnimationFrame(tickEsteiraDragScroll);
}

function onEsteiraDocumentDragOver(e) {
  if (!esteiraDragScroll.active) return;
  esteiraDragScroll.x = e.clientX;
  esteiraDragScroll.y = e.clientY;
}

function stopEsteiraBoardDragScroll() {
  esteiraDragScroll.active = false;
  if (esteiraDragScroll.raf) {
    cancelAnimationFrame(esteiraDragScroll.raf);
    esteiraDragScroll.raf = 0;
  }
  document.removeEventListener("dragover", onEsteiraDocumentDragOver, true);
  document.querySelectorAll(".card--dragging").forEach((c) => c.classList.remove("card--dragging"));
}

function startEsteiraBoardDragScroll() {
  if (esteiraDragScroll.active) return;
  esteiraDragScroll.active = true;
  document.addEventListener("dragover", onEsteiraDocumentDragOver, true);
  tickEsteiraDragScroll();
}

function initEsteiraBoardDragScroll() {
  const panel = document.getElementById("panelEsteira");
  if (!panel || panel.dataset.dragScrollInited) return;
  panel.dataset.dragScrollInited = "1";

  panel.addEventListener(
    "dragstart",
    (e) => {
      const card = e.target.closest(".card[draggable='true']");
      if (!card || !panel.contains(card)) return;
      card.classList.add("card--dragging");
      startEsteiraBoardDragScroll();
    },
    true,
  );

  const endDrag = () => stopEsteiraBoardDragScroll();
  document.addEventListener("dragend", endDrag);
  document.addEventListener("drop", endDrag);
}

initEsteiraBoardDragScroll();

/* ---------- Board (fila geral + esteira unificada) ---------- */
const BOARD_ATRIBUIDOS = "*";

function filteredDemandasForEsteira(linha = activeEsteiraCanal) {
  const f = readEsteiraFilters();
  const tombstones = demandaDeleteTombstones();
  return state.demandas
    .filter((d) => !tombstones.has(d.id))
    .map(migrateDemanda)
    .filter((d) => inferLinhaEsteira(d) === normalizeLinhaEsteira(linha))
    .filter((d) => demandaMatchesEsteiraFilters(d, f));
}

function demandasForBoard(boardResponsavel, linha = activeEsteiraCanal) {
  const list = filteredDemandasForEsteira(linha);
  if (boardResponsavel === BOARD_ATRIBUIDOS) {
    return list.filter((d) => normalizeResponsavel(d.responsavel) !== "");
  }
  const alvo = normalizeResponsavel(boardResponsavel);
  if (alvo === "") return list.filter((d) => normalizeResponsavel(d.responsavel) === "");
  return list.filter((d) => d.responsavel === alvo);
}

function normalizeOrdemEsteira(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Menor ordem = mais no topo (maior prioridade na coluna). */
function compareDemandaEsteiraOrdem(a, b) {
  const oa = normalizeOrdemEsteira(a.ordemEsteira);
  const ob = normalizeOrdemEsteira(b.ordemEsteira);
  if (oa != null && ob != null && oa !== ob) return oa - ob;
  if (oa != null && ob == null) return -1;
  if (oa == null && ob != null) return 1;
  return String(a.updatedAt || "").localeCompare(String(b.updatedAt || ""));
}

function demandasNaColunaEsteira(dem, linha = activeEsteiraCanal) {
  const unassigned = !normalizeResponsavel(dem.responsavel);
  const pool = unassigned
    ? demandasForBoard("", linha)
    : demandasForBoard(BOARD_ATRIBUIDOS, linha).filter((d) => d.status === dem.status);
  return pool.slice().sort(compareDemandaEsteiraOrdem);
}

function maxOrdemNaColuna(status, responsavel) {
  const stub = { status, responsavel };
  let max = 0;
  for (const d of demandasNaColunaEsteira(stub)) {
    const o = normalizeOrdemEsteira(d.ordemEsteira);
    if (o != null && o > max) max = o;
  }
  return max;
}

function ordemAoEntrarColuna(status, responsavel) {
  return maxOrdemNaColuna(status, responsavel) + 10;
}

function renumberColumnOrdens(orderedList) {
  const now = new Date().toISOString();
  orderedList.forEach((d, i) => {
    d.ordemEsteira = (i + 1) * 10;
    d.updatedAt = now;
  });
  return orderedList;
}

function moveDemandaOrdemEsteira(demId, delta) {
  const dem = state.demandas.find((x) => x.id === demId);
  if (!dem || !delta) return;
  const peers = demandasNaColunaEsteira(dem);
  const idx = peers.findIndex((d) => d.id === demId);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= peers.length) return;
  const ordered = peers.slice();
  const [item] = ordered.splice(idx, 1);
  ordered.splice(target, 0, item);
  renumberColumnOrdens(ordered);
  for (const d of ordered) applyCloudPatch({ demanda: migrateDemanda(d) });
  saveState();
  renderBoard();
  toast(delta < 0 ? "Card movido para cima (mais prioridade)" : "Card movido para baixo");
}

function handleDemandaDrop(dem, newStatus, boardResponsavel) {
  if (!dem) return;
  const dm = migrateDemanda(dem);
  const alteraResponsavel = boardResponsavel !== BOARD_ATRIBUIDOS;
  const resp = alteraResponsavel ? normalizeResponsavel(boardResponsavel) : normalizeResponsavel(dem.responsavel);
  if (dem.status === newStatus && normalizeResponsavel(dem.responsavel) === resp) return;
  const now = new Date().toISOString();
  if (dem.status !== newStatus) {
    dem.status = newStatus;
    dem.historicoStatus = statusHistoryPush(dem, newStatus);
    if (isStatusConcluidoNoFormulario(newStatus, dm.linhaEsteira) && !dem.dataTermino) {
      dem.dataTermino = todayISODate();
    }
    dem.ordemEsteira = ordemAoEntrarColuna(newStatus, alteraResponsavel ? resp : dem.responsavel);
  }
  if (alteraResponsavel) dem.responsavel = resp;
  dem.updatedAt = now;
  saveState({ demanda: dem });
  renderBoard();
  toast("Demanda atualizada");
}

/** Fila sem projetista: uma única caixa; soltar aqui só remove o direcionamento (mantém o status). */
function handleInboxDrop(dem) {
  if (!dem) return;
  if (normalizeResponsavel(dem.responsavel) === "") return;
  const now = new Date().toISOString();
  dem.responsavel = "";
  dem.updatedAt = now;
  saveState({ demanda: dem });
  renderBoard();
  toast("Demanda devolvida à fila geral");
}

const INBOX_ALERT_DIAS_SEM_ATRIB = 7;

function diasDesdeChegadaDemanda(d) {
  const dm = migrateDemanda(d);
  const iso = dm.dataChegada || (dm.createdAt || "").slice(0, 10);
  const a = parseDate(iso);
  const hoje = parseDate(todayISODate());
  if (a == null || hoje == null) return null;
  return Math.max(0, Math.round((hoje - a) / 86400000));
}

function buildInboxAlertasRows(list, linha) {
  const hoje = todayISODate();
  const hojeMs = parseDate(hoje);
  const rows = [];
  for (const raw of list) {
    const d = migrateDemanda(raw);
    const triagemMsgs = [];
    let triagemMeta = "";

    const dias = diasDesdeChegadaDemanda(d);
    if (dias != null && dias >= INBOX_ALERT_DIAS_SEM_ATRIB) {
      triagemMsgs.push(`Sem atribuição há ${dias} dia(s)`);
      triagemMeta = `Chegada: ${formatDataISO(d.dataChegada || d.createdAt?.slice(0, 10))}`;
    }
    if (linha === LINHA_ESTEIRA_OPERACIONAL && normalizeTipo(d.tipo) === "B2C" && !d.segmentoB2c) {
      triagemMsgs.push("B2C sem segmento (MDU, TCR ou TCT)");
      if (!triagemMeta) triagemMeta = "Complete no cadastro antes de atribuir";
    }
    if (linha === LINHA_ESTEIRA_B2B && normalizeTipo(d.tipo) === "B2B" && !d.produtoB2b) {
      triagemMsgs.push("B2B sem produto");
      if (!triagemMeta) triagemMeta = "Selecione o produto no cadastro";
    }

    let prazoMsg = "";
    let prazoMeta = "";
    const prev = d.dataFimPrevista;
    if (prev) {
      const prevMs = parseDate(prev);
      if (prevMs != null && hojeMs != null && hojeMs > prevMs) {
        prazoMsg = "Prazo previsto vencido";
        prazoMeta = `Previsto: ${formatDataISO(prev)}`;
      }
    }

    const hasTriagem = triagemMsgs.length > 0;
    const hasPrazo = !!prazoMsg;
    if (!hasTriagem && !hasPrazo) continue;

    let severity, msg, meta;
    if (hasTriagem && hasPrazo) {
      severity = "bad";
      msg = `${triagemMsgs.join(" · ")} + ${prazoMsg}`;
      meta = [prazoMeta, triagemMeta].filter(Boolean).join(" · ");
    } else if (hasPrazo) {
      severity = "prazo";
      msg = prazoMsg;
      meta = prazoMeta;
    } else {
      severity = "warn";
      msg = triagemMsgs.join(" · ");
      meta = triagemMeta;
    }
    rows.push({ severity, d, msg, meta });
  }
  const ordem = { bad: 0, prazo: 1, warn: 2 };
  return rows.sort(
    (a, b) =>
      (ordem[a.severity] ?? 3) - (ordem[b.severity] ?? 3) ||
      a.d.titulo.localeCompare(b.d.titulo, "pt-BR"),
  );
}

function renderInboxAlertas(linha = activeEsteiraCanal) {
  const el =
    document.getElementById(linha === LINHA_ESTEIRA_B2B ? "esteiraInboxAlertasB2b" : "esteiraInboxAlertas");
  if (!el) return;
  const list = demandasForBoard("", linha);
  const rows = buildInboxAlertasRows(list, linha);

  if (!list.length) {
    el.innerHTML =
      '<div class="inbox-alertas inbox-alertas--empty">' +
      '<h4 class="inbox-alertas__title">Alertas</h4>' +
      '<p class="muted small">Nenhuma demanda na fila.</p></div>';
    return;
  }

  if (!rows.length) {
    el.innerHTML =
      '<div class="inbox-alertas">' +
      '<h4 class="inbox-alertas__title">Alertas <span class="inbox-alertas__ok">Tudo ok</span></h4>' +
      `<p class="muted small">${list.length} na fila — nenhum alerta no momento.</p></div>`;
    return;
  }

  const items = rows
    .map(
      (r) =>
        `<li><button type="button" class="inbox-alertas__item inbox-alertas__item--${r.severity}" data-id="${escapeHtml(r.d.id)}">` +
        `<span class="inbox-alertas__item-titulo">${escapeHtml(r.d.titulo)}</span>` +
        `<span class="inbox-alertas__item-msg">${escapeHtml(r.msg)}</span>` +
        (r.meta ? `<span class="inbox-alertas__item-meta">${escapeHtml(r.meta)}</span>` : "") +
        `</button></li>`,
    )
    .join("");

  el.innerHTML =
    '<div class="inbox-alertas">' +
    `<h4 class="inbox-alertas__title">Alertas <span class="inbox-alertas__count">${rows.length}</span></h4>` +
    '<p class="muted small">Clique para abrir o projeto. <strong>Vermelho</strong>: triagem + prazo. <strong>Laranja</strong>: só prazo. <strong>Amarelo</strong>: só triagem.</p>' +
    `<ul class="inbox-alertas__list">${items}</ul></div>`;

  el.querySelectorAll(".inbox-alertas__item[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => openDemandaModal(btn.dataset.id));
  });
}

/**
 * Captura o scroll do board e de cada coluna ANTES de re-renderizar
 * e devolve um restaurador para chamar DEPOIS. Evita que ações como
 * abrir/fechar um card (que disparam onSnapshot do Firestore) joguem
 * a página de volta ao topo.
 */
function preserveBoardScroll(boardEl) {
  if (!boardEl) return () => {};
  const scrollLeft = boardEl.scrollLeft || 0;
  const scrollTop = boardEl.scrollTop || 0;
  const colScrolls = new Map();
  boardEl.querySelectorAll(".column").forEach((col) => {
    const key = col.dataset.status || col.className || "";
    const body = col.querySelector(".column__body");
    if (body) colScrolls.set(key, body.scrollTop || 0);
  });
  return function restore() {
    boardEl.scrollLeft = scrollLeft;
    boardEl.scrollTop = scrollTop;
    boardEl.querySelectorAll(".column").forEach((col) => {
      const key = col.dataset.status || col.className || "";
      if (!colScrolls.has(key)) return;
      const body = col.querySelector(".column__body");
      if (body) body.scrollTop = colScrolls.get(key);
    });
  };
}

function renderPendenteBoard(boardEl, linha = activeEsteiraCanal) {
  const cfg = getEsteiraConfig(linha);
  const list = demandasForBoard("", linha).sort(compareDemandaEsteiraOrdem);
  const restoreScroll = preserveBoardScroll(boardEl);
  boardEl.innerHTML = "";
  const col = document.createElement("div");
  col.className = "column column--inbox";
  col.dataset.status = cfg.inboxStatus;
  col.innerHTML = columnHeadHtml(cfg.inboxStatus, linha, list.length) + `<div class="column__body"></div>`;
  const body = col.querySelector(".column__body");
  col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
  col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
  col.addEventListener("drop", (e) => {
    e.preventDefault();
    col.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/plain");
    const dem = state.demandas.find((x) => x.id === id);
    handleInboxDrop(dem);
  });
  list.forEach((d, i) => {
    body.appendChild(renderCard(d, { canMoveUp: i > 0, canMoveDown: i < list.length - 1 }));
  });
  boardEl.appendChild(col);
  restoreScroll();
}

function renderBoardInto(boardEl, boardResponsavel, linha = activeEsteiraCanal) {
  const cfg = getEsteiraConfig(linha);
  const cols = [...cfg.statusOrder.map(([k]) => k), ...cfg.statusExtra.map(([k]) => k)];
  const byCol = Object.fromEntries(cols.map((k) => [k, []]));
  for (const d of demandasForBoard(boardResponsavel, linha)) {
    if (!byCol[d.status]) d.status = cfg.inboxStatus;
    byCol[d.status].push(d);
  }
  const restoreScroll = preserveBoardScroll(boardEl);
  boardEl.innerHTML = "";
  for (const key of cols) {
    const col = document.createElement("div");
    col.className = "column";
    col.dataset.status = key;
    const list = (byCol[key] || []).slice().sort(compareDemandaEsteiraOrdem);
    col.innerHTML = columnHeadHtml(key, linha, list.length) + `<div class="column__body"></div>`;
    const body = col.querySelector(".column__body");
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      const dem = state.demandas.find((x) => x.id === id);
      handleDemandaDrop(dem, key, boardResponsavel);
    });
    list.forEach((d, i) => {
      body.appendChild(renderCard(d, { canMoveUp: i > 0, canMoveDown: i < list.length - 1 }));
    });
    boardEl.appendChild(col);
  }
  restoreScroll();
}

function renderBoard() {
  const linha = activeEsteiraCanal;
  const viewOp = document.getElementById("esteiraViewOperacional");
  const viewB2b = document.getElementById("esteiraViewB2b");
  if (viewOp) viewOp.hidden = linha !== LINHA_ESTEIRA_OPERACIONAL;
  if (viewB2b) viewB2b.hidden = linha !== LINHA_ESTEIRA_B2B;
  if (linha === LINHA_ESTEIRA_B2B) {
    const pendente = document.getElementById("boardPendenteB2b");
    const esteira = document.getElementById("boardEsteiraB2b");
    if (pendente) renderPendenteBoard(pendente, linha);
    renderInboxAlertas(linha);
    if (esteira) renderBoardInto(esteira, BOARD_ATRIBUIDOS, linha);
  } else {
    const pendente = document.getElementById("boardPendente");
    const esteira = document.getElementById("boardEsteira");
    if (pendente) renderPendenteBoard(pendente, linha);
    renderInboxAlertas(linha);
    if (esteira) renderBoardInto(esteira, BOARD_ATRIBUIDOS, linha);
  }
  updateEsteiraStatusLine();
}

function setEsteiraTabMenuOpen(open) {
  setDropdownMenuOpen("esteiraTabPanel", "btnTabEsteira", open);
}

function updateEsteiraTabLabel() {
  const el = document.getElementById("esteiraTabLabel");
  if (!el) return;
  el.textContent = activeEsteiraCanal === LINHA_ESTEIRA_B2B ? "· B2B" : "· Projetos";
  document.querySelectorAll("[data-esteira-linha]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.esteiraLinha === activeEsteiraCanal);
  });
}

function setActiveEsteiraCanal(linha) {
  activeEsteiraCanal = normalizeLinhaEsteira(linha);
  setEsteiraTabMenuOpen(false);
  updateEsteiraTabLabel();
  fillFilterProjetistaSelect(activeEsteiraCanal);
  syncEsteiraFiltroTipoProduto(activeEsteiraCanal);
  const panelEsteira = document.getElementById("panelEsteira");
  if (panelEsteira && !panelEsteira.hidden) renderBoard();
}

function getUserHomePreference(user) {
  if (window.DemandasUserHome?.resolve) {
    return window.DemandasUserHome.resolve(user);
  }
  return { tab: "esteira", esteira: LINHA_ESTEIRA_OPERACIONAL };
}

/** Tela inicial após login conforme e-mail em user-home.js */
function applyUserHomeOnLogin(user) {
  const home = getUserHomePreference(user);
  if (home.tab === "esteira") {
    setActiveEsteiraCanal(home.esteira || LINHA_ESTEIRA_OPERACIONAL);
    switchMainTab("esteira");
    return;
  }
  if (panels[home.tab]) {
    switchMainTab(home.tab);
    return;
  }
  setActiveEsteiraCanal(LINHA_ESTEIRA_OPERACIONAL);
  switchMainTab("esteira");
}

function renderCard(d, { canMoveUp = false, canMoveDown = false } = {}) {
  const el = document.createElement("article");
  const dmCard = migrateDemanda(d);
  el.className =
    "card " +
    tipoCardClass(d.tipo) +
    (dmCard.linhaEsteira === LINHA_ESTEIRA_B2B ? " card--b2b" : " card--esteira-projetos");
  if (isAtraso(d)) el.classList.add("card--atraso");
  if (d.status === "pausado") el.classList.add("card--pausado");
  if (d.status === "reprovado") el.classList.add("card--reprovado");
  if (normalizeEditingBy(d.editingBy)) {
    el.classList.add("card--being-edited");
  }
  el.draggable = true;
  el.dataset.id = d.id;
  el.addEventListener("dragstart", (e) => {
    if (e.target.closest(".card__prio")) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", d.id);
    e.dataTransfer.effectAllowed = "move";
  });
  el.addEventListener("click", (e) => {
    if (e.target.closest(".card__prio")) return;
    openDemandaModal(d.id);
  });

  const atr = isAtraso(d) ? `<span class="badge badge--atr">Atraso</span>` : "";
  const st = d.status || "novo";
  const statusBadge = `<span class="badge ${statusBadgeClass(st)}">${escapeHtml(labelStatus(st, dmCard.linhaEsteira))}</span>`;
  const statusTxt = (d.statusAtual || "").trim();
  const statusTxtHtml = statusTxt
    ? `<p class="card__status-atual">${escapeHtml(statusTxt)}</p>`
    : "";
  const diasAtraso = demandaDiasAtraso(d);
  const atrasoHtml =
    isAtraso(d) && diasAtraso > 0
      ? `<div class="card__atraso"><p class="card__atraso-dias"><strong>Atraso:</strong> ${escapeHtml(formatDiasAtrasoLabel(diasAtraso))}</p></div>`
      : "";
  const diasAberto = demandaDiasAberto(d);
  const diasAbertoHtml =
    demandaInicioContagemAberto(dmCard)
      ? `<p class="card__dias-aberto" title="${isStatusConcluidoDemanda(dmCard) ? "Dias aberto até a conclusão" : "Dias desde a chegada — atualiza diariamente"}"><strong>Aberto:</strong> ${escapeHtml(formatDiasAbertoLabel(diasAberto))}</p>`
      : "";
  const editingHtml = cardEditingByHtml(d);
  const respAtrib = normalizeResponsavel(d.responsavel)
    ? `<span>${escapeHtml(d.responsavel)}</span>`
    : `<span class="badge badge--pend">${escapeHtml(labelProjetista(d.responsavel))}</span>`;
  const tipo = normalizeTipo(d.tipo);
  const produtoHtml =
    tipo === "B2B" && dmCard.produtoB2b
      ? `<span class="badge badge--produto-b2b">${escapeHtml(dmCard.produtoB2b)}</span>`
      : "";
  const segmentoHtml =
    tipo === "B2C" && dmCard.segmentoB2c
      ? `<span class="badge badge--segmento-b2c">${escapeHtml(dmCard.segmentoB2c)}</span>`
      : "";
  const prioHtml =
    `<div class="card__prio" title="Prioridade nesta coluna (topo = mais importante)">` +
    `<button type="button" class="card-prio-btn" data-dir="-1" aria-label="Subir (mais prioridade)"${canMoveUp ? "" : " disabled"}>▲</button>` +
    `<button type="button" class="card-prio-btn" data-dir="1" aria-label="Descer"${canMoveDown ? "" : " disabled"}>▼</button>` +
    `</div>`;
  el.innerHTML = `
    ${prioHtml}
    <h3 class="card__title"></h3>
    ${editingHtml}
    ${statusTxtHtml}
    ${diasAbertoHtml}
    ${atrasoHtml}
    <div class="card__meta">
      <span class="badge ${tipoBadgeClass(tipo)}">${escapeHtml(tipo)}</span>
      ${produtoHtml}
      ${segmentoHtml}
      ${statusBadge}
      ${respAtrib}
      ${d.cidade ? `<span>${escapeHtml(d.cidade)}</span>` : ""}
      ${d.solicitante ? `<span>${escapeHtml(d.solicitante)}</span>` : ""}
      ${atr}
    </div>
  `;
  el.querySelector(".card__title").textContent = d.titulo;
  el.querySelectorAll(".card-prio-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (btn.disabled) return;
      moveDemandaOrdemEsteira(d.id, Number(btn.dataset.dir));
    });
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
  });
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Modal demanda ---------- */
const modalDemanda = document.getElementById("modalDemanda");
const demStatusSel = document.getElementById("demStatus");

function setDemandaModalScrollLock(locked) {
  document.documentElement.classList.toggle("demanda-modal-open", locked);
}

function initDemandaModalScrollLock() {
  if (!modalDemanda) return;
  modalDemanda.addEventListener("close", () => {
    const id = editingDemandaOpenId;
    stopPresenceHeartbeat();
    if (id) releaseDemandaEditing(id);
    editingDemandaOpenId = null;
    editingDemandaBaselineUpdatedAt = "";
    hideDemandaModalAlerts();
    setDemandaModalScrollLock(false);
    if (panels.esteira && !panels.esteira.hidden) renderBoard();
  });
  const isInsideOpenDialog = (target) => {
    const node = target instanceof Node ? target : null;
    if (!node) return false;
    const dialogs = document.querySelectorAll("dialog[open]");
    for (const d of dialogs) {
      if (d.contains(node)) return true;
    }
    return false;
  };
  const blockScrollBehind = (e) => {
    if (!modalDemanda.open) return;
    if (isInsideOpenDialog(e.target)) return;
    e.preventDefault();
  };
  document.addEventListener("wheel", blockScrollBehind, { passive: false, capture: true });
  document.addEventListener("touchmove", blockScrollBehind, { passive: false, capture: true });
}

function fillStatusSelect(linha = editingLinhaEsteira) {
  if (!demStatusSel) return;
  const cfg = getEsteiraConfig(linha);
  demStatusSel.innerHTML = "";
  for (const [k, lab] of [...cfg.statusOrder, ...cfg.statusExtra]) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = lab;
    demStatusSel.appendChild(o);
  }
}
fillStatusSelect();
initDemandaModalScrollLock();

function fillSelectOptions(sel, options, preserveValue) {
  if (!sel) return;
  const cur = preserveValue !== false ? sel.value : "";
  sel.innerHTML = "";
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    sel.appendChild(opt);
  }
  if (cur && [...sel.options].some((opt) => opt.value === cur)) sel.value = cur;
}

function initProjetistaSelects() {
  fillDemResponsavelSelect(LINHA_ESTEIRA_OPERACIONAL);
  fillSelectOptions(document.getElementById("diariaResp"), PROJETISTAS.map((n) => ({ value: n, label: n })));
  fillSelectOptions(document.getElementById("filterDiariaResp"), [
    { value: "", label: "Todos" },
    ...PROJETISTAS.map((n) => ({ value: n, label: n })),
  ]);
  const dashProjetistaOpts = [
    { value: "", label: "Selecione…" },
    { value: FILTER_PROJETISTA_TODOS, label: "Todos os projetistas" },
    ...PROJETISTAS.map((n) => ({ value: n, label: n })),
    { value: "__none__", label: "Não atribuído" },
  ];
  for (const id of ["filterDashCfResp", "filterDashAtrasoResp", "filterDashTempoResp"]) {
    fillSelectOptions(document.getElementById(id), dashProjetistaOpts);
  }
  const dashB2bProjetistaOpts = [
    { value: "", label: "Selecione…" },
    { value: FILTER_PROJETISTA_TODOS, label: "Todos os projetistas" },
    ...PROJETISTAS_B2B.map((n) => ({ value: n, label: n })),
    { value: "__none__", label: "Não atribuído" },
  ];
  fillSelectOptions(document.getElementById("filterDashTempoB2bResp"), dashB2bProjetistaOpts);
  const peSel = document.getElementById("filterDashPeResp");
  const peCur = peSel?.value ?? "";
  const dashPeOpts = [
    { value: "", label: "Selecione…" },
    { value: FILTER_PROJETISTA_TODOS, label: "Todos os projetistas" },
    ...PROJETISTAS.map((n) => ({ value: n, label: n })),
    { value: "__none__", label: "Não atribuído" },
  ];
  fillSelectOptions(peSel, dashPeOpts, false);
  if (peSel) {
    if (peCur !== "" && [...peSel.options].some((o) => o.value === peCur)) peSel.value = peCur;
    else peSel.value = "";
  }
}
initProjetistaSelects();
initDemCidadeSelects();
initDemProdutoB2bSelect();
initDemSetorSolicitanteB2bSelect();
initDemSolicitanteB2bSelect();
initDemSegmentoB2cSelect();

function diariaRespClass(resp) {
  const map = {
    Matheus: "matheus",
    Vinicius: "vinicius",
    "João": "joao",
    Daniel: "daniel",
    Alberto: "alberto",
    Rafael: "rafael",
  };
  return map[resp] || "outros";
}

function readValorProjetoRealizadoFromForm() {
  const v = document.getElementById("demValorProjetoRealizado")?.value;
  const n = parseFloat(v);
  return v === "" || Number.isNaN(n) ? "" : parseCustoMoney(n);
}

function syncDemConclusaoFields() {
  const concluido = isStatusConcluidoNoFormulario(demStatusSel?.value, editingLinhaEsteira);
  const inpTermino = document.getElementById("demDataTermino");
  if (inpTermino) {
    inpTermino.disabled = !concluido;
    if (concluido && !inpTermino.value) inpTermino.value = todayISODate();
  }
  const fsValor = document.getElementById("fieldsetValorRealizado");
  if (fsValor) fsValor.hidden = !concluido;
}

function initDemProdutoB2bSelect() {
  const sel = document.getElementById("demProdutoB2b");
  if (!sel || sel.dataset.inited === "1") return;
  sel.dataset.inited = "1";
  sel.innerHTML =
    '<option value="">Selecione o produto…</option>' +
    PRODUTOS_B2B.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
}

function syncDemProdutoB2bField() {
  const field = document.getElementById("fieldDemProdutoB2b");
  const sel = document.getElementById("demProdutoB2b");
  const labelTipo = document.getElementById("labelDemTipo");
  const labelProduto = document.getElementById("labelDemProduto");
  if (!field || !sel) return;
  const isB2b = normalizeTipo(document.getElementById("demTipo")?.value) === "B2B";
  field.hidden = !isB2b;
  field.classList.toggle("is-hidden", !isB2b);
  sel.required = isB2b;
  sel.disabled = !isB2b;
  if (!isB2b) sel.value = "";
  labelTipo?.classList.toggle("field-label--required", !isB2b);
  labelProduto?.classList.toggle("field-label--required", isB2b);
}

function initDemSegmentoB2cSelect() {
  const sel = document.getElementById("demSegmentoB2c");
  if (!sel || sel.dataset.inited === "1") return;
  sel.dataset.inited = "1";
  sel.innerHTML =
    '<option value="">Selecione o segmento…</option>' +
    SEGMENTOS_B2C.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
}

function syncDemSegmentoB2cField() {
  const field = document.getElementById("fieldDemSegmentoB2c");
  const sel = document.getElementById("demSegmentoB2c");
  if (!field || !sel) return;
  const isB2c = normalizeTipo(document.getElementById("demTipo")?.value) === "B2C";
  field.hidden = !isB2c;
  field.classList.toggle("is-hidden", !isB2c);
  sel.required = isB2c;
  sel.disabled = !isB2c;
  if (!isB2c) sel.value = "";
}

function syncDemCamposPorTipo() {
  syncDemProdutoB2bField();
  syncDemSegmentoB2cField();
  syncDemSolicitanteField();
}

function initDemSetorSolicitanteB2bSelect() {
  const sel = document.getElementById("demSetorSolicitanteB2b");
  if (!sel || sel.dataset.inited === "1") return;
  sel.dataset.inited = "1";
  sel.innerHTML = SETORES_SOLICITANTE_B2B.map(
    (s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`,
  ).join("");
}

function initDemSolicitanteB2bSelect() {
  const sel = document.getElementById("demSolicitanteB2b");
  if (!sel || sel.dataset.inited === "1") return;
  sel.dataset.inited = "1";
  sel.innerHTML =
    '<option value="">Selecione o solicitante…</option>' +
    SOLICITANTES_B2B_COMERCIAL.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
}

function readSolicitanteFromForm() {
  const isB2b = normalizeTipo(document.getElementById("demTipo")?.value) === "B2B";
  if (isB2b) return document.getElementById("demSolicitanteB2b")?.value.trim() || "";
  return document.getElementById("demSolicitante")?.value.trim() || "";
}

function readSetorSolicitanteB2bFromForm() {
  const isB2b = normalizeTipo(document.getElementById("demTipo")?.value) === "B2B";
  if (!isB2b) return "";
  return document.getElementById("demSetorSolicitanteB2b")?.value || SETORES_SOLICITANTE_B2B[0];
}

function syncDemSolicitanteField() {
  const fieldSetor = document.getElementById("fieldDemSetorSolicitanteB2b");
  const selSetor = document.getElementById("demSetorSolicitanteB2b");
  const fieldSel = document.getElementById("fieldDemSolicitanteB2b");
  const selSol = document.getElementById("demSolicitanteB2b");
  const fieldText = document.getElementById("fieldDemSolicitanteText");
  const inpText = document.getElementById("demSolicitante");
  if (!fieldSetor || !fieldSel || !fieldText || !inpText) return;
  const isB2b = normalizeTipo(document.getElementById("demTipo")?.value) === "B2B";
  fieldSetor.hidden = !isB2b;
  fieldSetor.classList.toggle("is-hidden", !isB2b);
  fieldSel.hidden = !isB2b;
  fieldSel.classList.toggle("is-hidden", !isB2b);
  fieldText.hidden = isB2b;
  fieldText.classList.toggle("is-hidden", isB2b);
  if (selSetor) {
    selSetor.required = isB2b;
    selSetor.disabled = !isB2b;
    if (isB2b && !selSetor.value) selSetor.value = SETORES_SOLICITANTE_B2B[0];
  }
  if (selSol) {
    selSol.required = isB2b;
    selSol.disabled = !isB2b;
    if (!isB2b) selSol.value = "";
  }
  inpText.required = false;
  inpText.disabled = isB2b;
  if (isB2b) inpText.value = "";
}

function syncDemandaLinhaFromTipo() {
  const tipo = normalizeTipo(document.getElementById("demTipo")?.value);
  editingLinhaEsteira = inferLinhaEsteira({ tipo });
  fillDemResponsavelSelect(editingLinhaEsteira);
  const prevSt = demStatusSel?.value || "";
  fillStatusSelect(editingLinhaEsteira);
  if (demStatusSel) {
    demStatusSel.value = mapStatusParaLinha(prevSt, editingLinhaEsteira);
  }
  syncDemCamposPorTipo();
  syncDemConclusaoFields();
  syncMotivosAtrasoField();
  syncDiasAbertoResumo();
}

demStatusSel?.addEventListener("change", () => {
  syncDemConclusaoFields();
  syncMotivosAtrasoField();
  syncDiasAbertoResumo();
});
document.getElementById("demTipo")?.addEventListener("change", syncDemandaLinhaFromTipo);
document.getElementById("demDataChegada")?.addEventListener("change", syncDiasAbertoResumo);
document.getElementById("demDataFimPrevista")?.addEventListener("change", syncMotivosAtrasoField);
document.getElementById("demDataTermino")?.addEventListener("change", () => {
  syncMotivosAtrasoField();
  syncDiasAbertoResumo();
});

let editingImages = [];
let editingPdfLevantamento = null;
let lastPdfParseResult = null;
/** Custo ao abrir o modal — restaurado ao remover PDF após aplicar dados. */
let editingCustoBaseline = null;
let pdfCustoAppliedInSession = false;
let editingLancamentoCabos = [];
let editingComentarios = [];

function renderComentariosList() {
  const list = document.getElementById("demComentariosList");
  if (!list) return;
  if (!editingComentarios.length) {
    list.innerHTML = '<p class="comments-empty">Nenhum comentario ainda.</p>';
    return;
  }
  const groups = groupComentariosPorDia(editingComentarios);
  list.innerHTML = groups
    .map((g) => '<div class="comments-day-label">' + escapeHtml(g.label) + "</div>" + g.items.map((c) =>
        '<article class="comment-row">' +
        '<div class="comment-avatar ' + comentarioAvatarClass(c.autor) + '" aria-hidden="true">' + escapeHtml(comentarioIniciais(c.autor)) + "</div>" +
        '<div class="comment-body"><div class="comment-head"><strong>' + escapeHtml(c.autor) + '</strong><span class="comment-time">' +
        escapeHtml(formatComentarioRelativo(c.createdAt)) + '</span></div><p class="comment-text">' + escapeHtml(c.texto) +
        '</p></div><button type="button" class="comment-del" data-cid="' + escapeHtml(c.id) +
        '" title="Excluir" aria-label="Excluir">×</button></article>'
      ).join(""))
    .join("");
  list.querySelectorAll(".comment-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingComentarios = editingComentarios.filter((x) => x.id !== btn.dataset.cid);
      renderComentariosList();
    });
  });
}

function addComentarioFromForm() {
  const ta = document.getElementById("demComentarioNovo");
  if (!ta) return;
  const texto = ta.value.trim();
  if (!texto) {
    toast("Digite um comentário");
    ta.focus();
    return;
  }
  const c = normalizeComentario({ texto, autor: getLoggedInComentarioAutor(), createdAt: new Date().toISOString() });
  if (c) editingComentarios.unshift(c);
  ta.value = "";
  renderComentariosList();
}

function openDemandaModal(id) {
  if (editingDemandaOpenId && editingDemandaOpenId !== id) {
    releaseDemandaEditing(editingDemandaOpenId);
  }
  stopPresenceHeartbeat();

  const d = id ? state.demandas.find((x) => x.id === id) : null;
  const dm = d ? migrateDemanda(d) : null;
  editingDemandaOpenId = d?.id || null;
  editingDemandaBaselineUpdatedAt = d?.updatedAt || "";
  hideDemandaModalAlerts();
  editingLinhaEsteira = dm ? dm.linhaEsteira : activeEsteiraCanal;
  fillDemResponsavelSelect(editingLinhaEsteira);
  fillStatusSelect(editingLinhaEsteira);
  const cfg = getEsteiraConfig(editingLinhaEsteira);
  document.getElementById("modalDemandaTitle").textContent = d
    ? "Editar demanda"
    : editingLinhaEsteira === LINHA_ESTEIRA_B2B
      ? "Registrar demanda B2B"
      : "Registrar chegada da demanda";
  document.getElementById("demId").value = d?.id || "";
  const btnExcluirDem = document.getElementById("btnExcluirDemanda");
  if (btnExcluirDem) btnExcluirDem.textContent = d?.id ? "Excluir" : "Descartar";
  document.getElementById("demTitulo").value = d?.titulo || "";
  setDemCidadeUi(d?.cidade || "");
  document.getElementById("demDataChegada").value = d?.dataChegada || todayISODate();
  document.getElementById("demDataFimPrevista").value = d?.dataFimPrevista || "";
  document.getElementById("demDataFimAtualizada").value = d?.dataFimAtualizada || "";
  document.getElementById("demDataTermino").value = d ? d.dataTermino || demandaDataTermino(d) || "" : "";
  document.getElementById("demSolicitante").value = d?.solicitante || "";
  const selSetorSol = document.getElementById("demSetorSolicitanteB2b");
  if (selSetorSol) selSetorSol.value = dm?.setorSolicitanteB2b || SETORES_SOLICITANTE_B2B[0];
  const selSolB2b = document.getElementById("demSolicitanteB2b");
  if (selSolB2b) {
    const sol = dm?.solicitante || "";
    selSolB2b.value = SOLICITANTES_B2B_COMERCIAL.includes(sol) ? sol : "";
  }
  document.getElementById("demResponsavel").value = normalizeResponsavel(d?.responsavel);
  syncDemTipoSelect(d?.tipo || (editingLinhaEsteira === LINHA_ESTEIRA_B2B ? "B2B" : "B2C"));
  const selProduto = document.getElementById("demProdutoB2b");
  if (selProduto) selProduto.value = dm?.produtoB2b || "";
  const selSegmento = document.getElementById("demSegmentoB2c");
  if (selSegmento) selSegmento.value = dm?.segmentoB2c || "";
  syncDemCamposPorTipo();
  document.getElementById("demStatus").value = d?.status || cfg.inboxStatus;
  document.getElementById("demStatusAtual").value = d?.statusAtual || "";
  renderMotivosAtrasoLista(dm?.motivosAtrasoItens || normalizeMotivosAtrasoItens(d));
  document.getElementById("demDescricao").value = d?.descricao || "";
  const elChamado = document.getElementById("demChamadoOcomon");
  if (elChamado) elChamado.value = dm?.chamadoOcomon || "";
  const elOsAniel = document.getElementById("demOsAniel");
  if (elOsAniel) elOsAniel.value = dm?.osAniel || "";
  editingCustoBaseline = JSON.parse(JSON.stringify(normalizeCusto(d?.custo)));
  pdfCustoAppliedInSession = false;
  applyCustoToForm(editingCustoBaseline);
  editingImages = JSON.parse(JSON.stringify(d?.imagens || []));
  editingPdfLevantamento = d?.pdfLevantamento
    ? JSON.parse(JSON.stringify(normalizePdfLevantamento(d.pdfLevantamento)))
    : null;
  lastPdfParseResult = null;
  editingComentarios = JSON.parse(JSON.stringify(normalizeComentarios(d?.comentarios || [])));
  const comentarioNovo = document.getElementById("demComentarioNovo");
  if (comentarioNovo) comentarioNovo.value = "";
  renderComentariosList();
  renderPdfLevantamentoPreview();
  renderTimeline(d);
  const elValorReal = document.getElementById("demValorProjetoRealizado");
  if (elValorReal) {
    const v = dm?.valorProjetoRealizado;
    if (v === "" || v == null) elValorReal.value = "";
    else setCustoInputVal("demValorProjetoRealizado", v);
  }
  bindMotivosAtrasoUi();
  syncDemConclusaoFields();
  syncMotivosAtrasoField();
  syncDiasAbertoResumo();

  if (d?.id) {
    const other = normalizeEditingBy(d.editingBy);
    const me = getCurrentUserEmail();
    if (other && other.email !== me) {
      toast(`${other.autor} também está com este projeto aberto`);
    }
    const presence = buildEditingPresence();
    if (presence) {
      setDemandaEditingBy(d.id, presence);
      startPresenceHeartbeat(d.id);
    } else {
      toast("Faça login para marcar que você está editando (presença na esteira).");
    }
  }

  setDemandaModalScrollLock(true);
  modalDemanda.showModal();
  requestAnimationFrame(() => syncDemandaModalAlerts());
}

function readTimelineHistoricoFromDom() {
  const segments = [];
  document.querySelectorAll("#demTimelineTable tbody tr").forEach((tr) => {
    const status = tr.dataset.status;
    if (!status) return;
    segments.push({
      status,
      inicio: datetimeLocalToIso(tr.querySelector(".timeline-inicio")?.value) || "",
      fim: datetimeLocalToIso(tr.querySelector(".timeline-fim")?.value || "") || "",
      observacao: tr.querySelector(".timeline-obs")?.value.trim() || "",
    });
  });
  return normalizeHistoricoStatus(segments);
}

function syncDemStatusFromTimeline() {
  const rows = document.querySelectorAll("#demTimelineTable tbody tr");
  if (!rows.length) return;
  const last = rows[rows.length - 1];
  const st = last.dataset.status;
  const sel = document.getElementById("demStatus");
  if (st && sel) {
    sel.value = st;
    syncDemConclusaoFields();
    syncMotivosAtrasoField();
    syncDiasAbertoResumo();
  }
}

function refreshTimelineDeleteButtons() {
  const rows = document.querySelectorAll("#demTimelineTable tbody tr");
  const onlyOne = rows.length <= 1;
  rows.forEach((tr) => {
    const btn = tr.querySelector(".timeline-remove");
    if (btn) {
      btn.disabled = onlyOne;
      btn.title = onlyOne ? "Deve restar pelo menos uma fase" : "Excluir esta fase do histórico";
    }
  });
}

function refreshTimelineMoveButtons() {
  const rows = Array.from(document.querySelectorAll("#demTimelineTable tbody tr"));
  rows.forEach((tr, idx) => {
    const btnUp = tr.querySelector(".timeline-move-up");
    const btnDown = tr.querySelector(".timeline-move-down");
    if (btnUp) {
      btnUp.disabled = idx === 0;
      btnUp.title = idx === 0 ? "Primeira fase" : "Mover fase para cima";
    }
    if (btnDown) {
      btnDown.disabled = idx === rows.length - 1;
      btnDown.title = idx === rows.length - 1 ? "Última fase" : "Mover fase para baixo";
    }
  });
}

function swapTimelineRowUp(tr) {
  const tb = tr?.parentElement;
  if (!tb) return;
  const prev = tr.previousElementSibling;
  if (!prev) return;
  tb.insertBefore(tr, prev);
  syncDemStatusFromTimeline();
  refreshTimelineDeleteButtons();
  refreshTimelineMoveButtons();
}

function swapTimelineRowDown(tr) {
  const tb = tr?.parentElement;
  if (!tb) return;
  const next = tr.nextElementSibling;
  if (!next) return;
  tb.insertBefore(next, tr);
  syncDemStatusFromTimeline();
  refreshTimelineDeleteButtons();
  refreshTimelineMoveButtons();
}

function timelineSetorHtml(status, linha = editingLinhaEsteira) {
  const setor = setorForStatusDemanda(status, linha);
  if (setor) return setorBadgeHtml(setor);
  if (isTempoStatusExcludedDemanda(status, linha)) return '<span class="muted">—</span>';
  return '<span class="dash-setor dash-setor--outros">Outros</span>';
}

function confirmExcluirFaseTimeline(seg) {
  const lab = labelStatus(seg.status, editingLinhaEsteira);
  const setor = setorForStatusDemanda(seg.status, editingLinhaEsteira) || "—";
  const inicio = seg.inicio ? formatComentarioData(seg.inicio) : "—";
  const fim = seg.fim ? formatComentarioData(seg.fim) : "em andamento";
  return confirmDialog({
    title: "Excluir fase do histórico?",
    message: `A fase «${lab}» (${setor}) será removida do histórico desta demanda.`,
    details: [
      { label: "Início", value: inicio },
      { label: "Fim", value: fim },
    ],
    hint: "A alteração só será gravada ao salvar a demanda.",
    confirmText: "Excluir fase",
    variant: "danger",
  });
}

function refreshTimelineRowDur(tr) {
  const inEl = tr.querySelector(".timeline-inicio");
  const fimEl = tr.querySelector(".timeline-fim");
  const durEl = tr.querySelector(".timeline-dur");
  if (!inEl || !durEl) return;
  const inicio = datetimeLocalToIso(inEl.value) || inEl.value;
  const fim = datetimeLocalToIso(fimEl?.value || "") || "";
  durEl.textContent = formatDur(
    timelineSegmentMs({ inicio, fim: fim || "" }),
  );
}

function renderTimeline(d) {
  const tb = document.querySelector("#demTimelineTable tbody");
  if (!tb) return;
  tb.innerHTML = "";
  if (!d) return;
  const dm = migrateDemanda(d);
  const linha = dm.linhaEsteira;
  const hist = dm.historicoStatus || [];
  const statusAtual = dm.status;
  hist.forEach((seg, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.histIdx = String(idx);
    tr.dataset.status = seg.status;
    const isLast = idx === hist.length - 1;
    const faseAtual = isLast && seg.status === statusAtual;
    tr.innerHTML = `
      <td class="timeline-table__fase"><strong>${escapeHtml(labelStatus(seg.status, linha))}</strong></td>
      <td class="timeline-table__setor">${timelineSetorHtml(seg.status, linha)}</td>
      <td class="timeline-table__date"></td>
      <td class="timeline-table__date"></td>
      <td class="timeline-dur">${formatDur(timelineSegmentMs(seg))}</td>
      <td class="timeline-table__obs"></td>
      <td class="timeline-table__actions"></td>
    `;
    const inInput = document.createElement("input");
    inInput.type = "datetime-local";
    inInput.className = "timeline-inicio";
    inInput.value = isoToDatetimeLocal(seg.inicio);
    inInput.title = "Data e hora de início nesta fase";
    inInput.required = true;

    const fimInput = document.createElement("input");
    fimInput.type = "datetime-local";
    fimInput.className = "timeline-fim";
    fimInput.value = isoToDatetimeLocal(seg.fim);
    fimInput.title = faseAtual
      ? "Deixe em branco enquanto a fase estiver em andamento"
      : "Data e hora de fim nesta fase";
    if (!faseAtual && seg.fim) fimInput.required = true;

    const onDateChange = () => {
      refreshTimelineRowDur(tr);
    };
    inInput.addEventListener("input", onDateChange);
    inInput.addEventListener("change", onDateChange);
    fimInput.addEventListener("input", onDateChange);
    fimInput.addEventListener("change", onDateChange);

    const dateCells = tr.querySelectorAll(".timeline-table__date");
    dateCells[0]?.appendChild(inInput);
    dateCells[1]?.appendChild(fimInput);

    const ta = document.createElement("textarea");
    ta.className = "timeline-obs";
    ta.rows = 2;
    ta.maxLength = 2000;
    ta.placeholder = "Ex.: vistoria agendada, aguardando retorno do regional…";
    ta.value = seg.observacao || "";
    tr.querySelector(".timeline-table__obs").appendChild(ta);

    const actionsCell = tr.querySelector(".timeline-table__actions");

    const btnUp = document.createElement("button");
    btnUp.type = "button";
    btnUp.className = "timeline-move-up";
    btnUp.setAttribute("aria-label", "Mover fase para cima");
    btnUp.textContent = "↑";
    btnUp.addEventListener("click", () => {
      swapTimelineRowUp(tr);
      toast("Ordem ajustada — salve a demanda para confirmar");
    });
    actionsCell?.appendChild(btnUp);

    const btnDown = document.createElement("button");
    btnDown.type = "button";
    btnDown.className = "timeline-move-down";
    btnDown.setAttribute("aria-label", "Mover fase para baixo");
    btnDown.textContent = "↓";
    btnDown.addEventListener("click", () => {
      swapTimelineRowDown(tr);
      toast("Ordem ajustada — salve a demanda para confirmar");
    });
    actionsCell?.appendChild(btnDown);

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "timeline-remove";
    btnDel.setAttribute("aria-label", "Excluir fase");
    btnDel.textContent = "×";
    btnDel.addEventListener("click", async () => {
      const rowCount = tb.querySelectorAll("tr").length;
      if (rowCount <= 1) {
        toast("Mantenha pelo menos uma fase no histórico");
        return;
      }
      if (!(await confirmExcluirFaseTimeline(seg))) return;
      tr.remove();
      syncDemStatusFromTimeline();
      refreshTimelineDeleteButtons();
      refreshTimelineMoveButtons();
      toast("Fase removida — salve a demanda para confirmar");
    });
    actionsCell?.appendChild(btnDel);
    tb.appendChild(tr);
  });
  refreshTimelineDeleteButtons();
  refreshTimelineMoveButtons();
}

function normalizePdfLevantamento(v) {
  if (!v || typeof v !== "object") return null;
  const name = String(v.name || "").trim();
  if (!name) return null;
  const dataUrl = typeof v.dataUrl === "string" ? v.dataUrl : "";
  return {
    id: v.id || uid(),
    name,
    dataUrl: dataUrl.length > 0 && dataUrl.length < 900000 ? dataUrl : "",
    uploadedAt: v.uploadedAt || "",
  };
}

function formatBr() {
  return window.DemandasFormatBr || {};
}

function parseNumBrInput(raw) {
  const fn = formatBr().parseNumberBr;
  if (!fn) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : "";
  }
  return fn(raw);
}

function setCustoInputVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (val === "" || val == null) {
    el.value = "";
    return;
  }
  if (el.classList.contains("input-br-percent")) {
    el.value = formatBr().formatPercentBr ? formatBr().formatPercentBr(val) : val;
  } else if (el.classList.contains("input-br-money")) {
    el.value = formatBr().formatMoneyBr ? formatBr().formatMoneyBr(val) : val;
  } else if (el.classList.contains("input-br-int")) {
    el.value = formatBr().formatIntegerBr ? formatBr().formatIntegerBr(val) : val;
  } else {
    el.value = val;
  }
}

function formatInputBrOnBlur(el) {
  if (!el) return;
  const raw = el.value;
  if (raw.trim() === "") {
    el.value = "";
    return;
  }
  const n = parseNumBrInput(raw);
  if (n === "") {
    el.value = "";
    return;
  }
  if (el.classList.contains("input-br-percent")) {
    el.value = formatBr().formatPercentBr(n);
  } else if (el.classList.contains("input-br-money")) {
    el.value = formatBr().formatMoneyBr(n);
  } else if (el.classList.contains("input-br-int")) {
    el.value = formatBr().formatIntegerBr(n);
  }
}

function bindCustoNumberFormatting() {
  const onBlur = (e) => formatInputBrOnBlur(e.target);
  document.querySelectorAll(".input-br-money, .input-br-int").forEach((el) => {
    if (el.readOnly) return;
    el.addEventListener("blur", onBlur);
  });
  document.querySelectorAll(".lancamento-metragem").forEach((el) => {
    el.removeEventListener("blur", onBlur);
    el.addEventListener("blur", onBlur);
  });
}

function applyCustoToForm(custoRaw) {
  const c = normalizeCusto(custoRaw);
  document.getElementById("demTemLevantamento").value = c.temLevantamento ? "sim" : "nao";
  setCustoInputVal("custoValorProjeto", c.valorProjeto);
  document.getElementById("demTemPortas").value = c.temPortas ? "sim" : "nao";
  setCustoInputVal("custoQtdCasas", c.qtdCasas);
  setCustoInputVal("custoQtdPortasAtual", c.qtdPortasAtual);
  setCustoInputVal("custoQtdNovasPortas", c.qtdNovasPortas);
  setCustoInputVal("custoValorPorPortaNova", c.valorPorPortaNova);
  document.getElementById("demTemLancamento").value = c.temLancamento ? "sim" : "nao";
  editingLancamentoCabos = JSON.parse(JSON.stringify(c.lancamento?.cabos || []));
  const selExec = document.getElementById("custoExecucao");
  if (selExec) selExec.value = normalizeExecucaoCusto(c.execucao);
  const elCustoReg = document.getElementById("custoExecucaoRegional");
  const elCustoTer = document.getElementById("custoExecucaoTerceirizada");
  if (elCustoReg) setCustoInputVal("custoExecucaoRegional", c.custoRegional === "" ? "" : c.custoRegional);
  if (elCustoTer) setCustoInputVal("custoExecucaoTerceirizada", c.custoTerceirizada === "" ? "" : c.custoTerceirizada);
  toggleExecucaoCustoFields();
  toggleCustoFields();
  if (c.temLevantamento) {
    recalcCustoValores();
    recalcPenetracaoPortas();
    recalcValorPorPortaNova();
    renderLancamentoCabos();
  } else {
    editingLancamentoCabos = [];
    for (const id of [
      "custoValorProjeto",
      "custoValor5",
      "custoValorFinal",
      "custoQtdCasas",
      "custoQtdPortasAtual",
      "custoQtdNovasPortas",
      "custoPenetracaoAtual",
      "custoNovaPenetracao",
      "custoValorPorPortaNova",
      "custoTotalMetragem",
      "custoExecucaoRegional",
      "custoExecucaoTerceirizada",
    ]) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
    const list = document.getElementById("lancamentoCabosList");
    if (list) list.innerHTML = "";
    togglePortasFields();
    toggleLancamentoFields();
  }
}

/** Zera custo e volta padrão (sem levantamento, execução «Não se aplica»). */
function resetCustoFormAfterPdfRemove() {
  applyCustoToForm(emptyCusto());
  pdfCustoAppliedInSession = false;
}

function applyPdfCustoToForm(parsed) {
  if (!parsed) return;
  const v = parsed.values || {};
  const hasData = parsed.hasLevantamento || parsed.hasPortas || parsed.hasLancamento;
  if (!hasData) {
    toast("Nenhum dado reconhecido no PDF — veja o texto extraído abaixo");
    return;
  }

  if (parsed.hasLevantamento || Object.keys(v).some((k) => v[k] !== "")) {
    document.getElementById("demTemLevantamento").value = "sim";
    toggleCustoFields();
    setCustoInputVal("custoValorProjeto", v.valorProjeto);
    recalcCustoValores();
    if (v.execucao) {
      const selExec = document.getElementById("custoExecucao");
      if (selExec) selExec.value = normalizeExecucaoCusto(v.execucao);
    }
    setCustoInputVal("custoExecucaoRegional", v.custoRegional);
    setCustoInputVal("custoExecucaoTerceirizada", v.custoTerceirizada);
    toggleExecucaoCustoFields();
  }

  if (parsed.hasPortas) {
    document.getElementById("demTemPortas").value = "sim";
    togglePortasFields();
    setCustoInputVal("custoQtdCasas", v.qtdCasas);
    setCustoInputVal("custoQtdPortasAtual", v.qtdPortasAtual);
    setCustoInputVal("custoQtdNovasPortas", v.qtdNovasPortas);
    recalcPenetracaoPortas();
    recalcValorPorPortaNova();
  } else {
    clearPortasCustoForm();
  }

  if (parsed.hasLancamento) {
    document.getElementById("demTemLancamento").value = "sim";
    if (parsed.cabos?.length) {
      editingLancamentoCabos = parsed.cabos.map((c) => ({
        id: uid(),
        tipo: c.tipo,
        metragem: c.metragem,
      }));
    } else if (!editingLancamentoCabos.length) {
      editingLancamentoCabos = [{ id: uid(), tipo: TIPOS_CABO[0], metragem: "" }];
    }
    toggleLancamentoFields();
    renderLancamentoCabos();
    if (v.totalMetragem !== "") {
      setCustoInputVal("custoTotalMetragem", v.totalMetragem);
    } else {
      recalcTotalMetragem();
    }
  }

  pdfCustoAppliedInSession = true;
  toast("Dados do PDF aplicados — confira os campos e salve a demanda");
}

const PDF_CAMPO_LABEL = {
  valorProjeto: "Valor do projeto",
  valor5: "Valor 5%",
  valorFinal: "Valor final",
  qtdCasas: "Qtd. casas",
  qtdPortasAtual: "Portas existentes",
  qtdNovasPortas: "Novas portas",
  penetracaoAtual: "Penetração atual",
  novaPenetracao: "Nova penetração",
  execucao: "Execução",
  custoRegional: "MO Regional",
  custoTerceirizada: "MO Classe L + F",
  totalMetragem: "Metragem total",
};

function pdfPreviewValor(k, val) {
  if (k.startsWith("penetracao") || k === "novaPenetracao") {
    return formatBr().formatPercentBr ? formatBr().formatPercentBr(val) : String(val);
  }
  if (k.startsWith("valor") || k.startsWith("custo")) {
    return formatBr().formatMoneyBr ? formatBr().formatMoneyBr(val) : String(val);
  }
  if (k.startsWith("qtd") || k === "totalMetragem") {
    return formatBr().formatIntegerBr ? formatBr().formatIntegerBr(val) : String(val);
  }
  return String(val);
}

function renderPdfLevantamentoPreview() {
  const wrap = document.getElementById("demPdfPreview");
  if (!wrap) return;

  if (!editingPdfLevantamento) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  wrap.hidden = false;
  const parsed = lastPdfParseResult;
  const fields = parsed
    ? Object.entries(parsed.values || {})
        .filter(([, val]) => val !== "")
        .map(([k, val]) => {
          const label = PDF_CAMPO_LABEL[k] || k;
          return `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(pdfPreviewValor(k, val))}</li>`;
        })
        .join("")
    : "";
  const cabos = parsed?.cabos?.length
    ? `<li><strong>Cabos:</strong> ${parsed.cabos
        .map((c) => {
          const m = formatBr().formatIntegerBr ? formatBr().formatIntegerBr(c.metragem) : c.metragem;
          return escapeHtml(`${c.tipo} — ${m} m`);
        })
        .join(", ")}</li>`
    : "";
  const warns = (parsed?.warnings || [])
    .map((w) => `<p class="pdf-custo-preview__warn">${escapeHtml(w)}</p>`)
    .join("");
  const canApply = parsed && (parsed.hasLevantamento || parsed.hasPortas || parsed.hasLancamento);

  const pdfLink = editingPdfLevantamento.dataUrl
    ? `<a class="btn btn--ghost btn--sm" href="${editingPdfLevantamento.dataUrl}" download="${escapeHtml(editingPdfLevantamento.name)}" target="_blank" rel="noopener">Abrir PDF</a>`
    : `<span class="muted small">(arquivo salvo sem cópia local — envie de novo para reler)</span>`;

  wrap.innerHTML =
    `<div class="pdf-custo-preview__file">` +
    `<span class="pdf-custo-preview__name">${escapeHtml(editingPdfLevantamento.name)}</span>` +
    pdfLink +
    `<button type="button" class="btn btn--ghost btn--sm" id="btnPdfRemove">Remover PDF</button>` +
    `</div>` +
    warns +
    (fields || cabos
      ? `<p class="muted small">Campos detectados:</p><ul class="pdf-custo-preview__list">${fields}${cabos}</ul>`
      : `<p class="muted small">Nenhum campo detectado ainda.</p>`) +
    (canApply
      ? `<button type="button" class="btn btn--primary btn--sm" id="btnPdfApply">Aplicar ao formulário de custo</button>`
      : "");

  document.getElementById("btnPdfRemove")?.addEventListener("click", () => {
    editingPdfLevantamento = null;
    lastPdfParseResult = null;
    const inp = document.getElementById("demPdfInput");
    if (inp) inp.value = "";
    resetCustoFormAfterPdfRemove();
    renderPdfLevantamentoPreview();
    toast("PDF removido — campos de custo zerados (padrão: Não se aplica)");
  });
  document.getElementById("btnPdfApply")?.addEventListener("click", () => {
    applyPdfCustoToForm(lastPdfParseResult);
  });
}

async function handleDemPdfUpload(file) {
  const api = window.DemandasPdfCusto;
  if (!api) {
    toast("Módulo de PDF não carregou. Recarregue com Ctrl+F5.");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    toast("PDF muito grande (máx. 12 MB)");
    return;
  }
  const preview = document.getElementById("demPdfPreview");
  if (preview) {
    preview.hidden = false;
    preview.innerHTML = '<p class="muted small">Lendo PDF…</p>';
  }
  try {
    const extracted = await api.extractTextFromPdfFile(file);
    lastPdfParseResult = api.parseCustoText(extracted);
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    editingPdfLevantamento = {
      id: uid(),
      name: file.name,
      dataUrl: String(dataUrl).length < 900000 ? dataUrl : "",
      uploadedAt: new Date().toISOString(),
    };
    renderPdfLevantamentoPreview();
    const n = Object.keys(lastPdfParseResult.values || {}).filter((k) => lastPdfParseResult.values[k] !== "").length;
    const nc = lastPdfParseResult.cabos?.length || 0;
    const capex = lastPdfParseResult?.values?.valorProjeto;
    const parts = [];
    if (capex !== "" && capex != null) parts.push(`CAPEX: ${pdfPreviewValor("valorProjeto", capex)}`);
    const pv = lastPdfParseResult?.values || {};
    if (pv.qtdNovasPortas !== "") parts.push(`Portas est.: ${pv.qtdNovasPortas}`);
    if (pv.qtdCasas !== "" || pv.qtdPortasAtual !== "") {
      parts.push(`HP: ${pv.qtdCasas || "—"} / HC: ${pv.qtdPortasAtual || "—"}`);
    }
    if (pv.execucao) {
      const mo = [];
      if (pv.custoRegional !== "") mo.push(`reg.: ${pdfPreviewValor("custoRegional", pv.custoRegional)}`);
      if (pv.custoTerceirizada !== "") mo.push(`terc.: ${pdfPreviewValor("custoTerceirizada", pv.custoTerceirizada)}`);
      parts.push(`Exec.: ${pv.execucao}${mo.length ? ` (${mo.join("; ")})` : ""}`);
    }
    if (nc) parts.push(`${nc} cabo(s) em LANÇAMENTO DE CABOS`);
    toast(
      parts.length
        ? `${parts.join(" · ")} — clique em Aplicar`
        : "Poucos dados no PDF — confira CAPEX (pág. 1) e LANÇAMENTO DE CABOS (4.1.1)",
    );
  } catch (e) {
    console.error(e);
    lastPdfParseResult = null;
    editingPdfLevantamento = null;
    renderPdfLevantamentoPreview();
    toast(e.message || "Não foi possível ler o PDF");
  }
}

document.getElementById("demPdfInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    toast("Selecione um arquivo PDF");
    return;
  }
  await handleDemPdfUpload(file);
});

document.getElementById("demTemLevantamento")?.addEventListener("change", toggleCustoFields);
document.getElementById("custoExecucao")?.addEventListener("change", () => {
  const ex = readCustoExecucaoFromForm();
  if (ex === CUSTO_EXECUCAO_NAO_APLICA) {
    const elReg = document.getElementById("custoExecucaoRegional");
    const elTer = document.getElementById("custoExecucaoTerceirizada");
    if (elReg) elReg.value = "";
    if (elTer) elTer.value = "";
  } else if (ex === "Regional") {
    const el = document.getElementById("custoExecucaoTerceirizada");
    if (el) el.value = "";
  } else if (ex === "Terceirizada") {
    const el = document.getElementById("custoExecucaoRegional");
    if (el) el.value = "";
  }
  toggleExecucaoCustoFields();
});
document.getElementById("demTemPortas")?.addEventListener("change", togglePortasFields);
document.getElementById("demTemLancamento")?.addEventListener("change", toggleLancamentoFields);
document.getElementById("btnAddCabo")?.addEventListener("click", () => {
  syncLancamentoCabosFromDom();
  editingLancamentoCabos.push({ id: uid(), tipo: TIPOS_CABO[0], metragem: "" });
  renderLancamentoCabos();
});

function clearPortasCustoForm() {
  const sel = document.getElementById("demTemPortas");
  if (sel) sel.value = "nao";
  for (const id of [
    "custoQtdCasas",
    "custoQtdPortasAtual",
    "custoQtdNovasPortas",
    "custoPenetracaoAtual",
    "custoNovaPenetracao",
    "custoValorPorPortaNova",
  ]) {
    const el = document.getElementById(id);
    if (el) el.value = "";
  }
  togglePortasFields();
}

function togglePortasFields() {
  const tem = document.getElementById("demTemPortas").value === "sim";
  const det = document.getElementById("portasDetalhes");
  if (det) det.classList.toggle("is-hidden", !tem);
  if (tem) recalcPenetracaoPortas();
}

function toggleLancamentoFields() {
  const tem = document.getElementById("demTemLancamento").value === "sim";
  const det = document.getElementById("lancamentoDetalhes");
  if (det) det.classList.toggle("is-hidden", !tem);
  if (tem && !editingLancamentoCabos.length) {
    editingLancamentoCabos = [{ id: uid(), tipo: TIPOS_CABO[0], metragem: "" }];
    renderLancamentoCabos();
  }
}

function toggleExecucaoCustoFields() {
  const execucao = readCustoExecucaoFromForm();
  const naoAplica = execucao === CUSTO_EXECUCAO_NAO_APLICA;
  const showRegional = !naoAplica && (execucao === "Regional" || execucao === "Regional + Terceirizada");
  const showTerceirizada = !naoAplica && (execucao === "Terceirizada" || execucao === "Regional + Terceirizada");
  const wrapReg = document.getElementById("execucaoCustoRegionalWrap");
  const wrapTer = document.getElementById("execucaoCustoTerceirizadaWrap");
  const det = document.getElementById("execucaoCustosDetalhes");
  if (det) {
    det.classList.toggle("is-hidden", naoAplica);
    det.hidden = naoAplica;
    det.classList.toggle("execucao-custos--duplo", showRegional && showTerceirizada);
  }
  if (wrapReg) {
    wrapReg.classList.toggle("is-hidden", !showRegional);
    wrapReg.hidden = !showRegional;
  }
  if (wrapTer) {
    wrapTer.classList.toggle("is-hidden", !showTerceirizada);
    wrapTer.hidden = !showTerceirizada;
  }
}

function toggleCustoFields() {
  const tem = document.getElementById("demTemLevantamento").value === "sim";
  const det = document.getElementById("custoDetalhes");
  if (det) det.classList.toggle("is-hidden", !tem);
  toggleExecucaoCustoFields();
  togglePortasFields();
  toggleLancamentoFields();
}

function syncLancamentoCabosFromDom() {
  editingLancamentoCabos = readLancamentoCabosFromDom();
}

function readLancamentoCabosFromDom() {
  const rows = [];
  document.querySelectorAll("#lancamentoCabosList .lancamento-row").forEach((row) => {
    const tipo = row.querySelector(".lancamento-tipo")?.value;
    const raw = row.querySelector(".lancamento-metragem")?.value;
    const parsed = raw === "" ? "" : parseNumBrInput(raw);
    const metragem = parsed === "" ? "" : Number(parsed);
    rows.push({
      id: row.dataset.id || uid(),
      tipo: TIPOS_CABO.includes(tipo) ? tipo : TIPOS_CABO[0],
      metragem: Number.isFinite(metragem) ? metragem : "",
    });
  });
  return rows;
}

function recalcTotalMetragem() {
  const el = document.getElementById("custoTotalMetragem");
  if (!el) return;
  const total = sumMetragemCabos(readLancamentoCabosFromDom());
  el.value = total === "" ? "" : formatBr().formatIntegerBr?.(total) ?? total;
}

function renderLancamentoCabos() {
  const list = document.getElementById("lancamentoCabosList");
  if (!list) return;
  if (document.getElementById("demTemLancamento")?.value === "sim" && editingLancamentoCabos.length === 0) {
    editingLancamentoCabos = [{ id: uid(), tipo: TIPOS_CABO[0], metragem: "" }];
  }
  list.innerHTML = "";
  const opts = TIPOS_CABO.map((t) => `<option value="${t}">${t}</option>`).join("");

  editingLancamentoCabos.forEach((cabo, idx) => {
    const row = document.createElement("div");
    row.className = "lancamento-row";
    row.dataset.id = cabo.id;
    row.innerHTML = `
      <label class="field field--compact">
        <span>Tipo do cabo</span>
        <select class="lancamento-tipo">${opts}</select>
      </label>
      <label class="field field--compact">
        <span>Metragem (m)</span>
        <input type="text" inputmode="decimal" class="lancamento-metragem input-br-int" placeholder="0" autocomplete="off" />
      </label>
      <button type="button" class="icon-btn lancamento-remove" aria-label="Remover cabo">×</button>
    `;
    row.querySelector(".lancamento-tipo").value = TIPOS_CABO.includes(cabo.tipo) ? cabo.tipo : TIPOS_CABO[0];
    const elMet = row.querySelector(".lancamento-metragem");
    elMet.value =
      cabo.metragem === "" ? "" : formatBr().formatIntegerBr?.(cabo.metragem) ?? cabo.metragem;
    elMet.addEventListener("blur", () => formatInputBrOnBlur(elMet));

    row.querySelector(".lancamento-tipo").addEventListener("change", () => {
      syncLancamentoCabosFromDom();
    });
    row.querySelector(".lancamento-metragem").addEventListener("input", recalcTotalMetragem);
    row.querySelector(".lancamento-remove").addEventListener("click", () => {
      syncLancamentoCabosFromDom();
      editingLancamentoCabos = editingLancamentoCabos.filter((c) => c.id !== cabo.id);
      renderLancamentoCabos();
    });
    list.appendChild(row);
  });

  recalcTotalMetragem();
  bindCustoNumberFormatting();
}

document.getElementById("btnNovaDemanda")?.addEventListener("click", () => openDemandaModal(null));

document.getElementById("btnAddComentario")?.addEventListener("click", addComentarioFromForm);
document.getElementById("demComentarioNovo")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    addComentarioFromForm();
  }
});
document.getElementById("commentsPanelToggle")?.addEventListener("click", () => {
  const panel = document.querySelector(".comments-panel");
  const btn = document.getElementById("commentsPanelToggle");
  if (!panel || !btn) return;
  const collapsed = panel.classList.toggle("is-collapsed");
  btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
});
document.getElementById("modalDemandaClose")?.addEventListener("click", () => closeDemandaModal());
document.getElementById("btnFecharDemanda")?.addEventListener("click", () => closeDemandaModal());
document.getElementById("btnDemConflictReload")?.addEventListener("click", () => {
  const id = editingDemandaOpenId;
  if (!id) return;
  openDemandaModal(id);
});
window.addEventListener("beforeunload", () => {
  if (editingDemandaOpenId) releaseDemandaEditing(editingDemandaOpenId);
});

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function parseMoneyInput(id) {
  const el = document.getElementById(id);
  if (!el || el.value.trim() === "") return null;
  const n = parseNumBrInput(el.value);
  return n === "" ? null : n;
}

/** Recalcula 5% e valor final a partir do valor do projeto (não digitáveis). */
function recalcCustoValores() {
  const el5 = document.getElementById("custoValor5");
  const elFinal = document.getElementById("custoValorFinal");
  const projeto = parseMoneyInput("custoValorProjeto");

  if (projeto != null) {
    const cinco = roundMoney(projeto * 0.05);
    if (el5) el5.value = formatBr().formatMoneyBr?.(cinco) ?? cinco;
    if (elFinal) elFinal.value = formatBr().formatMoneyBr?.(roundMoney(projeto + cinco)) ?? "";
  } else {
    if (el5) el5.value = "";
    if (elFinal) elFinal.value = "";
  }
  recalcValorPorPortaNova();
}

function recalcValorPorPortaNova() {
  const el = document.getElementById("custoValorPorPortaNova");
  if (!el || document.getElementById("demTemPortas").value !== "sim") return;
  const valorFinal = parseMoneyInput("custoValorFinal");
  const novas = parseNumBrInput(document.getElementById("custoQtdNovasPortas")?.value ?? "");
  const qtd = novas !== "" ? Number(novas) : null;
  if (valorFinal != null && qtd != null && qtd > 0) {
    const vpp = calcValorPorPortaNova(valorFinal, qtd);
    el.value = vpp === "" ? "" : formatBr().formatMoneyBr?.(vpp) ?? vpp;
  } else {
    el.value = "";
  }
}

document.getElementById("custoValorProjeto")?.addEventListener("input", recalcCustoValores);
document.getElementById("custoValorProjeto")?.addEventListener("blur", (e) => {
  formatInputBrOnBlur(e.target);
  recalcCustoValores();
});
bindCustoNumberFormatting();
document.getElementById("custoQtdNovasPortas")?.addEventListener("input", () => {
  recalcPenetracaoPortas();
  recalcValorPorPortaNova();
});
["custoQtdCasas", "custoQtdPortasAtual"].forEach((id) => {
  const el = document.getElementById(id);
  el?.addEventListener("input", recalcPenetracaoPortas);
  el?.addEventListener("blur", (e) => {
    formatInputBrOnBlur(e.target);
    recalcPenetracaoPortas();
  });
});
document.getElementById("custoQtdNovasPortas")?.addEventListener("blur", (e) => {
  formatInputBrOnBlur(e.target);
  recalcPenetracaoPortas();
  recalcValorPorPortaNova();
});

function readCustoExecucaoFromForm() {
  return normalizeExecucaoCusto(document.getElementById("custoExecucao")?.value);
}

function readExecucaoCustosFromForm() {
  const num = (id) => {
    const v = document.getElementById(id)?.value;
    if (v === "" || v == null) return "";
    const n = parseNumBrInput(v);
    return n === "" ? "" : n;
  };
  return normalizeExecucaoCustos(
    {
      custoRegional: num("custoExecucaoRegional"),
      custoTerceirizada: num("custoExecucaoTerceirizada"),
    },
    readCustoExecucaoFromForm(),
  );
}

function readCustoFromForm() {
  const execucao = readCustoExecucaoFromForm();
  const execucaoCustos = readExecucaoCustosFromForm();
  const tem = document.getElementById("demTemLevantamento").value === "sim";
  if (!tem) return { ...emptyCusto(), execucao, ...execucaoCustos };
  const num = (id) => {
    const v = document.getElementById(id)?.value;
    if (v === "" || v == null) return "";
    const n = parseNumBrInput(v);
    return n === "" ? "" : n;
  };
  const valorProjeto = num("custoValorProjeto");
  const valor5 = valorProjeto !== "" ? roundMoney(valorProjeto * 0.05) : "";
  const valorFinal = valorProjeto !== "" ? roundMoney(valorProjeto * 1.05) : "";

  const temPortas = document.getElementById("demTemPortas").value === "sim";
  const qtdCasas = temPortas ? num("custoQtdCasas") : "";
  const qtdPortasAtual = temPortas ? num("custoQtdPortasAtual") : "";
  const qtdNovasPortas = temPortas ? num("custoQtdNovasPortas") : "";
  const penetracaoAtual = temPortas ? calcTaxaPenetracao(qtdPortasAtual, qtdCasas) : "";
  const portasTotais =
    temPortas && qtdPortasAtual !== ""
      ? Number(qtdPortasAtual) + (qtdNovasPortas !== "" ? Number(qtdNovasPortas) : 0)
      : "";
  const novaPenetracao = temPortas ? calcTaxaPenetracao(portasTotais, qtdCasas) : "";
  const valorPorPortaNova = temPortas ? calcValorPorPortaNova(valorFinal, qtdNovasPortas) : "";

  const temLancamento = document.getElementById("demTemLancamento").value === "sim";
  syncLancamentoCabosFromDom();
  const lancamento = temLancamento
    ? normalizeLancamento({ cabos: editingLancamentoCabos })
    : emptyLancamentoCusto();

  return {
    temLevantamento: true,
    temPortas,
    temLancamento,
    valorProjeto,
    valor5,
    valorFinal,
    ...(temPortas
      ? {
          qtdCasas,
          qtdPortasAtual,
          qtdNovasPortas,
          penetracaoAtual,
          novaPenetracao,
          valorPorPortaNova,
        }
      : emptyPortasCusto()),
    lancamento,
    execucao,
    ...execucaoCustos,
  };
}

document.getElementById("btnSalvarDemanda")?.addEventListener("click", async () => {
  const id = document.getElementById("demId").value || uid();
  let existing = state.demandas.find((x) => x.id === id);
  const prevStatus = existing?.status;
  const tipo = normalizeTipo(document.getElementById("demTipo").value);
  const linhaEsteira = inferLinhaEsteira({ tipo });
  const produtoB2b = tipo === "B2B" ? normalizeProdutoB2b(document.getElementById("demProdutoB2b")?.value) : "";
  const segmentoB2c = tipo === "B2C" ? normalizeSegmentoB2c(document.getElementById("demSegmentoB2c")?.value) : "";
  let newStatus = mapStatusParaLinha(document.getElementById("demStatus").value, linhaEsteira);
  const now = new Date().toISOString();
  const motivosItensSalvar = readMotivosAtrasoFromDom({ forSave: true });
  const payload = {
    id,
    titulo: document.getElementById("demTitulo").value.trim(),
    cidade: readCidadeFromForm(),
    dataChegada: document.getElementById("demDataChegada").value,
    dataFimPrevista: document.getElementById("demDataFimPrevista").value,
    dataFimAtualizada: document.getElementById("demDataFimAtualizada").value,
    dataTermino: document.getElementById("demDataTermino").value,
    statusAtual: document.getElementById("demStatusAtual").value.trim(),
    motivosAtrasoItens: motivosItensSalvar,
    motivosAtraso: formatMotivosAtrasoTexto(motivosItensSalvar),
    valorProjetoRealizado: readValorProjetoRealizadoFromForm(),
    solicitante: readSolicitanteFromForm(),
    setorSolicitanteB2b: readSetorSolicitanteB2bFromForm(),
    responsavel: normalizeResponsavel(document.getElementById("demResponsavel").value, linhaEsteira),
    tipo,
    produtoB2b,
    segmentoB2c,
    linhaEsteira,
    status: newStatus,
    descricao: document.getElementById("demDescricao").value,
    comentarios: normalizeComentarios(editingComentarios),
    custo: readCustoFromForm(),
    pdfLevantamento: editingPdfLevantamento,
    imagens: existing?.imagens?.length ? existing.imagens : editingImages,
    historicoStatus: existing?.historicoStatus || [],
    historicoEdicoes: Array.isArray(existing?.historicoEdicoes) ? [...existing.historicoEdicoes] : [],
    chamadoOcomon: (document.getElementById("demChamadoOcomon")?.value || "").trim(),
    osAniel: (document.getElementById("demOsAniel")?.value || "").trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (!payload.titulo) {
    toast("Informe o nome do projeto");
    return;
  }
  if (tipo === "B2B" && !produtoB2b) {
    syncDemCamposPorTipo();
    toast("Selecione o produto B2B");
    document.getElementById("demProdutoB2b")?.focus();
    return;
  }
  if (tipo === "B2B" && !payload.solicitante) {
    syncDemCamposPorTipo();
    toast("Selecione o solicitante (Comercial)");
    document.getElementById("demSolicitanteB2b")?.focus();
    return;
  }
  if (tipo === "B2C" && !segmentoB2c) {
    syncDemCamposPorTipo();
    toast("Selecione o segmento B2C (MDU, TCR ou TCT)");
    document.getElementById("demSegmentoB2c")?.focus();
    return;
  }
  if (!document.getElementById("demRegional")?.value) {
    toast("Selecione a regional");
    return;
  }
  if (!payload.cidade) {
    toast("Selecione a cidade");
    return;
  }
  if (!payload.dataChegada) {
    toast("Informe a data de chegada");
    return;
  }
  if (!payload.descricao.trim()) {
    toast("Informe a descrição do projeto");
    return;
  }
  payload.descricao = payload.descricao.trim();
  if (!payload.statusAtual) {
    toast("Informe o status atual do projeto");
    document.getElementById("demStatusAtual")?.focus();
    return;
  }
  let ordem = normalizeOrdemEsteira(existing?.ordemEsteira);
  if (ordem == null || prevStatus !== newStatus) {
    ordem = ordemAoEntrarColuna(newStatus, payload.responsavel);
  }
  payload.ordemEsteira = ordem;
  if (isAtrasoAtivo(payload) && !motivosAtrasoItensPreenchidos(payload.motivosAtrasoItens)) {
    syncMotivosAtrasoField();
    toast("Informe ao menos um motivo do atraso");
    document.getElementById("motivosAtrasoLista")?.querySelector(".motivo-atraso-texto")?.focus();
    return;
  }
  if (isStatusConcluidoNoFormulario(payload.status, linhaEsteira) && !payload.dataTermino) {
    payload.dataTermino = todayISODate();
  }
  let historico = readTimelineHistoricoFromDom();
  if (!historico.length) {
    historico = [{ status: newStatus, inicio: now, fim: "", observacao: "" }];
  }
  if (!existing) {
    payload.historicoStatus = historico;
    const errHist = validateHistoricoStatus(payload.historicoStatus, newStatus, linhaEsteira);
    if (errHist) {
      toast(errHist);
      return;
    }
    registrarCriacaoNoHistoricoEdicao(payload);
    state.demandas.push(payload);
  } else {
    if (
      editingDemandaBaselineUpdatedAt &&
      existing.updatedAt &&
      existing.updatedAt !== editingDemandaBaselineUpdatedAt
    ) {
      const ok = await confirmDialog({
        title: "Conflito de alteração",
        message:
          "Outra pessoa salvou esta demanda enquanto você editava. Se continuar, suas alterações podem substituir as dela.",
        confirmText: "Salvar mesmo assim",
        cancelText: "Cancelar",
        variant: "warn",
      });
      if (!ok) return;
    }
    if (prevStatus !== newStatus) {
      historico = statusHistoryPush({ historicoStatus: historico }, newStatus);
    }
    const errHist = validateHistoricoStatus(historico, newStatus, linhaEsteira);
    if (errHist) {
      toast(errHist);
      return;
    }
    payload.historicoStatus = historico;
    const prevSnapshot = migrateDemanda(existing);
    registrarEdicaoNoHistoricoEdicao(prevSnapshot, payload);
    Object.assign(existing, payload);
  }
  const saved = existing || payload;
  const savedId = saved.id;
  stopPresenceHeartbeat();
  delete saved.editingBy;
  delete saved.editingAt;
  if (savedId) releaseDemandaEditing(savedId);
  saveState({ demanda: migrateDemanda(saved) });
  closeDemandaModal();
  renderBoard();
  toast("Demanda salva");
});

document.getElementById("btnExcluirDemanda")?.addEventListener("click", async () => {
  const id = document.getElementById("demId").value?.trim();
  if (!id) {
    closeDemandaModal();
    toast("Rascunho descartado");
    return;
  }
  const titulo = document.getElementById("demTitulo")?.value?.trim() || "esta demanda";
  const ok = await confirmDialog({
    title: "Excluir demanda?",
    message: `A demanda «${titulo}» será removida permanentemente. Esta ação não pode ser desfeita.`,
    confirmText: "Excluir demanda",
    variant: "danger",
  });
  if (!ok) return;
  stopPresenceHeartbeat();
  releaseDemandaEditing(id);
  markDemandaPendingDelete(id);
  saveState({ deleteDemandaId: id });
  closeDemandaModal();
  renderBoard();
  toast("Demanda excluída");
});

/* ---------- Histórico de edição ---------- */
const modalHistoricoEdicao = document.getElementById("modalHistoricoEdicao");
const demandaFootMenu = document.getElementById("demandaFootMenu");
const demandaFootMenuList = document.getElementById("demandaFootMenuList");
const btnDemandaMaisOpcoes = document.getElementById("btnDemandaMaisOpcoes");

function setDemandaFootMenuOpen(open) {
  if (!demandaFootMenu || !demandaFootMenuList || !btnDemandaMaisOpcoes) return;
  demandaFootMenu.classList.toggle("is-open", open);
  demandaFootMenuList.hidden = !open;
  btnDemandaMaisOpcoes.setAttribute("aria-expanded", open ? "true" : "false");
}

btnDemandaMaisOpcoes?.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = demandaFootMenuList?.hidden !== false;
  setDemandaFootMenuOpen(open);
});

document.addEventListener("click", (e) => {
  if (!demandaFootMenu) return;
  if (demandaFootMenuList?.hidden) return;
  if (!demandaFootMenu.contains(e.target)) setDemandaFootMenuOpen(false);
});

document.getElementById("btnAbrirHistoricoEdicao")?.addEventListener("click", () => {
  setDemandaFootMenuOpen(false);
  abrirHistoricoEdicaoModal();
});

document.getElementById("modalHistoricoEdicaoClose")?.addEventListener("click", () => modalHistoricoEdicao?.close());
document.getElementById("btnFecharHistoricoEdicao")?.addEventListener("click", () => modalHistoricoEdicao?.close());

function abrirHistoricoEdicaoModal() {
  const id = document.getElementById("demId")?.value?.trim();
  const dem = id ? state.demandas.find((x) => x.id === id) : null;
  const tituloAtual = document.getElementById("demTitulo")?.value?.trim();
  const titEl = document.getElementById("modalHistoricoEdicaoTitulo");
  if (titEl) {
    titEl.textContent = tituloAtual
      ? `Histórico de edição — ${tituloAtual}`
      : "Histórico de edição";
  }
  const target = document.getElementById("histEdicaoList");
  if (!target) return;
  if (!dem) {
    target.innerHTML =
      '<p class="muted small">Esta demanda ainda não foi salva. O histórico começa a ser registrado a partir do primeiro salvamento.</p>';
    modalHistoricoEdicao?.showModal();
    return;
  }
  const lista = normalizeHistoricoEdicoes(dem.historicoEdicoes || []);
  if (!lista.length) {
    target.innerHTML =
      '<p class="muted small">Nenhuma alteração registrada. As próximas edições e a criação serão exibidas aqui.</p>';
  } else {
    target.innerHTML = renderHistoricoEdicaoEntries(lista);
  }
  modalHistoricoEdicao?.showModal();
}

function renderHistoricoEdicaoEntries(lista) {
  const ordenado = [...lista].sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
  return ordenado
    .map((e) => {
      const quando = formatComentarioData(e.at) || "—";
      const autor = escapeHtml(e.by?.autor || "Equipe");
      const email = e.by?.email ? `<span class="hist-edicao__email">${escapeHtml(e.by.email)}</span>` : "";
      const tipoCls = e.tipo === "criacao" ? "hist-edicao__pill hist-edicao__pill--criar" : "hist-edicao__pill";
      const tipoLab = e.tipo === "criacao" ? "Criação" : "Edição";
      let corpo = "";
      if (e.tipo === "criacao") {
        corpo = `<p class="hist-edicao__nota">${escapeHtml(e.nota || "Demanda criada.")}</p>`;
      } else if (e.alteracoes.length) {
        corpo =
          '<ul class="hist-edicao__alteracoes">' +
          e.alteracoes
            .map(
              (a) =>
                `<li><strong>${escapeHtml(a.label)}</strong>: <span class="hist-edicao__de">${escapeHtml(String(a.de ?? "—"))}</span> <span aria-hidden="true">→</span> <span class="hist-edicao__para">${escapeHtml(String(a.para ?? "—"))}</span></li>`,
            )
            .join("") +
          "</ul>";
      } else {
        corpo = '<p class="muted small">Sem campos rastreados alterados.</p>';
      }
      return `
        <article class="hist-edicao-item">
          <header class="hist-edicao__head">
            <span class="${tipoCls}">${tipoLab}</span>
            <span class="hist-edicao__quando" title="${escapeHtml(e.at)}">${escapeHtml(quando)}</span>
          </header>
          <p class="hist-edicao__autor"><strong>${autor}</strong> ${email}</p>
          ${corpo}
        </article>
      `;
    })
    .join("");
}

/* ---------- Diárias ---------- */
const modalDiaria = document.getElementById("modalDiaria");

document.getElementById("btnNovaDiaria")?.addEventListener("click", () => openDiariaModal(null));
document.getElementById("modalDiariaClose")?.addEventListener("click", () => modalDiaria?.close());
document.getElementById("btnFecharDiaria")?.addEventListener("click", () => modalDiaria?.close());

function openDiariaModal(id) {
  const d = id ? state.diarias.find((x) => x.id === id) : null;
  const n = d ? normalizeDiaria(d) : null;
  document.getElementById("diariaId").value = n?.id || "";
  document.getElementById("diariaTitulo").value = n?.titulo || "";
  document.getElementById("diariaDesc").value = n?.descricao || "";
  document.getElementById("diariaResp").value = n?.responsavel || "Vinicius";
  modalDiaria.showModal();
}

function renderDiarias() {
  const el = document.getElementById("listaDiarias");
  const filtro = document.getElementById("filterDiariaResp")?.value || "";
  let list = state.diarias.map(normalizeDiaria);
  if (filtro) list = list.filter((t) => t.responsavel === filtro);
  list.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  el.innerHTML = "";
  if (!list.length) {
    el.innerHTML = `<p class="diarias-empty muted">Nenhuma demanda cadastrada${filtro ? ` para ${filtro}` : ""}.</p>`;
    return;
  }
  for (const t of list) {
    const respClass = diariaRespClass(t.responsavel);
    const card = document.createElement("article");
    card.className = `diaria diaria--${respClass}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.innerHTML = `
      <header class="diaria__head">
        <h3 class="diaria__tit"></h3>
        <span class="diaria__resp"></span>
      </header>
      <p class="diaria__desc"></p>
    `;
    card.querySelector(".diaria__tit").textContent = t.titulo;
    card.querySelector(".diaria__resp").textContent = t.responsavel;
    card.querySelector(".diaria__desc").textContent = t.descricao || "—";
    const open = () => openDiariaModal(t.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    el.appendChild(card);
  }
}

const filterDiariaRespEl = document.getElementById("filterDiariaResp");
if (filterDiariaRespEl) filterDiariaRespEl.addEventListener("change", renderDiarias);

document.getElementById("btnSalvarDiaria")?.addEventListener("click", () => {
  const id = document.getElementById("diariaId").value || uid();
  const row = normalizeDiaria({
    id,
    titulo: document.getElementById("diariaTitulo").value,
    descricao: document.getElementById("diariaDesc").value,
    responsavel: document.getElementById("diariaResp").value,
    updatedAt: new Date().toISOString(),
  });
  if (!row.titulo) return toast("Informe o nome da demanda");
  if (!row.descricao) return toast("Informe a descrição");
  const ix = state.diarias.findIndex((x) => x.id === id);
  if (ix === -1) state.diarias.push(row);
  else state.diarias[ix] = row;
  saveState({ meta: true });
  modalDiaria.close();
  renderDiarias();
  toast("Demanda salva");
});

document.getElementById("btnExcluirDiaria")?.addEventListener("click", async () => {
  const id = document.getElementById("diariaId").value;
  if (!id) return;
  const titulo = document.getElementById("diariaTitulo")?.value?.trim() || "esta demanda";
  const ok = await confirmDialog({
    title: "Excluir demanda?",
    message: `A demanda «${titulo}» será removida permanentemente. Esta ação não pode ser desfeita.`,
    confirmText: "Excluir demanda",
    variant: "danger",
  });
  if (!ok) return;
  if (!Array.isArray(state.deletedDiariaIds)) state.deletedDiariaIds = [];
  if (!state.deletedDiariaIds.includes(id)) state.deletedDiariaIds.push(id);
  state.diarias = state.diarias.filter((x) => x.id !== id);
  saveState({ meta: true });
  modalDiaria.close();
  renderDiarias();
  toast("Demanda excluída");
});

/** Vínculo no card do projetista: "e:id" = esteira, "d:id" = diária; só id sem prefixo (legado) = esteira */
function normalizeProjetistaVinculoRef(ref) {
  if (!ref) return "";
  if (ref.startsWith("e:") || ref.startsWith("d:")) return ref;
  return `e:${ref}`;
}

function parseProjetistaVinculo(ref) {
  const n = normalizeProjetistaVinculoRef(ref);
  if (!n) return null;
  if (n.startsWith("d:")) return { tipo: "diaria", id: n.slice(2) };
  return { tipo: "esteira", id: n.slice(2) };
}

function labelProjetistaVinculo(ref) {
  const p = parseProjetistaVinculo(ref);
  if (!p) return "";
  if (p.tipo === "diaria") {
    const d = (state.diarias || []).map(normalizeDiaria).find((x) => x.id === p.id);
    return d ? `Demanda diária: «${d.titulo}»` : "Demanda diária não encontrada (pode ter sido excluída).";
  }
  const d = state.demandas.find((x) => x.id === p.id);
  return d ? `Esteira: «${d.titulo}»` : "Projeto não encontrado (pode ter sido excluído).";
}

/* ---------- Projetistas ---------- */
function renderProjetistas() {
  const grid = document.getElementById("projetistasGrid");
  grid.innerHTML = "";

  const fmtEsteiraOpt = (d) => {
    const resp = normalizeResponsavel(d.responsavel, inferLinhaEsteira(d));
    const r = resp ? resp : "Sem atrib.";
    return `<option value="e:${d.id}">${escapeHtml(d.titulo)} (${escapeHtml(r)})</option>`;
  };
  const esteiraAtiva = (d) => {
    const dm = migrateDemanda(d);
    if (dm.linhaEsteira === LINHA_ESTEIRA_B2B) return !STATUS_B2B_CONCLUIDOS.has(dm.status);
    return !["conclusao", "reprovado"].includes(dm.status);
  };
  const esteiraOptsOp = state.demandas
    .filter((d) => inferLinhaEsteira(d) === LINHA_ESTEIRA_OPERACIONAL && esteiraAtiva(d))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"))
    .map(fmtEsteiraOpt)
    .join("");
  const esteiraOptsB2b = state.demandas
    .filter((d) => inferLinhaEsteira(d) === LINHA_ESTEIRA_B2B && esteiraAtiva(d))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"))
    .map(fmtEsteiraOpt)
    .join("");

  const sections = [
    { titulo: "Esteira Projetos", nomes: PROJETISTAS, esteiraOpts: esteiraOptsOp, labelEsteira: "Esteira Projetos" },
    { titulo: "Esteira B2B", nomes: PROJETISTAS_B2B, esteiraOpts: esteiraOptsB2b, labelEsteira: "Esteira B2B" },
  ];

  for (const { titulo, nomes, esteiraOpts, labelEsteira } of sections) {
    const heading = document.createElement("h3");
    heading.className = "projetistas-section-title";
    heading.textContent = titulo;
    grid.appendChild(heading);

    for (const nome of nomes) {
    const p = state.projetistas[nome] || { texto: "", demandaId: "", desde: "" };
    const card = document.createElement("div");
    card.className = "projetista";

    const diariasOpts = (state.diarias || [])
      .map(normalizeDiaria)
      .filter((d) => d.responsavel === nome)
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"))
      .map((d) => `<option value="d:${d.id}">${escapeHtml(d.titulo)}</option>`)
      .join("");

    const demandasOpts =
      `<option value="">(sem vínculo)</option>` +
      `<optgroup label="${escapeHtml(labelEsteira)}">${esteiraOpts || '<option disabled value="">Nenhuma ativa</option>'}</optgroup>` +
      `<optgroup label="Demandas diárias">${diariasOpts || '<option disabled value="">Nenhuma para este responsável</option>'}</optgroup>`;

    card.innerHTML = `
      <h3>${nome}</h3>
      <label class="field"><span>O que está fazendo agora</span><textarea class="pj-text"></textarea></label>
      <label class="field"><span>Vincular a</span><select class="pj-dem">${demandasOpts}</select></label>
      <p class="muted small pj-vinculo-legenda" aria-live="polite"></p>
      <div class="projetista__row">
        <button type="button" class="btn btn--primary pj-save">Salvar</button>
        <span class="projetista__since"></span>
      </div>
    `;
    card.querySelector(".pj-text").value = p.texto || "";
    const selDem = card.querySelector(".pj-dem");
    const refNorm = normalizeProjetistaVinculoRef(p.demandaId);
    selDem.value = refNorm || "";
    if (refNorm && !Array.from(selDem.options).some((o) => o.value === refNorm && !o.disabled)) {
      const tipo = parseProjetistaVinculo(refNorm)?.tipo;
      const leg = tipo === "diaria" ? "Demanda diária" : "Esteira";
      const o = document.createElement("option");
      o.value = refNorm;
      o.textContent = `${leg}: (mantido · não listado atualmente)`;
      const primeiro = selDem.querySelector("option[value=\"\"]");
      if (primeiro) primeiro.insertAdjacentElement("afterend", o);
      else selDem.insertBefore(o, selDem.firstChild);
      selDem.value = refNorm;
    }

    const legenda = card.querySelector(".pj-vinculo-legenda");
    const atualizaLegenda = () => {
      legenda.textContent = selDem.value ? labelProjetistaVinculo(selDem.value) : "";
    };
    atualizaLegenda();
    selDem.addEventListener("change", atualizaLegenda);
    const since = card.querySelector(".projetista__since");
    since.textContent = p.desde ? `Desde: ${p.desde.slice(0, 16).replace("T", " ")}` : "";
    card.querySelector(".pj-save").addEventListener("click", () => {
      const texto = card.querySelector(".pj-text").value;
      const selVal = card.querySelector(".pj-dem").value;
      const demandaId = selVal === "" ? "" : normalizeProjetistaVinculoRef(selVal);
      const prev = state.projetistas[nome] || {};
      const prevNorm = normalizeProjetistaVinculoRef(prev.demandaId || "");
      const mudou = texto !== prev.texto || demandaId !== prevNorm;
      const agora = new Date().toISOString();
      state.projetistas[nome] = {
        texto,
        demandaId,
        desde: mudou ? agora : prev.desde || "",
        updatedAt: agora,
      };
      saveState({ meta: true });
      renderProjetistas();
      toast("Atividade atualizada");
    });
    grid.appendChild(card);
    }
  }
}

/* ---------- Dashboard ---------- */
const dashCharts = {};
const DASH_BLOCKS_STORAGE_KEY = "demandasDashBlocks_v1";
let dashBlocksInited = false;

function loadDashBlocksState() {
  try {
    const raw = localStorage.getItem(DASH_BLOCKS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDashBlocksState(state) {
  try {
    localStorage.setItem(DASH_BLOCKS_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function isDashBlockVisible(blockId) {
  const block = document.querySelector(`.dash-block[data-dash-block="${blockId}"]`);
  return block && !block.classList.contains("is-collapsed");
}

function setDashBlockVisible(blockId, visible, state) {
  const block = document.querySelector(`.dash-block[data-dash-block="${blockId}"]`);
  if (!block) return;
  block.classList.toggle("is-collapsed", !visible);
  const btn = block.querySelector(".dash-block__toggle");
  if (btn) btn.setAttribute("aria-expanded", visible ? "true" : "false");
  state[blockId] = visible;
}

function setDashSubBlockVisible(subId, visible, state) {
  const block = document.querySelector(`.dash-sub-block[data-dash-sub-block="${subId}"]`);
  if (!block) return;
  block.classList.toggle("is-collapsed", !visible);
  const btn = block.querySelector(".dash-sub-block__toggle");
  if (btn) btn.setAttribute("aria-expanded", visible ? "true" : "false");
  state[subId] = visible;
}

function resizeDashSubBlockCharts(block) {
  block?.querySelectorAll("canvas[id]").forEach((canvas) => {
    dashCharts[canvas.id]?.resize();
  });
}

function initDashSubBlocks(state) {
  document.querySelectorAll(".dash-sub-block[data-dash-sub-block]").forEach((block) => {
    const id = block.dataset.dashSubBlock;
    const visible = state[id] !== false;
    setDashSubBlockVisible(id, visible, state);
    const btn = block.querySelector(".dash-sub-block__toggle");
    btn?.addEventListener("click", () => {
      const nowVisible = block.classList.toggle("is-collapsed") === false;
      btn.setAttribute("aria-expanded", nowVisible ? "true" : "false");
      state[id] = nowVisible;
      saveDashBlocksState(state);
      if (nowVisible) {
        resizeDashSubBlockCharts(block);
        if (panels.dashboard && !panels.dashboard.hidden) renderDashboard();
      }
    });
  });
}

function initDashBlocks() {
  if (dashBlocksInited) return;
  dashBlocksInited = true;
  const state = loadDashBlocksState();
  document.querySelectorAll(".dash-block[data-dash-block]").forEach((block) => {
    const id = block.dataset.dashBlock;
    const visible = state[id] !== false;
    setDashBlockVisible(id, visible, state);
    const btn = block.querySelector(".dash-block__toggle");
    btn?.addEventListener("click", () => {
      const nowVisible = block.classList.toggle("is-collapsed") === false;
      btn.setAttribute("aria-expanded", nowVisible ? "true" : "false");
      state[id] = nowVisible;
      saveDashBlocksState(state);
      if (
        id === "graficos" ||
        id === "chegadas-fin" ||
        id === "entrega-atraso" ||
        id === "cidades" ||
        id === "tempo" ||
        id === "solicitantes" ||
        id === "projetado-executado" ||
        id === "indicadores-b2c" ||
        id === "indicadores-b2b"
      ) {
        if (nowVisible && panels.dashboard && !panels.dashboard.hidden) renderDashboard();
      }
    });
  });
  initDashSubBlocks(state);
  saveDashBlocksState(state);
}

function destroyDashboardCharts() {
  Object.keys(dashCharts).forEach((k) => {
    dashCharts[k]?.destroy();
    delete dashCharts[k];
  });
}

function numDash(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(n) {
  return numDash(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMetros(n) {
  return `${numDash(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m`;
}

/** Valor final (+5%) do levantamento — campo «Valor final (R$)». */
function demandaValorFinal(d) {
  const c = normalizeCusto(d.custo);
  const vf = parseCustoMoney(c.valorFinal);
  if (vf !== "") return vf;
  const vp = parseCustoMoney(c.valorProjeto);
  if (vp !== "") return Math.round(vp * 1.05 * 100) / 100;
  return 0;
}

function demandaTemValorFinalDash(d) {
  return demandaValorFinal(d) > 0;
}

function demandaValorBaseLevantamento(d) {
  const c = normalizeCusto(d.custo);
  if (!c.temLevantamento) return 0;
  return numDash(c.valorProjeto);
}

function demandaValorRealizado(d) {
  const dm = migrateDemanda(d);
  return numDash(dm.valorProjetoRealizado);
}

/** Fases pós-aprovação na esteira operacional (legado — gráficos). */
const STATUS_OPERACIONAL_APROVADO_EXEC = ["materiais", "execucao", "execucao_terceirizada", "configuracao_op", "transmissao_infra_op", "documentacao_op"];

/** Colunas da esteira operacional — base dos modos de valor no dashboard. */
const STATUS_OPERACIONAL_VALOR_CONCLUIDO = ["conclusao"];
const STATUS_OPERACIONAL_VALOR_EXECUCAO = ["execucao", "execucao_terceirizada"];
const STATUS_OPERACIONAL_VALOR_APROVACAO = ["aprovacao"];

/** Colunas da esteira B2B — mesma lógica de valor. */
const STATUS_B2B_VALOR_CONCLUIDO = [...STATUS_B2B_CONCLUIDOS];
const STATUS_B2B_VALOR_EXECUCAO = [...STATUS_B2B_EXECUCAO];
const STATUS_B2B_VALOR_APROVACAO = ["aprovacao_bp"];

const DASH_VALOR_MODOS = {
  concluido: {
    label: "Valor concluído",
    hint: "Coluna Conclusão — soma do campo Valor final (R$) do levantamento (projeto + 5%).",
  },
  execucao: {
    label: "Valor em execução",
    hint: "Execução Regional ou Terceirizada — soma do campo Valor final (R$) do levantamento.",
  },
  aprovacao: {
    label: "Valor em aprovação",
    hint: "Coluna Aprovação — soma do campo Valor final (R$) do levantamento.",
  },
  geral: {
    label: "Valor total geral",
    hint: "Concluídos + execução + aprovação — soma do campo Valor final (R$) de cada projeto.",
  },
};

function demandaGrupoValorDash(dm) {
  if (!dm) return null;
  const st = dm.status;
  if (st === "reprovado" || st === "pausado") return null;

  if (dm.linhaEsteira === LINHA_ESTEIRA_B2B) {
    if (STATUS_B2B_VALOR_CONCLUIDO.includes(st)) return "concluido";
    if (STATUS_B2B_VALOR_EXECUCAO.includes(st)) return "execucao";
    if (STATUS_B2B_VALOR_APROVACAO.includes(st)) return "aprovacao";
    return null;
  }

  if (STATUS_OPERACIONAL_VALOR_CONCLUIDO.includes(st)) return "concluido";
  if (STATUS_OPERACIONAL_VALOR_EXECUCAO.includes(st)) return "execucao";
  if (STATUS_OPERACIONAL_VALOR_APROVACAO.includes(st)) return "aprovacao";
  return null;
}

function getDashValorModo() {
  const v = document.getElementById("filterDashValorModo")?.value || "geral";
  return DASH_VALOR_MODOS[v] ? v : "geral";
}

function demandaIncluiModoDash(d, mode) {
  const grupo = demandaGrupoValorDash(migrateDemanda(d));
  if (!grupo) return false;
  if (mode === "geral") return true;
  return grupo === mode;
}

function demandaIncluiValorDash(d, mode) {
  return demandaIncluiModoDash(d, mode) && demandaTemValorFinalDash(d);
}

function demandaValorDashPorModo(d, mode) {
  if (!demandaIncluiValorDash(d, mode)) return 0;
  return demandaValorFinal(d);
}

function demandaPortasDashPorModo(d, mode = getDashValorModo()) {
  if (!demandaIncluiModoDash(d, mode)) return 0;
  return demandaPortasNovas(d);
}

function demandaMetragemDashPorModo(d, mode = getDashValorModo()) {
  if (!demandaIncluiModoDash(d, mode)) return 0;
  return demandaMetragemLancamento(d);
}

function labelValorDashModo(mode = getDashValorModo()) {
  return DASH_VALOR_MODOS[mode]?.label || "Valor";
}

function sumValorDashboard(list, mode = getDashValorModo()) {
  return list.reduce((s, d) => s + demandaValorDashPorModo(d, mode), 0);
}

function sumPortasDashboard(list, mode = getDashValorModo()) {
  return list.reduce((s, d) => s + demandaPortasDashPorModo(d, mode), 0);
}

function sumMetragemDashboard(list, mode = getDashValorModo()) {
  return list.reduce((s, d) => s + demandaMetragemDashPorModo(d, mode), 0);
}

/** Projetos incluídos na base de indicadores selecionada (concluído, execução, aprovação ou geral). */
function filterDemandasModoDash(list, mode = getDashValorModo()) {
  return list.filter((d) => demandaIncluiModoDash(d, mode));
}

function calcResumoIndicadoresDashboard(list = demandasDashOperacionalList()) {
  const resumo = {};
  for (const mode of Object.keys(DASH_VALOR_MODOS)) {
    let valor = 0;
    let portas = 0;
    let metragem = 0;
    let n = 0;
    list.forEach((d) => {
      const v = demandaValorDashPorModo(d, mode);
      const p = demandaPortasDashPorModo(d, mode);
      const m = demandaMetragemDashPorModo(d, mode);
      if (!v && !p && !m) return;
      n += 1;
      valor += v;
      portas += p;
      metragem += m;
    });
    resumo[mode] = { valor, portas, metragem, n };
  }
  return resumo;
}

function renderDashValoresFinanceirosKpis(list = demandasDashOperacionalList()) {
  const el = document.getElementById("dashValoresFinanceirosKpis");
  if (!el) return;
  const r = calcResumoIndicadoresDashboard(list);
  el.innerHTML =
    kpiCard("Valor concluído", formatBRL(r.concluido.valor), r.concluido.valor ? "ok" : "warn") +
    kpiCard(`${r.concluido.n} concluído(s)`, r.concluido.n ? String(r.concluido.n) : "—", "ok") +
    kpiCard("Valor em execução", formatBRL(r.execucao.valor), r.execucao.valor ? "ok" : "warn") +
    kpiCard(`${r.execucao.n} em execução`, r.execucao.n ? String(r.execucao.n) : "—", "ok") +
    kpiCard("Valor em aprovação", formatBRL(r.aprovacao.valor), r.aprovacao.valor ? "ok" : "warn") +
    kpiCard(`${r.aprovacao.n} em aprovação`, r.aprovacao.n ? String(r.aprovacao.n) : "—", "ok") +
    kpiCard("Valor total geral", formatBRL(r.geral.valor), r.geral.valor ? "ok" : "warn") +
    kpiCard(`${r.geral.n} projeto(s)`, r.geral.n ? String(r.geral.n) : "—", "ok") +
    kpiCard("Portas (geral)", formatQtd(r.geral.portas), r.geral.portas ? "ok" : "warn") +
    kpiCard("Metragem (geral)", formatMetros(r.geral.metragem), r.geral.metragem ? "ok" : "warn");
  const hintEl = document.getElementById("dashValoresFinanceirosHint");
  if (hintEl) {
    const modo = getDashValorModo();
    hintEl.textContent = DASH_VALOR_MODOS[modo].hint;
  }
}

function isDemandaConcluidaComparavel(d) {
  return isStatusConcluidoDemanda(migrateDemanda(d));
}

/** Compara valor final do levantamento (+5%) com o valor realizado na conclusão. */
function analiseProjetadoExecutado(d) {
  const c = normalizeCusto(d.custo);
  const projetado = numDash(c.valorFinal);
  const base = numDash(c.valorProjeto);
  const realizado = demandaValorRealizado(d);
  if (!c.temLevantamento || !projetado || !realizado) return null;

  const diff = Math.round((realizado - projetado) * 100) / 100;
  const desvioBasePct = base > 0 ? Math.round(((realizado - base) / base) * 10000) / 100 : null;
  const desvioProjetadoPct =
    projetado > 0 ? Math.round(((realizado - projetado) / projetado) * 10000) / 100 : null;
  const dentro = realizado <= projetado;

  return {
    base,
    projetado,
    realizado,
    diff,
    desvioBasePct,
    desvioProjetadoPct,
    dentro,
  };
}

function demandaMetragemLancamento(d) {
  const c = normalizeCusto(d.custo);
  if (!c.temLancamento) return 0;
  return numDash(c.lancamento?.totalMetragem);
}

function labelCidade(cidade) {
  const t = String(cidade || "").trim();
  return t || "Não informada";
}

function labelRegionalDemanda(d) {
  const reg = findRegionalForCidade(d?.cidade);
  return reg || "Não informada";
}

function regionalFromCidadeLabel(cidadeLabel) {
  if (cidadeLabel === "Não informada") return "Não informada";
  return findRegionalForCidade(cidadeLabel) || "Não informada";
}

function truncateChartLabel(text, max = 20) {
  const s = String(text || "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const DASH_REGIONAL_CHART_IDS = [
  "chartCidadesProjetos",
  "chartRegionalProjetos",
  "chartCidadesTipo",
  "chartRegionalTipo",
  "chartCidadesInvestimento",
  "chartRegionalInvestimento",
];

function destroyDashRegionalCharts() {
  DASH_REGIONAL_CHART_IDS.forEach((id) => {
    if (dashCharts[id]) {
      dashCharts[id].destroy();
      delete dashCharts[id];
    }
  });
}

function makeDashChartMoneyBar(canvasId, labels, data, color = "#22c55e", options = {}) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  if (!labels.length) return;
  const bg = Array.isArray(color) ? color : color;
  const datasetLabel = options.datasetLabel || "Investimento (R$)";
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: datasetLabel, data, backgroundColor: bg, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatBRL(ctx.raw) } },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 0, font: { size: 10 } },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#94a3b8",
            callback: (v) => formatBRL(v),
          },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
      },
    },
  });
}

function makeDashChartMetricBar(canvasId, labels, data, options = {}) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  if (!labels.length) return;
  const formatValue = options.formatValue || ((v) => String(v));
  const bg = options.colors || options.color || "#6366f1";
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: options.datasetLabel || "", data, backgroundColor: bg, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${options.datasetLabel || ""}: ${formatValue(ctx.raw)}`.trim() } },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", font: { size: 11 } },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#94a3b8",
            stepSize: options.stepSize,
            callback: options.yFormat || ((v) => formatValue(v)),
          },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
      },
    },
  });
}

function renderDashTipoPorGrupo(canvasId, demandas, groupRows, keyFn, topN = 12) {
  const topRows = groupRows.slice(0, topN);
  const groupKeys = topRows.map((r) => r.cidade);
  const tipos = tiposOperacionalDash();
  const matrix = Object.fromEntries(groupKeys.map((k) => [k, Object.fromEntries(tipos.map((t) => [t, 0]))]));
  demandas.forEach((d) => {
    const key = keyFn(d);
    if (!matrix[key]) return;
    const t = normalizeTipo(d.tipo);
    if (matrix[key][t] !== undefined) matrix[key][t] += 1;
  });
  const datasets = tipos
    .map((tipo) => ({
      label: tipo,
      data: groupKeys.map((k) => matrix[k][tipo] || 0),
      backgroundColor: TIPO_CHART_COLORS[tipo] || "#94a3b8",
      borderWidth: 0,
    }))
    .filter((ds) => ds.data.some((n) => n > 0));
  makeDashChartProjetistaStacked(
    canvasId,
    groupKeys.map((k) => truncateChartLabel(k, 22)),
    datasets,
  );
}

const B2C_SEGMENTO_SEM = "Sem segmento";

function segmentoB2cBucket(d) {
  return normalizeSegmentoB2c(d.segmentoB2c) || B2C_SEGMENTO_SEM;
}

function buildSegmentoB2cMatrix(demandas, rowKeys, keyFn) {
  const matrix = Object.fromEntries(
    rowKeys.map((k) => [
      k,
      Object.fromEntries([...SEGMENTOS_B2C, B2C_SEGMENTO_SEM].map((s) => [s, 0])),
    ]),
  );
  demandas.forEach((d) => {
    const key = keyFn(d);
    if (!matrix[key]) return;
    const seg = segmentoB2cBucket(d);
    if (matrix[key][seg] !== undefined) matrix[key][seg] += 1;
  });
  return matrix;
}

function buildSegmentoB2cValueMatrix(demandas, rowKeys, keyFn, valueFn) {
  const matrix = Object.fromEntries(
    rowKeys.map((k) => [
      k,
      Object.fromEntries([...SEGMENTOS_B2C, B2C_SEGMENTO_SEM].map((s) => [s, 0])),
    ]),
  );
  demandas.forEach((d) => {
    const key = keyFn(d);
    if (!matrix[key]) return;
    const seg = segmentoB2cBucket(d);
    if (matrix[key][seg] !== undefined) matrix[key][seg] += numDash(valueFn(d));
  });
  return matrix;
}

function activeSegmentoB2cCols(matrix, rowKeys) {
  const cols = [...SEGMENTOS_B2C];
  if (rowKeys.some((k) => (matrix[k]?.[B2C_SEGMENTO_SEM] || 0) > 0)) cols.push(B2C_SEGMENTO_SEM);
  return cols;
}

function activeSegmentoB2cValueCols(matrix, rowKeys) {
  const cols = activeSegmentoB2cCols(matrix, rowKeys);
  return cols.filter((seg) => rowKeys.some((k) => (matrix[k]?.[seg] || 0) > 0));
}

function renderDashSegmentoB2cValorPorGrupo(
  canvasId,
  tableId,
  tableRowHeader,
  demandas,
  groupRows,
  keyFn,
  valueFn,
  tableOpts,
  chartOpts,
  topN = 12,
) {
  const topRows = [...groupRows]
    .sort((a, b) => b.valor - a.valor || b.projetos - a.projetos)
    .slice(0, topN);
  const rowKeys = topRows.map((r) => r.cidade);
  const matrix = buildSegmentoB2cValueMatrix(demandas, rowKeys, keyFn, valueFn);
  const segmentos = activeSegmentoB2cValueCols(matrix, rowKeys);
  const datasets = segmentos
    .map((seg) => ({
      label: seg,
      data: rowKeys.map((k) => matrix[k][seg] || 0),
      backgroundColor: SEGMENTO_B2C_CHART_COLORS[seg] || "#64748b",
      borderWidth: 0,
    }))
    .filter((ds) => ds.data.some((n) => n > 0));
  makeDashChartProjetistaStacked(
    canvasId,
    rowKeys.map((k) => truncateChartLabel(k, 22)),
    datasets,
    chartOpts,
  );
  renderDashGrupoMatrixTable(
    tableId,
    tableRowHeader,
    rowKeys,
    segmentos,
    (k) => k,
    matrix,
    "Nenhum dado B2C neste agrupamento.",
    tableOpts,
  );
}

function renderDashSegmentoB2cInvestPorGrupo(
  canvasId,
  tableId,
  tableRowHeader,
  demandas,
  groupRows,
  keyFn,
  topN = 12,
) {
  renderDashSegmentoB2cValorPorGrupo(
    canvasId,
    tableId,
    tableRowHeader,
    demandas,
    groupRows,
    keyFn,
    (d) => demandaValorDashPorModo(d, getDashValorModo()),
    {
      formatCell: (n) => (n > 0 ? formatBRL(n) : "—"),
      formatTotal: (n) => (n > 0 ? formatBRL(n) : "—"),
    },
    {
      formatValue: (n) => formatBRL(n),
      yFormat: (v) => formatBRL(v),
    },
    topN,
  );
}

function renderDashSegmentoB2cPorGrupo(canvasId, tableId, tableRowHeader, demandas, groupRows, keyFn, topN = 12) {
  const topRows = groupRows.slice(0, topN);
  const rowKeys = topRows.map((r) => r.cidade);
  const matrix = buildSegmentoB2cMatrix(demandas, rowKeys, keyFn);
  const segmentos = activeSegmentoB2cCols(matrix, rowKeys);
  const datasets = segmentos
    .map((seg) => ({
      label: seg,
      data: rowKeys.map((k) => matrix[k][seg] || 0),
      backgroundColor: SEGMENTO_B2C_CHART_COLORS[seg] || "#64748b",
      borderWidth: 0,
    }))
    .filter((ds) => ds.data.some((n) => n > 0));
  makeDashChartProjetistaStacked(
    canvasId,
    rowKeys.map((k) => truncateChartLabel(k, 22)),
    datasets,
    { stepSize: 1 },
  );
  renderDashGrupoMatrixTable(
    tableId,
    tableRowHeader,
    rowKeys,
    segmentos,
    (k) => k,
    matrix,
    "Nenhum projeto B2C neste agrupamento.",
  );
}

function destroyDashB2cExtraCharts() {
  [
    "chartB2cSegmentoCidade",
    "chartB2cSegmentoRegional",
    "chartB2cInvestSegmento",
    "chartB2cPortasSegmento",
    "chartB2cLancamentoSegmento",
    "chartB2cInvestCidade",
    "chartB2cInvestRegional",
  ].forEach((id) => {
    if (dashCharts[id]) {
      dashCharts[id].destroy();
      delete dashCharts[id];
    }
  });
  [
    "dashB2cSegmentoCidadeTable",
    "dashB2cSegmentoRegionalTable",
    "dashB2cMetricSegmentoTable",
    "dashB2cInvestCidadeTable",
    "dashB2cInvestRegionalTable",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

function buildB2cMetricasPorSegmento(list) {
  const segmentos = [...SEGMENTOS_B2C, B2C_SEGMENTO_SEM];
  const rows = Object.fromEntries(
    segmentos.map((s) => [s, { segmento: s, projetos: 0, investimento: 0, portas: 0, metragem: 0 }]),
  );
  list.forEach((d) => {
    const seg = segmentoB2cBucket(d);
    const row = rows[seg];
    if (!row) return;
    row.projetos += 1;
    row.investimento += demandaValorDashPorModo(d, getDashValorModo());
    row.portas += demandaPortasDashPorModo(d);
    row.metragem += demandaMetragemDashPorModo(d);
  });
  return segmentos
    .map((s) => rows[s])
    .filter((r) => r.projetos > 0 || r.investimento > 0 || r.portas > 0 || r.metragem > 0);
}

function segmentoB2cChartColors(labels) {
  return labels.map((l) => SEGMENTO_B2C_CHART_COLORS[l] || "#94a3b8");
}

function renderDashB2cMetricasSegmento(list) {
  const rows = buildB2cMetricasPorSegmento(list);
  const labels = rows.map((r) => r.segmento);
  const colors = segmentoB2cChartColors(labels);

  if (labels.length) {
    makeDashChartMoneyBar(
      "chartB2cInvestSegmento",
      labels,
      rows.map((r) => r.investimento),
      colors,
    );
    makeDashChartMetricBar(
      "chartB2cPortasSegmento",
      labels,
      rows.map((r) => r.portas),
      {
        colors,
        datasetLabel: "Portas novas",
        formatValue: (v) => formatQtd(v),
        stepSize: 1,
      },
    );
    makeDashChartMetricBar(
      "chartB2cLancamentoSegmento",
      labels,
      rows.map((r) => r.metragem),
      {
        colors,
        datasetLabel: "Metragem",
        formatValue: (v) => formatMetros(v),
      },
    );
  } else {
    ["chartB2cInvestSegmento", "chartB2cPortasSegmento", "chartB2cLancamentoSegmento"].forEach((id) => {
      if (dashCharts[id]) {
        dashCharts[id].destroy();
        delete dashCharts[id];
      }
    });
  }

  const tableEl = document.getElementById("dashB2cMetricSegmentoTable");
  if (!tableEl) return;
  if (!rows.length) {
    tableEl.innerHTML = '<p class="muted small">Nenhuma métrica por segmento.</p>';
    return;
  }
  const totais = rows.reduce(
    (acc, r) => {
      acc.projetos += r.projetos;
      acc.investimento += r.investimento;
      acc.portas += r.portas;
      acc.metragem += r.metragem;
      return acc;
    },
    { projetos: 0, investimento: 0, portas: 0, metragem: 0 },
  );
  let body = "";
  for (const r of rows) {
    body +=
      "<tr><td><strong>" +
      escapeHtml(r.segmento) +
      "</strong></td><td class=\"dash-pj-matrix__num\">" +
      r.projetos +
      "</td><td class=\"dash-pj-matrix__num\">" +
      (r.investimento > 0 ? formatBRL(r.investimento) : "—") +
      "</td><td class=\"dash-pj-matrix__num\">" +
      (r.portas > 0 ? formatQtd(r.portas) : "—") +
      "</td><td class=\"dash-pj-matrix__num\">" +
      (r.metragem > 0 ? formatMetros(r.metragem) : "—") +
      "</td></tr>";
  }
  tableEl.innerHTML =
    '<table class="dash-table dash-table--pj-matrix"><thead><tr><th>Segmento</th><th>Projetos</th><th>Investimento</th><th>Portas novas</th><th>Metragem lanç. (m)</th></tr></thead><tbody>' +
    body +
    '</tbody><tfoot><tr><td><strong>Total</strong></td><td class="dash-pj-matrix__num"><strong>' +
    totais.projetos +
    "</strong></td><td class=\"dash-pj-matrix__num\"><strong>" +
    (totais.investimento > 0 ? formatBRL(totais.investimento) : "—") +
    "</strong></td><td class=\"dash-pj-matrix__num\"><strong>" +
    (totais.portas > 0 ? formatQtd(totais.portas) : "—") +
    "</strong></td><td class=\"dash-pj-matrix__num\"><strong>" +
    (totais.metragem > 0 ? formatMetros(totais.metragem) : "—") +
    "</strong></td></tr></tfoot></table>";
}

function demandaPortasNovas(d) {
  const c = normalizeCusto(d.custo);
  if (!c.temPortas) return 0;
  return numDash(c.qtdNovasPortas);
}

function formatQtd(n) {
  const v = numDash(n);
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function labelSolicitante(raw) {
  const s = String(raw || "").trim();
  return s || "(Sem solicitante)";
}

function isDemandaAberta(d) {
  const dm = migrateDemanda(d);
  if (dm.linhaEsteira === LINHA_ESTEIRA_B2B) return !STATUS_B2B_CONCLUIDOS.has(dm.status);
  return !["conclusao", "reprovado"].includes(dm.status);
}

const TIPOS_SOLICITANTE_ABERTAS = [...TIPOS_DEMANDA, TIPO_DIARIA_LEGADO];

function emptyStatsSolicitante(nome) {
  return {
    nome,
    abertas: 0,
    abertasPorTipo: Object.fromEntries(TIPOS_SOLICITANTE_ABERTAS.map((t) => [t, 0])),
    fechadas: 0,
    fechadasAtraso: 0,
    reprovadas: 0,
    total: 0,
  };
}

function tiposComAbertas(abertasPorTipo) {
  const seen = new Set();
  const out = [];
  for (const t of TIPOS_SOLICITANTE_ABERTAS) {
    if ((abertasPorTipo[t] || 0) > 0) {
      out.push(t);
      seen.add(t);
    }
  }
  for (const t of Object.keys(abertasPorTipo).sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    if (!seen.has(t) && abertasPorTipo[t] > 0) out.push(t);
  }
  return out;
}

function mergeAbertasPorTipo(rows) {
  const merged = {};
  for (const r of rows) {
    for (const [t, n] of Object.entries(r.abertasPorTipo)) {
      if (n > 0) merged[t] = (merged[t] || 0) + n;
    }
  }
  return merged;
}

function buildStatsPorSolicitante(demandas) {
  const map = new Map();
  for (const d of demandas) {
    const dm = migrateDemanda(d);
    const key = labelSolicitante(dm.solicitante);
    if (!map.has(key)) map.set(key, emptyStatsSolicitante(key));
    const row = map.get(key);
    row.total += 1;
    if (isDemandaAberta(dm)) {
      row.abertas += 1;
      const tipo = normalizeTipo(dm.tipo);
      if (row.abertasPorTipo[tipo] !== undefined) row.abertasPorTipo[tipo] += 1;
      else row.abertasPorTipo[tipo] = (row.abertasPorTipo[tipo] || 0) + 1;
    } else if (isStatusConcluidoDemanda(dm)) {
      row.fechadas += 1;
      if (demandaEntregaAtraso(dm)) row.fechadasAtraso += 1;
    } else if (dm.status === "reprovado") {
      row.reprovadas += 1;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.abertas - a.abertas || b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

function formatTiposAbertasHtml(abertasPorTipo) {
  const parts = tiposComAbertas(abertasPorTipo).map((t) => {
    const n = abertasPorTipo[t];
    return `<span class="badge ${tipoBadgeClass(t)} dash-sol-tipo">${escapeHtml(t)} (${n})</span>`;
  });
  return parts.length ? `<div class="dash-sol-tipos">${parts.join("")}</div>` : '<span class="muted">—</span>';
}

function makeDashChartSolicitantes(canvasId, labels, abertas, fechadas, fechadasAtraso) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Abertas", data: abertas, backgroundColor: "#3b82f6", borderWidth: 0 },
        { label: "Fechadas", data: fechadas, backgroundColor: "#22c55e", borderWidth: 0 },
        { label: "Fechadas c/ atraso", data: fechadasAtraso, backgroundColor: "#ef4444", borderWidth: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: "#cbd5e1", boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 0, font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.12)" } },
        y: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(148,163,184,0.12)" } },
      },
    },
  });
}

function renderDashSolicitantes() {
  const kpiEl = document.getElementById("dashSolicitantesKpis");
  const tableWrap = document.getElementById("dashSolicitantesTable");
  const countEl = document.getElementById("dashSolicitantesCount");
  if (!tableWrap) return;

  const todas = demandasDashOperacionalList();
  const rows = buildStatsPorSolicitante(todas);

  if (!todas.length) {
    if (kpiEl) kpiEl.innerHTML = "";
    if (countEl) countEl.textContent = "";
    tableWrap.innerHTML = '<p class="muted">Nenhum projeto cadastrado.</p>';
    return;
  }

  const totais = rows.reduce(
    (acc, r) => {
      acc.abertas += r.abertas;
      acc.fechadas += r.fechadas;
      acc.fechadasAtraso += r.fechadasAtraso;
      acc.reprovadas += r.reprovadas;
      return acc;
    },
    { abertas: 0, fechadas: 0, fechadasAtraso: 0, reprovadas: 0 },
  );

  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("Solicitantes", rows.length, "ok") +
      kpiCard("Abertas (total)", totais.abertas, totais.abertas ? "ok" : "warn") +
      kpiCard("Fechadas", totais.fechadas, "ok") +
      kpiCard("Fechadas c/ atraso", totais.fechadasAtraso, totais.fechadasAtraso ? "bad" : "ok");
  }

  if (countEl) {
    countEl.textContent = `${rows.length} solicitante(s) · ${todas.length} projeto(s) cadastrado(s).`;
  }

  const top = rows.slice(0, 12);
  const chartLabels = top.map((r) => {
    const n = r.nome;
    return n.length > 22 ? n.slice(0, 22) + "…" : n;
  });
  makeDashChartSolicitantes(
    "chartSolicitantes",
    chartLabels,
    top.map((r) => r.abertas),
    top.map((r) => r.fechadas),
    top.map((r) => r.fechadasAtraso),
  );

  let body = "";
  for (const r of rows) {
    body +=
      "<tr><td><strong>" +
      escapeHtml(r.nome) +
      '</strong></td><td class="dash-sol-num">' +
      r.abertas +
      "</td><td>" +
      formatTiposAbertasHtml(r.abertasPorTipo) +
      '</td><td class="dash-sol-num">' +
      r.fechadas +
      '</td><td class="dash-sol-num' +
      (r.fechadasAtraso ? " dash-sol-num--bad" : "") +
      '">' +
      r.fechadasAtraso +
      "</td><td class=\"dash-sol-num muted\">" +
      (r.reprovadas || "—") +
      "</td><td class=\"dash-sol-num\">" +
      r.total +
      "</td></tr>";
  }
  body +=
    '<tr class="dash-cf-total-row"><td><strong>Total</strong></td><td>' +
    totais.abertas +
    "</td><td>" +
    formatTiposAbertasHtml(mergeAbertasPorTipo(rows)) +
    "</td><td>" +
    totais.fechadas +
    "</td><td>" +
    totais.fechadasAtraso +
    "</td><td>" +
    (totais.reprovadas || "—") +
    "</td><td>" +
    todas.length +
    "</td></tr>";

  tableWrap.innerHTML =
    '<table class="dash-table dash-table--solicitantes"><thead><tr><th>Solicitante</th><th>Abertas</th><th>Tipos (abertas)</th><th>Fechadas</th><th>Fechadas c/ atraso</th><th>Reprovadas</th><th>Total</th></tr></thead><tbody>' +
    body +
    "</tbody></table>";
}

function makeDashChartProjetadoExecutado(dentro, acima) {
  makeDashChart(
    "chartProjetadoExecutado",
    "doughnut",
    ["Dentro do orçamento", "Acima do projetado"],
    [dentro, acima],
    { colors: ["#22c55e", "#ef4444"] },
  );
}

function filterDashProjetadoExecutadoRows(rows) {
  const resp = document.getElementById("filterDashPeResp")?.value || "";
  const sit = document.getElementById("filterDashPeSituacao")?.value || "";
  return rows.filter((r) => {
    if (resp && !matchFilterProjetista(r.d, resp)) return false;
    if (sit === "dentro" && !r.dentro) return false;
    if (sit === "acima" && r.dentro) return false;
    return true;
  });
}

function renderProjetadoExecutadoResumo(rows, kpiEl) {
  const dentro = rows.filter((r) => r.dentro).length;
  const acima = rows.length - dentro;
  const pctAderencia = rows.length ? Math.round((dentro / rows.length) * 100) : 0;
  const estouroTotal = rows.filter((r) => !r.dentro).reduce((s, r) => s + Math.max(0, r.diff), 0);
  const economiaTotal = rows.filter((r) => r.dentro).reduce((s, r) => s + Math.max(0, -r.diff), 0);

  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("Comparáveis", rows.length, rows.length ? "ok" : "warn") +
      kpiCard("Dentro do orçamento", dentro, dentro === rows.length && rows.length ? "ok" : "warn") +
      kpiCard("Acima do projetado", acima, acima ? "bad" : "ok") +
      kpiCard("Aderência", rows.length ? `${pctAderencia}%` : "—", pctAderencia >= 80 ? "ok" : pctAderencia >= 50 ? "warn" : "bad") +
      kpiCard("Economia (dentro)", formatBRL(economiaTotal), economiaTotal ? "ok" : "warn") +
      kpiCard("Estouro (acima)", formatBRL(estouroTotal), estouroTotal ? "bad" : "ok");
  }

  if (rows.length) {
    makeDashChartProjetadoExecutado(dentro, acima);
  } else if (dashCharts.chartProjetadoExecutado) {
    dashCharts.chartProjetadoExecutado.destroy();
    delete dashCharts.chartProjetadoExecutado;
  }
}

function projetadoExecutadoBadgeHtml(dentro, desvioProjetadoPct) {
  if (dentro) {
    const economia =
      desvioProjetadoPct != null && desvioProjetadoPct < 0
        ? ` (${Math.abs(desvioProjetadoPct)}% abaixo)`
        : "";
    return `<span class="dash-pe-badge dash-pe-badge--ok">Dentro do orçamento${economia}</span>`;
  }
  const estouro = desvioProjetadoPct != null && desvioProjetadoPct > 0 ? ` (+${desvioProjetadoPct}%)` : "";
  return `<span class="dash-pe-badge dash-pe-badge--bad">Acima do projetado${estouro}</span>`;
}

function renderDashProjetadoExecutado() {
  const kpiEl = document.getElementById("dashProjetadoExecutadoKpis");
  const tableWrap = document.getElementById("dashProjetadoExecutadoTable");
  const countEl = document.getElementById("dashProjetadoExecutadoCount");
  if (!tableWrap) return;

  const todas = demandasDashOperacionalList();
  const concluidas = todas.filter((d) => isDemandaConcluidaComparavel(d));
  const comLevantamento = concluidas.filter((d) => normalizeCusto(d.custo).temLevantamento);
  const rowsAll = comLevantamento
    .map((d) => {
      const a = analiseProjetadoExecutado(d);
      return a ? { d, ...a } : null;
    })
    .filter(Boolean);
  const semRealizado = comLevantamento.length - rowsAll.length;
  const respFiltro = document.getElementById("filterDashPeResp")?.value ?? "";
  const sitFiltro = document.getElementById("filterDashPeSituacao")?.value || "";
  const aguardandoProjetista = respFiltro === "";
  const filtroAtivo = (!!respFiltro && respFiltro !== FILTER_PROJETISTA_TODOS) || !!sitFiltro;

  if (!todas.length) {
    if (kpiEl) kpiEl.innerHTML = "";
    if (countEl) countEl.textContent = "";
    tableWrap.innerHTML = "<p class=\"muted\">Nenhum projeto cadastrado.</p>";
    return;
  }

  renderProjetadoExecutadoResumo(rowsAll, kpiEl);

  if (aguardandoProjetista) {
    if (countEl) {
      let msg = "";
      if (!rowsAll.length && comLevantamento.length) {
        msg = `${comLevantamento.length} concluído(s) com levantamento — informe o valor realizado na conclusão para comparar.`;
      } else if (rowsAll.length) {
        msg = `Gráficos com todos os ${rowsAll.length} projeto(s) comparáveis (visão geral).`;
        if (semRealizado) msg += ` ${semRealizado} concluído(s) sem valor realizado informado.`;
        msg += " Selecione um projetista para exibir a lista abaixo.";
      } else {
        msg = "Nenhum projeto concluído com levantamento para comparar.";
      }
      countEl.textContent = msg;
    }
    tableWrap.innerHTML =
      '<p class="muted dash-pe-hint">Selecione um projetista ou «Todos os projetistas» no filtro acima para exibir a lista.</p>';
    return;
  }

  const rows = filterDashProjetadoExecutadoRows(rowsAll);

  if (countEl) {
    let msg = "";
    if (!rowsAll.length && comLevantamento.length) {
      msg = `${comLevantamento.length} concluído(s) com levantamento — informe o valor realizado na conclusão para comparar.`;
    } else if (filtroAtivo) {
      msg = `Lista: ${rows.length} de ${rowsAll.length} projeto(s) comparáveis`;
      if (semRealizado) msg += ` · ${semRealizado} sem valor realizado`;
    } else {
      msg = `Lista: ${rows.length} de ${rowsAll.length} projeto(s) concluído(s) com valor projetado e realizado.`;
      if (semRealizado) msg += ` ${semRealizado} concluído(s) sem valor realizado informado.`;
    }
    if (filtroAtivo && !rows.length && rowsAll.length) {
      msg += " — nenhum resultado com os filtros atuais.";
    }
    countEl.textContent = msg;
  }

  if (!rows.length) {
    tableWrap.innerHTML = filtroAtivo
      ? "<p class=\"muted\">Nenhum projeto corresponde aos filtros. Ajuste projetista ou situação.</p>"
      : "<p class=\"muted\">Nenhum projeto com os dois valores para comparar.</p>";
    return;
  }

  const sortedTable = [...rows].sort((a, b) => {
    if (a.dentro !== b.dentro) return a.dentro ? 1 : -1;
    return (b.desvioProjetadoPct || 0) - (a.desvioProjetadoPct || 0);
  });

  let body = "";
  for (const r of sortedTable) {
    const dm = migrateDemanda(r.d);
    const desvioCls = r.dentro ? "dash-pe-num--ok" : "dash-pe-num--bad";
    const desvioTxt =
      r.desvioProjetadoPct != null
        ? `${r.desvioProjetadoPct > 0 ? "+" : ""}${r.desvioProjetadoPct}%`
        : "—";
    body +=
      "<tr><td><strong>" +
      escapeHtml(r.d.titulo || "—") +
      "</strong></td><td>" +
      escapeHtml(r.d.cidade || "—") +
      "</td><td>" +
      escapeHtml(dm.responsavel || "—") +
      '</td><td class="dash-pe-num">' +
      formatBRL(r.base) +
      '</td><td class="dash-pe-num">' +
      formatBRL(r.projetado) +
      '</td><td class="dash-pe-num">' +
      formatBRL(r.realizado) +
      '</td><td class="dash-pe-num ' +
      desvioCls +
      '">' +
      desvioTxt +
      "</td><td>" +
      projetadoExecutadoBadgeHtml(r.dentro, r.desvioProjetadoPct) +
      "</td></tr>";
  }

  tableWrap.innerHTML =
    '<table class="dash-table dash-table--projetado-exec"><thead><tr><th>Projeto</th><th>Cidade</th><th>Projetista</th><th>Valor projeto</th><th>Projetado (+5%)</th><th>Realizado</th><th>Desvio vs projetado</th><th>Situação</th></tr></thead><tbody>' +
    body +
    "</tbody></table>";
}

function emptyStatsCidade(cidade) {
  return {
    cidade,
    projetos: 0,
    valor: 0,
    portasNovas: 0,
    metragem: 0,
    comCusto: 0,
    comPortas: 0,
    comLancamento: 0,
  };
}

function accumulateDemandaStatsCidade(row, d, mode = getDashValorModo()) {
  row.projetos += 1;
  const c = normalizeCusto(d.custo);
  if (demandaTemValorFinalDash(d)) {
    row.comCusto += 1;
    row.valor += demandaValorDashPorModo(d, mode);
  }
  if (c.temPortas) {
    row.comPortas += 1;
    row.portasNovas += demandaPortasDashPorModo(d, mode);
  }
  if (c.temLancamento) {
    row.comLancamento += 1;
    row.metragem += demandaMetragemDashPorModo(d, mode);
  }
}

function buildStatsPorGrupo(demandas, keyFn) {
  const map = new Map();
  for (const d of demandas) {
    const key = keyFn(d);
    if (!map.has(key)) map.set(key, emptyStatsCidade(key));
    accumulateDemandaStatsCidade(map.get(key), d);
  }
  return [...map.values()].sort((a, b) => b.projetos - a.projetos || a.cidade.localeCompare(b.cidade, "pt-BR"));
}

function buildStatsPorCidade(demandas) {
  return buildStatsPorGrupo(demandas, (d) => labelCidade(d.cidade));
}

function buildStatsPorRegional(demandas) {
  return buildStatsPorGrupo(demandas, labelRegionalDemanda);
}

function collectRegionaisFromDemandas(demandas) {
  const set = new Set();
  for (const d of demandas) set.add(labelRegionalDemanda(d));
  return [...set].sort((a, b) => {
    if (a === "Não informada") return 1;
    if (b === "Não informada") return -1;
    return a.localeCompare(b, "pt-BR");
  });
}

function collectCidadesFromDemandas(demandas, regionalFilter) {
  const set = new Set();
  for (const d of demandas) {
    if (regionalFilter && labelRegionalDemanda(d) !== regionalFilter) continue;
    set.add(labelCidade(d.cidade));
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function populateDashCidadesFilters(demandas) {
  const selReg = document.getElementById("filterDashCidadesRegional");
  const selCid = document.getElementById("filterDashCidadesCidade");
  if (!selReg || !selCid) return;

  const savedReg = selReg.value;
  const savedCid = selCid.value;

  const regionais = collectRegionaisFromDemandas(demandas);
  fillSelectOptions(
    selReg,
    [{ value: "", label: "Todas" }, ...regionais.map((r) => ({ value: r, label: r }))],
    false,
  );
  if (savedReg && [...selReg.options].some((o) => o.value === savedReg)) selReg.value = savedReg;

  const cidades = collectCidadesFromDemandas(demandas, selReg.value);
  fillSelectOptions(
    selCid,
    [{ value: "", label: "Todas" }, ...cidades.map((c) => ({ value: c, label: c }))],
    false,
  );
  if (savedCid && [...selCid.options].some((o) => o.value === savedCid)) selCid.value = savedCid;
  else selCid.value = "";
}

function filterDemandasDashCidades(demandas) {
  const regional = document.getElementById("filterDashCidadesRegional")?.value || "";
  const cidade = document.getElementById("filterDashCidadesCidade")?.value || "";
  if (!regional && !cidade) return demandas;
  return demandas.filter((d) => {
    if (regional && labelRegionalDemanda(d) !== regional) return false;
    if (cidade && labelCidade(d.cidade) !== cidade) return false;
    return true;
  });
}

function dashCidadesFiltroAtivo() {
  const regional = document.getElementById("filterDashCidadesRegional")?.value || "";
  const cidade = document.getElementById("filterDashCidadesCidade")?.value || "";
  return !!(regional || cidade);
}

function renderDashCidades() {
  const kpiEl = document.getElementById("dashCidadesKpis");
  const tableWrap = document.getElementById("dashCidadesTable");
  const countEl = document.getElementById("dashCidadesCount");
  if (!tableWrap) return;

  const todasBase = demandasDashOperacionalList();
  populateDashCidadesFilters(todasBase);
  const todas = filterDemandasModoDash(filterDemandasDashCidades(todasBase));
  const rows = buildStatsPorCidade(todas);
  const rowsRegional = buildStatsPorRegional(todas);

  if (!todasBase.length) {
    destroyDashRegionalCharts();
    if (kpiEl) kpiEl.innerHTML = "";
    if (countEl) countEl.textContent = "";
    tableWrap.innerHTML = "<p class=\"muted\">Nenhum projeto cadastrado.</p>";
    return;
  }

  if (!todas.length) {
    destroyDashRegionalCharts();
    if (kpiEl) kpiEl.innerHTML = "";
    const modoLabel = labelValorDashModo().toLowerCase();
    if (countEl) {
      countEl.textContent = dashCidadesFiltroAtivo()
        ? "Nenhum projeto encontrado com os filtros atuais e a base de indicadores selecionada."
        : `Nenhum projeto na base «${modoLabel}».`;
    }
    tableWrap.innerHTML = "<p class=\"muted\">Nenhum projeto na base de indicadores selecionada.</p>";
    return;
  }

  const totais = rows.reduce(
    (acc, r) => {
      acc.projetos += r.projetos;
      acc.valor += r.valor;
      acc.portasNovas += r.portasNovas;
      acc.metragem += r.metragem;
      acc.comCusto += r.comCusto;
      acc.comPortas += r.comPortas;
      acc.comLancamento += r.comLancamento;
      return acc;
    },
    emptyStatsCidade("Total"),
  );

  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("Regionais", rowsRegional.length, "ok") +
      kpiCard("Cidades", rows.length, "ok") +
      kpiCard("Projetos", totais.projetos, "ok") +
      kpiCard(labelValorDashModo(), formatBRL(totais.valor), totais.valor ? "ok" : "warn") +
      kpiCard("Portas novas", formatQtd(totais.portasNovas), totais.portasNovas ? "ok" : "warn") +
      kpiCard("Metragem lanç.", formatMetros(totais.metragem), totais.metragem ? "ok" : "warn");
  }

  if (countEl) {
    const sufixo = dashCidadesFiltroAtivo() ? " no filtro." : " no total.";
    countEl.textContent = `${rowsRegional.length} regional(is) · ${rows.length} cidade(s) · ${totais.projetos} projeto(s)${sufixo}`;
  }

  const topCidades = rows.slice(0, 12);
  makeDashChart(
    "chartCidadesProjetos",
    "bar",
    topCidades.map((r) => truncateChartLabel(r.cidade, 22)),
    topCidades.map((r) => r.projetos),
    { color: "#8b5cf6", datasetLabel: "Projetos" },
  );

  makeDashChart(
    "chartRegionalProjetos",
    "bar",
    rowsRegional.map((r) => truncateChartLabel(r.cidade, 22)),
    rowsRegional.map((r) => r.projetos),
    { color: "#6366f1", datasetLabel: "Projetos" },
  );

  renderDashTipoPorGrupo("chartCidadesTipo", todas, rows, (d) => labelCidade(d.cidade));
  renderDashTipoPorGrupo("chartRegionalTipo", todas, rowsRegional, labelRegionalDemanda, rowsRegional.length);

  const topCidadesInvest = [...rows].sort((a, b) => b.valor - a.valor || b.projetos - a.projetos).slice(0, 12);
  makeDashChartMoneyBar(
    "chartCidadesInvestimento",
    topCidadesInvest.map((r) => truncateChartLabel(r.cidade, 22)),
    topCidadesInvest.map((r) => r.valor),
    "#22c55e",
  );

  const topRegionalInvest = [...rowsRegional].sort((a, b) => b.valor - a.valor || b.projetos - a.projetos);
  makeDashChartMoneyBar(
    "chartRegionalInvestimento",
    topRegionalInvest.map((r) => truncateChartLabel(r.cidade, 22)),
    topRegionalInvest.map((r) => r.valor),
    "#14b8a6",
  );

  let body = "";
  for (const r of rows) {
    body +=
      "<tr><td><strong>" +
      escapeHtml(r.cidade) +
      "</strong></td><td>" +
      escapeHtml(regionalFromCidadeLabel(r.cidade)) +
      "</td><td>" +
      r.projetos +
      "</td><td>" +
      (r.valor > 0 ? formatBRL(r.valor) : "—") +
      "</td><td>" +
      (r.portasNovas > 0 ? formatQtd(r.portasNovas) : "—") +
      "</td><td>" +
      (r.metragem > 0 ? formatMetros(r.metragem) : "—") +
      "</td><td>" +
      r.comCusto +
      "</td><td>" +
      r.comPortas +
      "</td><td>" +
      r.comLancamento +
      "</td></tr>";
  }
  body +=
    '<tr class="dash-cf-total-row"><td><strong>Total</strong></td><td>—</td><td>' +
    totais.projetos +
    "</td><td>" +
    (totais.valor > 0 ? formatBRL(totais.valor) : "—") +
    "</td><td>" +
    (totais.portasNovas > 0 ? formatQtd(totais.portasNovas) : "—") +
    "</td><td>" +
    (totais.metragem > 0 ? formatMetros(totais.metragem) : "—") +
    "</td><td>" +
    totais.comCusto +
    "</td><td>" +
    totais.comPortas +
    "</td><td>" +
    totais.comLancamento +
    "</td></tr>";

  tableWrap.innerHTML =
    '<table class="dash-table dash-table--cidades"><thead><tr><th>Cidade</th><th>Regional</th><th>Projetos</th><th>Investimento</th><th>Portas novas</th><th>Metragem lanç.</th><th>c/ custo</th><th>c/ portas</th><th>c/ lanç.</th></tr></thead><tbody>' +
    body +
    "</tbody></table>";
}

function demandaTempoTotalMs(d) {
  return Object.values(demandaTempoPorFase(d)).reduce((acc, ms) => acc + ms, 0);
}

function statsProjetista(nome, baseList = demandasDashOperacionalList()) {
  const list = baseList.filter((d) => d.responsavel === nome);
  let valorTotal = 0;
  let metragemTotal = 0;
  let portasNovasTotal = 0;
  let comCusto = 0;
  let comLancamento = 0;
  const mode = getDashValorModo();
  for (const d of list) {
    valorTotal += demandaValorDashPorModo(d, mode);
    metragemTotal += demandaMetragemDashPorModo(d, mode);
    portasNovasTotal += demandaPortasDashPorModo(d, mode);
    const c = normalizeCusto(d.custo);
    if (c.temLevantamento) comCusto += 1;
    if (c.temLancamento) comLancamento += 1;
  }
  return { ...countDemandas(list), valorTotal, metragemTotal, portasNovasTotal, comCusto, comLancamento };
}

function countDemandas(list, linha) {
  const isConcl = (d) =>
    linha === LINHA_ESTEIRA_B2B ? STATUS_B2B_CONCLUIDOS.has(d.status) : d.status === "conclusao";
  const pausadas = list.filter((d) => d.status === "pausado");
  const ativas = list.filter((d) => !isConcl(d) && d.status !== "reprovado" && d.status !== "pausado");
  const concl = list.filter(isConcl);
  const rep = linha === LINHA_ESTEIRA_B2B ? [] : list.filter((d) => d.status === "reprovado");
  const atraso = list.filter(isAtraso);
  return {
    total: list.length,
    ativas: ativas.length,
    pausadas: pausadas.length,
    concluidas: concl.length,
    reprovadas: rep.length,
    atraso: atraso.length,
  };
}

function kpiCard(label, value, tone) {
  return `<div class="kpi kpi--${tone}"><div class="kpi__label">${label}</div><div class="kpi__value">${value}</div></div>`;
}

function countByStatus(baseList = demandasDashOperacionalList()) {
  const counts = {};
  for (const [k, lab] of [...STATUS_ORDER, ...STATUS_EXTRA]) counts[k] = { label: lab, n: 0 };
  baseList.forEach((d) => {
    const st = migrateDemanda(d).status;
    if (counts[st]) counts[st].n += 1;
  });
  return Object.values(counts).filter((v) => v.n > 0);
}

const TIPO_CHART_COLORS = {
  B2C: "#6366f1",
  B2B: "#a855f7",
  SWAP: "#f59e0b",
  Backbone: "#0ea5e9",
  Licenciamento: "#10b981",
  "Diária": "#a855f7",
};

const STATUS_CHART_COLORS = {
  novo: "#6366f1",
  analise: "#14b8a6",
  vistoria: "#06b6d4",
  custo: "#84cc16",
  revisao: "#a855f7",
  aprovacao: "#f59e0b",
  materiais: "#f97316",
  execucao: "#ef4444",
  execucao_terceirizada: "#ec4899",
  configuracao_op: "#0ea5e9",
  transmissao_infra_op: "#eab308",
  documentacao_op: "#22c55e",
  conclusao: "#8b5cf6",
  pausado: "#64748b",
  reprovado: "#dc2626",
};

function tiposOperacionalDash() {
  return TIPOS_DEMANDA.filter((t) => t !== "B2B");
}

function dashStatusKeysOperacional() {
  return [...STATUS_ORDER.map(([k]) => k), ...STATUS_EXTRA.map(([k]) => k)];
}

function buildProjetistaCountMatrix(baseList, colKeys, valueFromDemanda) {
  const matrix = {};
  for (const nome of PROJETISTAS) {
    matrix[nome] = Object.fromEntries(colKeys.map((k) => [k, 0]));
  }
  baseList.forEach((d) => {
    const pj = normalizeResponsavel(d.responsavel);
    if (!PROJETISTAS.includes(pj)) return;
    const col = valueFromDemanda(d);
    if (col && matrix[pj][col] !== undefined) matrix[pj][col] += 1;
  });
  return matrix;
}

function activeMatrixColumns(matrix, colKeys) {
  return colKeys.filter((k) => PROJETISTAS.some((nome) => (matrix[nome]?.[k] || 0) > 0));
}

function renderDashGrupoMatrixTable(containerId, rowHeader, rowKeys, colKeys, colLabel, matrix, emptyMsg, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!colKeys.length || !rowKeys.length) {
    el.innerHTML = `<p class="muted small">${escapeHtml(emptyMsg || "Nenhum dado para exibir.")}</p>`;
    return;
  }
  const fmtCell = opts.formatCell || ((n) => (n ? String(n) : "—"));
  const fmtTotal = opts.formatTotal || fmtCell;
  const colTotals = Object.fromEntries(colKeys.map((k) => [k, 0]));
  let body = "";
  let grandTotal = 0;
  for (const rowKey of rowKeys) {
    const row = matrix[rowKey] || {};
    let rowTotal = 0;
    body += `<tr><td>${escapeHtml(rowKey)}</td>`;
    colKeys.forEach((k) => {
      const n = row[k] || 0;
      rowTotal += n;
      colTotals[k] += n;
      body += `<td class="dash-pj-matrix__num">${fmtCell(n)}</td>`;
    });
    grandTotal += rowTotal;
    body += `<td class="dash-pj-matrix__num dash-pj-matrix__total"><strong>${fmtTotal(rowTotal)}</strong></td></tr>`;
  }
  let foot = "";
  colKeys.forEach((k) => {
    foot += `<td class="dash-pj-matrix__num"><strong>${fmtTotal(colTotals[k])}</strong></td>`;
  });
  el.innerHTML =
    `<table class="dash-table dash-table--pj-matrix"><thead><tr><th>${escapeHtml(rowHeader)}</th>${colKeys
      .map((k) => `<th>${escapeHtml(colLabel(k))}</th>`)
      .join("")}<th>Total</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td><strong>Total</strong></td>${foot}<td class="dash-pj-matrix__num"><strong>${fmtTotal(grandTotal)}</strong></td></tr></tfoot></table>`;
}

function renderDashProjetistaMatrixTable(containerId, colKeys, colLabel, matrix) {
  renderDashGrupoMatrixTable(
    containerId,
    "Projetista",
    PROJETISTAS,
    colKeys,
    colLabel,
    matrix,
    "Nenhuma demanda atribuída aos projetistas.",
  );
}

function makeDashChartProjetistaStacked(canvasId, labels, datasets, chartOpts = {}) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  if (!datasets.length) return;
  const formatValue = chartOpts.formatValue || ((n) => String(n));
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "#cbd5e1", boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const n = ctx.raw;
              if (!n) return null;
              return `${ctx.dataset.label}: ${formatValue(n)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#94a3b8", font: { size: 11 }, maxRotation: 45, minRotation: 0 },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: "#94a3b8",
            stepSize: chartOpts.stepSize,
            callback: chartOpts.yFormat || ((v) => formatValue(v)),
          },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
      },
    },
  });
}

function renderDashProjetistaTipoStatusCharts(baseList) {
  const tipos = tiposOperacionalDash();
  const tipoMatrix = buildProjetistaCountMatrix(baseList, tipos, (d) => normalizeTipo(d.tipo));
  const tipoDatasets = tipos
    .filter((tipo) => PROJETISTAS.some((nome) => (tipoMatrix[nome]?.[tipo] || 0) > 0))
    .map((tipo) => ({
      label: tipo,
      data: PROJETISTAS.map((nome) => tipoMatrix[nome]?.[tipo] || 0),
      backgroundColor: TIPO_CHART_COLORS[tipo] || "#94a3b8",
      borderWidth: 0,
    }));
  makeDashChartProjetistaStacked("chartProjetistaTipo", PROJETISTAS, tipoDatasets);
  renderDashProjetistaMatrixTable("dashProjetistaTipoTable", tipos, (k) => k, tipoMatrix);

  const statusKeysAll = dashStatusKeysOperacional();
  const statusMatrix = buildProjetistaCountMatrix(baseList, statusKeysAll, (d) => migrateDemanda(d).status);
  const statusKeys = activeMatrixColumns(statusMatrix, statusKeysAll);
  const statusDatasets = statusKeys.map((status) => ({
    label: STATUS_LABEL[status] || status,
    data: PROJETISTAS.map((nome) => statusMatrix[nome]?.[status] || 0),
    backgroundColor: STATUS_CHART_COLORS[status] || "#94a3b8",
    borderWidth: 0,
  }));
  makeDashChartProjetistaStacked("chartProjetistaStatus", PROJETISTAS, statusDatasets);
  renderDashProjetistaMatrixTable(
    "dashProjetistaStatusTable",
    statusKeys,
    (k) => STATUS_LABEL[k] || k,
    statusMatrix,
  );
}

function countByTipo(baseList = demandasDashOperacionalList()) {
  const counts = Object.fromEntries(TIPOS_DEMANDA.map((t) => [t, 0]));
  baseList.forEach((d) => {
    const t = normalizeTipo(d.tipo);
    if (counts[t] !== undefined) counts[t] += 1;
  });
  return TIPOS_DEMANDA.filter((tipo) => tipo !== "B2B")
    .map((tipo) => ({ label: tipo, n: counts[tipo] || 0 }))
    .filter((x) => x.n > 0);
}

/** Tipos exibidos nos gráficos de quantidade e valor (Esteira Projetos, sem B2B). */
const TIPOS_GRAFICO_ESTEIRA = ["B2C", "Backbone", "SWAP", "Licenciamento"];

function statsTipoGraficoEsteira(
  baseListQtd = demandasDashOperacionalList(),
  baseListValor = baseListQtd,
  mode = getDashValorModo(),
) {
  const counts = Object.fromEntries(TIPOS_GRAFICO_ESTEIRA.map((t) => [t, 0]));
  const valores = Object.fromEntries(TIPOS_GRAFICO_ESTEIRA.map((t) => [t, 0]));
  baseListQtd.forEach((d) => {
    const t = normalizeTipo(d.tipo);
    if (!TIPOS_GRAFICO_ESTEIRA.includes(t)) return;
    counts[t] += 1;
  });
  baseListValor.forEach((d) => {
    const t = normalizeTipo(d.tipo);
    if (!TIPOS_GRAFICO_ESTEIRA.includes(t)) return;
    valores[t] += demandaValorDashPorModo(d, mode);
  });
  return TIPOS_GRAFICO_ESTEIRA.map((tipo) => ({
    label: tipo,
    n: counts[tipo],
    valor: valores[tipo],
  }));
}

function renderDashTipoProjetosCharts(baseListQtd = demandasDashOperacionalList(), baseListValor = null) {
  const mode = getDashValorModo();
  const listValor = baseListValor ?? filterDemandasModoDash(baseListQtd, mode);
  const rows = statsTipoGraficoEsteira(baseListQtd, listValor, mode);
  const labels = rows.map((r) => r.label);
  const colors = labels.map((l) => TIPO_CHART_COLORS[l] || "#94a3b8");

  makeDashChartMetricBar(
    "chartTipoQtd",
    labels,
    rows.map((r) => r.n),
    { colors, datasetLabel: "Projetos", stepSize: 1 },
  );

  const modoLabel = DASH_VALOR_MODOS[mode]?.label || "Valor";
  makeDashChartMoneyBar(
    "chartTipoValor",
    labels,
    rows.map((r) => r.valor),
    colors,
  );
  if (dashCharts.chartTipoValor) {
    dashCharts.chartTipoValor.data.datasets[0].label = modoLabel;
    dashCharts.chartTipoValor.update();
  }

}

const SEGMENTO_B2C_CHART_COLORS = {
  MDU: "#22c55e",
  TCR: "#3b82f6",
  TCT: "#f59e0b",
  [B2C_SEGMENTO_SEM]: "#64748b",
};

const B2B_PRODUTO_SEM = "Sem produto";

const PRODUTO_B2B_CHART_COLORS = {
  "Evento IP": "#a855f7",
  "IP Dedicado": "#6366f1",
  "IP Trânsito": "#818cf8",
  "Lan to Lan": "#c084fc",
  "Projeto Especial": "#e879f9",
  "Transporte PTT": "#7c3aed",
  Wireless: "#d946ef",
  [B2B_PRODUTO_SEM]: "#64748b",
};

function produtoB2bBucket(d) {
  const dm = migrateDemanda(d);
  return normalizeProdutoB2b(dm.produtoB2b) || B2B_PRODUTO_SEM;
}

function buildProdutoB2bMatrix(demandas, rowKeys, keyFn) {
  const cols = [...PRODUTOS_B2B, B2B_PRODUTO_SEM];
  const matrix = Object.fromEntries(
    rowKeys.map((k) => [k, Object.fromEntries(cols.map((p) => [p, 0]))]),
  );
  demandas.forEach((d) => {
    const key = keyFn(d);
    if (!matrix[key]) return;
    const prod = produtoB2bBucket(d);
    if (matrix[key][prod] !== undefined) matrix[key][prod] += 1;
  });
  return matrix;
}

function activeProdutoB2bCols(matrix, rowKeys) {
  const cols = [...PRODUTOS_B2B];
  if (rowKeys.some((k) => (matrix[k]?.[B2B_PRODUTO_SEM] || 0) > 0)) cols.push(B2B_PRODUTO_SEM);
  return cols.filter((p) => rowKeys.some((k) => (matrix[k]?.[p] || 0) > 0));
}

function renderDashProdutoB2bPorGrupo(canvasId, tableId, tableRowHeader, demandas, groupRows, keyFn, topN = 12) {
  const topRows = groupRows.slice(0, topN);
  const rowKeys = topRows.map((r) => r.cidade);
  const matrix = buildProdutoB2bMatrix(demandas, rowKeys, keyFn);
  const produtos = activeProdutoB2bCols(matrix, rowKeys);
  const datasets = produtos
    .map((prod) => ({
      label: prod,
      data: rowKeys.map((k) => matrix[k][prod] || 0),
      backgroundColor: PRODUTO_B2B_CHART_COLORS[prod] || "#64748b",
      borderWidth: 0,
    }))
    .filter((ds) => ds.data.some((n) => n > 0));
  makeDashChartProjetistaStacked(
    canvasId,
    rowKeys.map((k) => truncateChartLabel(k, 22)),
    datasets,
    { stepSize: 1 },
  );
  renderDashGrupoMatrixTable(
    tableId,
    tableRowHeader,
    rowKeys,
    produtos,
    (k) => k,
    matrix,
    "Nenhum projeto B2B neste agrupamento.",
  );
}

const DASH_B2B_REGIONAL_CHART_IDS = [
  "chartB2bProjetosCidade",
  "chartB2bProjetosRegional",
  "chartB2bProdutoCidade",
  "chartB2bProdutoRegional",
];

const DASH_B2B_COMERCIAL_CHART_IDS = [
  "chartB2bSolicitanteQtd",
  "chartB2bSolicitanteValor",
  "chartB2bSolicitanteCidade",
];

const SOLICITANTE_B2B_CHART_COLORS = {
  "Christopher Kurt": "#14b8a6",
  "Igor Barreto": "#6366f1",
  "Igor Raposo": "#818cf8",
  "Lorrany Rodrigues": "#a855f7",
  "Michel Dias": "#c084fc",
  "Pedro Cardoso": "#7c3aed",
  "Thiago Miranda": "#8b5cf6",
  [SOLICITANTE_B2B_OUTROS]: "#64748b",
  [SOLICITANTE_B2B_SEM]: "#475569",
};

function destroyDashB2bComercialCharts() {
  DASH_B2B_COMERCIAL_CHART_IDS.forEach((id) => {
    if (dashCharts[id]) {
      dashCharts[id].destroy();
      delete dashCharts[id];
    }
  });
  const tableEl = document.getElementById("dashB2bSolicitanteCidadeTable");
  if (tableEl) tableEl.innerHTML = "";
}

function statsSolicitanteB2bComercial(list = demandasB2bDashboardList(), mode = getDashValorModo()) {
  const byLabel = Object.fromEntries(
    SOLICITANTES_B2B_COMERCIAL.map((label) => [label, { label, n: 0, valor: 0 }]),
  );
  list.forEach((d) => {
    const key = resolveSolicitanteB2bComercial(d);
    if (!key) return;
    if (demandaIncluiModoDash(d, mode)) byLabel[key].n += 1;
    byLabel[key].valor += demandaValorDashPorModo(d, mode);
  });
  return SOLICITANTES_B2B_COMERCIAL.map((label) => byLabel[label]);
}

function scheduleDashChartsResize(ids) {
  requestAnimationFrame(() => {
    ids.forEach((id) => dashCharts[id]?.resize());
  });
}

function topCidadesSolicitanteB2b(demandas, topN = 10) {
  const counts = new Map();
  demandas.forEach((d) => {
    const c = labelCidade(d.cidade);
    counts.set(c, (counts.get(c) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, topN)
    .map(([cidade]) => cidade);
}

function buildSolicitanteB2bCidadeMatrix(demandas, cidades) {
  const matrix = Object.fromEntries(
    SOLICITANTES_B2B_COMERCIAL.map((s) => [s, Object.fromEntries(cidades.map((c) => [c, 0]))]),
  );
  demandas.forEach((d) => {
    const sol = resolveSolicitanteB2bComercial(d);
    const cid = labelCidade(d.cidade);
    if (!sol || !matrix[sol] || matrix[sol][cid] === undefined) return;
    matrix[sol][cid] += 1;
  });
  return matrix;
}

function renderDashSolicitanteB2bCharts(list = demandasB2bDashboardList()) {
  destroyDashB2bComercialCharts();
  if (!list.length) return;

  const mode = getDashValorModo();
  const rows = statsSolicitanteB2bComercial(list, mode);
  const labels = SOLICITANTES_B2B_COMERCIAL;
  const colors = labels.map((l) => SOLICITANTE_B2B_CHART_COLORS[l] || "#94a3b8");
  const temProjetos = rows.some((r) => r.n > 0);
  const temValor = rows.some((r) => r.valor > 0);

  if (!temProjetos && !temValor) return;

  if (temProjetos) {
    makeDashChartMetricBar(
      "chartB2bSolicitanteQtd",
      labels,
      rows.map((r) => r.n),
      { colors, datasetLabel: "Projetos", stepSize: 1 },
    );
  }

  makeDashChartMoneyBar(
    "chartB2bSolicitanteValor",
    labels,
    rows.map((r) => r.valor),
    colors,
    { datasetLabel: labelValorDashModo(mode) },
  );
  scheduleDashChartsResize(["chartB2bSolicitanteQtd", "chartB2bSolicitanteValor"]);

  const listModo = list.filter((d) => demandaIncluiModoDash(d, mode));
  const baseCidades = listModo.length ? listModo : list;
  const cidades = topCidadesSolicitanteB2b(baseCidades, 10);
  if (!cidades.length) return;

  const matrix = buildSolicitanteB2bCidadeMatrix(baseCidades, cidades);
  const activeSol = labels.filter((s) => cidades.some((c) => (matrix[s][c] || 0) > 0));
  if (!activeSol.length) return;

  const cityColors = ["#6366f1", "#818cf8", "#a855f7", "#c084fc", "#7c3aed", "#8b5cf6", "#22c55e", "#14b8a6", "#f59e0b", "#ef4444"];
  const datasets = cidades
    .map((cid, i) => ({
      label: truncateChartLabel(cid, 20),
      data: activeSol.map((sol) => matrix[sol][cid] || 0),
      backgroundColor: cityColors[i % cityColors.length],
      borderWidth: 0,
    }))
    .filter((ds) => ds.data.some((n) => n > 0));

  makeDashChartProjetistaStacked(
    "chartB2bSolicitanteCidade",
    activeSol.map((s) => truncateChartLabel(s, 22)),
    datasets,
    { stepSize: 1 },
  );

  scheduleDashChartsResize(["chartB2bSolicitanteCidade"]);

  const tableMatrix = Object.fromEntries(activeSol.map((s) => [s, Object.fromEntries(cidades.map((c) => [c, matrix[s][c] || 0]))]));
  renderDashGrupoMatrixTable(
    "dashB2bSolicitanteCidadeTable",
    "Solicitante",
    activeSol,
    cidades,
    (k) => k,
    tableMatrix,
    "Nenhum projeto B2B com solicitante comercial nestas cidades.",
  );
}

function destroyDashB2bRegionalCharts() {
  DASH_B2B_REGIONAL_CHART_IDS.forEach((id) => {
    if (dashCharts[id]) {
      dashCharts[id].destroy();
      delete dashCharts[id];
    }
  });
  ["dashB2bProdutoCidadeTable", "dashB2bProdutoRegionalTable"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

function countByValoresLista(list, valores, normalizer) {
  const counts = Object.fromEntries(valores.map((v) => [v, 0]));
  list.forEach((d) => {
    const key = normalizer(d);
    if (key && counts[key] !== undefined) counts[key] += 1;
  });
  return valores.map((label) => ({ label, n: counts[label] || 0 })).filter((x) => x.n > 0);
}

function countBySegmentoB2c(list = demandasB2cDashboardList()) {
  return countByValoresLista(list, SEGMENTOS_B2C, (d) => normalizeSegmentoB2c(d.segmentoB2c));
}

function countByProdutoB2b(list = demandasB2bDashboardList()) {
  return countByValoresLista(list, PRODUTOS_B2B, (d) => normalizeProdutoB2b(d.produtoB2b));
}

function countB2bIndicadores(list = demandasB2bDashboardList()) {
  let aguardandoBp = 0;
  let aprovados = 0;
  let execucaoRegional = 0;
  let execucaoTerceirizada = 0;
  let pausados = 0;
  let concluido = 0;
  let valorTotal = 0;
  for (const raw of list) {
    const d = migrateDemanda(raw);
    const st = d.status;
    if (st === "aprovacao_bp") aguardandoBp += 1;
    else if (STATUS_B2B_APROVADOS.includes(st)) aprovados += 1;
    else if (STATUS_B2B_EXECUCAO_REGIONAL.includes(st)) execucaoRegional += 1;
    else if (STATUS_B2B_EXECUCAO_TERCEIRIZADA.includes(st)) execucaoTerceirizada += 1;
    else if (st === "pausado") pausados += 1;
    else if (STATUS_B2B_CONCLUIDOS.has(st)) concluido += 1;
    valorTotal += demandaValorDashPorModo(raw, getDashValorModo());
  }
  return {
    total: list.length,
    aguardandoBp,
    aprovados,
    execucaoRegional,
    execucaoTerceirizada,
    pausados,
    concluido,
    valorTotal,
  };
}

/** Gráfico de status B2B — projeto_final agrupado como Aprovados. */
function countByStatusDashboardB2b(list = demandasB2bDashboardList()) {
  const counts = new Map();
  const add = (label, n = 1) => counts.set(label, (counts.get(label) || 0) + n);
  list.forEach((d) => {
    const st = migrateDemanda(d).status;
    if (st === "projeto_final") add("Aprovados");
    else add(labelStatus(st, LINHA_ESTEIRA_B2B));
  });
  return [...counts.entries()]
    .map(([label, n]) => ({ label, n }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "pt-BR"));
}

function makeDashChartChegadasFin(labels, chegadas, finalizacoes) {
  const canvasId = "chartChegadasFin";
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Chegadas", data: chegadas, backgroundColor: "#3b82f6", borderWidth: 0 },
        { label: "Finalizações", data: finalizacoes, backgroundColor: "#22c55e", borderWidth: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: "#cbd5e1", boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } },
        y: { beginAtZero: true, ticks: { color: "#94a3b8", stepSize: 1 }, grid: { color: "rgba(148,163,184,0.12)" } },
      },
    },
  });
}

function makeDashChart(canvasId, type, labels, data, options = {}) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  const palette = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#a855f7", "#0ea5e9", "#22c55e", "#94a3b8"];
  const color = options.color || palette[0];
  const bg =
    options.colors ||
    (type === "doughnut" ? palette.slice(0, labels.length) : color);
  dashCharts[canvasId] = new Chart(el, {
    type,
    data: {
      labels,
      datasets: [{ label: options.datasetLabel || "", data, backgroundColor: bg, borderWidth: type === "doughnut" ? 1 : 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: type === "doughnut", labels: { color: "#cbd5e1", boxWidth: 12 } }, ...(options.plugins || {}) },
      scales: type === "bar" ? { x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } }, y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } } } : undefined,
    },
  });
}


function destroyDashTempoCharts(cfg = DASH_TEMPO_CFG_OP) {
  cfg.chartIds.forEach((id) => {
    if (dashCharts[id]) {
      dashCharts[id].destroy();
      delete dashCharts[id];
    }
  });
}

function destroyDashChartTempoSetorResumo(cfg = DASH_TEMPO_CFG_OP) {
  if (dashCharts[cfg.resumoChartId]) {
    dashCharts[cfg.resumoChartId].destroy();
    delete dashCharts[cfg.resumoChartId];
  }
}

function buildTempoSetorResumoItems(bySetor, setores = SETORES_ESTEIRA, bySetorCount = null) {
  const totalSetor = setores.reduce((s, k) => s + (bySetor[k] || 0), 0);
  const itemsAll = setores.map((setor) => {
    const ms = bySetor[setor] || 0;
    const n = bySetorCount?.[setor] || 0;
    return {
      setor,
      ms,
      pct: totalSetor ? Math.round((ms / totalSetor) * 1000) / 10 : 0,
      days: msToChartDays(ms),
      avgDays: n ? msToChartDays(ms / n) : 0,
      avgCount: n,
    };
  });
  const itemsChart = itemsAll.filter((it) => it.ms > 0).sort((a, b) => b.avgDays - a.avgDays);
  return { itemsAll, itemsChart, totalSetor };
}

/** Tabela estática «Etapas × setores» — gerada a partir de STATUS_ORDER + STATUS_SETOR. */
function renderDashTempoSetorMap(cfg = DASH_TEMPO_CFG_OP) {
  const tbody = document.getElementById(cfg.ids.mapBody);
  if (!tbody) return;
  let html = "";
  for (const [status, label] of cfg.statusOrder) {
    if (cfg.isStatusExcluded(status)) continue;
    const setor = cfg.setorForStatus(status);
    html +=
      "<tr><td>" +
      escapeHtml(label) +
      "</td><td>" +
      (setor ? setorBadgeHtml(setor) : '<span class="dash-setor dash-setor--outros">—</span>') +
      "</td></tr>";
  }
  tbody.innerHTML = html;
}

function makeDashChartTempoSetorResumo(items, cfg = DASH_TEMPO_CFG_OP) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(cfg.resumoChartId);
  if (!el) return;
  destroyDashChartTempoSetorResumo(cfg);
  if (!items.length) return;

  const labels = items.map((it) => it.setor);
  const colors = items.map((it) => setorColorFor(it.setor, cfg));

  dashCharts[cfg.resumoChartId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Média de dias",
          data: items.map((it) => it.avgDays),
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const it = items[ctx.dataIndex];
              return [
                `Média: ${it.avgDays} dia(s)`,
                `${it.avgCount} projeto(s)`,
                `Total: ${formatDur(it.ms)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Média de dias", color: "#94a3b8", font: { size: 11 } },
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
        y: { ticks: { color: "#cbd5e1", font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

/** Resumo ao lado do mapa de etapas (sempre visível). */
function renderDashTempoSetorResumo(rows, cfg = DASH_TEMPO_CFG_OP) {
  const tableEl = document.getElementById(cfg.ids.resumoTable);
  const hintEl = document.getElementById(cfg.ids.resumoHint);
  if (!tableEl) return;

  if (!rows.length) {
    tableEl.innerHTML = `<p class="muted small">${cfg.emptyEsteiraMsg}</p>`;
    destroyDashChartTempoSetorResumo(cfg);
    if (hintEl) hintEl.textContent = "Sem dados para resumir.";
    return;
  }

  const agg = aggregateTempoEsteira(rows, cfg);
  const { itemsAll, itemsChart } = buildTempoSetorResumoItems(agg.bySetor, cfg.setores, agg.bySetorCount);
  const filtroAtivo = dashTempoFiltroAtivo(cfg);
  const resp = document.getElementById(cfg.ids.filterResp)?.value || "";

  if (hintEl) {
    let hint = filtroAtivo
      ? `${rows.length} projeto(s) no filtro atual.`
      : `Visão geral — ${rows.length} projeto(s) na ${cfg.esteiraLabel}.`;
    if (resp === FILTER_PROJETISTA_TODOS) hint += " Todos os projetistas.";
    else if (filtroAtivo && resp) hint += ` Projetista: ${resp}.`;
    else if (!filtroAtivo) hint += " Aplique filtros abaixo para refinar os gráficos detalhados.";
    hintEl.textContent = hint;
  }

  let body = "";
  for (const it of itemsAll) {
    body +=
      "<tr><td>" +
      setorBadgeHtml(it.setor) +
      "</td><td><strong>" +
      (it.ms ? formatDur(it.ms) : "—") +
      "</strong></td><td>" +
      (it.ms ? it.pct + "%" : "—") +
      "</td><td>" +
      (it.avgCount ? it.avgDays + " d" : "—") +
      "</td></tr>";
  }
  tableEl.innerHTML =
    '<table class="dash-table dash-table--setor-resumo"><thead><tr><th>Setor</th><th>Tempo acumulado</th><th>% do total</th><th>Média de dias</th></tr></thead><tbody>' +
    body +
    "</tbody></table>";

  if (itemsChart.length) makeDashChartTempoSetorResumo(itemsChart, cfg);
  else destroyDashChartTempoSetorResumo(cfg);
}

function chartTooltipDur(ctx, msArr) {
  const i = ctx.dataIndex;
  const ms = msArr?.[i];
  if (ms == null) return `${ctx.dataset.label || ""}: ${ctx.formattedValue} dia(s)`;
  return `${ctx.label}: ${formatDur(ms)} (${msToChartDays(ms)} d)`;
}

function makeDashChartTempoFase(canvasId, faseKeys, msPerFase, cfg = DASH_TEMPO_CFG_OP) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  const labels = faseKeys.map((k) => labelStatus(k, cfg.linhaEsteira || LINHA_ESTEIRA_OPERACIONAL));
  const colors = faseKeys.map((k) => setorColorFor(cfg.setorForStatus(k), cfg));
  const dataDays = msPerFase.map(msToChartDays);
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tempo médio",
          data: dataDays,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => chartTooltipDur(ctx, msPerFase) },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Dias (média)", color: "#94a3b8", font: { size: 11 } },
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
        y: { ticks: { color: "#cbd5e1", font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

function makeDashChartTempoSetor(canvasId, setores, msPerSetor, cfg = DASH_TEMPO_CFG_OP) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  const colors = setores.map((s) => setorColorFor(s, cfg));
  dashCharts[canvasId] = new Chart(el, {
    type: "doughnut",
    data: {
      labels: setores,
      datasets: [
        {
          data: msPerSetor.map(msToChartDays),
          backgroundColor: colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#cbd5e1", boxWidth: 12 } },
        tooltip: {
          callbacks: { label: (ctx) => chartTooltipDur(ctx, msPerSetor) },
        },
      },
    },
  });
}

function makeDashChartTempoSetorStack(canvasId, projectLabels, setorSeries, msMatrix, setores = SETORES_ESTEIRA, cfg = DASH_TEMPO_CFG_OP) {
  if (typeof Chart === "undefined") return;
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (dashCharts[canvasId]) {
    dashCharts[canvasId].destroy();
    delete dashCharts[canvasId];
  }
  const datasets = setores.map((setor, si) => ({
    label: setor,
    data: setorSeries[setor],
    backgroundColor: setorColorFor(setor, cfg),
    borderWidth: 0,
    _msRow: msMatrix[si],
  }));
  dashCharts[canvasId] = new Chart(el, {
    type: "bar",
    data: { labels: projectLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "#cbd5e1", boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const ms = ctx.dataset._msRow?.[ctx.dataIndex] || 0;
              if (!ms) return null;
              return `${ctx.dataset.label}: ${formatDur(ms)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 0, font: { size: 10 } },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: "Dias", color: "#94a3b8", font: { size: 11 } },
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(148,163,184,0.12)" },
        },
      },
    },
  });
}

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parsePeriodoFromDate(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

function demandaPeriodo(d) {
  return parsePeriodoFromDate(d.dataChegada || (d.createdAt || "").slice(0, 10));
}

/** Data em que o projeto entrou em Conclusão / Projeto Final (histórico ou atualização). */
function demandaDataConclusao(d) {
  const dm = migrateDemanda(d);
  if (!isStatusConcluidoDemanda(dm)) return "";
  const hist = dm.historicoStatus || [];
  const seg = hist.find((s) => s.status === dm.status);
  if (seg?.inicio) return seg.inicio.slice(0, 10);
  if (seg?.fim) return seg.fim.slice(0, 10);
  return (dm.updatedAt || "").slice(0, 10);
}

function demandaConclusaoPeriodo(d) {
  return parsePeriodoFromDate(demandaDataConclusao(d));
}

function demandaTerminoPeriodo(d) {
  return parsePeriodoFromDate(demandaDataTermino(d));
}

function formatDataISO(raw) {
  if (!raw) return "—";
  const parts = raw.split("-");
  if (parts.length < 3) return raw;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function collectAnosChegadaConclusao(demandas) {
  const years = new Set();
  demandas.forEach((d) => {
    const pc = demandaPeriodo(d);
    const pf = demandaConclusaoPeriodo(d);
    if (pc) years.add(pc.year);
    if (pf) years.add(pf.year);
  });
  return [...years].sort((a, b) => b - a);
}

function emptyMesesMap() {
  const m = {};
  for (let i = 1; i <= 12; i++) m[i] = { chegadas: 0, finalizacoes: 0 };
  return m;
}

function buildResumoAno(demandas, ano) {
  const meses = emptyMesesMap();
  let totalChegadas = 0;
  let totalFinalizacoes = 0;
  for (const d of demandas) {
    const pc = demandaPeriodo(d);
    if (pc && pc.year === ano) {
      meses[pc.month].chegadas += 1;
      totalChegadas += 1;
    }
    const pf = demandaConclusaoPeriodo(d);
    if (pf && pf.year === ano) {
      meses[pf.month].finalizacoes += 1;
      totalFinalizacoes += 1;
    }
  }
  return { meses, totalChegadas, totalFinalizacoes };
}

function projetosNoPeriodo(demandas, ano, mes) {
  const out = [];
  for (const d of demandas) {
    const pc = demandaPeriodo(d);
    const pf = demandaConclusaoPeriodo(d);
    const chegou = pc && pc.year === ano && (!mes || pc.month === mes);
    const finalizou = pf && pf.year === ano && (!mes || pf.month === mes);
    if (chegou || finalizou) {
      out.push({
        d,
        chegou: !!chegou,
        finalizou: !!finalizou,
        dataChegada: d.dataChegada || "",
        dataConclusao: demandaDataConclusao(d),
      });
    }
  }
  return out.sort((a, b) => {
    const ka = periodoSortKey(a.d);
    const kb = periodoSortKey(b.d);
    if (ka !== kb) return kb.localeCompare(ka);
    return a.d.titulo.localeCompare(b.d.titulo);
  });
}

function populateDashCfFilters() {
  const selAno = document.getElementById("filterDashCfAno");
  const selMes = document.getElementById("filterDashCfMes");
  if (!selAno) return;

  const todas = demandasDashOperacionalList();
  const years = collectAnosChegadaConclusao(todas);
  const savedAno = selAno.value;
  const savedMes = selMes?.value || "";

  const yOpts =
    years.length > 0
      ? years.map((y) => `<option value="${y}">${y}</option>`).join("")
      : `<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;
  selAno.innerHTML = yOpts;

  const pick =
    savedAno && years.some((y) => String(y) === savedAno)
      ? savedAno
      : String(years[0] || new Date().getFullYear());
  selAno.value = pick;

  if (selMes) {
    const mesOpts =
      '<option value="">Todos os meses</option>' +
      MESES_PT.map((lab, i) => {
        const v = String(i + 1).padStart(2, "0");
        return `<option value="${v}">${lab}</option>`;
      }).join("");
    selMes.innerHTML = mesOpts;
    if (savedMes) selMes.value = savedMes;
  }
}

function renderDashChegadasFinalizacoes() {
  populateDashCfFilters();
  const selAno = document.getElementById("filterDashCfAno");
  const selMes = document.getElementById("filterDashCfMes");
  const kpiEl = document.getElementById("dashCfKpis");
  const resumoWrap = document.getElementById("dashCfResumoTable");
  const resumoCount = document.getElementById("dashCfResumoCount");
  if (!selAno || !kpiEl || !resumoWrap) return;

  const ano = Number(selAno.value) || new Date().getFullYear();
  const mesVal = selMes?.value || "";
  const mes = mesVal ? Number(mesVal) : null;
  const todas = demandasDashOperacionalList();
  const { meses, totalChegadas, totalFinalizacoes } = buildResumoAno(todas, ano);

  const emAndamento = todas.filter((d) => {
    const pc = demandaPeriodo(d);
    return pc && pc.year === ano && d.status !== "conclusao" && d.status !== "reprovado";
  }).length;

  if (mes) {
    kpiEl.innerHTML =
      kpiCard("Chegadas no mês", meses[mes].chegadas, "ok") +
      kpiCard("Finalizações no mês", meses[mes].finalizacoes, "ok") +
      kpiCard(
        "Taxa no mês",
        meses[mes].chegadas ? Math.round((meses[mes].finalizacoes / meses[mes].chegadas) * 100) + "%" : "—",
        "ok",
      );
  } else {
    kpiEl.innerHTML =
      kpiCard("Chegadas no ano", totalChegadas, "ok") +
      kpiCard("Finalizações no ano", totalFinalizacoes, "ok") +
      kpiCard("Ativas (chegaram no ano)", emAndamento, emAndamento ? "warn" : "ok") +
      kpiCard(
        "Taxa conclusão no ano",
        totalChegadas ? Math.round((totalFinalizacoes / totalChegadas) * 100) + "%" : "—",
        "ok",
      );
  }

  const labels = [];
  const dataCheg = [];
  const dataFin = [];
  let body = "";
  for (let m = 1; m <= 12; m++) {
    const lab = MESES_PT[m - 1];
    labels.push(lab.slice(0, 3));
    dataCheg.push(meses[m].chegadas);
    dataFin.push(meses[m].finalizacoes);
    if (!mes || mes === m) {
      body +=
        "<tr><td>" +
        escapeHtml(lab + " / " + ano) +
        "</td><td>" +
        meses[m].chegadas +
        "</td><td>" +
        meses[m].finalizacoes +
        "</td></tr>";
    }
  }
  body +=
    '<tr class="dash-cf-total-row"><td>Total ' +
    ano +
    "</td><td>" +
    totalChegadas +
    "</td><td>" +
    totalFinalizacoes +
    "</td></tr>";

  if (resumoCount) {
    resumoCount.textContent = mes
      ? `Resumo de ${MESES_PT[mes - 1]} de ${ano}.`
      : `Resumo mensal de ${ano} (${totalChegadas} chegadas, ${totalFinalizacoes} finalizações).`;
  }
  resumoWrap.innerHTML =
    '<table class="dash-table"><thead><tr><th>Período</th><th>Chegadas</th><th>Finalizações</th></tr></thead><tbody>' +
    body +
    "</tbody></table>";

  makeDashChartChegadasFin(labels, dataCheg, dataFin);

  renderDashCfDetalheTable();
}

function initDashCfDetalheFilters() {
  const sel = document.getElementById("filterDashCfStatus");
  if (!sel || sel.dataset.ready) return;
  for (const [k, lab] of [...STATUS_ORDER, ...STATUS_EXTRA]) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = lab;
    sel.appendChild(o);
  }
  sel.dataset.ready = "1";
}

function dashCfDetalheFiltroAtivo() {
  const busca = (document.getElementById("filterDashCfBusca")?.value || "").trim();
  const resp = document.getElementById("filterDashCfResp")?.value || "";
  const status = document.getElementById("filterDashCfStatus")?.value || "";
  const evento = document.getElementById("filterDashCfEvento")?.value || "";
  const mes = document.getElementById("filterDashCfMes")?.value || "";
  return !!(busca || resp || status || evento || mes);
}

function filterDashCfDetalheRows(rows) {
  const busca = (document.getElementById("filterDashCfBusca")?.value || "").trim().toLowerCase();
  const resp = document.getElementById("filterDashCfResp")?.value || "";
  const status = document.getElementById("filterDashCfStatus")?.value || "";
  const evento = document.getElementById("filterDashCfEvento")?.value || "";

  return rows.filter((row) => {
    if (busca) {
      const hay = `${row.d.titulo} ${row.d.cidade || ""} ${row.d.solicitante || ""}`.toLowerCase();
      if (!hay.includes(busca)) return false;
    }
    if (!matchFilterProjetista(row.d, resp)) return false;
    if (status && row.d.status !== status) return false;
    if (evento === "chegada" && !row.chegou) return false;
    if (evento === "conclusao" && !row.finalizou) return false;
    return true;
  });
}

function renderDashCfDetalheTable() {
  const detWrap = document.getElementById("dashCfDetalheTable");
  const detCount = document.getElementById("dashCfDetalheCount");
  if (!detWrap) return;
  initDashCfDetalheFilters();

  const selAno = document.getElementById("filterDashCfAno");
  if (!selAno?.value) {
    if (detCount) detCount.textContent = "";
    detWrap.innerHTML = '<p class="muted">Selecione o ano no filtro acima.</p>';
    return;
  }

  const ano = Number(selAno.value);
  const mesVal = document.getElementById("filterDashCfMes")?.value || "";
  const mes = mesVal ? Number(mesVal) : null;
  const todas = demandasDashOperacionalList();
  const candidatos = projetosNoPeriodo(todas, ano, mes);

  if (!dashCfDetalheFiltroAtivo()) {
    if (detCount) {
      detCount.textContent = `${candidatos.length} projeto(s) no ano${mes ? `/${MESES_PT[mes - 1]}` : ""} — aplique um filtro para listar.`;
    }
    detWrap.innerHTML =
      '<p class="muted dash-tempo-hint">Use <strong>busca</strong>, <strong>mês</strong>, <strong>projetista</strong>, <strong>status</strong> ou <strong>evento</strong> para carregar a tabela.</p>';
    return;
  }

  const detalhes = filterDashCfDetalheRows(candidatos);
  if (detCount) {
    detCount.textContent = `Exibindo ${detalhes.length} de ${candidatos.length} projeto(s) com os filtros aplicados.`;
  }
  if (!detalhes.length) {
    detWrap.innerHTML = '<p class="muted">Nenhum projeto encontrado com os filtros atuais.</p>';
    return;
  }
  let detBody = "";
  for (const row of detalhes) {
    const tags =
      (row.chegou ? '<span class="dash-cf-badge dash-cf-badge--chegada">Chegada</span>' : "") +
      (row.finalizou ? '<span class="dash-cf-badge dash-cf-badge--fim">Conclusão</span>' : "");
    detBody +=
      "<tr><td>" +
      escapeHtml(row.d.titulo) +
      "</td><td>" +
      tags +
      "</td><td>" +
      formatDataISO(row.dataChegada) +
      "</td><td>" +
      formatDataISO(row.dataConclusao) +
      "</td><td>" +
      escapeHtml(labelProjetista(row.d.responsavel)) +
      "</td><td>" +
      escapeHtml(STATUS_LABEL[row.d.status] || row.d.status) +
      "</td></tr>";
  }
  detWrap.innerHTML =
    '<table class="dash-table"><thead><tr><th>Projeto</th><th>No período</th><th>Data chegada</th><th>Data conclusão</th><th>Projetista</th><th>Status</th></tr></thead><tbody>' +
    detBody +
    "</tbody></table>";
}

function periodoSortKey(d) {
  const p = demandaPeriodo(d);
  if (!p) return "0000-00";
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

function labelPeriodoGrupo(d) {
  const p = demandaPeriodo(d);
  if (!p) return "Sem data de chegada";
  return `${MESES_PT[p.month - 1] || p.month} de ${p.year}`;
}

function formatDataChegada(d) {
  const raw = d.dataChegada || "";
  if (!raw) return "—";
  const parts = raw.split("-");
  if (parts.length < 3) return raw;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function initDashTempoFilters(cfg = DASH_TEMPO_CFG_OP) {
  const sel = document.getElementById(cfg.ids.filterStatus);
  if (!sel) return;
  const saved = sel.value;
  sel.innerHTML = '<option value="">Selecione…</option>';
  for (const k of cfg.filtroStatusOpcoes) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = labelStatus(k, cfg.linhaEsteira || LINHA_ESTEIRA_OPERACIONAL);
    sel.appendChild(o);
  }
  if (saved === "novo" || saved === "pre_vendas") sel.value = "";
  if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
  sel.dataset.ready = "1";
}

function populateDashTempoAnoMes(cfg = DASH_TEMPO_CFG_OP) {
  const selAno = document.getElementById(cfg.ids.filterAno);
  const selMes = document.getElementById(cfg.ids.filterMes);
  if (!selAno) return;
  const savedAno = selAno.value;
  const savedMes = selMes?.value || "";
  const years = new Set();
  cfg.listFn().forEach((d) => {
    const p = demandaPeriodo(d);
    if (p) years.add(p.year);
  });
  const sorted = [...years].sort((a, b) => b - a);
  selAno.innerHTML =
    '<option value="">Selecione…</option>' +
    sorted.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (savedAno && sorted.some((y) => String(y) === savedAno)) selAno.value = savedAno;

  if (selMes) {
    selMes.innerHTML =
      '<option value="">Selecione…</option>' +
      MESES_PT.map((lab, i) => {
        const v = String(i + 1).padStart(2, "0");
        return `<option value="${v}">${lab}</option>`;
      }).join("");
    if (savedMes) selMes.value = savedMes;
  }
}

function dashTempoFiltroAtivo(cfg = DASH_TEMPO_CFG_OP) {
  const busca = (document.getElementById(cfg.ids.filterBusca)?.value || "").trim();
  const resp = document.getElementById(cfg.ids.filterResp)?.value || "";
  const status = document.getElementById(cfg.ids.filterStatus)?.value || "";
  const ano = document.getElementById(cfg.ids.filterAno)?.value || "";
  const mes = document.getElementById(cfg.ids.filterMes)?.value || "";
  return !!(busca || resp || status || ano || mes);
}

function filterDashTempoRows(rows, cfg = DASH_TEMPO_CFG_OP) {
  const busca = (document.getElementById(cfg.ids.filterBusca)?.value || "").trim().toLowerCase();
  const resp = document.getElementById(cfg.ids.filterResp)?.value || "";
  const status = document.getElementById(cfg.ids.filterStatus)?.value || "";
  const ano = document.getElementById(cfg.ids.filterAno)?.value || "";
  const mes = document.getElementById(cfg.ids.filterMes)?.value || "";
  return rows.filter(({ d }) => {
    if (busca) {
      const hay = `${d.titulo} ${d.cidade || ""} ${d.solicitante || ""}`.toLowerCase();
      if (!hay.includes(busca)) return false;
    }
    if (!matchFilterProjetista(d, resp)) return false;
    if (status && d.status !== status) return false;
    const p = demandaPeriodo(d);
    if (ano && (!p || p.year !== Number(ano))) return false;
    if (mes && (!p || p.month !== Number(mes))) return false;
    return true;
  });
}

function renderDashTempoAnalytics(rows, cfg = DASH_TEMPO_CFG_OP) {
  const chartsWrap = document.getElementById(cfg.ids.chartsWrap);
  const kpiEl = document.getElementById(cfg.ids.kpis);
  if (!chartsWrap) return;

  destroyDashTempoCharts(cfg);

  if (!rows.length) {
    chartsWrap.hidden = true;
    if (kpiEl) kpiEl.innerHTML = "";
    return;
  }

  const agg = aggregateTempoEsteira(rows, cfg);
  chartsWrap.hidden = false;

  const faseOrder = cfg.fasesOrder.filter((k) => agg.byFase[k] > 0);
  const faseAvgMs = faseOrder.map((k) => {
    const n = agg.byFaseCount[k] || 1;
    return agg.byFase[k] / n;
  });
  if (faseOrder.length) makeDashChartTempoFase(cfg.ids.chartFase, faseOrder, faseAvgMs, cfg);

  const setores = cfg.setores || SETORES_ESTEIRA;
  const setoresComDados = setores.filter((s) => agg.bySetor[s] > 0);
  if (setoresComDados.length) {
    makeDashChartTempoSetor(
      cfg.ids.chartSetor,
      setoresComDados,
      setoresComDados.map((s) => agg.bySetor[s]),
      cfg,
    );
  }

  const topN = 10;
  const sorted = [...rows].sort((a, b) => b.ms - a.ms).slice(0, topN);
  const labels = sorted.map(({ d }) => {
    const t = (d.titulo || "—").trim();
    return t.length > 28 ? t.slice(0, 28) + "…" : t;
  });
  const setorSeries = Object.fromEntries(setores.map((s) => [s, []]));
  const msMatrix = setores.map(() => []);
  for (const { d } of sorted) {
    const porFase = demandaTempoPorFase(d, cfg);
    setores.forEach((setor, si) => {
      let ms = 0;
      for (const [status, segMs] of Object.entries(porFase)) {
        if (cfg.setorForStatus(status) === setor) ms += segMs;
      }
      setorSeries[setor].push(msToChartDays(ms));
      msMatrix[si].push(ms);
    });
  }
  if (labels.length) makeDashChartTempoSetorStack(cfg.ids.chartStack, labels, setorSeries, msMatrix, setores, cfg);

  const mediaTotal = agg.n ? agg.totalMs / agg.n : 0;
  const setorLider = setores.reduce(
    (best, s) => (agg.bySetor[s] > (agg.bySetor[best] || 0) ? s : best),
    setores[0],
  );
  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("Projetos no filtro", agg.n, "ok") +
      kpiCard("Tempo médio total", formatDur(mediaTotal), "ok") +
      kpiCard("Setor com mais tempo", agg.bySetor[setorLider] ? setorLider : "—", "warn") +
      kpiCard("Tempo no setor líder", formatDur(agg.bySetor[setorLider] || 0), "ok");
  }
}

function renderDashTempoPanel(cfg) {
  const countEl = document.getElementById(cfg.ids.count);
  renderDashTempoSetorMap(cfg);
  initDashTempoFilters(cfg);
  populateDashTempoAnoMes(cfg);

  const allRows = cfg.listFn().map((d) => ({ d }));
  const rowsResumo = dashTempoFiltroAtivo(cfg) ? filterDashTempoRows(allRows, cfg) : allRows;
  renderDashTempoSetorResumo(rowsResumo, cfg);

  if (!allRows.length) {
    if (countEl) countEl.textContent = "Nenhuma demanda na esteira.";
    destroyDashTempoCharts(cfg);
    renderDashTempoAnalytics([], cfg);
    return;
  }

  if (!dashTempoFiltroAtivo(cfg)) {
    if (countEl) {
      countEl.textContent = `${allRows.length} projeto(s) cadastrado(s) — resumo ao lado atualizado; aplique um filtro para os gráficos detalhados.`;
    }
    destroyDashTempoCharts(cfg);
    renderDashTempoAnalytics([], cfg);
    return;
  }

  const rows = filterDashTempoRows(allRows, cfg);
  renderDashTempoSetorResumo(rows, cfg);
  renderDashTempoAnalytics(rows, cfg);
  if (countEl) {
    const resp = document.getElementById(cfg.ids.filterResp)?.value || "";
    const visao =
      resp === FILTER_PROJETISTA_TODOS ? " — visão geral (todos os projetistas)" : "";
    countEl.textContent = rows.length
      ? `Gráficos com ${rows.length} de ${allRows.length} projeto(s) no filtro${visao}.`
      : "Nenhum projeto encontrado com os filtros atuais.";
  }
}

function renderDashTempoTable() {
  renderDashTempoPanel(DASH_TEMPO_CFG_OP);
}

function renderDashTempoB2bTable() {
  renderDashTempoPanel(DASH_TEMPO_CFG_B2B);
}

function populateDashAtrasoAnoMes() {
  const selAno = document.getElementById("filterDashAtrasoAno");
  const selMes = document.getElementById("filterDashAtrasoMes");
  if (!selAno) return;
  const savedAno = selAno.value;
  const savedMes = selMes?.value || "";
  const years = new Set();
  demandasDashOperacionalList().forEach((d) => {
    const row = demandaEntregaAtraso(d);
    if (!row) return;
    const p = demandaTerminoPeriodo(row.d);
    if (p) years.add(p.year);
  });
  const sorted = [...years].sort((a, b) => b - a);
  selAno.innerHTML =
    '<option value="">Selecione…</option>' +
    sorted.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (savedAno && sorted.some((y) => String(y) === savedAno)) selAno.value = savedAno;

  if (selMes) {
    selMes.innerHTML =
      '<option value="">Selecione…</option>' +
      MESES_PT.map((lab, i) => {
        const v = String(i + 1).padStart(2, "0");
        return `<option value="${v}">${lab}</option>`;
      }).join("");
    if (savedMes) selMes.value = savedMes;
  }
}

function dashAtrasoFiltroAtivo() {
  const busca = (document.getElementById("filterDashAtrasoBusca")?.value || "").trim();
  const resp = document.getElementById("filterDashAtrasoResp")?.value || "";
  const ano = document.getElementById("filterDashAtrasoAno")?.value || "";
  const mes = document.getElementById("filterDashAtrasoMes")?.value || "";
  return !!(busca || resp || ano || mes);
}

function filterDashAtrasoRows(rows) {
  const busca = (document.getElementById("filterDashAtrasoBusca")?.value || "").trim().toLowerCase();
  const resp = document.getElementById("filterDashAtrasoResp")?.value || "";
  const ano = document.getElementById("filterDashAtrasoAno")?.value || "";
  const mes = document.getElementById("filterDashAtrasoMes")?.value || "";
  return rows.filter((row) => {
    const { d } = row;
    if (busca) {
      const hay = `${d.titulo} ${d.cidade || ""} ${d.solicitante || ""}`.toLowerCase();
      if (!hay.includes(busca)) return false;
    }
    if (!matchFilterProjetista(d, resp)) return false;
    const p = demandaTerminoPeriodo(d);
    if (ano && (!p || p.year !== Number(ano))) return false;
    if (mes && (!p || p.month !== Number(mes))) return false;
    return true;
  });
}

function renderDashEntregaAtraso() {
  const kpiEl = document.getElementById("dashAtrasoKpis");
  const wrap = document.getElementById("dashAtrasoTable");
  const countEl = document.getElementById("dashAtrasoCount");
  if (!wrap) return;
  populateDashAtrasoAnoMes();

  const allRows = demandasDashOperacionalList().map(demandaEntregaAtraso).filter(Boolean);

  if (!allRows.length) {
    if (kpiEl) kpiEl.innerHTML = kpiCard("Entregas com atraso", 0, "ok");
    if (countEl) countEl.textContent = "";
    wrap.innerHTML = '<p class="muted">Nenhum projeto concluído após o prazo previsto (com data de entrega e conclusão preenchidas).</p>';
    return;
  }

  if (!dashAtrasoFiltroAtivo()) {
    if (kpiEl) {
      kpiEl.innerHTML =
        kpiCard("Total com atraso na entrega", allRows.length, allRows.length ? "bad" : "ok") +
        kpiCard("Média de dias (todos)", Math.round(allRows.reduce((s, r) => s + r.diasAtraso, 0) / allRows.length), "warn");
    }
    if (countEl) {
      countEl.textContent = `${allRows.length} entrega(s) com atraso cadastrada(s) — aplique um filtro para listar.`;
    }
    wrap.innerHTML =
      '<p class="muted dash-tempo-hint">Projetos em <strong>Conclusão</strong> cuja <strong>data de conclusão</strong> passou do <strong>prazo previsto</strong>. Selecione <strong>ano</strong>, <strong>mês</strong>, <strong>projetista</strong> ou use a <strong>busca</strong>.</p>';
    return;
  }

  const rows = filterDashAtrasoRows(allRows);
  const mediaDias = rows.length ? Math.round(rows.reduce((s, r) => s + r.diasAtraso, 0) / rows.length) : 0;
  const maxDias = rows.length ? Math.max(...rows.map((r) => r.diasAtraso)) : 0;

  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("No filtro", rows.length, rows.length ? "bad" : "ok") +
      kpiCard("Média dias de atraso", rows.length ? mediaDias : "—", rows.length ? "warn" : "ok") +
      kpiCard("Maior atraso", rows.length ? maxDias + " dia(s)" : "—", rows.length ? "bad" : "ok");
  }
  if (countEl) {
    countEl.textContent = `Exibindo ${rows.length} de ${allRows.length} entrega(s) com atraso.`;
  }

  if (!rows.length) {
    wrap.innerHTML = '<p class="muted">Nenhum projeto encontrado com os filtros atuais.</p>';
    return;
  }

  const sorted = [...rows].sort((a, b) => {
    const da = parseDate(a.dataTermino) || 0;
    const db = parseDate(b.dataTermino) || 0;
    if (db !== da) return db - da;
    return b.diasAtraso - a.diasAtraso;
  });

  let body = "";
  for (const row of sorted) {
    body +=
      "<tr><td>" +
      escapeHtml(row.d.titulo) +
      "</td><td>" +
      formatDataISO(row.dataPrevista) +
      "</td><td>" +
      formatDataISO(row.dataTermino) +
      '</td><td><span class="dash-atraso-dias">' +
      row.diasAtraso +
      " dia(s)</span></td><td>" +
      escapeHtml(labelProjetista(row.d.responsavel)) +
      "</td><td>" +
      escapeHtml(row.d.cidade || "—") +
      "</td></tr>";
  }
  wrap.innerHTML =
    '<table class="dash-table"><thead><tr><th>Projeto</th><th>Prazo previsto</th><th>Data término</th><th>Atraso</th><th>Projetista</th><th>Cidade</th></tr></thead><tbody>' +
    body +
    "</tbody></table>";
}

function renderDashboard() {
  initDashBlocks();
  destroyDashboardCharts();
  const todas = demandasDashOperacionalList();
  const g = countDemandas(todas);
  const semDir = todas.filter((d) => normalizeResponsavel(d.responsavel) === "").length;
  const portasNovasGeral = sumPortasDashboard(todas);
  const metragemGeral = sumMetragemDashboard(todas);

  renderDashValoresFinanceirosKpis(todas);

  document.getElementById("kpiGeral").innerHTML =
    kpiCard("Total cadastradas", g.total, "ok") +
    kpiCard("Não atribuídas", semDir, semDir ? "warn" : "ok") +
    kpiCard("Ativas", g.ativas, "ok") +
    kpiCard("Pausadas", g.pausadas, g.pausadas ? "warn" : "ok") +
    kpiCard("Concluídas", g.concluidas, "ok") +
    kpiCard("Reprovadas", g.reprovadas, "warn") +
    kpiCard("Em atraso", g.atraso, g.atraso ? "bad" : "ok") +
    kpiCard("Portas novas", formatQtd(portasNovasGeral), portasNovasGeral ? "ok" : "warn") +
    kpiCard("Metragem lançamento", formatMetros(metragemGeral), "ok");

  if (isDashBlockVisible("graficos")) {
    const todasGraficos = todas;
    const todasModoValor = filterDemandasModoDash(todas);
    const statusData = countByStatus(todasGraficos);
    makeDashChart("chartStatus", "doughnut", statusData.map((s) => s.label), statusData.map((s) => s.n));

    const tipoData = countByTipo(todasGraficos);
    makeDashChart(
      "chartTipo",
      "doughnut",
      tipoData.map((t) => t.label),
      tipoData.map((t) => t.n),
      { colors: tipoData.map((t) => TIPO_CHART_COLORS[t.label] || "#94a3b8") },
    );

    renderDashTipoProjetosCharts(todasGraficos, todasModoValor);
    renderDashProjetistaTipoStatusCharts(todasGraficos);
  }

  const valorModoLabel = labelValorDashModo();
  let html = "";
  for (const nome of PROJETISTAS) {
    const s = statsProjetista(nome);
    html += '<div class="kpi dash-pj-card"><div class="kpi__label dash-pj-card__nome">' + escapeHtml(nome) + '</div><div class="dash-pj-grid kpi-grid">' +
      kpiCard("Total cadastradas", s.total, "ok") +
      kpiCard("Não atribuídas", 0, "ok") +
      kpiCard("Ativas", s.ativas, "ok") +
      kpiCard("Pausadas", s.pausadas, s.pausadas ? "warn" : "ok") +
      kpiCard("Concluídas", s.concluidas, "ok") +
      kpiCard("Reprovadas", s.reprovadas, s.reprovadas ? "warn" : "ok") +
      kpiCard("Em atraso", s.atraso, s.atraso ? "bad" : "ok") +
      kpiCard(valorModoLabel, formatBRL(s.valorTotal), s.valorTotal ? "ok" : "warn") +
      kpiCard("Portas novas", formatQtd(s.portasNovasTotal), s.portasNovasTotal ? "ok" : "warn") +
      kpiCard("Metragem lançamento", formatMetros(s.metragemTotal), s.metragemTotal ? "ok" : "warn") +
      '</div></div>';
  }
  document.getElementById("kpiProjetistas").innerHTML = html;
  if (isDashBlockVisible("cidades")) renderDashCidades();
  if (isDashBlockVisible("chegadas-fin")) {
    renderDashChegadasFinalizacoes();
  }
  if (isDashBlockVisible("entrega-atraso")) renderDashEntregaAtraso();
  if (isDashBlockVisible("tempo")) renderDashTempoTable();
  if (isDashBlockVisible("solicitantes")) renderDashSolicitantes();
  if (isDashBlockVisible("projetado-executado")) renderDashProjetadoExecutado();
  if (isDashBlockVisible("indicadores-b2c")) renderDashIndicadoresB2c();
  if (isDashBlockVisible("indicadores-b2b")) renderDashIndicadoresB2b();
}

function countByStatusForList(list, linha = LINHA_ESTEIRA_OPERACIONAL) {
  const cfg = getEsteiraConfig(linha);
  const counts = {};
  for (const [k, lab] of [...cfg.statusOrder, ...cfg.statusExtra]) counts[k] = { label: lab, n: 0 };
  list.forEach((d) => {
    if (counts[d.status]) counts[d.status].n += 1;
  });
  return Object.values(counts).filter((v) => v.n > 0);
}

function renderDashIndicadoresB2c() {
  const list = demandasB2cDashboardList();
  const listModo = filterDemandasModoDash(list);
  const g = countDemandas(list);
  const semDir = list.filter((d) => normalizeResponsavel(d.responsavel) === "").length;
  const valorModoLabel = labelValorDashModo();
  const valor = sumValorDashboard(list);
  const portas = sumPortasDashboard(list);
  const metragem = sumMetragemDashboard(list);
  const rowsCidade = buildStatsPorCidade(listModo);
  const rowsRegional = buildStatsPorRegional(listModo);

  const kpiEl = document.getElementById("kpiB2c");
  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("Total B2C", g.total, "ok") +
      kpiCard("Regionais", rowsRegional.length, "ok") +
      kpiCard("Cidades", rowsCidade.length, "ok") +
      kpiCard(valorModoLabel, formatBRL(valor), valor ? "ok" : "warn") +
      kpiCard("Portas novas", formatQtd(portas), portas ? "ok" : "warn") +
      kpiCard("Metragem lanç.", formatMetros(metragem), metragem ? "ok" : "warn") +
      kpiCard("Não atribuídas", semDir, semDir ? "warn" : "ok") +
      kpiCard("Ativas", g.ativas, "ok") +
      kpiCard("Pausadas", g.pausadas, g.pausadas ? "warn" : "ok") +
      kpiCard("Concluídas", g.concluidas, "ok") +
      kpiCard("Em atraso", g.atraso, g.atraso ? "bad" : "ok");
  }

  const countEl = document.getElementById("dashB2cCount");
  if (countEl) {
    const totalOp = demandasDashOperacionalList().length;
    countEl.textContent =
      list.length === 0
        ? "Nenhum projeto tipo B2C na Esteira Projetos."
        : `${list.length} projeto(s) B2C · ${rowsRegional.length} regional(is) · ${rowsCidade.length} cidade(s) · ${totalOp} na Esteira Projetos (sem B2B).`;
  }

  if (!list.length) {
    destroyDashB2cExtraCharts();
    dashCharts.chartB2cSegmento?.destroy();
    delete dashCharts.chartB2cSegmento;
    dashCharts.chartB2cStatus?.destroy();
    delete dashCharts.chartB2cStatus;
    return;
  }

  if (!listModo.length) {
    destroyDashB2cExtraCharts();
    dashCharts.chartB2cSegmento?.destroy();
    delete dashCharts.chartB2cSegmento;
    dashCharts.chartB2cStatus?.destroy();
    delete dashCharts.chartB2cStatus;
    return;
  }

  const segData = countBySegmentoB2c(listModo);
  if (segData.length) {
    makeDashChart(
      "chartB2cSegmento",
      "doughnut",
      segData.map((s) => s.label),
      segData.map((s) => s.n),
      { colors: segData.map((s) => SEGMENTO_B2C_CHART_COLORS[s.label] || "#94a3b8") },
    );
  } else {
    dashCharts.chartB2cSegmento?.destroy();
    delete dashCharts.chartB2cSegmento;
  }

  const statusData = countByStatusForList(listModo, LINHA_ESTEIRA_OPERACIONAL);
  if (statusData.length) {
    makeDashChart(
      "chartB2cStatus",
      "doughnut",
      statusData.map((s) => s.label),
      statusData.map((s) => s.n),
    );
  } else {
    dashCharts.chartB2cStatus?.destroy();
    delete dashCharts.chartB2cStatus;
  }

  renderDashSegmentoB2cPorGrupo(
    "chartB2cSegmentoCidade",
    "dashB2cSegmentoCidadeTable",
    "Cidade",
    listModo,
    rowsCidade,
    (d) => labelCidade(d.cidade),
  );
  renderDashSegmentoB2cPorGrupo(
    "chartB2cSegmentoRegional",
    "dashB2cSegmentoRegionalTable",
    "Regional",
    listModo,
    rowsRegional,
    labelRegionalDemanda,
    rowsRegional.length,
  );

  renderDashSegmentoB2cInvestPorGrupo(
    "chartB2cInvestCidade",
    "dashB2cInvestCidadeTable",
    "Cidade",
    listModo,
    rowsCidade,
    (d) => labelCidade(d.cidade),
  );
  renderDashSegmentoB2cInvestPorGrupo(
    "chartB2cInvestRegional",
    "dashB2cInvestRegionalTable",
    "Regional",
    listModo,
    rowsRegional,
    labelRegionalDemanda,
    rowsRegional.length,
  );

  renderDashB2cMetricasSegmento(listModo);
}

function collectAnosDemandasB2b(demandas = demandasB2bDashboardList()) {
  const years = new Set();
  demandas.forEach((d) => {
    const p = demandaPeriodo(d);
    if (p) years.add(p.year);
  });
  if (!years.size) years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

function populateDashB2bFilters() {
  const selAno = document.getElementById("filterDashB2bAno");
  const selMes = document.getElementById("filterDashB2bMes");
  if (!selAno) return;

  const todas = demandasB2bDashboardList();
  const savedAno = selAno.value;
  const savedMes = selMes?.value || "";
  const years = collectAnosDemandasB2b(todas);

  selAno.innerHTML =
    '<option value="">Todos os anos</option>' +
    years.map((y) => `<option value="${y}">${y}</option>`).join("");
  if (savedAno && [...selAno.options].some((o) => o.value === savedAno)) selAno.value = savedAno;

  if (selMes) {
    selMes.innerHTML =
      '<option value="">Todos os meses</option>' +
      MESES_PT.map((lab, i) => {
        const v = String(i + 1).padStart(2, "0");
        return `<option value="${v}">${lab}</option>`;
      }).join("");
    if (savedMes && [...selMes.options].some((o) => o.value === savedMes)) selMes.value = savedMes;
  }
}

function dashB2bPeriodoFiltroAtivo() {
  const ano = document.getElementById("filterDashB2bAno")?.value || "";
  const mes = document.getElementById("filterDashB2bMes")?.value || "";
  return !!(ano || mes);
}

function filterDemandasDashB2bPeriodo(list) {
  const ano = document.getElementById("filterDashB2bAno")?.value || "";
  const mes = document.getElementById("filterDashB2bMes")?.value || "";
  if (!ano && !mes) return list;
  return list.filter((d) => {
    const p = demandaPeriodo(d);
    if (!p) return false;
    if (ano && p.year !== Number(ano)) return false;
    if (mes && p.month !== Number(mes)) return false;
    return true;
  });
}

function labelDashB2bPeriodoFiltro() {
  const ano = document.getElementById("filterDashB2bAno")?.value || "";
  const mes = document.getElementById("filterDashB2bMes")?.value || "";
  if (!ano && !mes) return "";
  if (ano && mes) return `${MESES_PT[Number(mes) - 1] || mes}/${ano}`;
  if (ano) return String(ano);
  return MESES_PT[Number(mes) - 1] || mes;
}

function renderDashIndicadoresB2b() {
  populateDashB2bFilters();
  const listBase = demandasB2bDashboardList();
  const list = filterDemandasDashB2bPeriodo(listBase);
  const listModo = filterDemandasModoDash(list);
  const b = countB2bIndicadores(list);
  const rowsCidade = buildStatsPorCidade(listModo);
  const rowsRegional = buildStatsPorRegional(listModo);

  const kpiEl = document.getElementById("kpiB2b");
  if (kpiEl) {
    kpiEl.innerHTML =
      kpiCard("Total de projetos", b.total, "ok") +
      kpiCard("Regionais", rowsRegional.length, "ok") +
      kpiCard("Cidades", rowsCidade.length, "ok") +
      kpiCard("Aguardando BP", b.aguardandoBp, b.aguardandoBp ? "warn" : "ok") +
      kpiCard("Aprovados", b.aprovados, b.aprovados ? "ok" : "warn") +
      kpiCard("Exec. Regional", b.execucaoRegional, b.execucaoRegional ? "ok" : "warn") +
      kpiCard("Exec. Terceirizada", b.execucaoTerceirizada, b.execucaoTerceirizada ? "ok" : "warn") +
      kpiCard("Pausados", b.pausados, b.pausados ? "warn" : "ok") +
      kpiCard("Concluído", b.concluido, "ok") +
      kpiCard(labelValorDashModo(), formatBRL(b.valorTotal), b.valorTotal ? "ok" : "warn");
  }

  const countEl = document.getElementById("dashB2bCount");
  if (countEl) {
    const totalOp = demandasDashOperacionalList().length;
    const totalGeral = demandasDashboardList().length;
    const periodo = labelDashB2bPeriodoFiltro();
    if (!listBase.length) {
      countEl.textContent = "Nenhum projeto na esteira B2B cadastrado.";
    } else if (!list.length) {
      countEl.textContent = periodo
        ? `Nenhum projeto B2B com chegada em ${periodo}.`
        : "Nenhum projeto B2B no filtro de período.";
    } else {
      const sufixoPeriodo = periodo ? ` · chegada: ${periodo}` : "";
      countEl.textContent =
        `${list.length} projeto(s) B2B${sufixoPeriodo} · ${rowsRegional.length} regional(is) · ${rowsCidade.length} cidade(s) · ${totalOp} Esteira Projetos · ${totalGeral} no sistema.`;
    }
  }

  if (!listBase.length) {
    destroyDashB2bRegionalCharts();
    destroyDashB2bComercialCharts();
    dashCharts.chartB2bProduto?.destroy();
    delete dashCharts.chartB2bProduto;
    dashCharts.chartB2bStatus?.destroy();
    delete dashCharts.chartB2bStatus;
    renderDashTempoB2bTable();
    return;
  }

  if (!list.length) {
    destroyDashB2bRegionalCharts();
    destroyDashB2bComercialCharts();
    dashCharts.chartB2bProduto?.destroy();
    delete dashCharts.chartB2bProduto;
    dashCharts.chartB2bStatus?.destroy();
    delete dashCharts.chartB2bStatus;
    renderDashTempoB2bTable();
    return;
  }

  if (!listModo.length) {
    destroyDashB2bRegionalCharts();
    dashCharts.chartB2bProduto?.destroy();
    delete dashCharts.chartB2bProduto;
    dashCharts.chartB2bStatus?.destroy();
    delete dashCharts.chartB2bStatus;
    renderDashSolicitanteB2bCharts(list);
    renderDashTempoB2bTable();
    return;
  }

  const prodData = countByProdutoB2b(listModo);
  if (prodData.length) {
    makeDashChart(
      "chartB2bProduto",
      "doughnut",
      prodData.map((s) => s.label),
      prodData.map((s) => s.n),
      { colors: prodData.map((s) => PRODUTO_B2B_CHART_COLORS[s.label] || "#a855f7") },
    );
  } else {
    dashCharts.chartB2bProduto?.destroy();
    delete dashCharts.chartB2bProduto;
  }

  const statusData = countByStatusDashboardB2b(listModo);
  if (statusData.length) {
    makeDashChart(
      "chartB2bStatus",
      "doughnut",
      statusData.map((s) => s.label),
      statusData.map((s) => s.n),
    );
  } else {
    dashCharts.chartB2bStatus?.destroy();
    delete dashCharts.chartB2bStatus;
  }

  const topCidades = rowsCidade.slice(0, 12);
  makeDashChart(
    "chartB2bProjetosCidade",
    "bar",
    topCidades.map((r) => truncateChartLabel(r.cidade, 22)),
    topCidades.map((r) => r.projetos),
    { color: "#a855f7", datasetLabel: "Projetos" },
  );

  makeDashChart(
    "chartB2bProjetosRegional",
    "bar",
    rowsRegional.map((r) => truncateChartLabel(r.cidade, 22)),
    rowsRegional.map((r) => r.projetos),
    { color: "#7c3aed", datasetLabel: "Projetos" },
  );

  renderDashProdutoB2bPorGrupo(
    "chartB2bProdutoCidade",
    "dashB2bProdutoCidadeTable",
    "Cidade",
    listModo,
    rowsCidade,
    (d) => labelCidade(d.cidade),
  );
  renderDashProdutoB2bPorGrupo(
    "chartB2bProdutoRegional",
    "dashB2bProdutoRegionalTable",
    "Regional",
    listModo,
    rowsRegional,
    labelRegionalDemanda,
    rowsRegional.length,
  );

  renderDashSolicitanteB2bCharts(list);

  dashCharts.chartB2bProjetista?.destroy();
  delete dashCharts.chartB2bProjetista;
  dashCharts.chartB2bValor?.destroy();
  delete dashCharts.chartB2bValor;

  renderDashTempoB2bTable();
}


/* ---------- Export / import ---------- */
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function setDropdownMenuOpen(panelId, btnId, open) {
  const panel = document.getElementById(panelId);
  const btn = document.getElementById(btnId);
  if (!panel || !btn) return;
  panel.hidden = !open;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

function setImportMenuOpen(open) {
  setDropdownMenuOpen("importMenuPanel", "btnImportToggle", open);
}

function setExportMenuOpen(open) {
  setDropdownMenuOpen("exportMenuPanel", "btnExportToggle", open);
}

function exportStateJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  downloadBlob(blob, `demandas-backup-${todayISODate()}.json`);
  toast("Exportação JSON gerada");
}

function exportStateCsvFollowUp() {
  if (typeof DemandasCsvImport === "undefined") {
    toast("Módulo csv-import.js não carregou. Recarregue a página.");
    return;
  }
  const list = state.demandas.map(migrateDemanda);
  if (!list.length) {
    toast("Nenhuma demanda para exportar");
    return;
  }
  const csv = DemandasCsvImport.exportFollowUpCsv(list, todayISODate(), {
    isAtraso: (d) => isAtraso(d),
    diasAtraso: (d) => demandaDiasAtraso(d),
    diasAberto: (d) => demandaDiasAberto(d),
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `relatorio-projetos-completo-${todayISODate()}.csv`);
  toast(`${list.length} projeto(s) exportado(s) — relatório completo CSV`);
}

document.getElementById("btnExportToggle")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("exportMenuPanel");
  const willOpen = panel?.hidden !== false;
  setExportMenuOpen(willOpen);
  if (willOpen) setImportMenuOpen(false);
});

document.getElementById("btnExportJson")?.addEventListener("click", () => {
  setExportMenuOpen(false);
  exportStateJson();
});

document.getElementById("btnExportCsv")?.addEventListener("click", () => {
  setExportMenuOpen(false);
  exportStateCsvFollowUp();
});

document.getElementById("btnImportToggle")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("importMenuPanel");
  const willOpen = panel?.hidden !== false;
  setImportMenuOpen(willOpen);
  if (willOpen) setExportMenuOpen(false);
});

document.getElementById("btnImportJson")?.addEventListener("click", () => {
  setImportMenuOpen(false);
  document.getElementById("inputImport")?.click();
});

document.getElementById("btnImportCsvPick")?.addEventListener("click", () => {
  setImportMenuOpen(false);
  document.getElementById("inputImportCsv")?.click();
});

document.addEventListener("click", (e) => {
  const importMenu = document.getElementById("importMenu");
  const exportMenu = document.getElementById("exportMenu");
  const esteiraMenu = document.getElementById("esteiraTabMenu");
  if (!importMenu?.contains(e.target)) setImportMenuOpen(false);
  if (!exportMenu?.contains(e.target)) setExportMenuOpen(false);
  if (!esteiraMenu?.contains(e.target)) setEsteiraTabMenuOpen(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    setImportMenuOpen(false);
    setExportMenuOpen(false);
    setEsteiraTabMenuOpen(false);
  }
});

document.getElementById("inputImport")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  setImportMenuOpen(false);
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    applyLoadedState(data);
    saveState({ importFull: true });
    refreshAllViews();
    toast("Importação concluída");
  } catch {
    toast("Arquivo inválido");
  }
});

/* ---------- Import CSV Follow-up ---------- */
let pendingCsvImport = null;
const modalImportCsv = document.getElementById("modalImportCsv");

function refreshCsvImportPreview() {
  if (!pendingCsvImport) return;
  const mode = document.getElementById("importCsvMode")?.value || "skip";
  const plan = DemandasCsvImport.planImport(
    pendingCsvImport.records,
    state.demandas.map(migrateDemanda),
    mode,
    uid,
    todayISODate,
  );
  pendingCsvImport.plan = plan;

  const sum = document.getElementById("importCsvSummary");
  if (sum) {
    sum.innerHTML =
      `<strong>${pendingCsvImport.records.length}</strong> projeto(s) na planilha → ` +
      `<strong>${plan.novos}</strong> novo(s), <strong>${plan.atualizados}</strong> atualização(ões), ` +
      `<strong>${plan.ignorados}</strong> ignorado(s).`;
  }

  const tbody = document.getElementById("importCsvPreviewBody");
  const more = document.getElementById("importCsvPreviewMore");
  const rows = DemandasCsvImport.previewRows(plan.toApply, 20);
  if (tbody) {
    tbody.innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.titulo)}</td><td>${escapeHtml(r.regional)}</td><td>${escapeHtml(r.csvStatus)}</td>` +
          `<td>${escapeHtml(r.situacao)}</td><td>${escapeHtml(r.linha)}</td><td>${escapeHtml(r.esteira)}</td><td>${escapeHtml(r.responsavel)}</td><td>${escapeHtml(r.acao)}</td></tr>`,
      )
      .join("");
  }
  if (more) {
    const rest = plan.toApply.length - rows.length;
    more.hidden = rest <= 0;
    more.textContent = rest > 0 ? `… e mais ${rest} na importação.` : "";
  }

  const btn = document.getElementById("btnImportCsvConfirm");
  if (btn) btn.disabled = plan.toApply.length === 0;
}

async function openCsvImportModal(file) {
  if (typeof DemandasCsvImport === "undefined") {
    toast("Módulo csv-import.js não carregou. Recarregue a página.");
    return;
  }
  let text;
  try {
    text = await file.text();
  } catch {
    toast("Não foi possível ler o arquivo");
    return;
  }
  const parsed = DemandasCsvImport.parseFile(text);
  if (!parsed.ok) {
    toast(parsed.error || "CSV inválido");
    return;
  }
  pendingCsvImport = { records: parsed.records, fileName: file.name };
  const modeSel = document.getElementById("importCsvMode");
  if (modeSel) modeSel.value = "skip";
  refreshCsvImportPreview();
  modalImportCsv?.showModal();
}

async function confirmCsvImport() {
  if (!pendingCsvImport?.plan?.toApply?.length) {
    toast("Nada para importar com este modo");
    return;
  }
  const btn = document.getElementById("btnImportCsvConfirm");
  if (btn) btn.disabled = true;
  let n = 0;
  for (const { dem } of pendingCsvImport.plan.toApply) {
    const migrated = migrateDemanda(dem);
    const idx = state.demandas.findIndex((x) => x.id === migrated.id);
    if (idx >= 0) state.demandas[idx] = migrated;
    else state.demandas.push(migrated);
    applyCloudPatch({ demanda: migrated });
    n++;
  }
  saveState();
  pendingCsvImport = null;
  modalImportCsv?.close();
  refreshAllViews();
  if (btn) btn.disabled = false;
  toast(`${n} projeto(s) importado(s) da planilha`);
}

document.getElementById("inputImportCsv")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  setImportMenuOpen(false);
  if (file) await openCsvImportModal(file);
});
document.getElementById("importCsvMode")?.addEventListener("change", refreshCsvImportPreview);
document.getElementById("btnImportCsvConfirm")?.addEventListener("click", () => void confirmCsvImport());
document.getElementById("btnImportCsvCancel")?.addEventListener("click", () => {
  pendingCsvImport = null;
  modalImportCsv?.close();
});
document.getElementById("modalImportCsvClose")?.addEventListener("click", () => {
  pendingCsvImport = null;
  modalImportCsv?.close();
});

/* ---------- init ---------- */
["filterDashTempoBusca", "filterDashTempoResp", "filterDashTempoStatus", "filterDashTempoAno", "filterDashTempoMes"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", renderDashTempoTable);
  el.addEventListener("change", renderDashTempoTable);
});
["filterDashTempoB2bBusca", "filterDashTempoB2bResp", "filterDashTempoB2bStatus", "filterDashTempoB2bAno", "filterDashTempoB2bMes"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", renderDashTempoB2bTable);
  el.addEventListener("change", renderDashTempoB2bTable);
});
document.getElementById("filterDashValorModo")?.addEventListener("change", () => {
  renderDashboard();
});
["filterDashB2bAno", "filterDashB2bMes"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    if (isDashBlockVisible("indicadores-b2b")) renderDashIndicadoresB2b();
  });
});
document.getElementById("filterDashCidadesRegional")?.addEventListener("change", () => {
  const base = demandasDashOperacionalList();
  populateDashCidadesFilters(base);
  if (isDashBlockVisible("cidades")) renderDashCidades();
});
document.getElementById("filterDashCidadesCidade")?.addEventListener("change", () => {
  if (isDashBlockVisible("cidades")) renderDashCidades();
});
["filterDashPeResp", "filterDashPeSituacao"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    if (isDashBlockVisible("projetado-executado")) renderDashProjetadoExecutado();
  });
});
["filterDashCfAno", "filterDashCfMes"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("change", () => {
    renderDashChegadasFinalizacoes();
  });
});
["filterDashCfBusca", "filterDashCfResp", "filterDashCfStatus", "filterDashCfEvento"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", renderDashCfDetalheTable);
  el.addEventListener("change", renderDashCfDetalheTable);
});
["filterDashAtrasoBusca", "filterDashAtrasoResp", "filterDashAtrasoAno", "filterDashAtrasoMes"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", renderDashEntregaAtraso);
  el.addEventListener("change", renderDashEntregaAtraso);
});

function hideAppLoader() {
  const loader = document.getElementById("appLoader");
  if (loader) loader.hidden = true;
}

async function bootstrap() {
  setSyncStatus("connecting");
  const loader = document.getElementById("appLoader");
  if (loader) loader.hidden = false;
  persistenceReady = false;

  const localFirst = DemandasFirebase.loadLocal?.();
  if (localFirst?.demandas?.length) {
    applyLoadedState(localFirst);
    refreshAllViews();
  }

  const forceHideLoader = setTimeout(hideAppLoader, 12000);

  try {
    persistenceApi = await DemandasFirebase.init({
      onData(data) {
        applyLoadedState(data);
        refreshAllViews();
      },
      onStatus: setSyncStatus,
    });
    persistenceReady = persistenceApi.mode === "firebase";
    flushPendingCloudSave();
    if (persistenceApi.mode === "firebase") {
      toast("Conectado à nuvem");
    } else {
      toast(window.__demandasSyncHint || "Dados só neste navegador");
    }
  } catch (e) {
    console.error(e);
    setSyncStatus("error");
    const local = DemandasFirebase.loadLocal?.();
    if (local) applyLoadedState(local);
    persistenceReady = false;
    persistenceApi = null;
    appBootstrapped = false;
    toast(window.__demandasSyncHint || e.message || "Erro ao sincronizar — exibindo cópia local se houver");
  } finally {
    clearTimeout(forceHideLoader);
    hideAppLoader();
    refreshAllViews();
    updateEsteiraStatusLine();
    if (persistenceApi?.mode === "firebase") {
      /* emitToUi já chama synced; fallback se ainda vazio */
    } else if (!persistenceApi) {
      setSyncStatus(window.__demandasSyncHint ? "error" : "local");
    }
  }
}

function updateEsteiraStatusLine() {
  const el = document.getElementById("esteiraStatusLine");
  if (!el) return;
  const n = state.demandas.length;
  const linha = activeEsteiraCanal;
  const filtradas = filteredDemandasForEsteira(linha).length;
  const label = linha === LINHA_ESTEIRA_B2B ? "esteira B2B" : "Esteira Projetos";
  el.textContent =
    n === 0
      ? "Nenhuma demanda carregada. Verifique o badge de sync no topo ou importe/migre os dados."
      : `${filtradas} demanda(s) na ${label} · ${n} no total`;
}

(function syncPublicLink() {
  const a = document.getElementById("appPublicLink");
  if (a) {
    a.href = APP_PUBLIC_URL;
    a.textContent = APP_PUBLIC_URL.replace(/^https:\/\//, "");
  }
})();

let brandMigrateClicks = 0;
document.querySelector(".brand h1")?.addEventListener("click", async () => {
  if (!persistenceApi?.migrateLegacyPayload) return;
  brandMigrateClicks += 1;
  if (brandMigrateClicks < 5) return;
  brandMigrateClicks = 0;
  const ok = await confirmDialog({
    title: "Migrar dados legados?",
    message: "Copiar demandas do documento legado (demandasSistema/state) para a coleção «demandas».",
    hint: "Esta operação deve ser feita apenas uma vez.",
    confirmText: "Migrar agora",
    variant: "warn",
  });
  if (!ok) return;
  try {
    toast("Migrando…");
    const res = await persistenceApi.migrateLegacyPayload();
    toast(res.message || `Migradas: ${res.migrated}`);
    if (res.migrated > 0) window.__demandasSyncHint = "";
  } catch (e) {
    console.error(e);
    toast(e.message || "Erro na migração");
  }
});

initDashBlocks();

/* ---------- Login / bootstrap ---------- */
function showLoginScreen() {
  const loginScreen = document.getElementById("loginScreen");
  const appRoot = document.getElementById("appRoot");
  if (loginScreen) loginScreen.hidden = false;
  if (appRoot) appRoot.hidden = true;
  hideAppLoader();
}

function setAuthUi(user) {
  const loginScreen = document.getElementById("loginScreen");
  const appRoot = document.getElementById("appRoot");
  const emailEl = document.getElementById("authUserEmail");
  const btnOut = document.getElementById("btnSignOut");
  if (user) {
    if (loginScreen) loginScreen.hidden = true;
    if (appRoot) appRoot.hidden = false;
    setSyncStatus("connecting");
    if (emailEl) {
      emailEl.textContent = user.email || "Usuário";
      emailEl.hidden = false;
    }
    if (btnOut) btnOut.hidden = false;
  } else {
    const syncEl = document.getElementById("syncBadge");
    if (syncEl) syncEl.hidden = true;
    showLoginScreen();
    if (emailEl) emailEl.hidden = true;
    if (btnOut) btnOut.hidden = true;
    appBootstrapped = false;
    persistenceApi = null;
    persistenceReady = false;
    if (typeof DemandasFirebase?.teardown === "function") DemandasFirebase.teardown();
  }
}

async function startAppOnce() {
  if (persistenceApi) return;
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    appBootstrapped = true;
    const loader = document.getElementById("appLoader");
    if (loader) loader.hidden = false;
    try {
      await bootstrap();
    } catch (e) {
      appBootstrapped = false;
      throw e;
    } finally {
      hideAppLoader();
      bootstrapPromise = null;
    }
  })();
  return bootstrapPromise;
}

/** Garante Firestore/local após login (evita tela vazia se o 1º bootstrap falhou). */
async function ensureDataAfterLogin(user) {
  if (!user) return;
  if (!persistenceApi) {
    await startAppOnce();
    if (!persistenceApi) return;
  }
  if (!state.demandas.length) {
    setSyncStatus(persistenceApi?.mode === "firebase" ? "empty" : "local");
  }
  refreshAllViews();
}

function showLoginError(msg) {
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

function setLoginLoading(loading) {
  const btn = document.getElementById("btnLoginSubmit");
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Entrando…" : "Entrar";
}

async function handleAuthUser(user) {
  if (!user) {
    handleAuthPromise = null;
    setAuthUi(user);
    appBootstrapped = false;
    return;
  }
  if (handleAuthPromise) return handleAuthPromise;

  handleAuthPromise = (async () => {
    setAuthUi(user);
    applyUserHomeOnLogin(user);
    await startAppOnce();
    await ensureDataAfterLogin(user);
  })();

  try {
    await handleAuthPromise;
  } catch (e) {
    console.error(e);
    appBootstrapped = false;
    hideAppLoader();
    setSyncStatus("error");
    const msg = window.__demandasSyncHint || e.message || "Erro ao carregar os dados.";
    toast(msg);
    refreshAllViews();
    updateEsteiraStatusLine();
  } finally {
    handleAuthPromise = null;
  }
}

async function doLogin() {
  if (typeof DemandasAuth === "undefined") {
    showLoginError("Módulo de login não carregou. Recarregue a página (Ctrl+F5).");
    return;
  }
  showLoginError("");
  const email = document.getElementById("loginEmail")?.value?.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  if (!email || !password) {
    showLoginError("Informe e-mail e senha.");
    return;
  }
  setLoginLoading(true);
  try {
    await DemandasAuth.signIn(email, password);
    const user = DemandasAuth.currentUser();
    if (user) await handleAuthUser(user);
    else showLoginError("Login concluído, mas a sessão não foi reconhecida. Tente novamente.");
  } catch (err) {
    console.error("Login:", err);
    showLoginError(DemandasAuth.mapAuthError(err));
  } finally {
    setLoginLoading(false);
  }
}

function bindLoginUi() {
  document.getElementById("btnSignOut")?.addEventListener("click", async () => {
    try {
      await DemandasAuth.signOut();
      toast("Sessão encerrada");
    } catch (err) {
      toast(DemandasAuth.mapAuthError(err));
    }
  });
}

async function initAuthGate() {
  if (typeof DemandasAuth === "undefined") {
    showLoginScreen();
    showLoginError("Arquivo firebase-auth.js não encontrado. Faça deploy do site atualizado.");
    return;
  }

  if (!DemandasAuth.isConfigured()) {
    const loginScreen = document.getElementById("loginScreen");
    if (loginScreen) loginScreen.hidden = true;
    document.getElementById("appRoot").hidden = false;
    hideAppLoader();
    await startAppOnce();
    return;
  }

  showLoginScreen();

  try {
    await DemandasAuth.init(handleAuthUser);
  } catch (e) {
    console.error(e);
    showLoginError(DemandasAuth.mapAuthError(e) || e.message || "Erro ao iniciar autenticação.");
  }
}

window.addEventListener("error", (ev) => {
  console.error("Erro não tratado:", ev.error || ev.message);
  if (document.getElementById("appRoot")?.hidden !== false) {
    showLoginError("Erro ao carregar o sistema. Recarregue a página (Ctrl+F5).");
    hideAppLoader();
  }
});

window.__demandasFinishLoginFull = handleAuthUser;
window.__demandasApplyUserHome = applyUserHomeOnLogin;
if (window.__demandasAuthUserPending) {
  const pending = window.__demandasAuthUserPending;
  delete window.__demandasAuthUserPending;
  void handleAuthUser(pending);
}

bindMotivosAtrasoUi();
bindLoginUi();

try {
  initAuthGate();
} catch (e) {
  console.error("Falha ao iniciar:", e);
  showLoginError(e.message || "Erro ao iniciar o sistema. Recarregue com Ctrl+F5.");
  hideAppLoader();
}