import assert from "node:assert/strict";
import test from "node:test";

import { buildQueryFromStructure, parseQuery } from "./graphql-helpers.js";
import { graphqlStore } from "./graphql-store.js";

const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "crypto",
);
const canOverrideCrypto =
  !originalCryptoDescriptor || originalCryptoDescriptor.configurable;
const originalLocalStorage = globalThis.localStorage;
const mockStorage = new Map();

const mockLocalStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, value) => {
    mockStorage.set(key, value);
  },
  removeItem: (key) => {
    mockStorage.delete(key);
  },
  clear: () => {
    mockStorage.clear();
  },
};

const resetStore = () => {
  graphqlStore.resetDefaults();
  graphqlStore.clearHistory();
  graphqlStore.clearResults();
  graphqlStore.update((state) => ({
    ...state,
    endpoint: "https://example.com/graphql",
    variables: "{}",
    headers: "{}",
  }));
};

test.beforeEach(() => {
  if (canOverrideCrypto) {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: () => "test-uuid",
      },
      configurable: true,
    });
  }
  globalThis.localStorage = mockLocalStorage;
  mockStorage.clear();
  resetStore();
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (canOverrideCrypto) {
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
    } else {
      globalThis.crypto = originalCrypto;
    }
  }
  if (originalLocalStorage) {
    globalThis.localStorage = originalLocalStorage;
  } else {
    delete globalThis.localStorage;
  }
});

test("parses query operations with variables and fields", () => {
  const query = `query GetCountries($first: Int) {
  countries(first: $first) {
    code
    name
  }
}`;

  const result = parseQuery(query);

  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].type, "query");
  assert.equal(result.operations[0].name, "GetCountries");
  assert.deepEqual(result.operations[0].variables, [
    { name: "first", type: "Int", defaultValue: null },
  ]);
  assert.equal(result.operations[0].fields[0].name, "countries");
});

test("parses queries without names or variables", () => {
  const query = `query {
  country(code: "US") { name }
}`;

  const result = parseQuery(query);

  assert.equal(result.operations[0].type, "query");
  assert.equal(result.operations[0].name, "UnnamedOperation");
  assert.deepEqual(result.operations[0].variables, []);
  assert.equal(result.operations[0].fields[0].name, "country");
  assert.deepEqual(result.operations[0].fields[0].args, [
    { name: "code", value: '"US"', type: "String" },
  ]);
});

test("parses nested selection sets", () => {
  const query = `query GetPost($id: ID!) {
  post(id: $id) {
    title
    author {
      name
    }
  }
}`;

  const result = parseQuery(query);

  assert.equal(result.operations[0].fields[0].name, "post");
  assert.equal(result.operations[0].fields[0].fields[1].name, "author");
  assert.equal(result.operations[0].fields[0].fields[1].fields[0].name, "name");
});

test("parses queries with comments and blank input", () => {
  const query = `# comment line
  query {
    viewer {
      login
    }
  }`;

  const result = parseQuery(query);
  assert.equal(result.operations[0].fields[0].name, "viewer");

  const blankResult = parseQuery("");
  assert.equal(blankResult.operations[0].name, "UnnamedOperation");
});

test("parses aliased fields with nested selections", () => {
  const query = `query {\n  featured: post(id: 1) { title }\n}`;

  const result = parseQuery(query);

  assert.equal(result.operations[0].fields[0].name, "post");
  assert.equal(result.operations[0].fields[0].fields[0].name, "title");
});

test("builds a GraphQL query from a structure", () => {
  const structure = {
    operations: [
      {
        type: "query",
        name: "GetUser",
        variables: [{ name: "id", type: "ID!" }],
        fields: [
          {
            name: "user",
            args: [{ name: "id", value: "$id" }],
            fields: [{ name: "name" }, { name: "email" }],
          },
        ],
      },
    ],
    activeOperationIndex: 0,
  };

  const query = buildQueryFromStructure(structure);

  assert.match(query, /query GetUser\(\$id: ID!\)/);
  assert.match(query, /user\(id: \$id\)/);
  assert.match(query, /name/);
  assert.match(query, /email/);
});

test("builds multiple operations with arguments", () => {
  const structure = {
    operations: [
      {
        type: "query",
        name: "GetUsers",
        variables: [],
        fields: [
          { name: "users", args: [{ name: "first", value: 5 }], fields: [] },
        ],
      },
      {
        type: "mutation",
        name: "UpdateUser",
        variables: [{ name: "id", type: "ID!" }],
        fields: [
          {
            name: "updateUser",
            args: [{ name: "id", value: "$id" }],
            fields: [{ name: "id" }],
          },
        ],
      },
    ],
    activeOperationIndex: 0,
  };

  const query = buildQueryFromStructure(structure);

  assert.match(query, /query GetUsers/);
  assert.match(query, /users\(first: 5\)/);
  assert.match(query, /mutation UpdateUser\(\$id: ID!\)/);
  assert.match(query, /updateUser\(id: \$id\)/);
});

test("builds nested selection sets", () => {
  const structure = {
    operations: [
      {
        type: "query",
        name: "GetPost",
        variables: [{ name: "id", type: "ID!" }],
        fields: [
          {
            name: "post",
            args: [{ name: "id", value: "$id" }],
            fields: [
              { name: "title" },
              { name: "author", fields: [{ name: "name" }] },
            ],
          },
        ],
      },
    ],
    activeOperationIndex: 0,
  };

  const query = buildQueryFromStructure(structure);

  assert.match(query, /post\(id: \$id\)/);
  assert.match(query, /author/);
  assert.match(query, /name/);
});

test("builds a fallback query when no operations exist", () => {
  assert.equal(buildQueryFromStructure({ operations: [] }), "query { }");
});

test("builds a query without unnamed operation labels", () => {
  const structure = {
    operations: [
      {
        type: "query",
        name: "UnnamedOperation",
        variables: [],
        fields: [{ name: "viewer", args: [], fields: [] }],
      },
    ],
    activeOperationIndex: 0,
  };

  const query = buildQueryFromStructure(structure);

  assert.match(query, /^query \{/);
  assert.match(query, /viewer/);
  assert.doesNotMatch(query, /UnnamedOperation/);
});

test("parses mutation operations", () => {
  const query = `mutation UpdateUser($id: ID!) {\n  updateUser(id: $id) { id }\n}`;

  const result = parseQuery(query);

  assert.equal(result.operations[0].type, "mutation");
  assert.equal(result.operations[0].name, "UpdateUser");
  assert.deepEqual(result.operations[0].variables, [
    { name: "id", type: "ID!", defaultValue: null },
  ]);
});

test("stores history entry for missing endpoint", async () => {
  graphqlStore.update((state) => ({
    ...state,
    endpoint: "",
  }));

  await graphqlStore.executeQuery();

  const state = graphqlStore.getState();
  assert.equal(state.error, "Endpoint is required before executing a query.");
  assert.equal(state.history[0].status, "invalid");
  assert.equal(
    state.history[0].error,
    "Endpoint is required before executing a query.",
  );
  assert.equal(state.lastExecution.status, "invalid");
});

test("stores history entry for invalid variables", async () => {
  graphqlStore.update((state) => ({
    ...state,
    variables: "{ invalid",
  }));

  await graphqlStore.executeQuery();

  const state = graphqlStore.getState();
  assert.match(state.error, /Variables JSON error/);
  assert.equal(state.history[0].status, "invalid");
  assert.equal(state.lastExecution.status, "invalid");
});

test("stores history entry for invalid headers", async () => {
  graphqlStore.update((state) => ({
    ...state,
    headers: "{ invalid",
  }));

  await graphqlStore.executeQuery();

  const state = graphqlStore.getState();
  assert.match(state.error, /Headers JSON error/);
  assert.equal(state.history[0].status, "invalid");
  assert.equal(state.lastExecution.status, "invalid");
});

test("sends custom headers with requests", async () => {
  let receivedHeaders;
  globalThis.fetch = async (_url, options) => {
    receivedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: { ok: true },
      }),
    };
  };

  graphqlStore.update((state) => ({
    ...state,
    headers:
      '{\n  \"Authorization\": \"Bearer token\",\n  \"X-Env\": \"test\"\n}',
  }));

  await graphqlStore.executeQuery();

  assert.equal(receivedHeaders.Authorization, "Bearer token");
  assert.equal(receivedHeaders["X-Env"], "test");
  assert.equal(receivedHeaders["Content-Type"], "application/json");
});

test("stores history entry for GraphQL errors", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: null,
      errors: [{ message: "Example error" }],
    }),
  });

  await graphqlStore.executeQuery();

  const state = graphqlStore.getState();
  assert.equal(state.history[0].status, "error");
  assert.equal(state.history[0].error, "Example error");
  assert.equal(state.history[0].statusCode, 200);
  assert.equal(state.lastExecution.status, "error");
  assert.equal(state.lastExecution.statusCode, 200);
});

test("clears results state", () => {
  graphqlStore.update((state) => ({
    ...state,
    results: { data: { ok: true } },
    error: "Something went wrong",
  }));

  graphqlStore.clearResults();

  const state = graphqlStore.getState();
  assert.equal(state.results, null);
  assert.equal(state.error, null);
  assert.equal(state.loading, false);
  assert.equal(state.lastExecution, null);
});

test("stores lastExecution details for successful queries", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 201,
    statusText: "Created",
    json: async () => ({
      data: { ok: true },
    }),
  });

  await graphqlStore.executeQuery();

  const state = graphqlStore.getState();
  assert.equal(state.results.data.ok, true);
  assert.equal(state.lastExecution.status, "success");
  assert.equal(state.lastExecution.statusCode, 201);
  assert.equal(state.lastExecution.statusText, "Created");
});

test("imports history entries and toggles pins", () => {
  graphqlStore.importHistory([
    {
      id: "entry-1",
      timestamp: "2024-01-01T00:00:00.000Z",
      endpoint: "https://example.com/graphql",
      query: "query { viewer }",
      status: "success",
    },
  ]);

  let state = graphqlStore.getState();
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].id, "entry-1");
  assert.equal(state.history[0].pinned, false);

  graphqlStore.toggleHistoryPin("entry-1");
  state = graphqlStore.getState();
  assert.equal(state.history[0].pinned, true);
});

test("removes and clears unpinned history entries", () => {
  graphqlStore.importHistory([
    { id: "entry-1", query: "query { one }", status: "success", pinned: true },
    { id: "entry-2", query: "query { two }", status: "success", pinned: false },
  ]);

  graphqlStore.removeHistoryEntry("entry-2");
  let state = graphqlStore.getState();
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].id, "entry-1");

  graphqlStore.importHistory([
    { id: "entry-3", query: "query { three }", status: "success" },
  ]);
  graphqlStore.clearUnpinnedHistory();
  state = graphqlStore.getState();
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].id, "entry-1");
});

test("importHistory deduplicates by id and respects limit", () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({
    id: `entry-${index}`,
    query: `query { item${index} }`,
    status: "success",
  }));

  graphqlStore.importHistory(entries);
  graphqlStore.importHistory([
    { id: "entry-10", query: "query { updated }", status: "success" },
  ]);

  const state = graphqlStore.getState();
  assert.equal(state.history.length, 50);
  assert.equal(
    state.history.find((entry) => entry.id === "entry-10").query,
    "query { updated }",
  );
});

test("saves, loads, and applies workspace presets", () => {
  graphqlStore.update((state) => ({
    ...state,
    endpoint: "https://example.com/graphql",
    query: "query { viewer }",
    variables: '{\n  "id": 1\n}',
  }));

  graphqlStore.savePreset("Primary Workspace");

  let state = graphqlStore.getState();
  assert.equal(state.savedPresets.length, 1);
  assert.equal(state.savedPresets[0].name, "Primary Workspace");

  graphqlStore.update((state) => ({
    ...state,
    endpoint: "https://other.example.com/graphql",
    query: "query { other }",
    variables: "{}",
    savedPresets: [],
  }));

  graphqlStore.loadSavedPresets();
  state = graphqlStore.getState();
  assert.equal(state.savedPresets.length, 1);

  graphqlStore.applyPreset(state.savedPresets[0]);
  state = graphqlStore.getState();
  assert.equal(state.endpoint, "https://example.com/graphql");
  assert.equal(state.query, "query { viewer }");
  assert.equal(state.variables, '{\n  "id": 1\n}');
});

test("auto-saves editor drafts and restores them", async () => {
  graphqlStore.updateQuery("query { draft }");
  graphqlStore.updateVariables('{"draft": true}');
  graphqlStore.updateEndpoint("https://draft.example.com/graphql");

  await new Promise((resolve) => setTimeout(resolve, 700));

  let state = graphqlStore.getState();
  assert.ok(state.draft);
  assert.equal(state.draft.endpoint, "https://draft.example.com/graphql");

  graphqlStore.update((state) => ({
    ...state,
    endpoint: "",
    query: "",
    variables: "",
    draft: null,
  }));

  graphqlStore.loadDraft();
  state = graphqlStore.getState();
  assert.ok(state.draft);

  graphqlStore.applyDraft();
  state = graphqlStore.getState();
  assert.equal(state.endpoint, "https://draft.example.com/graphql");

  graphqlStore.clearDraft();
  state = graphqlStore.getState();
  assert.equal(state.draft, null);
});
