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

test("getDiagnostics adds endpoint quality diagnostics", () => {
  const diagnostics = getDiagnostics({
    query: "query GetUsers { users { id } }",
    endpoint: "https://user:pass@example.com/api?env=dev#frag",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "ENDPOINT_CREDENTIALS_IN_URL"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "ENDPOINT_QUERY_PARAMS"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "ENDPOINT_HASH_FRAGMENT"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "ENDPOINT_NON_GRAPHQL_PATH"),
  );
});

test("getDiagnostics adds header recommendations and whitespace checks", () => {
  const diagnostics = getDiagnostics({
    query: "query GetUsers { users { id } }",
    endpoint: "https://example.com/graphql",
    headers: JSON.stringify({
      Authorization: "token-only ",
      "X-Trace": " abc123 ",
    }),
  });

  assert.ok(diagnostics.some((entry) => entry.code === "AUTH_HEADER_SCHEME"));
  assert.ok(
    diagnostics.some((entry) => entry.code === "HEADER_VALUE_WHITESPACE"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "MISSING_ACCEPT_HEADER"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "MISSING_CONTENT_TYPE_HEADER"),
  );
});

test("getDiagnostics validates variable runtime value types", () => {
  const diagnostics = getDiagnostics({
    query:
      "query Demo($id: ID!, $count: Int, $enabled: Boolean, $filter: UserFilter, $ids: [ID!]!) { user(id: $id) { id } }",
    endpoint: "https://example.com/graphql",
    variables: JSON.stringify({
      id: null,
      count: "10",
      enabled: "true",
      filter: "nope",
      ids: "123",
    }),
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "NULL_FOR_NON_NULL_VARIABLE"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "VARIABLE_SCALAR_TYPE_MISMATCH"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "VARIABLE_OBJECT_TYPE_MISMATCH"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "VARIABLE_LIST_TYPE_MISMATCH"),
  );
});

test("getDiagnostics detects cyclic fragment spreads", () => {
  const diagnostics = getDiagnostics({
    query: `query Demo { user { ...A } }
fragment A on User { ...B }
fragment B on User { ...A }`,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "CYCLIC_FRAGMENT_SPREAD"),
  );
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

test("getDiagnostics validates headers entries and variable payload alignment", () => {
  const diagnostics = getDiagnostics({
    query:
      'query GetUsers($required: ID!, $optional: String = "demo") { user(id: $required) { id } }',
    endpoint: "https://example.com/graphql",
    headers: '{"": "bad", "x-number": 123}',
    variables: '{"extra": true}',
  });

  assert.ok(diagnostics.some((entry) => entry.code === "EMPTY_HEADER_NAME"));
  assert.ok(
    diagnostics.some((entry) => entry.code === "NON_STRING_HEADER_VALUE"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "EXTRA_VARIABLE_INPUT"));
  assert.ok(
    diagnostics.some(
      (entry) => entry.code === "MISSING_REQUIRED_VARIABLE_VALUE",
    ),
  );
});

test("getDiagnostics warns when document contains many operations", () => {
  const diagnostics = getDiagnostics({
    query: `query One { viewer { id } }
query Two { viewer { id } }
query Three { viewer { id } }
query Four { viewer { id } }
query Five { viewer { id } }
query Six { viewer { id } }`,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "LARGE_OPERATION_COUNT"),
  );
});

test("getDiagnostics skips strict required-variable checks for multi-operation documents", () => {
  const diagnostics = getDiagnostics({
    query: `query First($id: ID!) { user(id: $id) { id } }
query Second($slug: String!) { post(slug: $slug) { id } }`,
    endpoint: "https://example.com/graphql",
    variables: "{}",
  });

  assert.ok(
    diagnostics.some(
      (entry) => entry.code === "MULTI_OPERATION_VARIABLE_VALIDATION_SKIPPED",
    ),
  );
  assert.ok(
    !diagnostics.some(
      (entry) => entry.code === "MISSING_REQUIRED_VARIABLE_VALUE",
    ),
  );
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

test("getDiagnostics reports document style and convention guidance", () => {
  const diagnostics = getDiagnostics({
    query: `query get_users {\n\t__typename  \n\n\n\n  # TODO clean up this query\n  users(first: 10, search: \"${"x".repeat(150)}\") { id }\n}`,
    endpoint: "https://example.com/graphql",
  });

  assert.ok(diagnostics.some((entry) => entry.code === "QUERY_CONTAINS_TABS"));
  assert.ok(
    diagnostics.some((entry) => entry.code === "QUERY_TRAILING_WHITESPACE"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "QUERY_LONG_LINE"));
  assert.ok(
    diagnostics.some((entry) => entry.code === "QUERY_EXCESSIVE_BLANK_LINES"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "QUERY_TODO_COMMENT"));
  assert.ok(diagnostics.some((entry) => entry.code === "OPERATION_NAME_STYLE"));
});

test("getDiagnostics reports endpoint hygiene diagnostics", () => {
  const diagnostics = getDiagnostics({
    query: "query Query { __typename }",
    endpoint: "https://localhost:443/v2/",
  });

  assert.ok(diagnostics.some((entry) => entry.code === "ENDPOINT_LOCALHOST"));
  assert.ok(
    diagnostics.some(
      (entry) => entry.code === "ENDPOINT_DEFAULT_PORT_EXPLICIT",
    ),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "ENDPOINT_TRAILING_SLASH"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "ENDPOINT_VERSIONED_PATH"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "OPERATION_NAME_TOO_GENERIC"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "TYPENAME_ONLY_SELECTION"),
  );
});

test("getDiagnostics reports root endpoint and duplicate top-level fields", () => {
  const diagnostics = getDiagnostics({
    query: "query Demo {\n  viewer\n  viewer\n}",
    endpoint: "https://api.example.com/",
  });

  assert.ok(diagnostics.some((entry) => entry.code === "ENDPOINT_ROOT_PATH"));
  assert.ok(
    diagnostics.some((entry) => entry.code === "DUPLICATE_TOP_LEVEL_FIELD"),
  );
});

test("getDiagnostics reports advanced header security diagnostics", () => {
  const diagnostics = getDiagnostics({
    query: "query Demo { viewer { id } }",
    endpoint: "https://example.com/graphql",
    headers: JSON.stringify({
      Accept: "*/*",
      "Content-Type": "text/plain",
      Authorization: "Bearer ",
      "X-API-Key": "   ",
      Cookie: "session=abc",
      Host: "example.com",
      Authorization2: "Basic abc123",
    }),
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "ACCEPT_HEADER_WILDCARD"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "CONTENT_TYPE_NOT_JSON"),
  );
  assert.ok(
    diagnostics.some((entry) => entry.code === "AUTH_BEARER_MISSING_TOKEN"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "EMPTY_API_KEY_HEADER"));
  assert.ok(
    diagnostics.some((entry) => entry.code === "COOKIE_HEADER_PRESENT"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "HOST_HEADER_OVERRIDE"));
});

test("getDiagnostics warns when using basic auth header scheme", () => {
  const diagnostics = getDiagnostics({
    query: "query Demo { viewer { id } }",
    endpoint: "https://example.com/graphql",
    headers: JSON.stringify({ Authorization: "Basic abc123" }),
  });

  assert.ok(diagnostics.some((entry) => entry.code === "AUTH_BASIC_SCHEME"));
});
