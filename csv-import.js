/**
 * Importação / exportação CSV — planilha Follow-up e relatório completo do sistema.
 * Colunas alinhadas com EXPORT_HEADERS (Follow-up + campos estendidos).
 */
const DemandasCsvImport = (function () {
  const COL = {
    acao: "ação",
    tipo: "tipo de projeto",
    resumo: "resumo do projeto",
    regional: "regional",
    diasRestantes: "dias úteis restante",
    status: "status",
    situacao: "situação atual",
    prazoInicial: "prazo inicial",
    prazoAtualizado: "prazo atualizado",
    prioridade: "prioridade",
    custo: "custo (total)/ saving (mensal)",
    justificativa: "justificativa atraso",
    kpi: "indicador-chave (kpi)",
    responsavel: "responsável",
    responsavelExecucao: "responsável pela execução",
    modificado: "modificado por",
    indicador: "indicador estratégico",
    id: "id",
    linhaEsteira: "linha esteira",
    colunaEsteira: "coluna esteira",
    segmentoB2c: "segmento b2c",
    produtoB2b: "produto b2b",
    setorSolicitanteB2b: "setor solicitante b2b",
    dataTermino: "data término",
    dataFimAtualizada: "data fim atualizada",
    emAtraso: "em atraso",
    diasAtraso: "dias em atraso",
    diasAberto: "dias aberto",
    valorProjeto: "valor projeto",
    valorFinal: "valor final +5%",
    valorRealizado: "valor realizado",
    portasNovas: "portas novas",
    metragem: "metragem lançamento",
    chamadoOcomon: "chamado ocomon",
    osAniel: "os aniel",
    comentarios: "comentários",
    historicoEsteira: "histórico esteira",
    descricaoCompleta: "descrição completa",
    criadoEm: "criado em",
    atualizadoEm: "atualizado em",
  };

  const STATUS_LABEL = {
    novo: "Projetos novos",
    analise: "Análise geral / desenho",
    vistoria: "Vistoria",
    custo: "Levantamento de custo",
    revisao: "Revisão",
    aprovacao: "Aprovação",
    materiais: "Materiais",
    execucao: "Execução Regional",
    execucao_terceirizada: "Execução Terceirizada",
    configuracao_op: "IP e Serviços",
    transmissao_infra_op: "Transmissão e Infra",
    documentacao_op: "Documentação",
    conclusao: "Conclusão",
    pausado: "Pausado",
    reprovado: "Reprovado",
  };

  const STATUS_LABEL_B2B = {
    pre_vendas: "Pré-Vendas",
    analise_kmz: "Análise Geral / KMZ",
    vistoria: "Vistoria",
    custo: "Levantamento de Custo",
    aprovacao_bp: "Aprovação BP",
    projeto_final: "Projeto Final",
    estoque: "Estoque",
    configuracao: "Execução Regional",
    execucao_terceirizada: "Execução Terceirizada",
    documentacao: "Documentação / As-Builts",
    pausado: "Pausados",
  };

  function normHeader(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/:$/, "");
  }

  /** Parser CSV com campos entre aspas e quebras de linha dentro do campo. */
  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const s = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      const next = s[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') {
          field += '"';
          i++;
        } else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r" && next === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else if (c === "\n" || c === "\r") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function mapHeaderIndex(headerRow) {
    const idx = {};
    const entries = Object.entries(COL)
      .map(([k, label]) => ({ k, lbl: normHeader(label) }))
      .sort((a, b) => b.lbl.length - a.lbl.length);

    headerRow.forEach((h, i) => {
      const key = normHeader(h);
      if (!key) return;
      for (const { k, lbl } of entries) {
        if (idx[k] != null) continue;
        if (key === lbl || key.startsWith(lbl) || lbl.startsWith(key)) {
          idx[k] = i;
          break;
        }
      }
    });
    if (idx.acao == null && headerRow.length) idx.acao = 0;
    return idx;
  }

  function cell(row, idx, key) {
    const i = idx[key];
    return i == null ? "" : String(row[i] ?? "").trim();
  }

  function parseDateBr(v) {
    const s = String(v || "").trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return "";
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function parseMoneyBr(v) {
    let s = String(v || "")
      .replace(/\u00a0/g, " ")
      .replace(/R\$\s*/gi, "")
      .trim();
    if (!s || s === "—" || s === "-") return "";
    const neg = /^-/.test(s);
    s = s.replace(/^-/, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return "";
    const val = Math.round(Math.abs(n) * 100) / 100;
    return neg ? -val : val;
  }

  function tituloKey(t) {
    return String(t || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  const PROJETISTAS_CSV = ["Daniel", "João", "Matheus", "Vinicius"];

  function projetistaSlug(nome) {
    return String(nome || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function mapResponsavel(raw) {
    const all = projetistaSlug(String(raw || ""));
    const parts = String(raw || "")
      .split(/[;,]/)
      .map((p) => projetistaSlug(p))
      .filter(Boolean);
    const ordered = [...PROJETISTAS_CSV].sort((a, b) => b.length - a.length);
    for (const nome of ordered) {
      const slug = projetistaSlug(nome);
      if (parts.some((p) => p.includes(slug)) || all.includes(slug)) return nome;
    }
    return "";
  }

  function mapTipo(tipoProjeto, acao) {
    const t = String(tipoProjeto || "").toLowerCase();
    const a = String(acao || "").toLowerCase();
    if (t.includes("swap") || /\bswap\b/.test(a)) return "SWAP";
    if (t.includes("backbone") || /\bbackbone\b/.test(a) || /\bbackhal\b/.test(a)) return "Backbone";
    if (t.includes("licenciamento") || /\blicenciamento\b/.test(a)) return "Licenciamento";
    if (t.includes("b2b") || /\bb2b\b/.test(a) || t.includes("projetos b2b")) return "B2B";
    if (t.includes("redund") || t.includes("anel")) return "Backbone";
    if (t.includes("mdu") || /\bmdu\b/.test(a)) return "B2C";
    if (t.includes("alivio") || t.includes("expans") || t.includes("reten")) return "B2C";
    return "B2C";
  }

  function mapExecucaoCusto(raw) {
    const s = String(raw || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (/terceiriz/.test(s)) return "Terceirizada";
    if (/regional/.test(s)) return "Regional";
    return "";
  }

  function parseDatetimeBr(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!m) {
      const iso = parseDateBr(s);
      return iso ? new Date(`${iso}T12:00:00`).toISOString() : "";
    }
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      m[4] != null ? Number(m[4]) : 12,
      m[5] != null ? Number(m[5]) : 0,
    );
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }

  function stripAccentsLower(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function parseLinhaEsteira(raw, tipoProjeto, acao) {
    const s = stripAccentsLower(raw);
    if (/b2b/.test(s)) return "b2b";
    if (/operacional|esteira projetos|projetos/.test(s)) return "operacional";
    return mapTipo(tipoProjeto, acao) === "B2B" ? "b2b" : "operacional";
  }

  function parseComentariosImport(raw, uid) {
    const text = String(raw || "").trim();
    if (!text) return [];
    return text
      .split(/\n---\n/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const m = trimmed.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
        if (!m) {
          return {
            id: uid(),
            texto: trimmed.slice(0, 8000),
            autor: "Importado",
            createdAt: new Date().toISOString(),
          };
        }
        const header = m[1].trim();
        const texto = m[2].trim();
        const hm = header.match(/^(.+?)\s*[—\-]\s*(.+)$/);
        const createdAt = hm ? parseDatetimeBr(hm[1].trim()) : parseDatetimeBr(header);
        const autor = hm ? hm[2].trim() : "Importado";
        return {
          id: uid(),
          texto: texto.slice(0, 8000),
          autor: autor.slice(0, 120) || "Importado",
          createdAt: createdAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);
  }

  function parseHistoricoImport(raw, linha) {
    const text = String(raw || "").trim();
    if (!text) return [];
    return text
      .split(/\n\|\n/)
      .map((seg) => {
        const trimmed = seg.trim();
        if (!trimmed) return null;
        const m = trimmed.match(/^(.+?)\s+\((.+?)\s→\s(.+?)\)(?:\s*[—\-]\s*(.+))?$/);
        if (!m) return null;
        const status = resolveStatusFromLabel(m[1].trim(), linha);
        const inicio = parseDatetimeBr(m[2].trim());
        const fimRaw = m[3].trim();
        const fim = /em andamento/i.test(fimRaw) ? "" : parseDatetimeBr(fimRaw);
        return {
          status: status || "analise",
          inicio: inicio || new Date().toISOString(),
          fim,
          observacao: String(m[4] || "").trim().slice(0, 500),
        };
      })
      .filter(Boolean);
  }

  function resolveStatusFromLabel(label, linha) {
    const slug = stripAccentsLower(label);
    if (!slug) return "";
    if (linha !== "b2b") {
      if (slug === "configuracao") return "configuracao_op";
      if (slug === "transmissao e infra") return "transmissao_infra_op";
    }
    const labels = linha === "b2b" ? STATUS_LABEL_B2B : STATUS_LABEL;
    for (const [k, lab] of Object.entries(labels)) {
      if (stripAccentsLower(lab) === slug || k === label) return k;
    }
    return "";
  }

  function resolveStatusImport(rec, linha) {
    const fromCol = resolveStatusFromLabel(rec.colunaEsteira, linha);
    if (fromCol) return fromCol;
    return mapStatusEsteira(rec.csvStatus, rec.situacao);
  }

  function isConcluidoStatus(status, linha) {
    if (linha === "b2b") return status === "projeto_final" || status === "documentacao";
    return status === "conclusao";
  }

  function buildCustoImport(rec, existing) {
    const execucaoCusto = mapExecucaoCusto(rec.responsavelExecucao) || existing?.custo?.execucao || "Regional";
    let custo = {
      temLevantamento: false,
      temPortas: false,
      temLancamento: false,
      valorProjeto: "",
      valor5: "",
      valorFinal: "",
      execucao: execucaoCusto,
      custoRegional: existing?.custo?.custoRegional || "",
      custoTerceirizada: existing?.custo?.custoTerceirizada || "",
      qtdCasas: existing?.custo?.qtdCasas ?? "",
      qtdPortasAtual: existing?.custo?.qtdPortasAtual ?? "",
      qtdNovasPortas: existing?.custo?.qtdNovasPortas ?? "",
      lancamento: existing?.custo?.lancamento || { cabos: [], totalMetragem: "" },
    };

    const vpCol = parseMoneyBr(rec.valorProjetoRaw);
    const vfCol = parseMoneyBr(rec.valorFinalRaw);
    const vp = vpCol !== "" ? Math.abs(Number(vpCol)) : "";
    const vf = vfCol !== "" ? Math.abs(Number(vfCol)) : "";

    if (vp !== "" || vf !== "") {
      custo.temLevantamento = true;
      custo.valorProjeto = vp !== "" ? vp : vf !== "" ? Math.round((vf / 1.05) * 100) / 100 : "";
      custo.valorFinal = vf !== "" ? vf : "";
    } else {
      const valor = parseMoneyBr(rec.custoRaw);
      const valorAbs = valor === "" ? "" : Math.abs(Number(valor));
      if (valorAbs !== "") {
        custo.temLevantamento = true;
        custo.valorProjeto = Math.round((valorAbs / 1.05) * 100) / 100;
        custo.valorFinal = valorAbs;
      }
    }

    const portas = Number(String(rec.portasNovas || "").replace(/\s/g, ""));
    if (Number.isFinite(portas) && portas > 0) {
      custo.temPortas = true;
      custo.qtdNovasPortas = portas;
    } else if (existing?.custo?.temPortas) {
      custo.temPortas = true;
      custo.qtdCasas = existing.custo.qtdCasas ?? "";
      custo.qtdPortasAtual = existing.custo.qtdPortasAtual ?? "";
      custo.qtdNovasPortas = existing.custo.qtdNovasPortas ?? "";
    }

    const met = parseFloat(String(rec.metragem || "").replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(met) && met > 0) {
      custo.temLancamento = true;
      custo.lancamento = {
        cabos: existing?.custo?.lancamento?.cabos || [],
        totalMetragem: met,
      };
    } else if (existing?.custo?.temLancamento) {
      custo.temLancamento = true;
      custo.lancamento = existing.custo.lancamento || { cabos: [], totalMetragem: "" };
    }

    return custo;
  }

  function extractSolicitanteFromResumo(resumo) {
    const m = String(resumo || "").match(/SOLICITANTE:\s*([^\n\r]+)/i);
    return m ? m[1].trim() : "";
  }

  function buildComentariosImport(rec, existing, uid, nowIso) {
    const fromCol = parseComentariosImport(rec.comentariosRaw, uid);
    if (fromCol.length) return fromCol;

    const base = Array.isArray(existing?.comentarios)
      ? existing.comentarios.map((c) => ({ ...c }))
      : [];
    const situacao = String(rec.situacao || "").trim();
    if (!situacao) return base;

    const dupe = base.some((c) => {
      const t = String(c?.texto || "").trim();
      return t === situacao || (t.length > 20 && situacao.includes(t)) || (situacao.length > 20 && t.includes(situacao));
    });
    if (dupe) return base;

    const autor =
      mapResponsavel(rec.responsavelRaw) ||
      String(rec.modificado || "").trim() ||
      extractSolicitanteFromResumo(rec.resumo) ||
      "Planilha Follow-up";

    base.unshift({
      id: uid(),
      texto: situacao.slice(0, 8000),
      autor: autor.slice(0, 120),
      createdAt: nowIso,
    });
    return base;
  }

  function mapStatusEsteira(csvStatus, situacao) {
    const st = String(csvStatus || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const sit = String(situacao || "").toLowerCase();
    if (/conclu/.test(st)) return "conclusao";
    if (/cancel/.test(st)) return "reprovado";
    if (/stand/.test(st)) return "pausado";
    if (/conclu|finaliz|entregue com sucesso|projeto conclu|100% finaliz/.test(sit)) return "conclusao";
    if (/paralisado|oportunidade pausada|aguardando.*comercial/.test(sit)) return "pausado";
    if (/vistoria/.test(sit)) return "vistoria";
    if (/levantamento de custo|orcamento|aprovação de custo/.test(sit)) return "custo";
    if (/aprovac/.test(sit)) return "aprovacao";
    if (/materiai|estoque/.test(sit)) return "materiais";
    if (/terceirizad/.test(sit)) return "execucao_terceirizada";
    if (/lancamento|execuc|ativacao|fusao|obra|configuracao|provisionamento|jm\b/.test(sit)) return "execucao";
    if (/revisao/.test(sit)) return "revisao";
    if (/em andamento|atrasado/.test(st)) return "execucao";
    return "analise";
  }

  function buildDescricao(rec) {
    const parts = [];
    if (rec.resumo) parts.push(rec.resumo);
    const meta = [];
    if (rec.tipoProjeto) meta.push(`Tipo (planilha): ${rec.tipoProjeto}`);
    if (rec.prioridade) meta.push(`Prioridade: ${rec.prioridade}`);
    if (rec.kpi) meta.push(`KPI: ${rec.kpi}`);
    if (rec.indicador) meta.push(`Indicador estratégico: ${rec.indicador}`);
    if (rec.diasRestantes !== "" && rec.diasRestantes != null) meta.push(`Dias úteis restantes (planilha): ${rec.diasRestantes}`);
    if (meta.length) parts.push("\n\n---\n" + meta.join("\n"));
    return parts.join("").trim() || "Importado da planilha Follow-up.";
  }

  function rowsToRecords(rows) {
    if (!rows.length) return { records: [], error: "Arquivo vazio." };
    const header = rows[0];
    const idx = mapHeaderIndex(header);
    if (idx.acao == null) return { records: [], error: "Cabeçalho inválido: coluna «Ação» não encontrada." };

    const records = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row.some((c) => String(c || "").trim())) continue;
      const acao = cell(row, idx, "acao");
      if (!acao) continue;
      records.push({
        acao,
        tipoProjeto: cell(row, idx, "tipo"),
        resumo: cell(row, idx, "resumo"),
        regional: cell(row, idx, "regional"),
        diasRestantes: cell(row, idx, "diasRestantes"),
        csvStatus: cell(row, idx, "status"),
        situacao: cell(row, idx, "situacao"),
        prazoInicial: cell(row, idx, "prazoInicial"),
        prazoAtualizado: cell(row, idx, "prazoAtualizado"),
        prioridade: cell(row, idx, "prioridade"),
        custoRaw: cell(row, idx, "custo"),
        justificativa: cell(row, idx, "justificativa"),
        kpi: cell(row, idx, "kpi"),
        responsavelRaw: cell(row, idx, "responsavel"),
        responsavelExecucao: cell(row, idx, "responsavelExecucao"),
        modificado: cell(row, idx, "modificado"),
        indicador: cell(row, idx, "indicador"),
        id: cell(row, idx, "id"),
        linhaEsteira: cell(row, idx, "linhaEsteira"),
        colunaEsteira: cell(row, idx, "colunaEsteira"),
        segmentoB2c: cell(row, idx, "segmentoB2c"),
        produtoB2b: cell(row, idx, "produtoB2b"),
        setorSolicitanteB2b: cell(row, idx, "setorSolicitanteB2b"),
        dataTermino: cell(row, idx, "dataTermino"),
        dataFimAtualizada: cell(row, idx, "dataFimAtualizada"),
        valorProjetoRaw: cell(row, idx, "valorProjeto"),
        valorFinalRaw: cell(row, idx, "valorFinal"),
        valorRealizadoRaw: cell(row, idx, "valorRealizado"),
        portasNovas: cell(row, idx, "portasNovas"),
        metragem: cell(row, idx, "metragem"),
        chamadoOcomon: cell(row, idx, "chamadoOcomon"),
        osAniel: cell(row, idx, "osAniel"),
        comentariosRaw: cell(row, idx, "comentarios"),
        historicoRaw: cell(row, idx, "historicoEsteira"),
        descricaoCompleta: cell(row, idx, "descricaoCompleta"),
        criadoEm: cell(row, idx, "criadoEm"),
        atualizadoEm: cell(row, idx, "atualizadoEm"),
      });
    }

    return { records, error: null };
  }

  function parseFile(text) {
    const rows = parseCsvRows(text);
    const { records, error } = rowsToRecords(rows);
    if (error) return { ok: false, error, records: [] };
    if (!records.length) return { ok: false, error: "Nenhum projeto encontrado no arquivo.", records: [] };
    return { ok: true, records, error: null };
  }

  function recordToDemanda(rec, { existing, uid, todayISO }) {
    const linha = parseLinhaEsteira(rec.linhaEsteira, rec.tipoProjeto, rec.acao);
    let tipo = mapTipo(rec.tipoProjeto, rec.acao);
    if (linha === "b2b") tipo = "B2B";

    const status = resolveStatusImport(rec, linha);
    const dataChegada = parseDateBr(rec.prazoInicial) || existing?.dataChegada || todayISO();
    const dataFimPrevista =
      parseDateBr(rec.prazoAtualizado) || parseDateBr(rec.prazoInicial) || existing?.dataFimPrevista || "";
    const dataFimAtualizada = parseDateBr(rec.dataFimAtualizada) || existing?.dataFimAtualizada || "";
    let dataTermino = parseDateBr(rec.dataTermino) || "";
    if (!dataTermino && isConcluidoStatus(status, linha)) {
      dataTermino =
        parseDateBr(rec.prazoAtualizado) ||
        parseDateBr(rec.prazoInicial) ||
        existing?.dataTermino ||
        todayISO();
    }

    const custo = buildCustoImport(rec, existing);
    const valorRealizadoCol = parseMoneyBr(rec.valorRealizadoRaw);
    const valorRealizado =
      valorRealizadoCol !== ""
        ? Math.abs(Number(valorRealizadoCol))
        : isConcluidoStatus(status, linha) && custo.valorFinal !== ""
          ? custo.valorFinal
          : existing?.valorProjetoRealizado || "";

    const motivos =
      rec.justificativa ||
      (/atrasado/i.test(rec.csvStatus) ? rec.situacao : "") ||
      existing?.motivosAtraso ||
      "";

    const now = new Date().toISOString();
    const inicioIso = dataChegada ? new Date(`${dataChegada}T12:00:00`).toISOString() : now;
    const fimIso =
      isConcluidoStatus(status, linha) && dataTermino
        ? new Date(`${dataTermino}T18:00:00`).toISOString()
        : "";

    const historicoParsed = parseHistoricoImport(rec.historicoRaw, linha);
    const historicoStatus = historicoParsed.length
      ? historicoParsed
      : existing?.historicoStatus?.length
        ? existing.historicoStatus
        : [{ status, inicio: inicioIso, fim: fimIso, observacao: "Importado do CSV" }];

    const descricao = String(rec.descricaoCompleta || "").trim() || buildDescricao(rec);
    const statusAtual = String(rec.situacao || "").trim() || existing?.statusAtual || "";

    const demanda = {
      id: String(rec.id || "").trim() || existing?.id || uid(),
      titulo: rec.acao.slice(0, 300),
      descricao: descricao.slice(0, 12000),
      cidade: rec.regional.slice(0, 120) || existing?.cidade || "",
      dataChegada,
      dataFimPrevista,
      dataFimAtualizada,
      dataTermino,
      statusAtual: statusAtual.slice(0, 500),
      motivosAtraso: motivos.slice(0, 3000),
      solicitante:
        rec.modificado.slice(0, 120) ||
        extractSolicitanteFromResumo(rec.resumo).slice(0, 120) ||
        existing?.solicitante ||
        "",
      responsavel: mapResponsavel(rec.responsavelRaw) || existing?.responsavel || "",
      tipo,
      linhaEsteira: linha,
      status,
      custo,
      segmentoB2c: rec.segmentoB2c || existing?.segmentoB2c || "",
      produtoB2b: rec.produtoB2b || existing?.produtoB2b || "",
      setorSolicitanteB2b: rec.setorSolicitanteB2b || existing?.setorSolicitanteB2b || "",
      chamadoOcomon: String(rec.chamadoOcomon || existing?.chamadoOcomon || "").trim(),
      osAniel: String(rec.osAniel || existing?.osAniel || "").trim(),
      valorProjetoRealizado: valorRealizado,
      comentarios: buildComentariosImport(rec, existing, uid, now),
      imagens: existing?.imagens || [],
      pdfLevantamento: existing?.pdfLevantamento,
      historicoEdicoes: existing?.historicoEdicoes || [],
      historicoStatus,
      ordemEsteira: existing?.ordemEsteira ?? "",
      createdAt: parseDatetimeBr(rec.criadoEm) || existing?.createdAt || now,
      updatedAt: parseDatetimeBr(rec.atualizadoEm) || now,
    };

    return demanda;
  }

  function findExistingRecord(rec, byId, byTitulo, mode) {
    if (mode === "all") return null;
    const id = String(rec.id || "").trim();
    if (id && byId.has(id)) return byId.get(id);
    const k = tituloKey(rec.acao);
    return k ? byTitulo.get(k) || null : null;
  }

  function planImport(records, existingDemandas, mode, uid, todayISO) {
    const byTitulo = new Map();
    const byId = new Map();
    for (const d of existingDemandas || []) {
      const k = tituloKey(d.titulo);
      if (k && !byTitulo.has(k)) byTitulo.set(k, d);
      if (d.id) byId.set(String(d.id), d);
    }

    const toApply = [];
    let novos = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const rec of records) {
      const existing = findExistingRecord(rec, byId, byTitulo, mode);

      if (mode === "skip" && existing) {
        ignorados++;
        continue;
      }
      if (mode === "update" && !existing) {
        ignorados++;
        continue;
      }

      const dem = recordToDemanda(rec, { existing, uid, todayISO });
      toApply.push({ dem, rec, isUpdate: !!existing });
      const tk = tituloKey(dem.titulo);
      if (existing) {
        atualizados++;
        if (tk) byTitulo.set(tk, dem);
        if (dem.id) byId.set(String(dem.id), dem);
      } else {
        novos++;
        if (tk) byTitulo.set(tk, dem);
        if (dem.id) byId.set(String(dem.id), dem);
      }
    }

    return { toApply, novos, atualizados, ignorados };
  }

  function previewRows(toApply, limit = 15) {
    return toApply.slice(0, limit).map(({ dem, rec, isUpdate }) => {
      const linha = dem.linhaEsteira === "b2b" ? "b2b" : "operacional";
      return {
        titulo: dem.titulo,
        regional: dem.cidade,
        csvStatus: rec.csvStatus,
        situacao: rec.situacao ? rec.situacao.slice(0, 80) + (rec.situacao.length > 80 ? "…" : "") : "—",
        linha: linhaEsteiraLabel(linha),
        esteira: statusLabelExport(dem.status, linha),
        responsavel: dem.responsavel || "—",
        acao: isUpdate ? "Atualizar" : "Novo",
      };
    });
  }

  function linhaEsteiraLabel(linha) {
    return linha === "b2b" ? "Esteira B2B" : "Esteira Projetos";
  }

  function statusLabelExport(status, linha) {
    if (linha === "b2b") return STATUS_LABEL_B2B[status] || STATUS_LABEL[status] || status;
    return STATUS_LABEL[status] || status;
  }

  function isConcluidoExport(d) {
    if (d.linhaEsteira === "b2b") return d.status === "projeto_final" || d.status === "documentacao";
    return d.status === "conclusao";
  }

  function formatDatetimeBrExport(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return formatDateBrExport(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatComentariosExport(comentarios) {
    return (comentarios || [])
      .slice()
      .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0))
      .map((c) => {
        const dt = formatDatetimeBrExport(c.createdAt) || formatDateBrExport(c.createdAt);
        const autor = String(c.autor || "Equipe").trim();
        const texto = String(c.texto || "").trim();
        return dt ? `[${dt} — ${autor}] ${texto}` : `[${autor}] ${texto}`;
      })
      .join("\n---\n");
  }

  function formatHistoricoExport(hist, linha) {
    return (hist || [])
      .map((seg) => {
        const lab = statusLabelExport(seg.status, linha);
        const ini = formatDatetimeBrExport(seg.inicio) || formatDateBrExport(seg.inicio);
        const fim = seg.fim ? formatDatetimeBrExport(seg.fim) || formatDateBrExport(seg.fim) : "em andamento";
        const obs = String(seg.observacao || "").trim();
        return obs ? `${lab} (${ini} → ${fim}) — ${obs}` : `${lab} (${ini} → ${fim})`;
      })
      .join("\n|\n");
  }

  function portasNovasExport(d) {
    const c = d.custo || {};
    if (!c.temPortas) return "";
    const n = Number(c.qtdNovasPortas);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }

  function metragemExport(d) {
    const c = d.custo || {};
    if (!c.temLancamento) return "";
    const n = Number(c.lancamento?.totalMetragem);
    return Number.isFinite(n) && n > 0 ? String(n).replace(".", ",") : "";
  }

  function valorProjetoExport(d) {
    const c = d.custo || {};
    if (!c.temLevantamento) return "";
    const v = c.valorProjeto;
    if (v === "" || v == null) return "";
    return formatMoneyBrExport(Number(v));
  }

  function valorFinalExport(d) {
    const c = d.custo || {};
    if (!c.temLevantamento) return "";
    const v = c.valorFinal !== "" && c.valorFinal != null ? c.valorFinal : c.valorProjeto;
    if (v === "" || v == null) return "";
    return formatMoneyBrExport(Number(v));
  }

  function valorRealizadoExport(d) {
    if (d.valorProjetoRealizado === "" || d.valorProjetoRealizado == null) return "";
    return formatMoneyBrExport(Number(d.valorProjetoRealizado));
  }

  function execucaoCustoExport(d) {
    const ex = String(d.custo?.execucao || "").trim();
    return ex && ex !== "Não se aplica" ? ex : "";
  }

  /** Colunas Follow-up (importação) + campos estendidos do sistema. */
  const EXPORT_HEADERS = [
    "Ação",
    "Tipo de Projeto",
    "Resumo do Projeto",
    "Regional",
    "Dias Úteis Restante",
    "Status",
    "Situação Atual",
    "Prazo Inicial",
    "Prazo Atualizado",
    "Prioridade:",
    "Custo (Total)/ Saving (Mensal)",
    "Justificativa Atraso",
    "Indicador-Chave (KPI)",
    "Horas Necessárias",
    "Evidência",
    "Responsável ",
    "Modificado por",
    "Indicador Estratégico",
    "Responsável pela Execução",
    "ID",
    "Linha Esteira",
    "Coluna Esteira (sistema)",
    "Segmento B2C",
    "Produto B2B",
    "Setor Solicitante B2B",
    "Data Término",
    "Data Fim Atualizada",
    "Em Atraso",
    "Dias em Atraso",
    "Dias aberto",
    "Valor Projeto (R$)",
    "Valor Final +5% (R$)",
    "Valor Realizado (R$)",
    "Portas Novas",
    "Metragem Lançamento (m)",
    "Chamado Ocomon",
    "OS Aniel",
    "Comentários",
    "Histórico Esteira",
    "Descrição Completa",
    "Criado em",
    "Atualizado em",
  ];

  function escapeCsvField(val) {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function serializeCsvRows(rows) {
    return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
  }

  function formatDateBrExport(iso) {
    if (!iso) return "";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function parseIsoDate(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(t) ? null : t;
  }

  function diasRestantesExport(dataFim, todayISO) {
    const fim = parseIsoDate(dataFim);
    const hoje = parseIsoDate(todayISO);
    if (fim == null || hoje == null) return "";
    return String(Math.round((fim - hoje) / 86400000));
  }

  function resumoFromDescricao(desc) {
    const parts = String(desc || "").split(/\n\n---\n/);
    return parts[0].trim();
  }

  function metaFromDescricao(desc) {
    const parts = String(desc || "").split(/\n\n---\n/);
    if (parts.length < 2) return { prioridade: "", kpi: "", indicador: "" };
    const block = parts[1];
    const pick = (re) => {
      const m = block.match(re);
      return m ? m[1].trim() : "";
    };
    return {
      prioridade: pick(/Prioridade:\s*(.+)/i),
      kpi: pick(/KPI:\s*(.+)/i),
      indicador: pick(/Indicador estratégico:\s*(.+)/i),
    };
  }

  function formatMoneyBrExport(v) {
    if (v === "" || v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "R$ 0,00";
    const str = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `-R$ ${str}` : `R$ ${str}`;
  }

  function custoExportValue(d) {
    if (isConcluidoExport(d) && d.valorProjetoRealizado !== "") {
      return formatMoneyBrExport(-Math.abs(Number(d.valorProjetoRealizado)));
    }
    const c = d.custo || {};
    if (!c.temLevantamento) return "";
    const v = c.valorFinal !== "" && c.valorFinal != null ? c.valorFinal : c.valorProjeto;
    if (v === "" || v == null) return "";
    return formatMoneyBrExport(-Math.abs(Number(v)));
  }

  function mapStatusFollowUpExport(d, todayISO) {
    if (isConcluidoExport(d)) return "Concluido";
    if (d.status === "reprovado") return "Cancelado";
    if (d.status === "pausado") return "Stand-by";
    const prev = d.dataFimPrevista;
    const hoje = todayISO || "";
    if (prev && hoje && !isConcluidoExport(d) && d.status !== "reprovado") {
      const p = parseIsoDate(prev);
      const t = parseIsoDate(hoje);
      if (p != null && t != null && t > p) return "Atrasado";
    }
    return "Em Andamento";
  }

  function tipoProjetoExport(d) {
    const t = String(d.tipo || "");
    if (t === "B2B") return "Projetos B2B";
    return t;
  }

  function demandaToReportRow(d, todayISO, helpers = {}) {
    const meta = metaFromDescricao(d.descricao);
    const linha = d.linhaEsteira === "b2b" ? "b2b" : "operacional";
    const emAtraso = helpers.isAtraso ? helpers.isAtraso(d) : false;
    const diasAtraso = emAtraso && helpers.diasAtraso ? helpers.diasAtraso(d) : 0;
    const diasAberto = helpers.diasAberto ? helpers.diasAberto(d) : "";
    const comentariosTxt = formatComentariosExport(d.comentarios);
    const situacaoAtual =
      String(d.statusAtual || "").trim() ||
      (comentariosTxt ? comentariosTxt.split("\n---\n").slice(-1)[0].replace(/^\[[^\]]+\]\s*/, "") : "");

    return [
      d.titulo || "",
      tipoProjetoExport(d),
      resumoFromDescricao(d.descricao),
      d.cidade || "",
      diasRestantesExport(d.dataFimPrevista, todayISO),
      mapStatusFollowUpExport(d, todayISO),
      situacaoAtual,
      formatDateBrExport(d.dataChegada),
      formatDateBrExport(d.dataFimPrevista),
      meta.prioridade,
      custoExportValue(d),
      d.motivosAtraso || "",
      meta.kpi,
      "",
      "",
      d.responsavel || "",
      d.solicitante || "",
      meta.indicador,
      execucaoCustoExport(d),
      d.id || "",
      linhaEsteiraLabel(linha),
      statusLabelExport(d.status, linha),
      d.segmentoB2c || "",
      d.produtoB2b || "",
      d.setorSolicitanteB2b || "",
      formatDateBrExport(d.dataTermino),
      formatDateBrExport(d.dataFimAtualizada),
      emAtraso ? "Sim" : "Não",
      emAtraso && diasAtraso ? String(diasAtraso) : "",
      diasAberto !== "" ? String(diasAberto) : "",
      valorProjetoExport(d),
      valorFinalExport(d),
      valorRealizadoExport(d),
      portasNovasExport(d),
      metragemExport(d),
      d.chamadoOcomon || "",
      d.osAniel || "",
      comentariosTxt,
      formatHistoricoExport(d.historicoStatus, linha),
      String(d.descricao || "").trim(),
      formatDatetimeBrExport(d.createdAt),
      formatDatetimeBrExport(d.updatedAt),
    ];
  }

  /** Gera CSV (UTF-8 com BOM) — relatório completo compatível com Follow-up + campos do sistema. */
  function exportFollowUpCsv(demandas, todayISO, helpers = {}) {
    const rows = [EXPORT_HEADERS, ...(demandas || []).map((d) => demandaToReportRow(d, todayISO, helpers))];
    return "\uFEFF" + serializeCsvRows(rows);
  }

  return {
    parseFile,
    planImport,
    previewRows,
    tituloKey,
    exportFollowUpCsv,
    EXPORT_HEADERS,
  };
})();

if (typeof window !== "undefined") window.DemandasCsvImport = DemandasCsvImport;
