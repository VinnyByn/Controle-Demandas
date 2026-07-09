/**
 * Formatação numérica pt-BR: 1.234.567,89 e % na frente.
 */
(function (global) {
  function parseNumberBr(raw) {
    if (raw == null || raw === "") return "";
    let s = String(raw)
      .trim()
      .replace(/%/g, "")
      .replace(/R\$\s*/gi, "")
      .trim();
    if (!s) return "";
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : "";
  }

  function formatNumberBr(n, decimals) {
    if (n === "" || n == null || !Number.isFinite(Number(n))) return "";
    const d = decimals == null ? 2 : decimals;
    return Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }

  function formatMoneyBr(n) {
    return formatNumberBr(n, 2);
  }

  function formatIntegerBr(n) {
    if (n === "" || n == null || !Number.isFinite(Number(n))) return "";
    return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  /** Ex.: 40,50% */
  function formatPercentBr(n) {
    const v = formatNumberBr(n, 2);
    return v === "" ? "" : `${v}%`;
  }

  /** Compat.: mesmo formato com sufixo % */
  function formatPercentBrPrefix(n) {
    return formatPercentBr(n);
  }

  global.DemandasFormatBr = {
    parseNumberBr,
    formatNumberBr,
    formatMoneyBr,
    formatIntegerBr,
    formatPercentBr,
    formatPercentBrPrefix,
  };
})(typeof window !== "undefined" ? window : globalThis);
