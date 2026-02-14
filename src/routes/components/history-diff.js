/**
 * Build a lightweight request/response diff summary for two history entries.
 * We keep this intentionally simple and readable for quick triage in the UI.
 */
export function buildHistoryDiff(leftEntry, rightEntry) {
  if (!leftEntry || !rightEntry) {
    return null;
  }

  const queryChanged =
    normalizeText(leftEntry.query) !== normalizeText(rightEntry.query);
  const variablesChanged =
    normalizeText(leftEntry.variables) !== normalizeText(rightEntry.variables);
  const endpointChanged =
    normalizeText(leftEntry.endpoint) !== normalizeText(rightEntry.endpoint);
  const statusChanged =
    normalizeText(leftEntry.status) !== normalizeText(rightEntry.status);

  const leftResult = safeJsonStringify(leftEntry.result);
  const rightResult = safeJsonStringify(rightEntry.result);
  const resultChanged = leftResult !== rightResult;

  const leftLines = (leftResult ?? "").split("\n");
  const rightLines = (rightResult ?? "").split("\n");
  const lineDelta = Math.abs(leftLines.length - rightLines.length);

  return {
    leftId: leftEntry.id,
    rightId: rightEntry.id,
    queryChanged,
    variablesChanged,
    endpointChanged,
    statusChanged,
    resultChanged,
    resultLineDelta: lineDelta,
    changeCount: [
      queryChanged,
      variablesChanged,
      endpointChanged,
      statusChanged,
      resultChanged,
    ].filter(Boolean).length,
  };
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return null;
  }
}
