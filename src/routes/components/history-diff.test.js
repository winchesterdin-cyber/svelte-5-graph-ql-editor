import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoryDiff } from "./history-diff.js";

test("buildHistoryDiff reports nested changed paths", () => {
  const diff = buildHistoryDiff(
    {
      id: "a",
      query: "query A",
      endpoint: "https://a",
      status: "success",
      result: { data: { user: { id: "1", name: "A" } } },
    },
    {
      id: "b",
      query: "query B",
      endpoint: "https://a",
      status: "success",
      result: { data: { user: { id: "1", name: "B" }, extra: true } },
    },
  );

  assert.equal(diff.resultChanged, true);
  assert.ok(diff.changedPaths.includes("data.user.name"));
  assert.ok(diff.changedPaths.includes("data.extra"));
  assert.ok(diff.changedPathCount >= 2);
});
