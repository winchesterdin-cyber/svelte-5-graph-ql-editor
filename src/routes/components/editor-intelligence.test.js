import test from "node:test";
import assert from "node:assert/strict";
import {
  getDiagnostics,
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
    variables: "{ invalid",
  });

  assert.ok(
    diagnostics.some((entry) => entry.code === "MISSING_CLOSING_TOKEN"),
  );
  assert.ok(diagnostics.some((entry) => entry.code === "MISSING_ENDPOINT"));
  assert.ok(diagnostics.some((entry) => entry.code === "VARIABLES_JSON"));
});

test("getSchemaSuggestions filters root fields by token", () => {
  const suggestions = getSchemaSuggestions({
    schema: {
      queryType: { name: "Query" },
      types: [
        {
          name: "Query",
          fields: [
            {
              name: "users",
              type: { name: "User" },
              description: "List users",
            },
            {
              name: "posts",
              type: { name: "Post" },
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
