import test from "node:test";
import assert from "node:assert/strict";
import {
  getDiagnostics,
  getDocumentMetrics,
  getOperationOutline,
  getSchemaSuggestions,
  getVariableDefinitions,
} from "./editor-intelligence.js";

test("getOperationOutline returns operation metadata and top-level fields", () => {
  const outline = getOperationOutline(
    `query GetUsers { users { id } posts { id } }`,
  );

  assert.equal(outline.length, 1);
  assert.equal(outline[0].name, "GetUsers");
  assert.deepEqual(outline[0].fields, ["users", "posts"]);
});

test("getDiagnostics reports endpoint and JSON issues", () => {
  const diagnostics = getDiagnostics({
    query: "query GetUsers { users { id }",
    endpoint: "",
    headers: "{ invalid",
    variables: "{ invalid",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "MISSING_CLOSING_TOKEN"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "MISSING_ENDPOINT"));
  assert.ok(diagnostics.some((entry) => entry.code === "HEADERS_JSON"));
  assert.ok(diagnostics.some((entry) => entry.code === "VARIABLES_JSON"));
});

test("getDiagnostics validates endpoint URL format", () => {
  const diagnostics = getDiagnostics({
    query: "query GetUsers { users { id } }",
    endpoint: "ht^tp://bad-url",
  });

  assert.ok(diagnostics.some((entry) => entry.code === "ENDPOINT_URL"));
});

test("getDiagnostics warns for insecure http endpoints", () => {
  const diagnostics = getDiagnostics({
    query: "query GetUsers { users { id } }",
    endpoint: "http://example.com/graphql",
  });

  assert.ok(diagnostics.some((entry) => entry.code === "INSECURE_ENDPOINT"));
});

test("getSchemaSuggestions filters root fields by token and builds snippets", () => {
  const suggestions = getSchemaSuggestions({
    schema: {
      queryType: { name: "Query" },
      types: [
        {
          name: "Query",
          fields: [
            {
              name: "users",
              type: { name: "User", kind: "OBJECT" },
              description: "List users",
              args: [{ name: "first" }],
            },
            {
              name: "posts",
              type: { name: "Post", kind: "OBJECT" },
              description: "List posts",
            },
          ],
        },
      ],
    },
    query: "query Demo { us",
    cursorIndex: "query Demo { us".length,
  });

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].label, "users");
  assert.equal(
    suggestions[0].insertText,
    "users(first: $first) {\n  __typename\n}",
  );
});

test("getVariableDefinitions extracts declared variable names and types", () => {
  const definitions = getVariableDefinitions(
    "query GetUsers($first: Int!, $search: String) { users(first: $first, search: $search) { id } }",
  );

  assert.deepEqual(definitions, {
    first: "Int!",
    search: "String",
  });
});

test("getOperationOutline includes fragments and anonymous operations", () => {
  const outline = getOperationOutline(`query { viewer { id } }
fragment UserFields on User { id name }`);

  assert.ok(
    outline.some((entry) => entry.type === "query" && entry.isAnonymous),
  );
  assert.ok(
    outline.some(
      (entry) =>
        entry.type === "fragment" &&
        entry.name === "UserFields" &&
        entry.onType === "User",
    ),
  );
});

test("getDiagnostics reports duplicate operations, fragments, and variable issues", () => {
  const diagnostics = getDiagnostics({
    query: `query GetUsers($first: Int, $first: Int) { users(first: $first) { ...UserFields } }
query GetUsers { users { id } }
fragment UserFields on User { id }
fragment UserFields on User { name }
query Search($unused: String) { users(search: $search) { id ...UnknownFragment } }`,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "DUPLICATE_OPERATION_NAME"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "DUPLICATE_FRAGMENT_NAME"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "UNKNOWN_FRAGMENT_SPREAD"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "DUPLICATE_VARIABLE_DEFINITION"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "UNUSED_VARIABLE"));
  assert.ok(diagnostics.some((entry) => entry.code === "UNDEFINED_VARIABLE"));
});

test("getDiagnostics reports multiple anonymous operations", () => {
  const diagnostics = getDiagnostics({
    query: `query { viewer { id } }\nmutation { updateProfile { id } }`,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "MULTIPLE_ANONYMOUS_OPERATIONS"),
  );
});

test("getDiagnostics ignores brackets inside comments and strings", () => {
  const diagnostics = getDiagnostics({
    query: `query Demo {
  users(note: "text with }") {
    id # comment with }
  }
}`,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(!diagnostics.some((entry) => entry.code === "UNBALANCED_TOKEN"));
  assert.ok(
    !diagnostics.some((entry) => entry.code === "MISSING_CLOSING_TOKEN"),
  );
});

test("getDocumentMetrics returns high-level document counters and complexity", () => {
  const metrics = getDocumentMetrics(
    `query GetUsers {\n  users {\n    profile { id }\n  }\n}\nfragment UserFields on User { id }`,
  );

  assert.equal(metrics.operationCount, 1);
  assert.equal(metrics.fragmentCount, 1);
  assert.equal(metrics.lineCount, 6);
  assert.equal(metrics.topLevelFieldCount, 1);
  assert.equal(metrics.maxSelectionDepth, 2);
  assert.ok(metrics.characterCount > 10);
  assert.ok(metrics.complexityScore > 0);
  assert.equal(typeof metrics.complexityLabel, "string");
});

test("getDiagnostics emits high complexity warning for deep documents", () => {
  const deepQuery = `query Heavy {
  one {
    two {
      three {
        four {
          five {
            six {
              seven {
                id
              }
            }
          }
        }
      }
    }
  }
}`;

  const diagnostics = getDiagnostics({
    query: deepQuery,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(diagnostics.some((entry) => entry.code === "DEEP_SELECTION"));
});

test("getDiagnostics are returned in deterministic severity/code order", () => {
  const diagnostics = getDiagnostics({
    query: "query Demo($id: ID, $id: ID){ user(id: $missing) { id } }",
    endpoint: "http://example.com/graphql",
  });

  const levels = diagnostics.map((entry) => entry.level);
  const firstWarnIndex = levels.indexOf("warn");
  const firstErrorIndex = levels.indexOf("error");

  assert.ok(firstErrorIndex >= 0);
  assert.ok(firstWarnIndex >= 0);
  assert.ok(firstErrorIndex < firstWarnIndex);
});
