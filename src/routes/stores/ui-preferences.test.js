import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_UI_PREFERENCES,
  normalizeUiPreferences,
  parseUiPreferences,
  serializeUiPreferences,
} from "./ui-preferences.js";

const tabs = [{ id: "editor" }, { id: "results" }];

test("normalizeUiPreferences keeps only valid tab ids and booleans", () => {
  const normalized = normalizeUiPreferences(
    { activeTab: "unknown", showSchema: 1, darkMode: "" },
    tabs,
  );

  assert.deepEqual(normalized, {
    activeTab: "editor",
    showSchema: true,
    darkMode: false,
  });
});

test("parseUiPreferences handles malformed JSON", () => {
  assert.deepEqual(parseUiPreferences("{", tabs), DEFAULT_UI_PREFERENCES);
});

test("serializeUiPreferences stores persisted fields", () => {
  const payload = JSON.parse(
    serializeUiPreferences({
      activeTab: "results",
      showSchema: true,
      darkMode: true,
    }),
  );

  assert.equal(payload.activeTab, "results");
  assert.equal(payload.showSchema, true);
  assert.equal(payload.darkMode, true);
  assert.ok(payload.savedAt);
});
