// Lector y escritor de CSV (RFC 4180): comillas, comillas dobles
// escapadas (""), comas y saltos de línea dentro de campos, CRLF y BOM.

export function parseCSV(text, sep = ',') {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows = [];
  let row = [], field = '', inQ = false, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === sep) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Convierte filas a objetos usando la primera fila como cabecera. */
export function parseCSVObjects(text) {
  const rows = parseCSV(text);
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, idx) => { o[h] = r[idx] ?? ''; });
    return o;
  });
  return { header, records };
}

function q(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return '"' + String(v).replace(/"/g, '""') + '"';
}
/** Genera CSV. Las cadenas van entre comillas (como Hevy); los números no. */
export function toCSV(header, rows) {
  return [header.map(q).join(','), ...rows.map((r) => r.map(q).join(','))].join('\n') + '\n';
}
