/**
 * Utilities for rendering and exporting Results table data.
 * These helpers stay framework-agnostic so they can be unit-tested easily.
 */

/**
 * Calculate a stable column order for table rendering + CSV export.
 * We preserve the first row's keys first, then append any missing keys.
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string[]}
 */
export function buildColumnOrder(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const columns = Object.keys(rows[0] ?? {});
  rows.forEach((row) => {
    Object.keys(row ?? {}).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });
  return columns;
}

/**
 * Normalize table cell values for display and filtering.
 * @param {unknown} value
 * @returns {string}
 */
export function formatCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

/**
 * Filter table rows by a case-insensitive query across visible columns.
 * @param {Array<Record<string, unknown>> | null} rows
 * @param {string} filterText
 * @param {string[]} visibleColumns
 * @returns {Array<Record<string, unknown>> | null}
 */
export function filterTableRows(rows, filterText, visibleColumns = []) {
  if (!Array.isArray(rows)) return null;
  const trimmed = filterText.trim();
  if (!trimmed) return rows;
  const needle = trimmed.toLowerCase();
  const columnsToScan =
    Array.isArray(visibleColumns) && visibleColumns.length > 0
      ? visibleColumns
      : buildColumnOrder(rows);
  return rows.filter((row) =>
    columnsToScan.some((column) =>
      formatCellValue(row?.[column]).toLowerCase().includes(needle),
    ),
  );
}

/**
 * Build a CSV string from table data.
 * We preserve the first row's keys as a stable column order for readability.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} selectedColumns
 * @param {string} delimiter
 * @returns {string}
 */
export function buildCsv(rows, selectedColumns, delimiter = ",") {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const allColumns = buildColumnOrder(rows);
  const headers =
    Array.isArray(selectedColumns) && selectedColumns.length
      ? allColumns.filter((column) => selectedColumns.includes(column))
      : allColumns;
  const escapeValue = (value) => {
    if (value === null || value === undefined) return "";
    const normalized = formatCellValue(value);
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  };
  const lines = [
    headers.map(escapeValue).join(delimiter),
    ...rows.map((row) =>
      headers.map((header) => escapeValue(row?.[header])).join(delimiter),
    ),
  ];
  return lines.join("\n");
}

/**
 * Split a cell value into highlight parts based on the filter text.
 * Returning structured parts keeps rendering safe from HTML injection.
 * @param {string} value
 * @param {string} filterText
 * @returns {Array<{ text: string; isMatch: boolean }>}
 */
export function getHighlightParts(value, filterText) {
  const normalizedValue = value ?? "";
  const trimmed = filterText.trim();
  if (!trimmed) {
    return [{ text: normalizedValue, isMatch: false }];
  }
  const lowerValue = normalizedValue.toLowerCase();
  const lowerNeedle = trimmed.toLowerCase();
  const parts = [];
  let cursor = 0;
  while (cursor < normalizedValue.length) {
    const index = lowerValue.indexOf(lowerNeedle, cursor);
    if (index === -1) {
      parts.push({
        text: normalizedValue.slice(cursor),
        isMatch: false,
      });
      break;
    }
    if (index > cursor) {
      parts.push({
        text: normalizedValue.slice(cursor, index),
        isMatch: false,
      });
    }
    parts.push({
      text: normalizedValue.slice(index, index + lowerNeedle.length),
      isMatch: true,
    });
    cursor = index + lowerNeedle.length;
  }
  return parts;
}
