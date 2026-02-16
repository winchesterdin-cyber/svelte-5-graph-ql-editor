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

  const nestedDiff = buildNestedPathDiff(leftEntry.result, rightEntry.result);

  return {
    leftId: leftEntry.id,
    rightId: rightEntry.id,
    queryChanged,
    variablesChanged,
    endpointChanged,
    statusChanged,
    resultChanged,
    resultLineDelta: lineDelta,
    changedPaths: nestedDiff.changedPaths,
    changedPathCount: nestedDiff.changedPaths.length,
    sampleChangedPaths: nestedDiff.changedPaths.slice(0, 6),
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

/**
 * Walk both JSON payloads and record changed paths.
 * This intentionally tracks value-level deltas only (no move detection).
 */
function buildNestedPathDiff(leftValue, rightValue, basePath = "") {
  const changedPaths = [];
  if (Object.is(leftValue, rightValue)) {
    return { changedPaths };
  }

  const leftType = getValueType(leftValue);
  const rightType = getValueType(rightValue);
  if (leftType !== rightType) {
    return { changedPaths: [basePath || "(root)"] };
  }

  if (leftType === "array") {
    const maxLength = Math.max(leftValue.length, rightValue.length);
    for (let index = 0; index < maxLength; index += 1) {
      const path = `${basePath}[${index}]`;
      changedPaths.push(
        ...buildNestedPathDiff(leftValue[index], rightValue[index], path)
          .changedPaths,
      );
    }
    return { changedPaths: uniquePaths(changedPaths) };
  }

  if (leftType === "object") {
    const keys = new Set([
      ...Object.keys(leftValue ?? {}),
      ...Object.keys(rightValue ?? {}),
    ]);
    for (const key of keys) {
      const path = basePath ? `${basePath}.${key}` : key;
      changedPaths.push(
        ...buildNestedPathDiff(leftValue?.[key], rightValue?.[key], path)
          .changedPaths,
      );
    }
    return { changedPaths: uniquePaths(changedPaths) };
  }

  return { changedPaths: [basePath || "(root)"] };
}

function getValueType(value) {
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return typeof value;
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}
