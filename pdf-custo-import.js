/**
 * Leitura de PDF padrão de levantamento de custo (texto) e extração de campos.
 * Ajuste os padrões em PDF_CUSTO_PATTERNS se o layout do seu PDF mudar.
 */
(function (global) {
  const TIPOS_CABO = ["FO-06", "FO-12", "FO-24", "FO-36", "FO-48", "FO-72", "FO-144"];
  /** Separador entre páginas (não usar \\n simples — quebra leitura do CAPEX). */
  const PDF_PAGE_SEP = "\f";

  /** Valores monetários BR (ex.: 1.234.567,89 ou 1234567.89) */
  const RE_MONEY_BR =
    /([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]{2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/;

  const PDF_CUSTO_PATTERNS = {
    valorProjeto: [
      /valor\s+do\s+projeto\s*[:\s]*R?\$?\s*([\d.,]+)/i,
      /valor\s+projeto\s*[:\s]*R?\$?\s*([\d.,]+)/i,
    ],
    valor5: [/valor\s*5\s*%?\s*[:\s]*R?\$?\s*([\d.,]+)/i, /5\s*%\s*[:\s]*R?\$?\s*([\d.,]+)/i],
    valorFinal: [/valor\s+final\s*(?:do\s+projeto)?\s*[:\s]*R?\$?\s*([\d.,]+)/i],
    qtdCasas: [
      /(?:qtd\.?|quantidade)\s*(?:de\s*)?casas\s*[:\s]*(\d+)/i,
      /n[º°]?\s*de\s*casas\s*[:\s]*(\d+)/i,
    ],
    qtdPortasAtual: [
      /portas?\s*(?:existentes?|atuais?)\s*[:\s]*(\d+)/i,
      /qtd\.?\s*portas?\s*(?:existentes?|atuais?)\s*[:\s]*(\d+)/i,
    ],
    qtdNovasPortas: [
      /(?:qtd\.?|quantidade)\s*(?:de\s*)?(?:novas?\s*)?portas?\s*[:\s]*(\d+)/i,
      /novas?\s*portas?\s*[:\s]*(\d+)/i,
    ],
    penetracaoAtual: [/penetra[çc][ãa]o\s*atual\s*[:\s]*([\d.,]+)\s*%?/i, /taxa\s*atual\s*[:\s]*([\d.,]+)/i],
    novaPenetracao: [/nova\s*penetra[çc][ãa]o\s*[:\s]*([\d.,]+)\s*%?/i, /nova\s*taxa\s*[:\s]*([\d.,]+)/i],
    custoRegional: [/custo\s*(?:da\s*)?regional\s*[:\s]*R?\$?\s*([\d.,]+)/i],
    custoTerceirizada: [/custo\s*(?:da\s*)?terceirizad[ao]\s*[:\s]*R?\$?\s*([\d.,]+)/i],
    totalMetragem: [/total\s*(?:de\s*)?metragem\s*[:\s]*([\d.,]+)\s*m?/i, /metragem\s+total\s*[:\s]*([\d.,]+)/i],
  };

  function parseMoneyBr(raw) {
    if (raw == null || raw === "") return "";
    let s = String(raw).trim().replace(/R\$\s*/gi, "");
    if (/,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "";
  }

  function parseIntBr(raw) {
    if (raw == null || raw === "") return "";
    const n = parseInt(String(raw).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n >= 0 ? n : "";
  }

  function firstMatch(text, patterns) {
    if (!patterns) return null;
    const list = Array.isArray(patterns) ? patterns : [patterns];
    for (const re of list) {
      const m = text.match(re);
      if (m && m[1] != null) return m[1].trim();
    }
    return null;
  }

  /**
   * Valor do projeto = CAPEX estimado (somente 1ª página do PDF padrão).
   */
  function extractValorProjetoCapexFlat(flat) {
    if (!flat) return "";

    const inlinePatterns = [
      /capex\s*estimad[oa]?\s*[:\-–]?\s*R?\$?\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?|\d+(?:[.,]\d+)?)/i,
      /capex\s*estimad[oa]?\s+([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)/i,
      /R?\$?\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)\s*(?:[-–—]\s*)?capex\s*estimad[oa]?/i,
    ];

    for (const re of inlinePatterns) {
      const m = flat.match(re);
      if (m?.[1]) {
        const v = parseMoneyBr(m[1]);
        if (v !== "") return v;
      }
    }

    const label = flat.match(/capex\s*estimad[oa]?/i);
    if (label) {
      const from = Math.max(0, label.index - 40);
      const window = flat.slice(from, label.index + 140);
      const after = window.slice(window.search(/capex\s*estimad[oa]?/i));
      const moneyAfter = after.match(new RegExp(`capex\\s*estimad[oa]?\\s*(?:[:\\-–]|R\\$?\\s*)?${RE_MONEY_BR.source}`, "i"));
      if (moneyAfter?.[1]) {
        const v = parseMoneyBr(moneyAfter[1]);
        if (v !== "") return v;
      }
      const anyMoney = window.match(new RegExp(`R?\\$?\\s*${RE_MONEY_BR.source}`));
      if (anyMoney?.[1]) {
        const v = parseMoneyBr(anyMoney[1]);
        if (v !== "" && v >= 100) return v;
      }
    }

    return "";
  }

  function extractValorProjetoCapex(firstPageText) {
    const raw = String(firstPageText || "");
    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (!/capex\s*estimad/i.test(lines[i])) continue;
      const v = extractValorProjetoCapexFlat(lines.slice(i, i + 4).join(" "));
      if (v !== "") return v;
    }
    return extractValorProjetoCapexFlat(raw.replace(/\n/g, " ").replace(/\s+/g, " ").trim());
  }

  function normalizePdfText(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n +/g, "\n");
  }

  function splitPdfPages(text) {
    const norm = normalizePdfText(text);
    if (norm.includes(PDF_PAGE_SEP)) {
      return norm.split(PDF_PAGE_SEP).map((p) => p.trim()).filter(Boolean);
    }
    return [norm];
  }

  function flatText(block) {
    return String(block || "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractIntFromLabel(text, labelRes) {
    const flat = flatText(text);
    const list = Array.isArray(labelRes) ? labelRes : [labelRes];
    for (const re of list) {
      const m = flat.match(re);
      if (m?.[1] != null) {
        const v = parseIntBr(m[1]);
        if (v !== "") return v;
      }
    }
    const lines = String(text || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      for (const re of list) {
        const m = lines[i].match(re);
        if (m?.[1] != null) {
          const v = parseIntBr(m[1]);
          if (v !== "") return v;
        }
      }
      const hasLabel = list.some((re) => re.test(lines[i]));
      if (hasLabel && lines[i + 1]) {
        const v = parseIntBr(lines[i + 1]);
        if (v !== "") return v;
      }
    }
    return "";
  }

  function sliceEstudoAreaBlock(text) {
    const flat = flatText(text);
    const idx = flat.search(/estudo\s+de\s+[áa]rea/i);
    if (idx < 0) return flat;
    return flat.slice(idx, idx + 1500);
  }

  const PORTAS_KEYS = ["qtdNovasPortas", "qtdCasas", "qtdPortasAtual"];

  function hasPortasValues(values) {
    return PORTAS_KEYS.some((k) => values[k] !== "" && values[k] != null);
  }

  /**
   * 1ª página (região CAPEX): Portas estimadas, estudo de área HP/HC.
   * Só extrai quando o rótulo correspondente existir na página (evita falso positivo).
   */
  function extractPortasFromFirstPage(firstPageText) {
    const raw = String(firstPageText || "");
    let qtdNovasPortas = "";
    if (/portas\s*estimadas?/i.test(raw)) {
      qtdNovasPortas = extractIntFromLabel(raw, [
        /portas\s*estimadas?\s*[:\-–]?\s*(\d+)/i,
        /portas\s*estimadas?\s*[:\-–]?\s*([\d.,]+)/i,
      ]);
    }

    let qtdCasas = "";
    let qtdPortasAtual = "";
    if (/estudo\s+de\s+[áa]rea/i.test(raw)) {
      const searchEstudo = sliceEstudoAreaBlock(raw);
      qtdCasas = extractIntFromLabel(searchEstudo, [
        /(?:linha\s*)?hp\s*[:\-–]?\s*(\d+)/i,
        /\bhp\s*[:\-–]?\s*(\d+)/i,
        /hp\s+(\d+)/i,
      ]);
      qtdPortasAtual = extractIntFromLabel(searchEstudo, [
        /\bhc\s*[:\-–]?\s*(\d+)/i,
        /hc\s+(\d+)/i,
      ]);
      const hpHc = searchEstudo.match(/\bhp\s*[:\-–]?\s*(\d+)[\s\S]{0,80}?\bhc\s*[:\-–]?\s*(\d+)/i);
      if (hpHc) {
        if (qtdCasas === "") qtdCasas = parseIntBr(hpHc[1]);
        if (qtdPortasAtual === "") qtdPortasAtual = parseIntBr(hpHc[2]);
      }
      const hcHp = searchEstudo.match(/\bhc\s*[:\-–]?\s*(\d+)[\s\S]{0,80}?\bhp\s*[:\-–]?\s*(\d+)/i);
      if (hcHp) {
        if (qtdPortasAtual === "") qtdPortasAtual = parseIntBr(hcHp[1]);
        if (qtdCasas === "") qtdCasas = parseIntBr(hcHp[2]);
      }
    }

    return {
      qtdNovasPortas: qtdNovasPortas !== "" ? qtdNovasPortas : "",
      qtdCasas: qtdCasas !== "" ? qtdCasas : "",
      qtdPortasAtual: qtdPortasAtual !== "" ? qtdPortasAtual : "",
    };
  }

  /** CAPEX na 1ª página (e fallback nas 2 primeiras + documento). */
  function extractValorProjetoFromPdf(pages, fullNormalized) {
    const list = Array.isArray(pages) && pages.length ? pages : [fullNormalized];
    for (let i = 0; i < Math.min(2, list.length); i++) {
      const v = extractValorProjetoCapex(list[i]);
      if (v !== "") return v;
    }
    const vDoc = extractValorProjetoCapex(fullNormalized);
    if (vDoc !== "") return vDoc;
    const flatDoc = flatText(fullNormalized);
    const raw = firstMatch(flatDoc, PDF_CUSTO_PATTERNS.valorProjeto);
    return raw ? parseMoneyBr(raw) : "";
  }

  const FIBRAS_VALIDAS = [6, 12, 24, 36, 48, 72, 144];

  function fibrasToTipo(fibrasRaw) {
    const n = parseInt(String(fibrasRaw).replace(/\D/g, ""), 10);
    if (!FIBRAS_VALIDAS.includes(n)) return null;
    const suffix = n === 144 ? "144" : String(n).padStart(2, "0");
    const tipo = `FO-${suffix}`;
    return TIPOS_CABO.includes(tipo) ? tipo : null;
  }

  /**
   * Especificação do PDF: "CFOA SM ASU 80 S 12 FIBRAS NR" → FO-12 (nº de fibras antes de FIBRAS).
   */
  function fibrasFromEspecificacao(text) {
    const m = String(text || "").match(/(\d{1,3})\s*fibras?\s*(?:nr|n\.?r\.?|ópticas?|opticas?)?\b/i);
    return m ? fibrasToTipo(m[1]) : null;
  }

  function linhaPareceMetragem(s) {
    const t = String(s || "").trim();
    if (!t || /cfoa|fibras?/i.test(t)) return false;
    if (parecePrecoCelula(t)) return false;
    return /^[\d.,\s]+$/.test(t) || /^[\d]{1,3}(?:\.[\d]{3})+$/.test(t);
  }

  /** Valor da coluna Preço (R$ com centavos) — não é metragem. */
  function parecePrecoCelula(s) {
    const t = String(s || "").trim();
    if (!t || /R\$/i.test(t) || /pre[çc]o/i.test(t)) return true;
    if (/,\d{2}$/.test(t.replace(/\s/g, ""))) return true;
    return false;
  }

  /** Célula da coluna "Metragem do cabo" (não unidade "m" nem preço). */
  function parseMetragemCell(raw) {
    const s = String(raw || "").trim();
    if (!s || parecePrecoCelula(s)) return "";
    if (/^(m|mt|metros?|un|unidade)$/i.test(s)) return "";
    return parseMetragemBr(s);
  }

  function clusterCells(rowItems, xGap = 28) {
    const sorted = [...rowItems].sort((a, b) => a.x - b.x);
    const clusters = [];
    for (const it of sorted) {
      const last = clusters[clusters.length - 1];
      if (!last || it.x - last.maxX > xGap) {
        clusters.push({ minX: it.x, maxX: it.x, texts: [it.str], centerX: it.x });
      } else {
        last.maxX = it.x;
        last.texts.push(it.str);
        last.centerX = (last.minX + last.maxX) / 2;
      }
    }
    return clusters.map((c) => ({
      text: c.texts.join(" ").trim(),
      minX: c.minX,
      maxX: c.maxX,
      centerX: c.centerX,
    }));
  }

  function assignRowToColumns(rowItems, headerClusters) {
    const rowClusters = clusterCells(rowItems);
    return headerClusters.map((hCol) => {
      let best = null;
      let bestDist = Infinity;
      for (const r of rowClusters) {
        const d = Math.abs(r.centerX - hCol.centerX);
        if (d < bestDist) {
          bestDist = d;
          best = r;
        }
      }
      return best && bestDist < 90 ? best.text : "";
    });
  }

  function groupItemsIntoRows(items, yTol = 5) {
    if (!items.length) return [];
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    let bucket = [];
    let refY = sorted[0].y;

    const flush = () => {
      if (!bucket.length) return;
      bucket.sort((a, b) => a.x - b.x);
      rows.push(bucket);
      bucket = [];
    };

    for (const it of sorted) {
      if (!bucket.length || Math.abs(it.y - refY) <= yTol) {
        bucket.push(it);
      } else {
        flush();
        bucket = [it];
        refY = it.y;
      }
    }
    flush();
    return rows;
  }

  function pageItemsFromContent(content) {
    return (content.items || [])
      .map((it) => {
        const s = String(it.str || "").trim();
        if (!s) return null;
        const tr = it.transform || [1, 0, 0, 1, 0, 0];
        return { str: s, x: tr[4], y: tr[5] };
      })
      .filter(Boolean);
  }

  /**
   * Tabela: Nome do cabo | Unidade | Metragem do cabo | Preço
   */
  function extractTableCabosFromRows(rowBuckets) {
    const cabos = [];
    const seen = new Set();
    let headerIdx = -1;
    let headerClusters = null;
    let metragemIdx = -1;
    let precoIdx = -1;

    for (let i = 0; i < rowBuckets.length; i++) {
      const lineText = rowBuckets[i].map((it) => it.str).join(" ");
      if (!/metragem/i.test(lineText)) continue;
      if (!/cabo|pre[çc]o|unidade/i.test(lineText)) continue;
      headerClusters = clusterCells(rowBuckets[i]);
      metragemIdx = headerClusters.findIndex((c) => /metragem/i.test(c.text));
      precoIdx = headerClusters.findIndex((c) => /pre[çc]o/i.test(c.text));
      if (metragemIdx < 0) continue;
      headerIdx = i;
      break;
    }

    if (headerIdx < 0 || metragemIdx < 0 || !headerClusters) return cabos;

    for (let i = headerIdx + 1; i < rowBuckets.length; i++) {
      const row = rowBuckets[i];
      const lineText = row.map((it) => it.str).join(" ");
      if (/^total|subtotal|observa[çc]/i.test(lineText)) break;
      if (/lan[çc]amento\s+de\s+cabos/i.test(lineText) && !/cfoa|fibras/i.test(lineText)) continue;

      const cols = assignRowToColumns(row, headerClusters);
      const nomeText = cols[0] || lineText;
      const tipo = fibrasFromEspecificacao(nomeText) || fibrasFromEspecificacao(lineText);
      if (!tipo) continue;

      let met = parseMetragemCell(cols[metragemIdx]);
      if (met === "" && /R\$/i.test(lineText)) {
        met = extractMetragemFromLinhaCabo(lineText);
      }
      if (met === "") {
        for (let c = 0; c < cols.length; c++) {
          if (c === precoIdx || parecePrecoCelula(cols[c])) continue;
          if (/unidade|^m$|^mt$/i.test(cols[c]) && !/\d{2,}/.test(cols[c])) continue;
          const v = parseMetragemCell(cols[c]);
          if (v !== "") {
            met = v;
            break;
          }
        }
      }
      pushCabo(cabos, seen, tipo, met);
    }
    return cabos;
  }

  async function extractTableCabosFromPage(page) {
    const content = await page.getTextContent();
    const items = pageItemsFromContent(content);
    if (!items.length) return [];
    const lineText = items.map((i) => i.str).join(" ");
    if (!/metragem|lan[çc]amento|cfoa|fibras/i.test(lineText)) return [];
    return extractTableCabosFromRows(groupItemsIntoRows(items));
  }

  function mergeCabosLists(tableCabos, textCabos) {
    const seen = new Set();
    const out = [];
    const add = (list) => {
      for (const c of list || []) {
        if (!c?.tipo || seen.has(c.tipo)) continue;
        if (c.metragem === "" || c.metragem == null) continue;
        seen.add(c.tipo);
        out.push({ tipo: c.tipo, metragem: c.metragem });
      }
    };
    add(tableCabos);
    add(textCabos);
    return out;
  }

  /**
   * Metragem na linha da tabela: … 12 FIBRAS NR  m  850  R$ 2,02  R$ 1.717,00
   * Usa o número antes do primeiro R$ (850), nunca os preços.
   */
  function extractMetragemFromLinhaCabo(line) {
    const ln = String(line || "");
    const fibrasM = ln.match(/(\d{1,3})\s*fibras?\s*(?:nr|n\.?r\.?)?/i);
    if (!fibrasM) return "";

    const antesPreco = ln.match(
      /fibras?\s*(?:nr|n\.?r\.?)?\s*(?:\s*m\b|\s*mt\b)?\s*([\d]{1,3}(?:\.[\d]{3})*|\d+)\s*R\$/i,
    );
    if (antesPreco?.[1]) {
      const v = parseMetragemBr(antesPreco[1]);
      if (v !== "") return v;
    }

    const afterFibras = ln.slice(fibrasM.index + fibrasM[0].length);
    const beforeMoney = afterFibras.split(/R\$/i)[0] || "";
    const chunk = beforeMoney.replace(/\b(nr|n\.?r\.?|m|mt|metros?|un|unidade)\b/gi, " ").trim();

    const re = /([\d]{1,3}(?:\.[\d]{3})+|\d+)/g;
    let nm;
    while ((nm = re.exec(chunk)) !== null) {
      if (/,\d/.test(nm[1])) continue;
      const v = parseMetragemBr(nm[1]);
      if (v === "") continue;
      if (Number(v) === parseInt(fibrasM[1], 10)) continue;
      if (Number(v) === 80 && /\b80\s+s\b/i.test(ln)) continue;
      return v;
    }
    return "";
  }

  function metragemLinhasVizinhas(lines, i) {
    for (const j of [i + 1, i - 1, i + 2]) {
      if (j < 0 || j >= lines.length) continue;
      if (!linhaPareceMetragem(lines[j])) continue;
      const v = parseMetragemBr(lines[j]);
      if (v !== "") return v;
    }
    return "";
  }

  /** Metragem (metros) — separador de milhar com ponto, sem confundir com R$. */
  function parseMetragemBr(raw) {
    if (raw == null || raw === "") return "";
    let s = String(raw).trim().replace(/\s*m(?:etros?)?\s*$/i, "");
    if (/,\d{1,2}$/.test(s.replace(/\s/g, ""))) return "";
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      const n = parseInt(s.replace(/\./g, ""), 10);
      return Number.isFinite(n) && n >= 0 ? n : "";
    }
    if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/\.\d{3}$/.test(s) && !/,/.test(s)) {
      s = s.replace(/\./g, "");
    } else {
      s = s.replace(/,/g, ".");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "";
  }

  function findIndexInText(text, patterns) {
    if (!text) return -1;
    const list = Array.isArray(patterns) ? patterns : [patterns];
    for (const re of list) {
      const m = text.match(re);
      if (m?.index != null) return m.index;
    }
    return -1;
  }

  /** Tópico 4 do PDF padrão: "4. Custo" (singular) + subitens 4.1 / 4.1.1 */
  const RE_SECAO_4_HEAD = [
    /(?:^|\n)\s*4\s*[\.\):\-–]\s*custo[s]?\b/i,
    /(?:^|\n)\s*4\s*[\.\):\-–]?\s*custo[s]?\b/i,
    /(?:^|\n)\s*4\s*[-–]\s*custo[s]?\b/i,
    /(?:^|\n)\s*4\s+custo[s]?\b/i,
    /(?:^|\n)\s*(?:t[óo]pico|item|cap[ií]tulo)\s*4\s*[:\.\-–]?\s*custo[s]?\b/i,
  ];

  function findSecao4Start(text) {
    let idx = findIndexInText(text, RE_SECAO_4_HEAD);
    if (idx >= 0) return idx;

    const lines = text.split("\n");
    let offset = 0;
    for (const line of lines) {
      const l = line.trim();
      if (!l) {
        offset += 1;
        continue;
      }
      if (/^4\s*[\.\):\-–]\s*custo[s]?\b/i.test(l) || /^4\s*[\.\):\-–]?\s*custo[s]?\b/i.test(l)) return offset;
      if (/^4\b/.test(l) && /\bcusto[s]?\b/i.test(l) && l.length < 120) return offset;
      offset += line.length + 1;
    }

    const loose = text.match(/\b4\b[^\n]{0,50}?custo[s]?\b|custo[s]?\b[^\n]{0,50}?\b4\b/i);
    return loose?.index ?? -1;
  }

  function extractSecao4Custos(text) {
    const norm = normalizePdfText(text);
    const from = findSecao4Start(norm);
    if (from < 0) return "";

    const rest = norm.slice(from);
    const nextPatterns = [
      /(?:^|\n)\s*5\s*[\.\):\-–]\s+\S/i,
      /(?:^|\n)\s*5\s*[\.\):]\s+/i,
      /(?:^|\n)\s*(?:t[óo]pico|item)\s*5\b/i,
    ];
    let end = rest.length;
    const tail = rest.slice(12);
    for (const re of nextPatterns) {
      const n = tail.search(re);
      if (n >= 0) end = Math.min(end, n + 12);
    }
    return rest.slice(0, end);
  }

  /** Planilha: cabeçalho "LANÇAMENTO DE CABOS" (seção 4.1.1 Custo de Lançamento). */
  const RE_LANCAMENTO_HEAD = [
    /lan[çc]amento\s+de\s+cabos/i,
    /lan[çc\u00e7]amento\s+de\s+cabos/i,
    /4\s*\.?\s*1\s*\.?\s*1\s+custo\s+de\s+lan[çc]amento/i,
    /custo\s+de\s+lan[çc]amento/i,
    /4\s*\.?\s*1\s+detalhamento\s+de\s+materiais/i,
    /lan[çc]amento\s*(?:de\s*)?cabos?/i,
    /lan\s*[çc]?\s*amento\s*(?:de\s*)?cabos?/i,
    /lancamento\s+de\s+cabos/i,
    /lancamento\s*(?:de\s*)?cabos?/i,
  ];

  /** Bloco da tabela / planilha Lançamento (tópico 4 ou documento inteiro). */
  function extractLancamentoBlock(searchText) {
    if (!searchText) return "";
    let idx = findIndexInText(searchText, RE_LANCAMENTO_HEAD);
    if (idx < 0) {
      const m411 = searchText.match(/4\s*\.?\s*1\s*\.?\s*1\s+custo\s+de\s+lan[çc]amento/i);
      if (m411?.index != null) idx = m411.index;
    }
    if (idx < 0) return "";

    let block = searchText.slice(idx);
    const stopPatterns = [
      /(?:^|\n)\s*(?:total(?:\s+geral|\s+de)?\s+metragem|metragem\s+total)\b/i,
      /(?:^|\n)\s*5\s*[\.\):\-–]\s+/i,
      /(?:^|\n)\s*(?:observa[çc][õo]es?|anexo|assinatura)\b/i,
      /(?:^|\n)\s*(?:t[óo]pico|item)\s*5\b/i,
    ];
    const tail = block.slice(30);
    let stopAt = block.length;
    for (const re of stopPatterns) {
      const n = tail.search(re);
      if (n >= 0) stopAt = Math.min(stopAt, n + 30);
    }
    block = block.slice(0, stopAt);
    return block.slice(0, 8000);
  }

  /** Janela ao redor da primeira especificação CFOA / "XX fibras" (fallback). */
  function extractFibrasWindow(text) {
    if (!text) return "";
    const m = text.match(/cfoa\s+.+?\d{1,3}\s*fibras?|\d{1,3}\s*fibras?\b/i);
    if (!m?.index) return "";
    const start = Math.max(0, m.index - 400);
    return text.slice(start, m.index + 5500);
  }

  function pushCabo(cabos, seen, tipo, metragem) {
    if (!tipo || metragem === "" || metragem == null) return;
    if (seen.has(tipo)) return;
    seen.add(tipo);
    cabos.push({ tipo, metragem });
  }

  /**
   * Tabela lançamento: CFOA … 12 FIBRAS NR → FO-12; também "06 fibras" simples.
   */
  function extractCabosLancamento(lancamentoText) {
    const cabos = [];
    const seen = new Set();
    const lines = String(lancamentoText || "")
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const flat = lines.join(" ");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/fibras?\b/i.test(line) && !/cfoa\b/i.test(line)) continue;
      const tipo = fibrasFromEspecificacao(line);
      if (!tipo) continue;
      let met = extractMetragemFromLinhaCabo(line);
      if (met === "") met = metragemLinhasVizinhas(lines, i);
      pushCabo(cabos, seen, tipo, met);
    }

    const reFibrasMetragemAntesPreco =
      /(\d{1,3})\s*fibras?\s*(?:nr|n\.?r\.?)?\s*(?:\s*m\b)?\s*([\d]{1,3}(?:\.[\d]{3})*|\d+)\s*R\$/gi;
    let m;
    while ((m = reFibrasMetragemAntesPreco.exec(flat)) !== null) {
      pushCabo(cabos, seen, fibrasToTipo(m[1]), parseMetragemBr(m[2]));
    }

    const reCfoaFlat =
      /\bcfoa\s+[\w\s]*?(\d{1,3})\s*fibras?\s*(?:nr|n\.?r\.?)?/gi;
    while ((m = reCfoaFlat.exec(flat)) !== null) {
      const tipo = fibrasToTipo(m[1]);
      const met = extractMetragemFromLinhaCabo(m[0]);
      pushCabo(cabos, seen, tipo, met);
    }

    for (let i = 0; i < lines.length; i++) {
      const n = lines[i];
      if (!/^(\d{1,3})$/.test(n)) continue;
      const tipo = fibrasToTipo(n);
      if (!tipo) continue;

      const next = lines[i + 1] || "";
      if (/^fibras?\b/i.test(next)) {
        const onLine = next.match(/fibras?\s+([\d.,]+)/i);
        const met =
          (onLine && parseMetragemBr(onLine[1])) ||
          (lines[i + 2] && /^[\d.,]+$/.test(lines[i + 2]) ? parseMetragemBr(lines[i + 2]) : "");
        pushCabo(cabos, seen, tipo, met);
        continue;
      }
      if (/fibras?/i.test(next)) {
        const fm = next.match(/(\d{1,3})\s*fibras?\s+([\d.,]+)/i);
        if (fm) pushCabo(cabos, seen, fibrasToTipo(fm[1]), parseMetragemBr(fm[2]));
      }
    }

    return cabos;
  }

  function extractCabosFromSecaoCustos(fullText) {
    const norm = normalizePdfText(fullText);
    const pages = splitPdfPages(fullText);

    let secao = "";
    for (const p of pages) {
      const s = extractSecao4Custos(p);
      if (s.length > secao.length) secao = s;
    }
    if (!secao) secao = extractSecao4Custos(norm);

    let lancamento = extractLancamentoBlock(secao);
    let source = "";

    if (lancamento) {
      source = "secao4_lancamento";
    } else {
      for (const p of pages) {
        const l = extractLancamentoBlock(p);
        if (l.length > lancamento.length) lancamento = l;
      }
      if (!lancamento) lancamento = extractLancamentoBlock(norm);
      if (lancamento) source = "doc_lancamento";
    }

    if (!lancamento && secao) {
      lancamento = secao;
      source = "secao4_inteira";
    }

    if (!lancamento) {
      for (const p of pages.slice(1)) {
        const w = extractFibrasWindow(p);
        if (w.length > lancamento.length) lancamento = w;
      }
      if (!lancamento) {
        const idx = findSecao4Start(norm);
        const nearCustos = idx >= 0 ? norm.slice(idx) : norm;
        lancamento = extractFibrasWindow(nearCustos) || extractFibrasWindow(norm);
      }
      if (lancamento) source = "janela_fibras";
    }

    let cabos = lancamento ? extractCabosLancamento(lancamento) : [];
    if (!cabos.length && secao) cabos = extractCabosLancamento(secao);
    if (!cabos.length) {
      for (const p of pages) {
        const c = extractCabosLancamento(extractFibrasWindow(p));
        if (c.length > cabos.length) cabos = c;
      }
    }

    return {
      cabos,
      secao,
      lancamento,
      source: cabos.length ? source : "",
      foundSecao4: secao.length > 0,
      foundLancamentoTitle: findIndexInText(secao || norm, RE_LANCAMENTO_HEAD) >= 0,
    };
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

  const RE_SECAO_2_HEAD = [
    /(?:^|\n)\s*2\s*[\.\):\-–]\s*escopo\s+do\s+projeto\b/i,
    /(?:^|\n)\s*2\s*[\.\):\-–]?\s*escopo\s+do\s+projeto\b/i,
    /(?:^|\n)\s*(?:t[óo]pico|item|cap[ií]tulo)\s*2\s*[:\.\-–]?\s*escopo\s+do\s+projeto\b/i,
  ];

  function findSecao2Start(text) {
    let idx = findIndexInText(text, RE_SECAO_2_HEAD);
    if (idx >= 0) return idx;

    const lines = text.split("\n");
    let offset = 0;
    for (const line of lines) {
      const l = line.trim();
      if (!l) {
        offset += 1;
        continue;
      }
      if (/^2\s*[\.\):\-–]\s*escopo\s+do\s+projeto\b/i.test(l)) return offset;
      if (/^2\b/.test(l) && /escopo\s+do\s+projeto/i.test(l) && l.length < 140) return offset;
      offset += line.length + 1;
    }
    return -1;
  }

  function extractSecao2Escopo(text) {
    const norm = normalizePdfText(text);
    const from = findSecao2Start(norm);
    if (from < 0) return "";

    const rest = norm.slice(from);
    const nextPatterns = [
      /(?:^|\n)\s*3\s*[\.\):\-–]\s+\S/i,
      /(?:^|\n)\s*3\s*[\.\):]\s+/i,
      /(?:^|\n)\s*(?:t[óo]pico|item)\s*3\b/i,
    ];
    let end = rest.length;
    const tail = rest.slice(20);
    for (const re of nextPatterns) {
      const n = tail.search(re);
      if (n >= 0) end = Math.min(end, n + 20);
    }
    return rest.slice(0, end);
  }

  /** Tabela do escopo: cabeçalho CUSTO ESTIMADO → linhas MO → coluna SOMA PARCIAL. */
  function extractBlocoCustoEstimado(searchText) {
    if (!searchText) return "";
    const idx = searchText.search(/custo\s+estimado/i);
    if (idx < 0) return "";

    let block = searchText.slice(idx);
    const tail = block.slice(15);
    const stopInvest = tail.search(/(?:^|\n)\s*investimento\b/i);
    if (stopInvest >= 0) block = block.slice(0, stopInvest + 15);

    const tail2 = block.slice(30);
    const stopSec = tail2.search(/(?:^|\n)\s*3\s*[\.\):\-–]\s+/i);
    if (stopSec >= 0) block = block.slice(0, stopSec + 30);
    return block;
  }

  function normalizeLineMaoObra(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[""]/g, '"');
  }

  function isMaoObraRegionalLine(lineNorm) {
    if (/material\s+classe/i.test(lineNorm)) return false;
    if (/mao\s*de\s*obra\s+classe/i.test(lineNorm)) return false;
    if (/terceirizad/i.test(lineNorm)) return false;
    return (
      /mao\s*de\s*obra\s+regional\b/.test(lineNorm) ||
      /\bmob\s+regional\b/.test(lineNorm) ||
      /\bm\.?\s*o\.?\s*regional\b/.test(lineNorm)
    );
  }

  /** Terceirizada no PDF padrão: MO Classe "L" e MO Classe "F" (soma parcial de cada). */
  function isMaoObraTerceirizadaLine(lineNorm) {
    if (/material\s+classe/i.test(lineNorm)) return false;
    return (
      /mao\s*de\s*obra\s+classe\s*["']?\s*[lf]\s*["']?/.test(lineNorm) ||
      /mao\s*de\s*obra\s+classe\s+[lf]\b/.test(lineNorm) ||
      /mao\s*de\s*obra\s+terceirizad/.test(lineNorm) ||
      /\bmob\s+terceirizad/.test(lineNorm) ||
      /\bm\.?\s*o\.?\s*terceirizad/.test(lineNorm)
    );
  }

  function isLinhaMaoObraCusto(lineNorm) {
    return isMaoObraRegionalLine(lineNorm) || isMaoObraTerceirizadaLine(lineNorm);
  }

  /** Último valor monetário da linha = coluna "Soma parcial" da tabela do escopo. */
  function extractSomaParcialFromLinha(line) {
    const ln = String(line || "");
    if (!ln.trim()) return "";
    const valores = [];
    const re = /R?\$?\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?|\d+(?:,\d{2})?)/gi;
    let m;
    while ((m = re.exec(ln)) !== null) {
      const v = parseMoneyBr(m[1]);
      if (v !== "" && Number.isFinite(Number(v))) valores.push(Number(v));
    }
    if (!valores.length) return "";
    return Math.round(valores[valores.length - 1] * 100) / 100;
  }

  function somaParcialLinhaVizinha(lines, i) {
    for (const j of [i + 1, i + 2, i + 3]) {
      if (j >= lines.length) continue;
      const norm = normalizeLineMaoObra(lines[j]);
      if (isLinhaMaoObraCusto(norm)) continue;
      if (/^(?:custo\s+estimado|soma\s+parcial|investimento|material)\b/i.test(norm)) continue;
      const v = extractSomaParcialFromLinha(lines[j]);
      if (v !== "") return v;
    }
    return "";
  }

  function parseLinhasCustoEstimado(bloco) {
    const lines = String(bloco || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let custoRegional = "";
    let terceirizadaTotal = 0;
    let terceirizadaHas = false;

    for (let i = 0; i < lines.length; i++) {
      const norm = normalizeLineMaoObra(lines[i]);
      const isReg = isMaoObraRegionalLine(norm);
      const isTer = isMaoObraTerceirizadaLine(norm);
      if (!isReg && !isTer) continue;

      let val = extractSomaParcialFromLinha(lines[i]);
      if (val === "") val = somaParcialLinhaVizinha(lines, i);
      if (val === "") continue;

      if (isReg) custoRegional = val;
      if (isTer) {
        terceirizadaTotal += Number(val);
        terceirizadaHas = true;
      }
    }

    return { custoRegional, terceirizadaTotal, terceirizadaHas };
  }

  /**
   * 2. Escopo do projeto → tabela CUSTO ESTIMADO (SOMA PARCIAL):
   * MO Regional; MO Classe "L" + MO Classe "F" → terceirizada (soma).
   */
  function extractExecucaoFromEscopoProjeto(text) {
    const norm = normalizePdfText(text);
    const secao2 = extractSecao2Escopo(norm);
    let bloco = secao2 ? extractBlocoCustoEstimado(secao2) : "";
    if (!bloco) bloco = extractBlocoCustoEstimado(norm);

    const empty = {
      execucao: "",
      custoRegional: "",
      custoTerceirizada: "",
      foundSecao2: false,
      foundCustoEstimado: false,
    };
    if (!bloco) return empty;

    const parsed = parseLinhasCustoEstimado(bloco);
    const hasReg = parsed.custoRegional !== "";
    const hasTer = parsed.terceirizadaHas;
    let execucao = "";
    if (hasReg && hasTer) execucao = "Regional + Terceirizada";
    else if (hasReg) execucao = "Regional";
    else if (hasTer) execucao = "Terceirizada";

    return {
      execucao,
      custoRegional: hasReg ? parsed.custoRegional : "",
      custoTerceirizada: hasTer ? Math.round(parsed.terceirizadaTotal * 100) / 100 : "",
      foundSecao2: secao2.length > 0,
      foundCustoEstimado: true,
    };
  }

  function parseCustoText(input) {
    const text = typeof input === "string" ? input : input?.text || "";
    const tableCabos = Array.isArray(input?.tableCabos) ? input.tableCabos : [];
    const normalized = normalizePdfText(text);
    const pages = splitPdfPages(text);
    const firstPage = pages[0] || normalized;
    const flat = flatText(normalized);
    const warnings = [];
    const values = {};

    values.valorProjeto = extractValorProjetoFromPdf(pages, normalized);
    if (values.valorProjeto === "") {
      warnings.push(
        "CAPEX estimado não encontrado na 1ª página — confira o preview da página 1 (rótulo e valor em R$).",
      );
    }

    const portasP1 = extractPortasFromFirstPage(firstPage);
    for (const k of PORTAS_KEYS) {
      if (portasP1[k] !== "") values[k] = portasP1[k];
    }

    const escopoExec = extractExecucaoFromEscopoProjeto(normalized);
    if (escopoExec.execucao) values.execucao = escopoExec.execucao;
    if (escopoExec.custoRegional !== "") values.custoRegional = escopoExec.custoRegional;
    if (escopoExec.custoTerceirizada !== "") values.custoTerceirizada = escopoExec.custoTerceirizada;

    for (const [key, patterns] of Object.entries(PDF_CUSTO_PATTERNS)) {
      if (key === "valorProjeto") continue;
      if (PORTAS_KEYS.includes(key)) continue;
      if (key === "custoRegional" || key === "custoTerceirizada") continue;
      const raw = firstMatch(flat, patterns) || firstMatch(normalized, patterns);
      if (!raw) continue;
      if (key.startsWith("qtd") || key === "penetracaoAtual" || key === "novaPenetracao") {
        values[key] = parseIntBr(raw);
      } else if (key === "totalMetragem" || key.startsWith("valor") || key.startsWith("custo")) {
        values[key] = parseMoneyBr(raw);
      }
    }

    const lancamentoExtract = extractCabosFromSecaoCustos(normalized);
    const cabos = mergeCabosLists(tableCabos, lancamentoExtract.cabos);
    if (tableCabos.length) lancamentoExtract.source = lancamentoExtract.source || "tabela_colunas";
    if (cabos.length) {
      const soma = sumMetragemCabos(cabos);
      if (soma !== "") values.totalMetragem = soma;
    } else if (!lancamentoExtract.foundSecao4) {
      warnings.push(
        'Tópico "4. Custo" não localizado — o PDF padrão usa esse título (não "4. Custos"). Confira o preview.',
      );
    } else if (!lancamentoExtract.foundLancamentoTitle && !cabos.length) {
      warnings.push(
        'Tópico 4 encontrado, mas "LANÇAMENTO DE CABOS" / "4.1.1 Custo de Lançamento" não — confira o preview.',
      );
    } else if (lancamentoExtract.lancamento && !cabos.length) {
      warnings.push(
        'Lançamento localizado, mas nenhum cabo com metragem — confira linhas CFOA … XX FIBRAS NR no preview.',
      );
    }

    const found = Object.keys(values).filter((k) => values[k] !== "").length;

    if (!found && !cabos.length) {
      warnings.push(
        "Nenhum campo reconhecido automaticamente. Confira se o PDF tem texto selecionável (não é só imagem escaneada).",
      );
    }

    return {
      values,
      cabos,
      warnings,
      textPreview: normalized.slice(0, 4000),
      textPreviewFirstPage: firstPage.slice(0, 2500),
      textPreviewLancamento: (lancamentoExtract.lancamento || lancamentoExtract.secao || "").slice(0, 3500),
      textPreviewSecao4: (lancamentoExtract.secao || "").slice(0, 3500),
      valorProjetoSource: values.valorProjeto !== "" ? "capex_estimado_p1" : "",
      portasSource:
        portasP1.qtdNovasPortas !== "" || portasP1.qtdCasas !== "" || portasP1.qtdPortasAtual !== ""
          ? "pagina1_capex_estudo_area"
          : "",
      cabosSource: lancamentoExtract.source || "",
      execucaoSource:
        escopoExec.foundCustoEstimado && escopoExec.execucao
          ? "escopo_custo_estimado_soma_parcial"
          : "",
      pdfDebug: {
        foundSecao2: escopoExec.foundSecao2,
        foundSecao4: lancamentoExtract.foundSecao4,
        foundLancamentoTitle: lancamentoExtract.foundLancamentoTitle,
        source: lancamentoExtract.source,
      },
      hasLevantamento: found > 0 || cabos.length > 0,
      hasPortas: hasPortasValues(values),
      hasLancamento: cabos.length > 0,
    };
  }

  async function extractPageTextWithLines(page) {
    const content = await page.getTextContent();
    const items = pageItemsFromContent(content);
    if (!items.length) return "";
    const rows = groupItemsIntoRows(items);
    return rows.map((row) => row.map((i) => i.str).join(" ")).join("\n");
  }

  async function extractTextFromPdfFile(file) {
    const lib = global.pdfjsLib;
    if (!lib?.getDocument) {
      throw new Error("Biblioteca PDF.js não carregou. Recarregue a página (Ctrl+F5).");
    }
    const data = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data }).promise;
    const parts = [];
    const tableCabos = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const pageText = await extractPageTextWithLines(page);
      parts.push(pageText);
      const fromTable = await extractTableCabosFromPage(page);
      if (fromTable.length) tableCabos.push(...fromTable);
    }
    return {
      text: parts.join(PDF_PAGE_SEP),
      tableCabos: mergeCabosLists(tableCabos, []),
    };
  }

  global.DemandasPdfCusto = {
    TIPOS_CABO,
    PDF_PAGE_SEP,
    parseCustoText,
    extractTextFromPdfFile,
    extractCabosFromSecaoCustos,
    extractPortasFromFirstPage,
    extractExecucaoFromEscopoProjeto,
    splitPdfPages,
    fibrasToTipo,
    fibrasFromEspecificacao,
  };
})(typeof window !== "undefined" ? window : globalThis);
