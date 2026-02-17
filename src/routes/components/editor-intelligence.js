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

  diagnostics.push(...getBalanceDiagnostics(source));

  const operations = getOperationOutline(source).filter(
    (entry) => entry.type !== "fragment",
  );
  diagnostics.push(...getOperationNameDiagnostics(operations));
  diagnostics.push(...getFragmentDiagnostics(source));
  diagnostics.push(...getVariableDiagnostics(source));
  diagnostics.push(...getAnonymousOperationDiagnostics(source));
  diagnostics.push(...getOperationVolumeDiagnostics(operations));

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
      /\$([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_\[\]!]*)/g,
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
      /\$([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_\[\]!]*)\s*(=\s*[^,)]+)?/g,
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
