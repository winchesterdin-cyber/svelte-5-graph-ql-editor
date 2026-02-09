import { writable } from "svelte/store";
import { buildQueryFromStructure, parseQuery } from "./graphql-helpers.js";
import { LEVELS, logEvent } from "./logger.js";

// Create reactive store for GraphQL state
const DEFAULT_QUERY = `query GetCountries($first: Int) {
  countries(first: $first) {
    code
    name
    emoji
    currency
  }
}`;

const DEFAULT_VARIABLES = '{\n  "first": 5\n}';
const DEFAULT_HEADERS = "{}";

const DEMO_SCHEMAS = {
  blog: {
    name: "Blog & Social Media",
    description: "Users, posts, comments with deep nesting",
    schema: {
      types: [
        {
          name: "Query",
          kind: "OBJECT",
          description: "The root query type",
          fields: [
            {
              name: "user",
              type: { name: "User", kind: "OBJECT" },
              args: [
                { name: "id", type: { name: "ID", kind: "SCALAR" } },
                { name: "email", type: { name: "String", kind: "SCALAR" } },
              ],
            },
            {
              name: "users",
              type: {
                name: "User",
                kind: "LIST",
                ofType: { name: "User", kind: "OBJECT" },
              },
              args: [
                { name: "first", type: { name: "Int", kind: "SCALAR" } },
                {
                  name: "filter",
                  type: { name: "UserFilter", kind: "INPUT_OBJECT" },
                },
              ],
            },
            {
              name: "posts",
              type: {
                name: "Post",
                kind: "LIST",
                ofType: { name: "Post", kind: "OBJECT" },
              },
              args: [
                { name: "authorId", type: { name: "ID", kind: "SCALAR" } },
                {
                  name: "published",
                  type: { name: "Boolean", kind: "SCALAR" },
                },
              ],
            },
          ],
        },
        {
          name: "User",
          kind: "OBJECT",
          description: "A user in the system",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "email",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "avatar",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "profile",
              type: { name: "UserProfile", kind: "OBJECT" },
              args: [],
            },
            {
              name: "posts",
              type: {
                name: "Post",
                kind: "LIST",
                ofType: { name: "Post", kind: "OBJECT" },
              },
              args: [
                { name: "first", type: { name: "Int", kind: "SCALAR" } },
                {
                  name: "published",
                  type: { name: "Boolean", kind: "SCALAR" },
                },
              ],
            },
            {
              name: "comments",
              type: {
                name: "Comment",
                kind: "LIST",
                ofType: { name: "Comment", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "UserProfile",
          kind: "OBJECT",
          description: "Extended user profile information",
          fields: [
            { name: "bio", type: { name: "String", kind: "SCALAR" }, args: [] },
            {
              name: "website",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "location",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "socialLinks",
              type: { name: "SocialLinks", kind: "OBJECT" },
              args: [],
            },
            {
              name: "preferences",
              type: { name: "UserPreferences", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "SocialLinks",
          kind: "OBJECT",
          description: "Social media links",
          fields: [
            {
              name: "twitter",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "github",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "linkedin",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
          ],
        },
        {
          name: "UserPreferences",
          kind: "OBJECT",
          fields: [
            {
              name: "theme",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "notifications",
              type: { name: "NotificationSettings", kind: "OBJECT" },
              args: [],
            },
            {
              name: "privacy",
              type: { name: "PrivacySettings", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "NotificationSettings",
          kind: "OBJECT",
          fields: [
            {
              name: "email",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
            {
              name: "push",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
            {
              name: "sms",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
          ],
        },
        {
          name: "PrivacySettings",
          kind: "OBJECT",
          fields: [
            {
              name: "profileVisible",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
            {
              name: "showEmail",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
          ],
        },
        {
          name: "Post",
          kind: "OBJECT",
          description: "A blog post",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "title",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "content",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "published",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
            {
              name: "createdAt",
              type: { name: "DateTime", kind: "SCALAR" },
              args: [],
            },
            {
              name: "author",
              type: { name: "User", kind: "OBJECT" },
              args: [],
            },
            {
              name: "comments",
              type: {
                name: "Comment",
                kind: "LIST",
                ofType: { name: "Comment", kind: "OBJECT" },
              },
              args: [{ name: "first", type: { name: "Int", kind: "SCALAR" } }],
            },
            {
              name: "tags",
              type: {
                name: "Tag",
                kind: "LIST",
                ofType: { name: "Tag", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "Comment",
          kind: "OBJECT",
          description: "A comment on a post",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "content",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "createdAt",
              type: { name: "DateTime", kind: "SCALAR" },
              args: [],
            },
            {
              name: "author",
              type: { name: "User", kind: "OBJECT" },
              args: [],
            },
            {
              name: "post",
              type: { name: "Post", kind: "OBJECT" },
              args: [],
            },
            {
              name: "replies",
              type: {
                name: "Comment",
                kind: "LIST",
                ofType: { name: "Comment", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "Tag",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "color",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
          ],
        },
      ],
      queryType: { name: "Query" },
      mutationType: { name: "Mutation" },
    },
  },
  ecommerce: {
    name: "E-commerce Platform",
    description: "Products, orders, customers, inventory",
    schema: {
      types: [
        {
          name: "Query",
          kind: "OBJECT",
          fields: [
            {
              name: "product",
              type: { name: "Product", kind: "OBJECT" },
              args: [
                { name: "id", type: { name: "ID", kind: "SCALAR" } },
                { name: "sku", type: { name: "String", kind: "SCALAR" } },
              ],
            },
            {
              name: "products",
              type: {
                name: "Product",
                kind: "LIST",
                ofType: { name: "Product", kind: "OBJECT" },
              },
              args: [
                { name: "category", type: { name: "String", kind: "SCALAR" } },
                { name: "inStock", type: { name: "Boolean", kind: "SCALAR" } },
                {
                  name: "priceRange",
                  type: { name: "PriceRange", kind: "INPUT_OBJECT" },
                },
              ],
            },
            {
              name: "order",
              type: { name: "Order", kind: "OBJECT" },
              args: [{ name: "id", type: { name: "ID", kind: "SCALAR" } }],
            },
          ],
        },
        {
          name: "Product",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "description",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "price",
              type: { name: "Money", kind: "OBJECT" },
              args: [],
            },
            {
              name: "category",
              type: { name: "Category", kind: "OBJECT" },
              args: [],
            },
            {
              name: "inventory",
              type: { name: "Inventory", kind: "OBJECT" },
              args: [],
            },
            {
              name: "reviews",
              type: {
                name: "Review",
                kind: "LIST",
                ofType: { name: "Review", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "Money",
          kind: "OBJECT",
          fields: [
            {
              name: "amount",
              type: { name: "Float", kind: "SCALAR" },
              args: [],
            },
            {
              name: "currency",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
          ],
        },
        {
          name: "Category",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "parent",
              type: { name: "Category", kind: "OBJECT" },
              args: [],
            },
            {
              name: "children",
              type: {
                name: "Category",
                kind: "LIST",
                ofType: { name: "Category", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "Inventory",
          kind: "OBJECT",
          fields: [
            {
              name: "quantity",
              type: { name: "Int", kind: "SCALAR" },
              args: [],
            },
            {
              name: "reserved",
              type: { name: "Int", kind: "SCALAR" },
              args: [],
            },
            {
              name: "warehouse",
              type: { name: "Warehouse", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "Warehouse",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "location",
              type: { name: "Address", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "Address",
          kind: "OBJECT",
          fields: [
            {
              name: "street",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "city",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "country",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "coordinates",
              type: { name: "Coordinates", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "Coordinates",
          kind: "OBJECT",
          fields: [
            { name: "lat", type: { name: "Float", kind: "SCALAR" }, args: [] },
            { name: "lng", type: { name: "Float", kind: "SCALAR" }, args: [] },
          ],
        },
        {
          name: "Order",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "customer",
              type: { name: "Customer", kind: "OBJECT" },
              args: [],
            },
            {
              name: "items",
              type: {
                name: "OrderItem",
                kind: "LIST",
                ofType: { name: "OrderItem", kind: "OBJECT" },
              },
              args: [],
            },
            {
              name: "total",
              type: { name: "Money", kind: "OBJECT" },
              args: [],
            },
            {
              name: "status",
              type: { name: "OrderStatus", kind: "ENUM" },
              args: [],
            },
          ],
        },
        {
          name: "Customer",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "email",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "profile",
              type: { name: "CustomerProfile", kind: "OBJECT" },
              args: [],
            },
            {
              name: "orders",
              type: {
                name: "Order",
                kind: "LIST",
                ofType: { name: "Order", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "CustomerProfile",
          kind: "OBJECT",
          fields: [
            {
              name: "firstName",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "lastName",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "addresses",
              type: {
                name: "Address",
                kind: "LIST",
                ofType: { name: "Address", kind: "OBJECT" },
              },
              args: [],
            },
          ],
        },
        {
          name: "OrderItem",
          kind: "OBJECT",
          fields: [
            {
              name: "product",
              type: { name: "Product", kind: "OBJECT" },
              args: [],
            },
            {
              name: "quantity",
              type: { name: "Int", kind: "SCALAR" },
              args: [],
            },
            {
              name: "price",
              type: { name: "Money", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "Review",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            { name: "rating", type: { name: "Int", kind: "SCALAR" }, args: [] },
            {
              name: "comment",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "author",
              type: { name: "Customer", kind: "OBJECT" },
              args: [],
            },
          ],
        },
      ],
      queryType: { name: "Query" },
      mutationType: { name: "Mutation" },
    },
  },
  github: {
    name: "GitHub API Style",
    description: "Repositories, users, issues, pull requests",
    schema: {
      types: [
        {
          name: "Query",
          kind: "OBJECT",
          fields: [
            {
              name: "repository",
              type: { name: "Repository", kind: "OBJECT" },
              args: [
                { name: "owner", type: { name: "String", kind: "SCALAR" } },
                { name: "name", type: { name: "String", kind: "SCALAR" } },
              ],
            },
            {
              name: "user",
              type: { name: "User", kind: "OBJECT" },
              args: [
                { name: "login", type: { name: "String", kind: "SCALAR" } },
              ],
            },
          ],
        },
        {
          name: "Repository",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "description",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            { name: "owner", type: { name: "User", kind: "OBJECT" }, args: [] },
            {
              name: "stargazers",
              type: { name: "StargazerConnection", kind: "OBJECT" },
              args: [
                { name: "first", type: { name: "Int", kind: "SCALAR" } },
                { name: "after", type: { name: "String", kind: "SCALAR" } },
              ],
            },
            {
              name: "issues",
              type: { name: "IssueConnection", kind: "OBJECT" },
              args: [
                { name: "first", type: { name: "Int", kind: "SCALAR" } },
                {
                  name: "states",
                  type: {
                    name: "IssueState",
                    kind: "LIST",
                    ofType: { name: "IssueState", kind: "ENUM" },
                  },
                },
              ],
            },
          ],
        },
        {
          name: "User",
          kind: "OBJECT",
          fields: [
            { name: "id", type: { name: "ID", kind: "SCALAR" }, args: [] },
            {
              name: "login",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "name",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "repositories",
              type: { name: "RepositoryConnection", kind: "OBJECT" },
              args: [
                { name: "first", type: { name: "Int", kind: "SCALAR" } },
                {
                  name: "orderBy",
                  type: { name: "RepositoryOrder", kind: "INPUT_OBJECT" },
                },
              ],
            },
            {
              name: "followers",
              type: { name: "FollowerConnection", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "StargazerConnection",
          kind: "OBJECT",
          fields: [
            {
              name: "totalCount",
              type: { name: "Int", kind: "SCALAR" },
              args: [],
            },
            {
              name: "edges",
              type: {
                name: "StargazerEdge",
                kind: "LIST",
                ofType: { name: "StargazerEdge", kind: "OBJECT" },
              },
              args: [],
            },
            {
              name: "pageInfo",
              type: { name: "PageInfo", kind: "OBJECT" },
              args: [],
            },
          ],
        },
        {
          name: "StargazerEdge",
          kind: "OBJECT",
          fields: [
            { name: "node", type: { name: "User", kind: "OBJECT" }, args: [] },
            {
              name: "starredAt",
              type: { name: "DateTime", kind: "SCALAR" },
              args: [],
            },
          ],
        },
        {
          name: "PageInfo",
          kind: "OBJECT",
          fields: [
            {
              name: "hasNextPage",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
            {
              name: "hasPreviousPage",
              type: { name: "Boolean", kind: "SCALAR" },
              args: [],
            },
            {
              name: "startCursor",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
            {
              name: "endCursor",
              type: { name: "String", kind: "SCALAR" },
              args: [],
            },
          ],
        },
      ],
      queryType: { name: "Query" },
      mutationType: { name: "Mutation" },
    },
  },
};

function createGraphQLStore() {
  const HISTORY_LIMIT = 50;
  const HISTORY_NOTE_MAX_LENGTH = 280;
  const LOG_LIMIT = 200;
  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_RETRY_COUNT = 2;
  const DEFAULT_RETRY_DELAY_MS = 1000;
  const PRESET_STORAGE_KEY = "graphql-editor-presets";
  const HISTORY_STORAGE_KEY = "graphql-editor-history";
  const DRAFT_STORAGE_KEY = "graphql-editor-draft";
  const DRAFT_SAVE_DELAY_MS = 600;
  let activeController = null;
  let activeTimeoutId = null;
  let draftSaveTimeoutId = null;

  /**
   * Normalize user-supplied notes to keep history entries tidy and safe to render.
   * Truncates overly long notes to prevent unbounded localStorage payloads.
   */
  const normalizeHistoryNote = (note) => {
    if (!note) return "";
    const trimmed = String(note).trim();
    if (trimmed.length <= HISTORY_NOTE_MAX_LENGTH) {
      return trimmed;
    }
    return trimmed.slice(0, HISTORY_NOTE_MAX_LENGTH);
  };

  /**
   * Recover persisted history entries from localStorage.
   * This is best-effort so the UI can still load without storage access.
   */
  const readHistoryFromStorage = () => {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logEvent(LEVELS.WARN, "Failed to parse saved history entries", {
        error: error.message,
      });
      return [];
    }
  };

  const normalizeHistoryEntry = (entry) => ({
    id:
      entry.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}`),
    timestamp: entry.timestamp || new Date().toISOString(),
    endpoint: entry.endpoint ?? "",
    query: entry.query ?? "",
    variables: entry.variables ?? "",
    status: entry.status ?? "success",
    durationMs: entry.durationMs,
    statusCode: entry.statusCode,
    statusText: entry.statusText,
    error: entry.error,
    pinned: Boolean(entry.pinned),
    note: normalizeHistoryNote(entry.note),
  });

  const initialState = {
    endpoint: "https://countries.trevorblades.com/",
    query: DEFAULT_QUERY,
    variables: DEFAULT_VARIABLES,
    headers: DEFAULT_HEADERS,
    results: null,
    schema: null,
    loading: false,
    error: null,
    history: readHistoryFromStorage()
      .map(normalizeHistoryEntry)
      .slice(0, HISTORY_LIMIT),
    lastExecution: null,
    requestTimeoutMs: DEFAULT_TIMEOUT_MS,
    retryPolicy: {
      maxRetries: DEFAULT_RETRY_COUNT,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    },
    retryAttempt: null,
    logs: [],
    savedPresets: [],
    draft: null,
    queryStructure: {
      operations: [
        {
          type: "query",
          name: "MyQuery",
          fields: [], // Start with no fields
          variables: [],
        },
      ],
      activeOperationIndex: 0,
    },
    currentSchemaKey: null,
    availableSchemas: DEMO_SCHEMAS,
  };

  const { subscribe, set, update } = writable(initialState);
  const store = { subscribe, set, update };

  /**
   * Safely read saved workspaces from localStorage.
   * This guards against SSR environments and malformed JSON.
   */
  const readPresetsFromStorage = () => {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      recordLog(LEVELS.WARN, "Failed to parse saved workspaces", {
        error: error.message,
      });
      return [];
    }
  };

  /**
   * Persist saved workspaces for quick reloads across sessions.
   * Failure is non-fatal because the UI should keep working without persistence.
   */
  const persistPresets = (presets) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      recordLog(LEVELS.ERROR, "Failed to persist saved workspaces", {
        error: error.message,
      });
    }
  };

  /**
   * Read the most recent editor draft from localStorage.
   * Drafts are optional, so failures are treated as recoverable warnings.
   */
  const readDraftFromStorage = () => {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (error) {
      recordLog(LEVELS.WARN, "Failed to parse editor draft", {
        error: error.message,
      });
      return null;
    }
  };

  /**
   * Persist a draft payload so users can recover work after refreshes.
   * Uses a debounce to avoid writing to storage on every keystroke.
   */
  const scheduleDraftSave = (draftPayload) => {
    if (typeof localStorage === "undefined") return;
    if (draftSaveTimeoutId) {
      clearTimeout(draftSaveTimeoutId);
    }
    draftSaveTimeoutId = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
        recordLog(LEVELS.INFO, "Auto-saved editor draft", {
          updatedAt: draftPayload.updatedAt,
        });
        update((state) => ({ ...state, draft: draftPayload }));
      } catch (error) {
        recordLog(LEVELS.ERROR, "Failed to persist editor draft", {
          error: error.message,
        });
      }
    }, DRAFT_SAVE_DELAY_MS);
  };

  const clearDraftStorage = () => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  /**
   * Persist history entries in localStorage for durable session recall.
   */
  const persistHistory = (history) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      recordLog(LEVELS.ERROR, "Failed to persist history entries", {
        error: error.message,
      });
    }
  };

  const addHistoryEntry = (entry) => {
    update((state) => {
      const nextHistory = [
        normalizeHistoryEntry(entry),
        ...state.history,
      ].slice(0, HISTORY_LIMIT);
      persistHistory(nextHistory);
      return {
        ...state,
        history: nextHistory,
      };
    });
  };

  /**
   * Merge and persist history entries with de-duplication.
   * Shared by imports to keep behavior consistent.
   * @param {Array<Record<string, unknown>>} entries
   */
  const importHistoryEntries = (entries = []) => {
    recordLog(LEVELS.INFO, "Imported query history entries", {
      count: entries.length,
    });
    update((state) => {
      const normalized = entries.map(normalizeHistoryEntry);
      const existing = state.history ?? [];
      const merged = [...normalized, ...existing];
      const deduped = Array.from(
        new Map(
          [...merged].reverse().map((entry) => [entry.id, entry]),
        ).values(),
      ).reverse();
      const nextHistory = deduped.slice(0, HISTORY_LIMIT);
      persistHistory(nextHistory);
      return { ...state, history: nextHistory };
    });
  };

  /**
   * Build a stable history export payload with metadata for later restore.
   * Keeping a version allows us to evolve the format without breaking imports.
   * @param {Array<Record<string, unknown>>} historyEntries
   */
  const buildHistoryExportPayload = (historyEntries) => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: historyEntries,
  });

  /**
   * Persist a structured log entry in the store and emit it to the console.
   * Keeps the most recent LOG_LIMIT entries to avoid unbounded growth.
   */
  const recordLog = (level, message, context = {}) => {
    const entry = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`,
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    logEvent(level, message, context);

    update((state) => ({
      ...state,
      logs: [...(state.logs ?? []), entry].slice(-LOG_LIMIT),
    }));
  };

  /**
   * Provide a lightweight hook for UI components to emit structured logs.
   * Centralizing UI logs keeps observability consistent across the app.
   */
  const logUiEvent = (level, message, context = {}) => {
    recordLog(level, message, {
      scope: "ui",
      ...context,
    });
  };

  /**
   * Normalize a user-provided header map into fetch-ready headers.
   * This ensures values are strings and guards against non-object JSON values.
   * @param {string} rawHeaders
   * @returns {{ headers: Record<string, string> | null, error: string | null }}
   */
  const parseHeadersJson = (rawHeaders) => {
    if (!rawHeaders || !rawHeaders.trim()) {
      return { headers: {}, error: null };
    }

    try {
      const parsed = JSON.parse(rawHeaders);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          headers: null,
          error: "Headers must be a JSON object with key/value pairs.",
        };
      }

      const normalizedHeaders = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!key || typeof key !== "string") {
          return {
            headers: null,
            error: "Header names must be non-empty strings.",
          };
        }

        if (value === null || typeof value === "undefined") {
          normalizedHeaders[key] = "";
          continue;
        }

        if (typeof value === "object") {
          return {
            headers: null,
            error: "Header values must be strings, numbers, or booleans.",
          };
        }

        normalizedHeaders[key] = String(value);
      }

      return { headers: normalizedHeaders, error: null };
    } catch (error) {
      return {
        headers: null,
        error: `Headers JSON error: ${error.message}`,
      };
    }
  };

  /**
   * Parse user-provided variables JSON into a plain object payload.
   * GraphQL variables must be a JSON object, not arrays or primitives.
   * @param {string} rawVariables
   * @returns {{ variables: Record<string, unknown> | null, error: string | null }}
   */
  const parseVariablesJson = (rawVariables) => {
    if (!rawVariables || !rawVariables.trim()) {
      return { variables: {}, error: null };
    }

    try {
      const parsed = JSON.parse(rawVariables);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          variables: null,
          error: "Variables must be a JSON object.",
        };
      }

      return { variables: parsed, error: null };
    } catch (error) {
      return {
        variables: null,
        error: `Variables JSON error: ${error.message}`,
      };
    }
  };

  /**
   * Build a lightweight draft payload from editor state.
   * Keeping the payload minimal reduces localStorage usage.
   */
  const buildDraftPayload = (state) => ({
    endpoint: state.endpoint,
    query: state.query,
    variables: state.variables,
    headers: state.headers,
    updatedAt: new Date().toISOString(),
  });

  return {
    subscribe,
    set,
    update,

    isValidField: (typeName, fieldName) => {
      const currentState = get(store);
      if (!currentState.schema) return true; // Allow if no schema loaded

      const type = currentState.schema.types.find((t) => t.name === typeName);
      if (!type || !type.fields) return false;

      return type.fields.some((f) => f.name === fieldName);
    },

    isValidArgument: (typeName, fieldName, argName) => {
      const currentState = get(store);
      if (!currentState.schema) return true; // Allow if no schema loaded

      const type = currentState.schema.types.find((t) => t.name === typeName);
      if (!type || !type.fields) return false;

      const field = type.fields.find((f) => f.name === fieldName);
      if (!field || !field.args) return false;

      return field.args.some((a) => a.name === argName);
    },

    getValidFieldsForType: (typeName) => {
      const currentState = get(store);
      if (!currentState.schema) return [];

      const type = currentState.schema.types.find((t) => t.name === typeName);
      return type ? type.fields || [] : [];
    },

    getValidArgsForField: (typeName, fieldName) => {
      const currentState = get(store);
      if (!currentState.schema) return [];

      const type = currentState.schema.types.find((t) => t.name === typeName);
      if (!type || !type.fields) return [];

      const field = type.fields.find((f) => f.name === fieldName);
      return field ? field.args || [] : [];
    },

    addOperation: (operationType = "query") => {
      update((state) => {
        const newOperation = {
          type: operationType,
          name: `My${operationType.charAt(0).toUpperCase() + operationType.slice(1)}`,
          fields: [],
          variables: [],
        };

        const newOperations = [
          ...state.queryStructure.operations,
          newOperation,
        ];
        const newStructure = {
          ...state.queryStructure,
          operations: newOperations,
          activeOperationIndex: newOperations.length - 1,
        };

        return {
          ...state,
          queryStructure: newStructure,
          query: buildQueryFromStructure(newStructure),
        };
      });
    },

    removeOperation: (index) => {
      update((state) => {
        const newOperations = state.queryStructure.operations.filter(
          (_, i) => i !== index,
        );
        if (newOperations.length === 0) {
          // Always keep at least one operation
          newOperations.push({
            type: "query",
            name: "MyQuery",
            fields: [],
            variables: [],
          });
        }

        const newActiveIndex = Math.min(
          state.queryStructure.activeOperationIndex,
          newOperations.length - 1,
        );
        const newStructure = {
          ...state.queryStructure,
          operations: newOperations,
          activeOperationIndex: newActiveIndex,
        };

        return {
          ...state,
          queryStructure: newStructure,
          query: buildQueryFromStructure(newStructure),
        };
      });
    },

    setActiveOperation: (index) => {
      update((state) => ({
        ...state,
        queryStructure: {
          ...state.queryStructure,
          activeOperationIndex: index,
        },
      }));
    },

    getCurrentOperation: () => {
      const currentState = get(store);
      return currentState.queryStructure.operations[
        currentState.queryStructure.activeOperationIndex
      ];
    },

    updateQueryStructure: (newStructure) => {
      update((state) => {
        const newQuery = buildQueryFromStructure(newStructure);
        return {
          ...state,
          queryStructure: newStructure,
          query: newQuery,
        };
      });
    },

    updateCurrentOperation: (updatedOperation) => {
      update((state) => {
        const newOperations = [...state.queryStructure.operations];
        newOperations[state.queryStructure.activeOperationIndex] =
          updatedOperation;

        const newStructure = {
          ...state.queryStructure,
          operations: newOperations,
        };

        return {
          ...state,
          queryStructure: newStructure,
          query: buildQueryFromStructure(newStructure),
        };
      });
    },

    loadDemoSchema: (schemaKey = "blog") => {
      const selectedSchema = DEMO_SCHEMAS[schemaKey];
      if (selectedSchema) {
        recordLog(LEVELS.INFO, "Loaded demo schema", { schemaKey });
        update((state) => ({
          ...state,
          schema: selectedSchema.schema,
          currentSchemaKey: schemaKey,
          endpoint: `demo://${schemaKey}`,
        }));
      }
    },

    addFieldToQuery: (fieldPath, fieldName, args = []) => {
      update((state) => {
        const newStructure = { ...state.queryStructure };

        if (fieldPath.length === 0) {
          // Adding to root level
          const existingField = newStructure.operations[
            newStructure.activeOperationIndex
          ].fields.find((f) => f.name === fieldName);
          if (!existingField) {
            newStructure.operations[
              newStructure.activeOperationIndex
            ].fields.push({
              name: fieldName,
              args: args,
              fields: [],
            });
          }
        } else {
          // Adding to nested level
          const addToNestedField = (fields, path, depth = 0) => {
            if (depth >= path.length) return;

            const currentFieldName = path[depth];
            let field = fields.find((f) => f.name === currentFieldName);

            if (!field) {
              field = { name: currentFieldName, args: [], fields: [] };
              fields.push(field);
            }

            if (depth === path.length - 1) {
              // Add the new field here
              if (!field.fields.find((f) => f.name === fieldName)) {
                field.fields.push({
                  name: fieldName,
                  args: args,
                  fields: [],
                });
              }
            } else {
              // Continue deeper
              addToNestedField(field.fields, path, depth + 1);
            }
          };

          addToNestedField(
            newStructure.operations[newStructure.activeOperationIndex].fields,
            fieldPath,
          );
        }

        const newQuery = buildQueryFromStructure(newStructure);

        return {
          ...state,
          queryStructure: newStructure,
          query: newQuery,
        };
      });
    },

    removeFieldFromQuery: (fieldPath, fieldName) => {
      update((state) => {
        const newStructure = { ...state.queryStructure };

        if (fieldPath.length === 0) {
          // Removing from root level
          newStructure.operations[newStructure.activeOperationIndex].fields =
            newStructure.operations[
              newStructure.activeOperationIndex
            ].fields.filter((f) => f.name !== fieldName);
        } else {
          // Removing from nested level
          const removeFromNestedField = (fields, path, depth = 0) => {
            if (depth >= path.length) return;

            const currentFieldName = path[depth];
            const field = fields.find((f) => f.name === currentFieldName);

            if (field) {
              if (depth === path.length - 1) {
                // Remove the field here
                field.fields = field.fields.filter((f) => f.name !== fieldName);
              } else {
                // Continue deeper
                removeFromNestedField(field.fields, path, depth + 1);
              }
            }
          };

          removeFromNestedField(
            newStructure.operations[newStructure.activeOperationIndex].fields,
            fieldPath,
          );
        }

        const newQuery = buildQueryFromStructure(newStructure);

        return {
          ...state,
          queryStructure: newStructure,
          query: newQuery,
        };
      });
    },

    updateQuery: (newQuery) => {
      update((state) => {
        const newState = { ...state, query: newQuery };
        newState.queryStructure = parseQuery(newQuery);
        scheduleDraftSave(buildDraftPayload(newState));
        return newState;
      });
    },

    updateEndpoint: (newEndpoint) => {
      update((state) => {
        const nextState = { ...state, endpoint: newEndpoint };
        scheduleDraftSave(buildDraftPayload(nextState));
        return nextState;
      });
    },

    updateVariables: (newVariables) => {
      update((state) => {
        const nextState = { ...state, variables: newVariables };
        scheduleDraftSave(buildDraftPayload(nextState));
        return nextState;
      });
    },

    updateHeaders: (newHeaders) => {
      update((state) => {
        const nextState = { ...state, headers: newHeaders };
        scheduleDraftSave(buildDraftPayload(nextState));
        return nextState;
      });
    },

    setRequestTimeoutMs: (timeoutMs) => {
      const normalizedTimeout =
        Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.round(timeoutMs) : 0;
      recordLog(LEVELS.INFO, "Updated request timeout", {
        timeoutMs: normalizedTimeout,
      });
      update((state) => ({ ...state, requestTimeoutMs: normalizedTimeout }));
    },

    setRetryPolicy: ({ maxRetries, retryDelayMs }) => {
      const normalizedMaxRetries =
        Number.isFinite(maxRetries) && maxRetries >= 0
          ? Math.round(maxRetries)
          : 0;
      const normalizedRetryDelay =
        Number.isFinite(retryDelayMs) && retryDelayMs >= 0
          ? Math.round(retryDelayMs)
          : DEFAULT_RETRY_DELAY_MS;
      recordLog(LEVELS.INFO, "Updated retry policy", {
        maxRetries: normalizedMaxRetries,
        retryDelayMs: normalizedRetryDelay,
      });
      update((state) => ({
        ...state,
        retryPolicy: {
          maxRetries: normalizedMaxRetries,
          retryDelayMs: normalizedRetryDelay,
        },
      }));
    },

    cancelActiveRequest: () => {
      if (!activeController) {
        recordLog(LEVELS.WARN, "Cancel requested with no active request");
        return;
      }
      activeController.abort("user-cancelled");
      recordLog(LEVELS.WARN, "User cancelled active request");
    },

    addHistoryEntry,

    /**
     * Export the current query history as a JSON string with metadata.
     * This keeps exports easy to share while remaining forward compatible.
     */
    exportHistory: () => {
      const currentState = get(store);
      const historyEntries = currentState.history ?? [];
      const payload = buildHistoryExportPayload(historyEntries);
      recordLog(LEVELS.INFO, "Exported query history", {
        count: historyEntries.length,
      });
      return JSON.stringify(payload, null, 2);
    },

    clearHistory: () => {
      recordLog(LEVELS.INFO, "Cleared query history");
      update((state) => {
        persistHistory([]);
        return { ...state, history: [] };
      });
    },

    importHistory: (entries = []) => {
      importHistoryEntries(entries);
    },

    /**
     * Import history entries from a JSON string.
     * Accepts raw arrays for backward compatibility or the export payload shape.
     * @param {string} rawHistoryJson
     */
    importHistoryFromJson: (rawHistoryJson) => {
      if (!rawHistoryJson || !rawHistoryJson.trim()) {
        recordLog(LEVELS.WARN, "Skipped importing empty history payload");
        return;
      }
      try {
        const parsed = JSON.parse(rawHistoryJson);
        const entries = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.entries)
            ? parsed.entries
            : null;

        if (!entries) {
          recordLog(LEVELS.WARN, "History import payload was not valid", {
            payloadType: Array.isArray(parsed) ? "array" : typeof parsed,
          });
          return;
        }

        recordLog(LEVELS.INFO, "Imported history from JSON payload", {
          count: entries.length,
        });
        importHistoryEntries(entries);
      } catch (error) {
        recordLog(LEVELS.ERROR, "Failed to parse history import payload", {
          error: error.message,
        });
      }
    },

    toggleHistoryPin: (entryId) => {
      update((state) => {
        const nextHistory = state.history.map((entry) =>
          entry.id === entryId ? { ...entry, pinned: !entry.pinned } : entry,
        );
        persistHistory(nextHistory);
        return {
          ...state,
          history: nextHistory,
        };
      });
    },

    removeHistoryEntry: (entryId) => {
      update((state) => {
        const nextHistory = state.history.filter(
          (entry) => entry.id !== entryId,
        );
        persistHistory(nextHistory);
        return {
          ...state,
          history: nextHistory,
        };
      });
    },

    clearUnpinnedHistory: () => {
      recordLog(LEVELS.INFO, "Cleared unpinned history entries");
      update((state) => {
        const nextHistory = state.history.filter((entry) => entry.pinned);
        persistHistory(nextHistory);
        return {
          ...state,
          history: nextHistory,
        };
      });
    },

    updateHistoryNote: (entryId, note) => {
      const normalizedNote = normalizeHistoryNote(note);
      if (note && normalizedNote.length < String(note).trim().length) {
        recordLog(LEVELS.WARN, "History note truncated to max length", {
          entryId,
          maxLength: HISTORY_NOTE_MAX_LENGTH,
        });
      }
      update((state) => {
        let found = false;
        const nextHistory = state.history.map((entry) => {
          if (entry.id !== entryId) return entry;
          found = true;
          return { ...entry, note: normalizedNote };
        });
        if (!found) {
          recordLog(LEVELS.WARN, "History entry not found for note update", {
            entryId,
          });
          return state;
        }
        recordLog(LEVELS.INFO, "Updated history note", {
          entryId,
          hasNote: Boolean(normalizedNote),
        });
        persistHistory(nextHistory);
        return {
          ...state,
          history: nextHistory,
        };
      });
    },

    clearResults: () => {
      recordLog(LEVELS.INFO, "Cleared results panel");
      update((state) => ({
        ...state,
        results: null,
        error: null,
        loading: false,
        lastExecution: null,
        retryAttempt: null,
      }));
    },

    loadHistoryEntry: (entry) => {
      if (!entry || typeof entry !== "object") {
        recordLog(LEVELS.WARN, "Skipped loading invalid history entry", {
          entryType: typeof entry,
        });
        return;
      }
      recordLog(LEVELS.INFO, "Loaded history entry into editor", {
        entryId: entry?.id,
      });
      update((state) => {
        const nextQuery =
          typeof entry.query === "string" ? entry.query : state.query;
        const nextVariables =
          typeof entry.variables === "string"
            ? entry.variables
            : state.variables;
        const nextEndpoint =
          typeof entry.endpoint === "string" ? entry.endpoint : state.endpoint;
        const nextState = {
          ...state,
          query: nextQuery,
          variables: nextVariables,
          endpoint: nextEndpoint,
          queryStructure: parseQuery(nextQuery),
          error: null,
        };
        scheduleDraftSave(buildDraftPayload(nextState));
        return nextState;
      });
    },

    loadDraft: () => {
      const draft = readDraftFromStorage();
      recordLog(LEVELS.INFO, "Loaded editor draft", {
        hasDraft: Boolean(draft),
      });
      update((state) => ({ ...state, draft }));
    },

    applyDraft: () => {
      const draft = readDraftFromStorage();
      if (!draft) {
        recordLog(LEVELS.WARN, "No editor draft found to apply");
        return;
      }
      recordLog(LEVELS.INFO, "Applied editor draft", {
        updatedAt: draft.updatedAt,
      });
      update((state) => ({
        ...state,
        endpoint: draft.endpoint ?? state.endpoint,
        query: draft.query ?? state.query,
        variables: draft.variables ?? state.variables,
        headers: draft.headers ?? state.headers,
        queryStructure: parseQuery(draft.query ?? state.query),
        error: null,
        draft,
      }));
    },

    clearDraft: () => {
      recordLog(LEVELS.INFO, "Cleared editor draft");
      clearDraftStorage();
      update((state) => ({ ...state, draft: null }));
    },

    loadSavedPresets: () => {
      const presets = readPresetsFromStorage();
      recordLog(LEVELS.INFO, "Loaded saved workspaces", {
        count: presets.length,
      });
      update((state) => ({ ...state, savedPresets: presets }));
    },

    savePreset: (name) => {
      if (!name) {
        recordLog(LEVELS.WARN, "Skipped saving workspace without a name");
        return;
      }
      update((state) => {
        // Upsert by name so teams can refresh an existing workspace without duplicates.
        const existingIndex = state.savedPresets.findIndex(
          (preset) => preset.name.toLowerCase() === name.toLowerCase(),
        );
        const timestamp = new Date().toISOString();
        const nextPreset = {
          id:
            existingIndex >= 0
              ? state.savedPresets[existingIndex].id
              : typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}`,
          name,
          endpoint: state.endpoint,
          query: state.query,
          variables: state.variables,
          headers: state.headers,
          createdAt:
            existingIndex >= 0
              ? state.savedPresets[existingIndex].createdAt
              : timestamp,
          updatedAt: timestamp,
        };

        const nextPresets = [...state.savedPresets];
        if (existingIndex >= 0) {
          nextPresets[existingIndex] = nextPreset;
        } else {
          nextPresets.unshift(nextPreset);
        }

        recordLog(LEVELS.INFO, "Saved workspace", {
          name,
          updatedExisting: existingIndex >= 0,
        });
        persistPresets(nextPresets);
        return { ...state, savedPresets: nextPresets };
      });
    },

    deletePreset: (presetId) => {
      update((state) => {
        const nextPresets = state.savedPresets.filter(
          (preset) => preset.id !== presetId,
        );
        recordLog(LEVELS.INFO, "Deleted workspace", { presetId });
        persistPresets(nextPresets);
        return { ...state, savedPresets: nextPresets };
      });
    },

    applyPreset: (preset) => {
      if (!preset) return;
      recordLog(LEVELS.INFO, "Applied saved workspace", {
        presetId: preset.id,
        name: preset.name,
      });
      update((state) => ({
        ...state,
        endpoint: preset.endpoint ?? state.endpoint,
        query: preset.query ?? state.query,
        variables: preset.variables ?? state.variables,
        headers: preset.headers ?? state.headers,
        queryStructure: parseQuery(preset.query ?? state.query),
        error: null,
      }));
      scheduleDraftSave(
        buildDraftPayload({
          endpoint: preset.endpoint,
          query: preset.query,
          variables: preset.variables,
          headers: preset.headers,
        }),
      );
    },

    getState: () => get(store),

    resetDefaults: () => {
      update((state) => {
        const nextState = {
          ...state,
          query: DEFAULT_QUERY,
          variables: DEFAULT_VARIABLES,
          headers: DEFAULT_HEADERS,
          results: null,
          error: null,
          loading: false,
          retryAttempt: null,
          queryStructure: parseQuery(DEFAULT_QUERY),
        };
        scheduleDraftSave(buildDraftPayload(nextState));
        return nextState;
      });
    },

    clearLogs: () => {
      recordLog(LEVELS.INFO, "Cleared activity logs");
      update((state) => ({ ...state, logs: [] }));
    },

    parseHeadersJson,

    logUiEvent,

    /**
     * Execute the GraphQL request while handling abort + timeout.
     * Timeout is applied via AbortController to ensure fetch is cancelled.
     */
    executeQuery: async () => {
      update((state) => ({
        ...state,
        loading: true,
        error: null,
        retryAttempt: 0,
      }));

      const currentState = get(store);
      const startedAt = Date.now();
      const entryId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`;

      /**
       * Sleep between retry attempts to avoid immediate hammering of the endpoint.
       * @param {number} delayMs
       */
      const waitForRetry = (delayMs) =>
        new Promise((resolve) => setTimeout(resolve, delayMs));

      /**
       * Determine if an HTTP response status should trigger a retry.
       * @param {number} statusCode
       */
      const shouldRetryStatus = (statusCode) =>
        statusCode === 429 || (statusCode >= 500 && statusCode <= 599);

      const finalizeExecution = ({
        status,
        errorMessage,
        result,
        statusCode,
        statusText,
      }) => {
        update((state) => ({
          ...state,
          results: result ?? null,
          loading: false,
          retryAttempt: null,
          lastExecution: {
            id: entryId,
            status,
            durationMs: Date.now() - startedAt,
            endpoint: currentState.endpoint,
            timestamp: new Date().toISOString(),
            statusCode,
            statusText,
            error: errorMessage ?? null,
          },
          error: status === "success" ? null : errorMessage,
        }));

        addHistoryEntry({
          id: entryId,
          timestamp: new Date().toISOString(),
          endpoint: currentState.endpoint,
          query: currentState.query,
          variables: currentState.variables,
          status,
          durationMs: Date.now() - startedAt,
          statusCode,
          statusText,
          error: errorMessage ?? null,
        });
      };

      try {
        if (!currentState.endpoint) {
          recordLog(LEVELS.WARN, "Execution blocked: missing endpoint", {
            entryId,
          });
          finalizeExecution({
            status: "invalid",
            errorMessage: "Endpoint is required before executing a query.",
          });
          return;
        }

        const { variables, error: variablesError } = parseVariablesJson(
          currentState.variables,
        );
        if (variablesError) {
          recordLog(LEVELS.WARN, "Execution blocked: invalid variables JSON", {
            entryId,
            error: variablesError,
          });
          finalizeExecution({
            status: "invalid",
            errorMessage: variablesError,
          });
          return;
        }

        const { headers: parsedHeaders, error: headerError } = parseHeadersJson(
          currentState.headers,
        );
        if (headerError) {
          recordLog(LEVELS.WARN, "Execution blocked: invalid headers JSON", {
            entryId,
            error: headerError,
          });
          finalizeExecution({
            status: "invalid",
            errorMessage: headerError,
          });
          return;
        }

        const requestHeaders = {
          "Content-Type": "application/json",
          ...(parsedHeaders ?? {}),
        };

        if (activeController) {
          activeController.abort("superseded");
          activeController = null;
          if (activeTimeoutId) {
            clearTimeout(activeTimeoutId);
            activeTimeoutId = null;
          }
        }

        const timeoutMs = currentState.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
        const retryPolicy = currentState.retryPolicy ?? {
          maxRetries: DEFAULT_RETRY_COUNT,
          retryDelayMs: DEFAULT_RETRY_DELAY_MS,
        };
        const maxAttempts = (retryPolicy.maxRetries ?? 0) + 1;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          update((state) => ({ ...state, retryAttempt: attempt }));
          activeController = new AbortController();
          if (timeoutMs > 0) {
            activeTimeoutId = setTimeout(() => {
              activeController?.abort("timeout");
            }, timeoutMs);
          }

          recordLog(LEVELS.INFO, "Executing GraphQL request", {
            entryId,
            endpoint: currentState.endpoint,
            timeoutMs,
            attempt: attempt + 1,
            maxAttempts,
            hasVariables: Object.keys(variables ?? {}).length > 0,
          });

          try {
            const response = await fetch(currentState.endpoint, {
              method: "POST",
              headers: requestHeaders,
              body: JSON.stringify({
                query: currentState.query,
                variables: variables,
              }),
              signal: activeController.signal,
            });

            let result;
            try {
              result = await response.json();
            } catch (parseError) {
              throw new Error(
                `Response JSON parse error: ${parseError.message}`,
              );
            }

            if (!response.ok) {
              const statusMessage = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
              if (
                shouldRetryStatus(response.status) &&
                attempt < maxAttempts - 1
              ) {
                recordLog(
                  LEVELS.WARN,
                  "Retrying GraphQL request after HTTP error",
                  {
                    entryId,
                    statusCode: response.status,
                    statusText: response.statusText,
                    attempt: attempt + 1,
                    maxAttempts,
                    retryDelayMs: retryPolicy.retryDelayMs,
                  },
                );
                await waitForRetry(retryPolicy.retryDelayMs);
                continue;
              }

              finalizeExecution({
                status: "error",
                errorMessage: statusMessage,
                result,
                statusCode: response.status,
                statusText: response.statusText,
              });
              recordLog(
                LEVELS.ERROR,
                "GraphQL request failed with HTTP error",
                {
                  entryId,
                  statusCode: response.status,
                  statusText: response.statusText,
                  durationMs: Date.now() - startedAt,
                },
              );
              return;
            }

            const errorMessages = Array.isArray(result.errors)
              ? result.errors
                  .map((err) => err.message)
                  .filter(Boolean)
                  .join("; ")
              : null;

            finalizeExecution({
              status: result.errors ? "error" : "success",
              errorMessage: errorMessages,
              result,
              statusCode: response.status,
              statusText: response.statusText,
            });

            recordLog(LEVELS.INFO, "GraphQL request completed", {
              entryId,
              status: result.errors ? "error" : "success",
              statusCode: response.status,
              durationMs: Date.now() - startedAt,
            });
            return;
          } catch (error) {
            const wasAborted = activeController?.signal?.aborted;
            const abortReason = activeController?.signal?.reason;
            const isTimeout = abortReason === "timeout";
            const canRetry =
              attempt < maxAttempts - 1 &&
              !wasAborted &&
              error?.name === "TypeError";

            if (isTimeout && attempt < maxAttempts - 1) {
              recordLog(LEVELS.WARN, "Retrying GraphQL request after timeout", {
                entryId,
                attempt: attempt + 1,
                maxAttempts,
                retryDelayMs: retryPolicy.retryDelayMs,
              });
              await waitForRetry(retryPolicy.retryDelayMs);
              continue;
            }

            if (wasAborted) {
              const cancelMessage = isTimeout
                ? `Request timed out after ${timeoutMs}ms.`
                : "Request cancelled.";
              recordLog(LEVELS.WARN, "GraphQL request cancelled", {
                entryId,
                reason: abortReason ?? "aborted",
                durationMs: Date.now() - startedAt,
              });
              finalizeExecution({
                status: "cancelled",
                errorMessage: cancelMessage,
              });
              return;
            }

            if (canRetry) {
              recordLog(
                LEVELS.WARN,
                "Retrying GraphQL request after network error",
                {
                  entryId,
                  attempt: attempt + 1,
                  maxAttempts,
                  retryDelayMs: retryPolicy.retryDelayMs,
                  error: error.message,
                },
              );
              await waitForRetry(retryPolicy.retryDelayMs);
              continue;
            }

            recordLog(LEVELS.ERROR, "GraphQL request failed", {
              entryId,
              error: error.message,
              durationMs: Date.now() - startedAt,
            });
            finalizeExecution({
              status: "error",
              errorMessage: error.message,
            });
            return;
          } finally {
            if (activeTimeoutId) {
              clearTimeout(activeTimeoutId);
              activeTimeoutId = null;
            }
            activeController = null;
          }
        }
      } catch (error) {
        recordLog(LEVELS.ERROR, "GraphQL request failed before execution", {
          entryId,
          error: error.message,
        });
        finalizeExecution({
          status: "error",
          errorMessage: error.message,
        });
      }
    },

    introspectSchema: async () => {
      update((state) => ({ ...state, loading: true }));

      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            types {
              name
              kind
              description
              fields {
                name
                type {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
                args {
                  name
                  type {
                    name
                    kind
                    ofType {
                      name
                      kind
                    }
                  }
                }
              }
            }
            queryType {
              name
            }
            mutationType {
              name
            }
          }
        }
      `;

      try {
        const currentState = get(store);
        recordLog(LEVELS.INFO, "Running schema introspection", {
          endpoint: currentState.endpoint,
        });
        const response = await fetch(currentState.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: introspectionQuery }),
        });

        const result = await response.json();

        recordLog(LEVELS.INFO, "Schema introspection completed", {
          endpoint: currentState.endpoint,
          typesCount: result.data?.__schema?.types?.length ?? 0,
        });
        update((state) => ({
          ...state,
          schema: result.data.__schema,
          loading: false,
        }));
      } catch (error) {
        recordLog(LEVELS.ERROR, "Schema introspection failed", {
          endpoint: get(store).endpoint,
          error: error.message,
        });
        update((state) => ({
          ...state,
          error: error.message,
          loading: false,
        }));
      }
    },

    getFieldsForType: (typeName) => {
      const currentState = get(store);
      if (!currentState.schema) return [];

      const type = currentState.schema.types.find((t) => t.name === typeName);
      return type ? type.fields || [] : [];
    },

    getArgsForField: (typeName, fieldName) => {
      const currentState = get(store);
      if (!currentState.schema) return [];

      const type = currentState.schema.types.find((t) => t.name === typeName);
      if (!type) return [];

      const field = type.fields?.find((f) => f.name === fieldName);
      return field ? field.args || [] : [];
    },

    getRootQueryFields: () => {
      const currentState = get(store);
      if (!currentState.schema) return [];

      const queryType = currentState.schema.types.find(
        (t) => t.name === "Query",
      );
      return queryType ? queryType.fields || [] : [];
    },

    getFieldReturnType: (typeName, fieldName) => {
      const currentState = get(store);
      if (!currentState.schema) return null;

      const type = currentState.schema.types.find((t) => t.name === typeName);
      if (!type) return null;

      const field = type.fields?.find((f) => f.name === fieldName);
      if (!field) return null;

      // Handle list types and non-null types
      let returnType = field.type;
      if (returnType.kind === "LIST" && returnType.ofType) {
        returnType = returnType.ofType;
      }
      if (returnType.kind === "NON_NULL" && returnType.ofType) {
        returnType = returnType.ofType;
      }

      return returnType.name;
    },

    getAvailableFieldsForPath: (fieldPath) => {
      const currentState = get(store);
      if (!currentState.schema) return [];

      let currentTypeName = "Query"; // Start with root query type

      // Walk through the field path to determine the current type
      for (const pathSegment of fieldPath) {
        const returnType = store.getFieldReturnType(
          currentTypeName,
          pathSegment,
        );
        if (!returnType) return [];
        currentTypeName = returnType;
      }

      return store.getFieldsForType(currentTypeName);
    },
  };
}

// Helper function to get current store value
function get(store) {
  let value;
  store.subscribe((v) => (value = v))();
  return value;
}

export const graphqlStore = createGraphQLStore();
