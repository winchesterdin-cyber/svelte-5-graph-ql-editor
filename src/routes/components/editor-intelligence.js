/**
 * Lightweight editor intelligence helpers used by the Query Editor UI.
 * These utilities intentionally avoid heavy parser dependencies while still
 * giving users useful diagnostics, operation discovery, and suggestions.
 */

const OPERATION_REGEX =
  /(query|mutation|subscription)(?:\s+([A-Za-z_][A-Za-z0-9_]*))?\s*(\([^)]*\))?/g;
const FRAGMENT_REGEX =
  /fragment\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\s+([A-Za-z_][A-Za-z0-9_]*)/g;

const DIAGNOSTIC_LEVEL_WEIGHT = {
  error: 0,
  warn: 1,
  info: 2,
};

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
    if (match) {
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

  diagnostics.push(...getBalanceDiagnostics(source));

  const operations = getOperationOutline(source).filter(
    (entry) => entry.type !== "fragment",
  );
  diagnostics.push(...getOperationNameDiagnostics(operations));
  diagnostics.push(...getFragmentDiagnostics(source));
  diagnostics.push(...getFragmentCycleDiagnostics(source));
  diagnostics.push(...getVariableDiagnostics(source));
  diagnostics.push(...getAnonymousOperationDiagnostics(source));
  diagnostics.push(...getOperationSelectionDiagnostics(operations));
  diagnostics.push(...getOperationVolumeDiagnostics(operations));
  diagnostics.push(...getDocumentStyleDiagnostics(source));
  diagnostics.push(...getOperationConventionDiagnostics(operations));
  diagnostics.push(...getOperationFieldDiagnostics(operations));

  if (source.trim() && operations.length === 0) {
    diagnostics.push({
      level: "error",
      code: "NO_OPERATION",
      message: "No GraphQL operation detected in document.",
    });
  }

  const metrics = getDocumentMetrics(source);
  diagnostics.push(...getComplexityDiagnostics(metrics));

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
      const parsedUrl = new URL(normalizedEndpoint);
      diagnostics.push(
        ...getEndpointQualityDiagnostics(parsedUrl, endpointText),
      );
      if (parsedUrl.protocol === "http:") {
        diagnostics.push({
          level: "warn",
          code: "INSECURE_ENDPOINT",
          message:
            "Endpoint is using http://. Prefer https:// for production and shared environments.",
        });
      }
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
      } else {
        diagnostics.push(...getHeaderEntryDiagnostics(parsedHeaders));
        diagnostics.push(...getHeaderRecommendationDiagnostics(parsedHeaders));
        diagnostics.push(...getHeaderSecurityDiagnostics(parsedHeaders));
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
      } else {
        diagnostics.push(
          ...getVariableInputDiagnostics(source, parsed, operations),
        );
        diagnostics.push(...getVariableTypeDiagnostics(source, parsed));
      }
    } catch (error) {
      diagnostics.push({
        level: "error",
        code: "VARIABLES_JSON",
        message: `Variables JSON parse error: ${error.message}`,
      });
    }
  }

  // Keep list deterministic so UI panels and tests are stable.
  return sortDiagnostics(diagnostics);
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
  const normalizedSource = normalizeQueryForStructureScan(source);

  for (let index = 0; index < normalizedSource.length; index += 1) {
    const char = normalizedSource[index];
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
    .sort((left, right) => {
      const leftLower = left.name.toLowerCase();
      const rightLower = right.name.toLowerCase();
      const leftStartsWith = leftLower.startsWith(loweredToken);
      const rightStartsWith = rightLower.startsWith(loweredToken);
      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1;
      }
      return leftLower.localeCompare(rightLower);
    })
    .slice(0, limit)
    .map((field) => ({
      label: field.name,
      detail: field.type?.name ?? field.type?.kind ?? "Unknown",
      documentation: field.description ?? "No schema description available.",
      insertText: buildSuggestionInsertText(field),
    }));
}

/**
 * Return high-level document metrics for visibility in the editor UI.
 */
export function getDocumentMetrics(query = "") {
  const source = String(query);
  const outline = getOperationOutline(source);
  const operations = outline.filter((entry) => entry.type !== "fragment");
  const fragments = outline.filter((entry) => entry.type === "fragment");
  const lines = source.split("\n");
  const nonEmptyLines = lines.map((line) => line.trim()).filter(Boolean);

  const maxSelectionDepth = getMaxSelectionDepth(source);
  const complexityScore =
    operations.length * 5 +
    fragments.length * 3 +
    maxSelectionDepth * 4 +
    Math.ceil(source.length / 120) +
    Math.ceil(nonEmptyLines.length / 10);

  return {
    characterCount: source.length,
    lineCount: nonEmptyLines.length,
    operationCount: operations.length,
    fragmentCount: fragments.length,
    maxSelectionDepth,
    topLevelFieldCount: operations.reduce(
      (count, operation) => count + (operation.fields?.length ?? 0),
      0,
    ),
    complexityScore,
    complexityLabel:
      complexityScore >= 80 ? "high" : complexityScore >= 35 ? "medium" : "low",
  };
}

export function getVariableDefinitions(query = "") {
  const definitions = {};
  const source = String(query);

  const variableSections = source.match(/\(([^)]*\$[^)]*)\)/g) ?? [];
  variableSections.forEach((section) => {
    const matches = section.matchAll(
      /\$([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\[\]A-Za-z_][A-Za-z0-9_\[\]!]*)/g,
    );
    for (const match of matches) {
      definitions[match[1]] = match[2];
    }
  });

  return definitions;
}

function getOperationNameDiagnostics(operations) {
  const diagnostics = [];
  const operationNameCounts = new Map();

  operations.forEach((entry) => {
    if (!entry.name || entry.isAnonymous || entry.name === "UnnamedOperation") {
      return;
    }
    operationNameCounts.set(
      entry.name,
      (operationNameCounts.get(entry.name) ?? 0) + 1,
    );
  });

  operationNameCounts.forEach((count, operationName) => {
    if (count <= 1) return;
    diagnostics.push({
      level: "error",
      code: "DUPLICATE_OPERATION_NAME",
      message: `Operation name "${operationName}" is duplicated ${count} times.`,
    });
  });

  return diagnostics;
}

function getFragmentDiagnostics(source) {
  const diagnostics = [];
  const definitions = [
    ...source.matchAll(/fragment\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\s+/g),
  ].map((match) => match[1]);
  const spreads = [
    ...source.matchAll(/\.\.\.\s*([A-Za-z_][A-Za-z0-9_]*)/g),
  ].map((match) => match[1]);

  const definitionCounts = new Map();
  definitions.forEach((name) => {
    definitionCounts.set(name, (definitionCounts.get(name) ?? 0) + 1);
  });

  definitionCounts.forEach((count, name) => {
    if (count <= 1) return;
    diagnostics.push({
      level: "error",
      code: "DUPLICATE_FRAGMENT_NAME",
      message: `Fragment "${name}" is defined ${count} times.`,
    });
  });

  spreads.forEach((spreadName) => {
    if (definitions.includes(spreadName)) return;
    diagnostics.push({
      level: "error",
      code: "UNKNOWN_FRAGMENT_SPREAD",
      message: `Fragment spread "${spreadName}" has no matching definition.`,
    });
  });

  definitions.forEach((definitionName) => {
    if (spreads.includes(definitionName)) return;
    diagnostics.push({
      level: "warn",
      code: "UNUSED_FRAGMENT",
      message: `Fragment "${definitionName}" is defined but never spread.`,
    });
  });

  return diagnostics;
}

function getVariableDiagnostics(source) {
  const diagnostics = [];
  const definitions = getVariableDefinitions(source);
  const definedNames = new Set(Object.keys(definitions));
  const usedNames = new Set();

  const duplicateDefinitionMatches = [
    ...source.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)\s*:/g),
  ].map((match) => match[1]);
  const variableDefinitionCounts = new Map();
  duplicateDefinitionMatches.forEach((name) => {
    variableDefinitionCounts.set(
      name,
      (variableDefinitionCounts.get(name) ?? 0) + 1,
    );
  });
  variableDefinitionCounts.forEach((count, name) => {
    if (count <= 1) return;
    diagnostics.push({
      level: "error",
      code: "DUPLICATE_VARIABLE_DEFINITION",
      message: `Variable "$${name}" is defined ${count} times in operation signatures.`,
    });
  });

  const sourceWithoutSignatures = source
    .replace(
      /\b(query|mutation|subscription)\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)/g,
      "$1",
    )
    .replace(/\b(query|mutation|subscription)\s*\(([^)]*)\)/g, "$1");
  const variableUsageMatches = sourceWithoutSignatures.matchAll(
    /\$([A-Za-z_][A-Za-z0-9_]*)/g,
  );

  for (const usageMatch of variableUsageMatches) {
    usedNames.add(usageMatch[1]);
  }

  usedNames.forEach((name) => {
    if (definedNames.has(name)) return;
    diagnostics.push({
      level: "warn",
      code: "UNDEFINED_VARIABLE",
      message: `Variable "$${name}" is used but not declared in an operation signature.`,
    });
  });

  definedNames.forEach((name) => {
    if (usedNames.has(name)) return;
    diagnostics.push({
      level: "warn",
      code: "UNUSED_VARIABLE",
      message: `Variable "$${name}" is declared but never used in selections.`,
    });
  });

  return diagnostics;
}

function getAnonymousOperationDiagnostics(source) {
  const anonymousMatches = [
    ...source.matchAll(/\b(query|mutation|subscription)\s*\{/g),
  ];
  if (anonymousMatches.length <= 1) return [];

  return [
    {
      level: "error",
      code: "MULTIPLE_ANONYMOUS_OPERATIONS",
      message:
        "Only one anonymous operation is allowed per GraphQL document. Name additional operations.",
    },
  ];
}

function getOperationSelectionDiagnostics(operations) {
  return operations
    .filter((operation) => !operation.fields?.length)
    .map((operation) => ({
      level: "error",
      code: "EMPTY_OPERATION_SELECTION",
      message: `Operation "${operation.name}" does not contain top-level fields in its selection set.`,
    }));
}

// Detect cycles in fragment spread graph to prevent recursive fragment mistakes.
function getFragmentCycleDiagnostics(source) {
  const diagnostics = [];
  const fragments = [
    ...String(source).matchAll(
      /fragment\s+([A-Za-z_][A-Za-z0-9_]*)\s+on\s+[A-Za-z_][A-Za-z0-9_]*\s*\{([\s\S]*?)\}/g,
    ),
  ];

  const graph = new Map();
  fragments.forEach((match) => {
    const [, name, body] = match;
    const dependencies = [
      ...body.matchAll(/\.\.\.\s*([A-Za-z_][A-Za-z0-9_]*)/g),
    ].map((spread) => spread[1]);
    graph.set(name, dependencies);
  });

  const visiting = new Set();
  const visited = new Set();
  const reported = new Set();

  const visit = (node, trail = []) => {
    if (visiting.has(node)) {
      const cycleStartIndex = trail.indexOf(node);
      const cyclePath = [...trail.slice(cycleStartIndex), node];
      const cycleKey = cyclePath.join(" -> ");
      if (!reported.has(cycleKey)) {
        reported.add(cycleKey);
        diagnostics.push({
          level: "error",
          code: "CYCLIC_FRAGMENT_SPREAD",
          message: `Fragment cycle detected: ${cyclePath.join(" -> ")}.`,
        });
      }
      return;
    }

    if (visited.has(node)) return;
    visiting.add(node);
    const dependencies = graph.get(node) ?? [];
    dependencies.forEach((dependency) => {
      if (graph.has(dependency)) {
        visit(dependency, [...trail, node]);
      }
    });
    visiting.delete(node);
    visited.add(node);
  };

  [...graph.keys()].forEach((name) => visit(name));
  return diagnostics;
}

function getOperationVolumeDiagnostics(operations) {
  // Large multi-operation documents are hard to debug and often hide stale operations.
  if (operations.length <= 5) return [];

  return [
    {
      level: "warn",
      code: "LARGE_OPERATION_COUNT",
      message:
        "Document includes more than 5 operations. Split large documents to simplify review and execution.",
    },
  ];
}

function getDocumentStyleDiagnostics(source) {
  const diagnostics = [];
  const lines = String(source).split("\n");
  let longestLineLength = 0;
  let trailingWhitespaceCount = 0;
  let tabCharacterCount = 0;
  let consecutiveBlankLines = 0;
  let maxConsecutiveBlankLines = 0;

  lines.forEach((line) => {
    longestLineLength = Math.max(longestLineLength, line.length);
    if (/\s+$/.test(line)) {
      trailingWhitespaceCount += 1;
    }
    if (line.includes("\t")) {
      tabCharacterCount += 1;
    }

    if (!line.trim()) {
      consecutiveBlankLines += 1;
      maxConsecutiveBlankLines = Math.max(
        maxConsecutiveBlankLines,
        consecutiveBlankLines,
      );
    } else {
      consecutiveBlankLines = 0;
    }
  });

  if (tabCharacterCount > 0) {
    diagnostics.push({
      level: "info",
      code: "QUERY_CONTAINS_TABS",
      message:
        "Query contains tab characters. Prefer spaces for consistent formatting across tools.",
    });
  }

  if (trailingWhitespaceCount > 0) {
    diagnostics.push({
      level: "info",
      code: "QUERY_TRAILING_WHITESPACE",
      message:
        "Query contains trailing whitespace on one or more lines. Trim line endings for cleaner diffs.",
    });
  }

  if (longestLineLength >= 140) {
    diagnostics.push({
      level: "warn",
      code: "QUERY_LONG_LINE",
      message:
        "Query has very long lines (140+ chars). Consider wrapping selections or arguments for readability.",
    });
  }

  if (maxConsecutiveBlankLines >= 3) {
    diagnostics.push({
      level: "info",
      code: "QUERY_EXCESSIVE_BLANK_LINES",
      message:
        "Query contains large blank-line gaps. Compact formatting can make review and debugging easier.",
    });
  }

  if (/#[^\n]*\b(TODO|FIXME|XXX)\b/i.test(source)) {
    diagnostics.push({
      level: "info",
      code: "QUERY_TODO_COMMENT",
      message:
        "Query includes TODO/FIXME comments. Confirm temporary notes are intentional before sharing.",
    });
  }

  return diagnostics;
}

function getOperationConventionDiagnostics(operations) {
  const diagnostics = [];

  operations.forEach((entry) => {
    if (entry.type === "fragment") return;

    if (!entry.isAnonymous && !/^[A-Z][A-Za-z0-9]*$/.test(entry.name)) {
      diagnostics.push({
        level: "info",
        code: "OPERATION_NAME_STYLE",
        message: `Operation "${entry.name}" should use PascalCase for consistent naming conventions.`,
      });
    }

    if (["Query", "Mutation", "Subscription"].includes(entry.name)) {
      diagnostics.push({
        level: "warn",
        code: "OPERATION_NAME_TOO_GENERIC",
        message: `Operation "${entry.name}" is generic. Use a more specific name to improve traceability.`,
      });
    }
  });

  return diagnostics;
}

function getOperationFieldDiagnostics(operations) {
  const diagnostics = [];

  operations.forEach((operation) => {
    if (operation.type === "fragment") return;

    const fieldCounts = new Map();
    operation.fields.forEach((field) => {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    });

    fieldCounts.forEach((count, fieldName) => {
      if (count <= 1) return;
      diagnostics.push({
        level: "warn",
        code: "DUPLICATE_TOP_LEVEL_FIELD",
        message: `Operation "${operation.name}" requests top-level field "${fieldName}" ${count} times. Consider aliases or deduplication.`,
      });
    });

    if (operation.fields.length === 1 && operation.fields[0] === "__typename") {
      diagnostics.push({
        level: "info",
        code: "TYPENAME_ONLY_SELECTION",
        message: `Operation "${operation.name}" selects only __typename. Confirm this is intentional for your debugging workflow.`,
      });
    }
  });

  return diagnostics;
}

function getHeaderEntryDiagnostics(parsedHeaders) {
  const diagnostics = [];

  Object.entries(parsedHeaders).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey).trim();
    if (!key) {
      diagnostics.push({
        level: "error",
        code: "EMPTY_HEADER_NAME",
        message: "Headers cannot include empty key names.",
      });
    }

    if (typeof rawValue !== "string") {
      diagnostics.push({
        level: "warn",
        code: "NON_STRING_HEADER_VALUE",
        message: `Header \"${rawKey}\" should be a string value for predictable request serialization.`,
      });
    }
  });

  return diagnostics;
}

// Endpoint diagnostics beyond strict URL validity to catch risky-but-valid configurations.
function getEndpointQualityDiagnostics(parsedUrl, rawEndpoint = "") {
  const diagnostics = [];

  if (parsedUrl.username || parsedUrl.password) {
    diagnostics.push({
      level: "warn",
      code: "ENDPOINT_CREDENTIALS_IN_URL",
      message:
        "Avoid embedding credentials in endpoint URLs. Use headers (for example Authorization) instead.",
    });
  }

  if (parsedUrl.search) {
    diagnostics.push({
      level: "info",
      code: "ENDPOINT_QUERY_PARAMS",
      message:
        "Endpoint URL includes query parameters. Ensure this is intentional for your GraphQL gateway setup.",
    });
  }

  if (parsedUrl.hash) {
    diagnostics.push({
      level: "warn",
      code: "ENDPOINT_HASH_FRAGMENT",
      message:
        "Endpoint URL includes a hash fragment. Fragments are ignored by HTTP requests and are usually unintended.",
    });
  }

  if (!parsedUrl.pathname.toLowerCase().includes("graphql")) {
    diagnostics.push({
      level: "info",
      code: "ENDPOINT_NON_GRAPHQL_PATH",
      message:
        'Endpoint path does not include "graphql". Verify this URL points to your GraphQL handler.',
    });
  }

  if (["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
    diagnostics.push({
      level: "info",
      code: "ENDPOINT_LOCALHOST",
      message:
        "Endpoint targets localhost. Verify this endpoint is reachable from your current runtime environment.",
    });
  }

  if (/(https?:\/\/[^/]+:(80|443))(\/|$)/i.test(rawEndpoint)) {
    diagnostics.push({
      level: "info",
      code: "ENDPOINT_DEFAULT_PORT_EXPLICIT",
      message:
        "Endpoint explicitly includes a default HTTP(S) port. You can usually omit it to reduce URL noise.",
    });
  }

  if (parsedUrl.pathname.length > 1 && parsedUrl.pathname.endsWith("/")) {
    diagnostics.push({
      level: "info",
      code: "ENDPOINT_TRAILING_SLASH",
      message:
        "Endpoint path ends with a trailing slash. Ensure this matches your gateway routing expectations.",
    });
  }

  if (parsedUrl.pathname === "/") {
    diagnostics.push({
      level: "warn",
      code: "ENDPOINT_ROOT_PATH",
      message:
        "Endpoint uses the root path (/). Confirm your GraphQL server is actually mounted at this location.",
    });
  }

  if (/\b(v\d+)\b/i.test(parsedUrl.pathname)) {
    diagnostics.push({
      level: "info",
      code: "ENDPOINT_VERSIONED_PATH",
      message:
        "Endpoint path includes an API version segment. Keep editor presets aligned when backend versions change.",
    });
  }

  return diagnostics;
}

// Header diagnostics focus on interoperability and auth correctness, not only JSON validity.
function getHeaderRecommendationDiagnostics(parsedHeaders) {
  const diagnostics = [];
  const headerEntries = Object.entries(parsedHeaders).map(([key, value]) => ({
    rawKey: key,
    normalizedKey: String(key).trim().toLowerCase(),
    value,
  }));

  const duplicateHeaderMap = new Map();
  headerEntries.forEach((entry) => {
    duplicateHeaderMap.set(
      entry.normalizedKey,
      (duplicateHeaderMap.get(entry.normalizedKey) ?? 0) + 1,
    );
  });

  duplicateHeaderMap.forEach((count, headerName) => {
    if (!headerName || count <= 1) return;
    diagnostics.push({
      level: "warn",
      code: "DUPLICATE_HEADER_CASE_INSENSITIVE",
      message: `Header "${headerName}" appears ${count} times when compared case-insensitively. Keep a single key to avoid ambiguity.`,
    });
  });

  const hasAcceptHeader = headerEntries.some(
    (entry) => entry.normalizedKey === "accept",
  );
  const hasContentTypeHeader = headerEntries.some(
    (entry) => entry.normalizedKey === "content-type",
  );
  const authorizationHeader = headerEntries.find(
    (entry) => entry.normalizedKey === "authorization",
  );

  if (!hasAcceptHeader) {
    diagnostics.push({
      level: "info",
      code: "MISSING_ACCEPT_HEADER",
      message:
        "Consider adding an Accept header (application/json) for predictable response content negotiation.",
    });
  }

  if (!hasContentTypeHeader) {
    diagnostics.push({
      level: "info",
      code: "MISSING_CONTENT_TYPE_HEADER",
      message:
        "Consider adding a Content-Type header (application/json) for explicit request serialization.",
    });
  }

  if (
    authorizationHeader &&
    typeof authorizationHeader.value === "string" &&
    authorizationHeader.value.trim() &&
    !/^(Bearer|Basic|Digest|ApiKey|Token)\s+/i.test(
      authorizationHeader.value.trim(),
    )
  ) {
    diagnostics.push({
      level: "warn",
      code: "AUTH_HEADER_SCHEME",
      message:
        "Authorization header does not include a recognized auth scheme prefix (for example: Bearer <token>).",
    });
  }

  const acceptHeader = headerEntries.find(
    (entry) => entry.normalizedKey === "accept",
  );
  if (
    acceptHeader &&
    typeof acceptHeader.value === "string" &&
    acceptHeader.value.trim() === "*/*"
  ) {
    diagnostics.push({
      level: "info",
      code: "ACCEPT_HEADER_WILDCARD",
      message:
        "Accept header is set to */*. Consider application/json for more predictable GraphQL response handling.",
    });
  }

  const contentTypeHeader = headerEntries.find(
    (entry) => entry.normalizedKey === "content-type",
  );
  if (
    contentTypeHeader &&
    typeof contentTypeHeader.value === "string" &&
    !/application\/json/i.test(contentTypeHeader.value)
  ) {
    diagnostics.push({
      level: "warn",
      code: "CONTENT_TYPE_NOT_JSON",
      message:
        "Content-Type is not application/json. Most GraphQL HTTP servers expect JSON request payloads.",
    });
  }

  headerEntries.forEach((entry) => {
    if (typeof entry.value !== "string") return;
    if (entry.value !== entry.value.trim()) {
      diagnostics.push({
        level: "warn",
        code: "HEADER_VALUE_WHITESPACE",
        message: `Header "${entry.rawKey}" contains leading or trailing whitespace, which can break authentication or cache keys.`,
      });
    }
  });

  return diagnostics;
}

function getHeaderSecurityDiagnostics(parsedHeaders) {
  const diagnostics = [];
  const normalizedHeaders = Object.entries(parsedHeaders).map(
    ([key, value]) => ({
      normalizedKey: String(key).trim().toLowerCase(),
      value,
    }),
  );

  const authorization = normalizedHeaders.find(
    (entry) => entry.normalizedKey === "authorization",
  );
  if (typeof authorization?.value === "string") {
    const value = authorization.value.trim();
    if (/^Bearer\s*$/i.test(value)) {
      diagnostics.push({
        level: "error",
        code: "AUTH_BEARER_MISSING_TOKEN",
        message:
          "Authorization header uses Bearer scheme without a token value.",
      });
    }

    if (/^Basic\s+/i.test(value)) {
      diagnostics.push({
        level: "warn",
        code: "AUTH_BASIC_SCHEME",
        message:
          "Authorization header uses Basic auth. Avoid Basic credentials for shared or production traffic when possible.",
      });
    }
  }

  const apiKeyHeader = normalizedHeaders.find((entry) =>
    ["x-api-key", "apikey", "api-key"].includes(entry.normalizedKey),
  );
  if (typeof apiKeyHeader?.value === "string" && !apiKeyHeader.value.trim()) {
    diagnostics.push({
      level: "error",
      code: "EMPTY_API_KEY_HEADER",
      message:
        "API key header is present but empty. Populate a key value or remove the header.",
    });
  }

  const hasCookieHeader = normalizedHeaders.some(
    (entry) => entry.normalizedKey === "cookie",
  );
  if (hasCookieHeader) {
    diagnostics.push({
      level: "warn",
      code: "COOKIE_HEADER_PRESENT",
      message:
        "Cookie header is set manually. Confirm this is safe and required for your GraphQL environment.",
    });
  }

  if (normalizedHeaders.some((entry) => entry.normalizedKey === "host")) {
    diagnostics.push({
      level: "warn",
      code: "HOST_HEADER_OVERRIDE",
      message:
        "Host header override detected. Custom Host values can break TLS routing and reverse proxy behavior.",
    });
  }

  return diagnostics;
}

function getVariableInputDiagnostics(source, parsedVariables, operations = []) {
  const diagnostics = [];
  const variableDefinitions = getVariableDefinitionMetadata(source);

  Object.keys(parsedVariables).forEach((variableName) => {
    if (variableDefinitions.allVariables.has(variableName)) return;
    diagnostics.push({
      level: "warn",
      code: "EXTRA_VARIABLE_INPUT",
      message: `Variable input "${variableName}" is not declared in the active operation signatures.`,
    });
  });

  const operationCount = operations.length;
  if (operationCount > 1 && variableDefinitions.requiredVariables.length) {
    // Avoid false errors when documents define multiple operations but execute one at a time.
    diagnostics.push({
      level: "info",
      code: "MULTI_OPERATION_VARIABLE_VALIDATION_SKIPPED",
      message:
        "Required variable presence checks are skipped for multi-operation documents. Run one operation at a time for strict validation.",
    });
    return diagnostics;
  }

  variableDefinitions.requiredVariables.forEach((metadata) => {
    if (Object.hasOwn(parsedVariables, metadata.name)) return;
    diagnostics.push({
      level: "error",
      code: "MISSING_REQUIRED_VARIABLE_VALUE",
      message: `Missing required variable input "$${metadata.name}" (${metadata.type}).`,
    });
  });

  return diagnostics;
}

function getVariableDefinitionMetadata(source) {
  const allVariables = new Set();
  const requiredVariables = [];
  const variableSections = String(source).match(/\(([^)]*\$[^)]*)\)/g) ?? [];

  variableSections.forEach((section) => {
    const matches = section.matchAll(
      /\$([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\[\]A-Za-z_][A-Za-z0-9_\[\]!]*)\s*(=\s*[^,)]+)?/g,
    );

    for (const match of matches) {
      const [, name, type, defaultValue] = match;
      allVariables.add(name);
      if (type.endsWith("!") && !defaultValue) {
        requiredVariables.push({ name, type });
      }
    }
  });

  return {
    allVariables,
    requiredVariables,
  };
}

// Runtime variable checks provide fast feedback before making network requests.
function getVariableTypeDiagnostics(source, parsedVariables) {
  const diagnostics = [];
  const definitions = getVariableDefinitions(source);

  Object.entries(parsedVariables).forEach(([name, value]) => {
    const type = definitions[name];
    if (!type) return;

    if (type.endsWith("!") && value === null) {
      diagnostics.push({
        level: "error",
        code: "NULL_FOR_NON_NULL_VARIABLE",
        message: `Variable "$${name}" is non-null (${type}) but received null.`,
      });
      return;
    }

    const typeDiagnostics = validateVariableValueByType(name, type, value);
    diagnostics.push(...typeDiagnostics);
  });

  return diagnostics;
}

function validateVariableValueByType(name, type, value) {
  const diagnostics = [];
  const normalizedType = stripGraphqlTypeDecorators(type);

  if (
    normalizedType.startsWith("[") &&
    !Array.isArray(value) &&
    value !== null
  ) {
    diagnostics.push({
      level: "warn",
      code: "VARIABLE_LIST_TYPE_MISMATCH",
      message: `Variable "$${name}" expects list type (${type}) but received ${getValueKind(value)}.`,
    });
    return diagnostics;
  }

  if (isLikelyInputObjectType(normalizedType)) {
    if (value !== null && (typeof value !== "object" || Array.isArray(value))) {
      diagnostics.push({
        level: "warn",
        code: "VARIABLE_OBJECT_TYPE_MISMATCH",
        message: `Variable "$${name}" expects input object type (${type}) but received ${getValueKind(value)}.`,
      });
    }
    return diagnostics;
  }

  if (value === null) return diagnostics;

  const scalarValidators = {
    Int: Number.isInteger,
    Float: (entry) => typeof entry === "number" && Number.isFinite(entry),
    Boolean: (entry) => typeof entry === "boolean",
    String: (entry) => typeof entry === "string",
    ID: (entry) => typeof entry === "string" || Number.isInteger(entry),
  };

  const validator = scalarValidators[normalizedType];
  if (validator && !validator(value)) {
    diagnostics.push({
      level: "warn",
      code: "VARIABLE_SCALAR_TYPE_MISMATCH",
      message: `Variable "$${name}" expects ${normalizedType} but received ${getValueKind(value)}.`,
    });
  }

  return diagnostics;
}

function stripGraphqlTypeDecorators(type) {
  return String(type).replace(/!/g, "").trim();
}

function isLikelyInputObjectType(type) {
  if (!type || type.startsWith("[")) return false;
  return (
    /^[A-Z][A-Za-z0-9_]*$/.test(type) &&
    !["Int", "Float", "String", "Boolean", "ID"].includes(type)
  );
}

function getValueKind(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function getComplexityDiagnostics(metrics) {
  const diagnostics = [];

  if (metrics.maxSelectionDepth >= 6) {
    diagnostics.push({
      level: "warn",
      code: "DEEP_SELECTION",
      message:
        "Selection depth is high (6+). Consider trimming nested fields to reduce resolver load.",
    });
  }

  if (metrics.characterCount >= 3000) {
    diagnostics.push({
      level: "warn",
      code: "LARGE_QUERY_DOCUMENT",
      message:
        "Query document is large (3000+ chars). Consider fragments or splitting operations for readability.",
    });
  }

  if (metrics.complexityLabel === "high") {
    diagnostics.push({
      level: "warn",
      code: "HIGH_COMPLEXITY_QUERY",
      message:
        "Computed complexity score is high. Validate this document carefully before repeated execution.",
    });
  }

  return diagnostics;
}

function getMaxSelectionDepth(source) {
  let depth = 0;
  let maxDepth = 0;
  const normalizedSource = normalizeQueryForStructureScan(source);

  for (const char of normalizedSource) {
    if (char === "{") {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }
    if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
  }

  // Exclude the document root level to better represent nested selection depth.
  return Math.max(0, maxDepth - 1);
}

function buildSuggestionInsertText(field) {
  const argCount = field?.args?.length ?? 0;
  const hasNestedSelection = isObjectLikeField(field?.type);

  const base = !argCount
    ? field.name
    : `${field.name}(${field.args.map((arg) => `${arg.name}: $${arg.name}`).join(", ")})`;

  // Encourage explicit nested selection when field resolves to object-like data.
  if (hasNestedSelection) {
    return `${base} {\n  __typename\n}`;
  }

  return base;
}

function isObjectLikeField(type) {
  if (!type) return false;
  if (type.kind === "OBJECT") return true;
  if (type.kind === "LIST") {
    return isObjectLikeField(type.ofType);
  }
  if (type.ofType) {
    return isObjectLikeField(type.ofType);
  }

  return false;
}

function normalizeQueryForStructureScan(source) {
  const chars = [...String(source)];
  let inString = false;
  let inComment = false;

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];
    const prev = chars[index - 1];

    if (inComment) {
      if (current === "\n") {
        inComment = false;
      } else {
        chars[index] = " ";
      }
      continue;
    }

    if (!inString && current === "#") {
      inComment = true;
      chars[index] = " ";
      continue;
    }

    if (current === '"' && prev !== "\\") {
      inString = !inString;
      chars[index] = " ";
      continue;
    }

    if (inString) {
      chars[index] = " ";
    }
  }

  return chars.join("");
}

function sortDiagnostics(entries) {
  return [...entries].sort((left, right) => {
    const levelWeightDiff =
      (DIAGNOSTIC_LEVEL_WEIGHT[left.level] ?? 99) -
      (DIAGNOSTIC_LEVEL_WEIGHT[right.level] ?? 99);
    if (levelWeightDiff !== 0) return levelWeightDiff;
    return String(left.code).localeCompare(String(right.code));
  });
}
