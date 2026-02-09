const DEFAULT_STRUCTURE = {
  operations: [
    {
      type: "query",
      name: "UnnamedOperation",
      variables: [],
      fields: [],
    },
  ],
  activeOperationIndex: 0,
};

function stripComments(queryString) {
  return queryString.replace(/#.*/g, "");
}

function extractOperationHeader(queryString) {
  const headerMatch = queryString.match(
    /(query|mutation|subscription)\s*(\w+)?\s*(\([^)]*\))?\s*{/,
  );

  if (!headerMatch) {
    return {
      type: "query",
      name: "UnnamedOperation",
      variables: [],
      selectionStart:
        queryString.indexOf("{") >= 0 ? queryString.indexOf("{") : -1,
    };
  }

  const [, type, name, varsString] = headerMatch;

  return {
    type,
    name: name || "UnnamedOperation",
    variables: parseVariables(varsString || ""),
    selectionStart: queryString.indexOf("{", headerMatch.index),
  };
}

function parseVariables(varsString) {
  if (!varsString) return [];

  const variables = [];
  const varMatches = varsString.matchAll(/\$(\w+):\s*([\w\[\]!]+)/g);
  for (const match of varMatches) {
    variables.push({
      name: match[1],
      type: match[2],
      defaultValue: null,
    });
  }

  return variables;
}

function parseArguments(argString) {
  if (!argString.trim()) return [];
  const args = [];
  const argMatches = argString.matchAll(/(\w+):\s*([^,\s]+)/g);
  for (const match of argMatches) {
    args.push({
      name: match[1],
      value: match[2],
      type: "String",
    });
  }
  return args;
}

function parseSelectionSet(queryString, startIndex) {
  const fields = [];
  let index = startIndex;

  const skipWhitespace = () => {
    while (index < queryString.length && /\s|,/.test(queryString[index])) {
      index += 1;
    }
  };

  const parseName = () => {
    skipWhitespace();
    const nameMatch = queryString.slice(index).match(/^(\w+)/);
    if (!nameMatch) return null;
    index += nameMatch[0].length;
    return nameMatch[0];
  };

  const parseBlock = () => {
    const nameOrAlias = parseName();
    if (!nameOrAlias) return null;

    skipWhitespace();
    let fieldName = nameOrAlias;

    if (queryString[index] === ":") {
      index += 1;
      const realName = parseName();
      if (realName) {
        fieldName = realName;
      }
    }

    skipWhitespace();

    let args = [];
    if (queryString[index] === "(") {
      let depth = 1;
      let argsStart = index + 1;
      index += 1;
      while (index < queryString.length && depth > 0) {
        if (queryString[index] === "(") depth += 1;
        if (queryString[index] === ")") depth -= 1;
        index += 1;
      }
      const argsString = queryString.slice(argsStart, index - 1);
      args = parseArguments(argsString);
    }

    skipWhitespace();

    let nestedFields = [];
    if (queryString[index] === "{") {
      const nested = parseSelectionSet(queryString, index + 1);
      nestedFields = nested.fields;
      index = nested.index;
    }

    return {
      name: fieldName,
      args,
      fields: nestedFields,
    };
  };

  while (index < queryString.length) {
    skipWhitespace();
    if (queryString[index] === "}") {
      index += 1;
      break;
    }

    const field = parseBlock();
    if (field) {
      fields.push(field);
    } else {
      index += 1;
    }
  }

  return { fields, index };
}

export function parseQuery(queryString = "") {
  if (!queryString.trim()) {
    return { ...DEFAULT_STRUCTURE };
  }

  try {
    const cleaned = stripComments(queryString);
    const header = extractOperationHeader(cleaned);

    if (header.selectionStart < 0) {
      return {
        operations: [
          {
            type: header.type,
            name: header.name,
            variables: header.variables,
            fields: [],
          },
        ],
        activeOperationIndex: 0,
      };
    }

    const selection = parseSelectionSet(cleaned, header.selectionStart + 1);

    return {
      operations: [
        {
          type: header.type,
          name: header.name,
          variables: header.variables,
          fields: selection.fields,
        },
      ],
      activeOperationIndex: 0,
    };
  } catch (error) {
    return {
      operations: [
        {
          type: "query",
          name: "ParseError",
          variables: [],
          fields: [],
        },
      ],
      activeOperationIndex: 0,
    };
  }
}

export function buildQueryFromStructure(structure) {
  if (!structure?.operations || structure.operations.length === 0) {
    return "query { }";
  }

  const buildFields = (fields, indent = "  ") => {
    if (!fields || fields.length === 0) return "";

    return fields
      .map((field) => {
        const argsString = field.args?.length
          ? `(${field.args.map((arg) => `${arg.name}: ${arg.value}`).join(", ")})`
          : "";

        if (field.fields && field.fields.length > 0) {
          return `${indent}${field.name}${argsString} {\n${buildFields(field.fields, indent + "  ")}${indent}}\n`;
        }

        return `${indent}${field.name}${argsString}\n`;
      })
      .join("");
  };

  return structure.operations
    .map((operation) => {
      let query = operation.type || "query";

      if (operation.name && operation.name !== "UnnamedOperation") {
        query += ` ${operation.name}`;
      }

      if (operation.variables && operation.variables.length > 0) {
        const varsString = operation.variables
          .map((v) => `$${v.name}: ${v.type}`)
          .join(", ");
        query += `(${varsString})`;
      }

      query += " {\n";
      query += buildFields(operation.fields);
      query += "}";

      return query;
    })
    .join("\n\n");
}
