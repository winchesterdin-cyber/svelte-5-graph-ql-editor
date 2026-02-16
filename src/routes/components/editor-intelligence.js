/**
 * Lightweight editor intelligence helpers used by the Query Editor UI.
 * These utilities intentionally avoid heavy parser dependencies while still
 * giving users useful diagnostics, operation discovery, and suggestions.
 */

const OPERATION_REGEX =
  /(query|mutation|subscription)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?\s*(\([^)]*\))?/g;
const FRAGMENT_REGEX =
  /fragment\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\s+([A-Za-z_][A-Za-z0-9_]*)/g;

export function getOperationOutline(query = "") {
  const operations = [];
  const source = String(query);
  let match;

  while ((match = OPERATION_REGEX.exec(source)) !== null) {
    const [, type, rawName = "", variables = ""] = match;
    const isAnonymous = !rawName;
    operations.push({
      type,
      name: rawName || "AnonymousOperation",
      variables,
      index: match.index,
      isAnonymous,
      fields: getTopLevelFieldsForOperation(source, match.index),
    });
  }

  let fragmentMatch;
  while ((fragmentMatch = FRAGMENT_REGEX.exec(source)) !== null) {
    operations.push({
      type: "fragment",
      name: fragmentMatch[1],
      onType: fragmentMatch[2],
      variables: "",
      index: fragmentMatch.index,
      isAnonymous: false,
      fields: getTopLevelFieldsForOperation(source, fragmentMatch.index),
    });
  }

  // Keep backwards-compatible fallback for shorthand documents.
  if (!operations.length && source.trim()) {
    operations.push({
      type: "query",
      name: "UnnamedOperation",
      variables: "",
      index: 0,
      isAnonymous: true,
      fields: getTopLevelFieldsForOperation(source, 0),
    });
  }

  return operations;
}

function getTopLevelFieldsForOperation(query, operationStartIndex) {
  const selectionStart = query.indexOf("{", operationStartIndex);
  if (selectionStart < 0) return [];

  const fields = [];
  let depth = 1;
  let cursor = selectionStart + 1;
  let segment = "";

  const flushSegment = () => {
    const match = segment.match(/([A-Za-z_][A-Za-z0-9_]*)/);
    if (match && !fields.includes(match[1])) {
      fields.push(match[1]);
    }
    segment = "";
  };

  while (cursor < query.length && depth > 0) {
    const char = query[cursor];

    if (char === "{") {
      if (depth === 1) {
        flushSegment();
      }
      depth += 1;
      cursor += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 1) {
        flushSegment();
      }
      depth -= 1;
      cursor += 1;
      continue;
    }

    if (depth === 1) {
      if (char === "\n" || char === ",") {
        flushSegment();
      } else {
        segment += char;
      }
    }

    cursor += 1;
  }

  return fields;
}

export function getDiagnostics({
  query = "",
  endpoint = "",
  variables = "",
  headers = "",
} = {}) {
  const diagnostics = [];
  const source = String(query);

  if (!source.trim()) {
    diagnostics.push({
      level: "warn",
      code: "EMPTY_QUERY",
      message: "Query document is empty.",
    });
  }

  const bracketCheck = getBalanceDiagnostics(source);
  diagnostics.push(...bracketCheck);

  const operations = getOperationOutline(source).filter(
    (entry) => entry.type !== "fragment",
  );
  if (source.trim() && operations.length === 0) {
    diagnostics.push({
      level: "error",
      code: "NO_OPERATION",
      message: "No GraphQL operation detected in document.",
    });
  }

  const endpointText = String(endpoint).trim();
  if (!endpointText) {
    diagnostics.push({
      level: "warn",
      code: "MISSING_ENDPOINT",
      message: "Endpoint is required before execution.",
    });
  } else {
    const normalizedEndpoint = endpointText.startsWith("http")
      ? endpointText
      : `https://${endpointText}`;
    try {
      // Validate URL format early to prevent avoidable request failures.
      new URL(normalizedEndpoint);
    } catch {
      diagnostics.push({
        level: "error",
        code: "ENDPOINT_URL",
        message:
          "Endpoint must be a valid URL (for example: https://api.example.com/graphql).",
      });
    }
  }

  const headersText = String(headers).trim();
  if (headersText) {
    try {
      const parsedHeaders = JSON.parse(headersText);
      if (
        !parsedHeaders ||
        typeof parsedHeaders !== "object" ||
        Array.isArray(parsedHeaders)
      ) {
        diagnostics.push({
          level: "error",
          code: "HEADERS_SHAPE",
          message: "Headers JSON must be an object.",
        });
      }
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "HEADERS_JSON",
        message: `Headers JSON parse error: ${error.message}`,
      });
    }
  }

  const variablesText = String(variables).trim();
  if (variablesText) {
    try {
      const parsed = JSON.parse(variablesText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        diagnostics.push({
          level: "error",
          code: "VARIABLES_SHAPE",
          message: "Variables JSON must be an object.",
        });
      }
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "VARIABLES_JSON",
        message: `Variables JSON parse error: ${error.message}`,
      });
    }
  }

  return diagnostics;
}

function getBalanceDiagnostics(source) {
  const diagnostics = [];
  const stack = [];
  const pairs = {
    "{": "}",
    "(": ")",
    "[": "]",
  };
  const closing = new Set(Object.values(pairs));

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (pairs[char]) {
      stack.push({ char, index });
      continue;
    }
    if (closing.has(char)) {
      const open = stack.pop();
      if (!open || pairs[open.char] !== char) {
        diagnostics.push({
          level: "error",
          code: "UNBALANCED_TOKEN",
          message: `Unexpected closing token "${char}" at index ${index}.`,
        });
      }
    }
  }

  if (stack.length) {
    stack.forEach((entry) => {
      diagnostics.push({
        level: "error",
        code: "MISSING_CLOSING_TOKEN",
        message: `Missing closing token for "${entry.char}" opened at index ${entry.index}.`,
      });
    });
  }

  return diagnostics;
}

export function getSchemaSuggestions({
  schema = null,
  query = "",
  cursorIndex = 0,
  limit = 8,
} = {}) {
  if (!schema?.types?.length) return [];

  const queryTypeName = schema.queryType?.name ?? "Query";
  const queryType = schema.types.find((type) => type.name === queryTypeName);
  const fields = queryType?.fields ?? [];
  if (!fields.length) return [];

  const clampedCursor = Math.max(0, Math.min(cursorIndex, query.length));
  const beforeCursor = query.slice(0, clampedCursor);
  const tokenMatch = beforeCursor.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  const token = tokenMatch?.[0] ?? "";
  const loweredToken = token.toLowerCase();

  return fields
    .filter((field) => field.name.toLowerCase().includes(loweredToken))
    .slice(0, limit)
    .map((field) => ({
      label: field.name,
      detail: field.type?.name ?? field.type?.kind ?? "Unknown",
      documentation: field.description ?? "No schema description available.",
      insertText: field.name,
    }));
}

export function getVariableDefinitions(query = "") {
  const definitions = {};
  const source = String(query);

  const variableSections = source.match(/\(([^)]*\$[^)]*)\)/g) ?? [];
  variableSections.forEach((section) => {
    const matches = section.matchAll(
      /\$([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_\[\]!]*)/g,
    );
    for (const match of matches) {
      definitions[match[1]] = match[2];
    }
  });

  return definitions;
}
