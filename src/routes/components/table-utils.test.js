import assert from "node:assert/strict";
import test from "node:test";

import {
  buildColumnOrder,
  buildCsv,
  filterTableRows,
  formatCellValue,
  getHighlightParts,
} from "./table-utils.js";

test("buildColumnOrder preserves first row order and appends new keys", () => {
  const rows = [
    { name: "A", code: "AA" },
    { code: "BB", region: "North" },
  ];
  assert.deepEqual(buildColumnOrder(rows), ["name", "code", "region"]);
});

test("buildCsv respects selected columns and delimiter", () => {
  const rows = [
    { name: "Alpha", code: "A" },
    { name: "Beta", code: "B" },
  ];
  const csv = buildCsv(rows, ["code"], ";");
  assert.equal(csv.trim(), "code\nA\nB");
});

test("filterTableRows returns rows that match visible columns", () => {
  const rows = [
    { name: "Alpha", code: "A" },
    { name: "Beta", code: "B" },
  ];
  const filtered = filterTableRows(rows, "beta", ["name"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, "Beta");
});

test("formatCellValue normalizes non-string values", () => {
  assert.equal(formatCellValue(123), "123");
  assert.equal(formatCellValue({ value: "X" }), '{"value":"X"}');
});

test("getHighlightParts marks matching segments", () => {
  const parts = getHighlightParts("GraphQL", "ph");
  assert.deepEqual(parts, [
    { text: "Gra", isMatch: false },
    { text: "ph", isMatch: true },
    { text: "QL", isMatch: false },
  ]);
});
