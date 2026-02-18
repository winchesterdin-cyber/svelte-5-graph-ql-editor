# Team Notes

## 2026-02-17 — Diagnostics hygiene expansion (20-item execution)

- Added query style diagnostics: tabs, trailing whitespace, long lines, excessive blank lines, and TODO/FIXME comments.
- Added operation convention diagnostics: PascalCase name guidance, generic-name warning, duplicate top-level field detection, and typename-only selection hints.
- Added endpoint hygiene diagnostics: localhost awareness, explicit default port hints, trailing slash/root path checks, and versioned-path guidance.
- Added header safety diagnostics: wildcard Accept, non-JSON Content-Type, empty Bearer/API-key detection, Basic auth warning, and Cookie/Host override warnings.
- Added comprehensive regression coverage in `editor-intelligence.test.js` and re-ran full lint/check/test pipeline successfully.

## Iteration Review Summary

- Completed all 20 tracked improvements in `implementation-plan.md`.
- Focused on reliability, persistence, diagnostics, accessibility, and operational workflows.
- Added test coverage for new utility and diagnostics behavior and kept full check/test pipeline green.

## Newly delivered operational capabilities

1. **UI shell reliability**
   - Persistent app shell preferences are now validated via reusable helper utilities.
   - Reset behavior is isolated to shell preferences only.
2. **Request authoring improvements**
   - Added request template library support (Bearer auth and cursor pagination starters).
   - Operation outline now includes fragments and anonymous operations.
3. **Diagnostics + errors**
   - Endpoint URL and headers JSON diagnostics now block common pre-flight mistakes.
   - Store now uses a normalized error-message helper for consistency in logs.
4. **Results + history operations**
   - Persisted results view settings (mode/filter/sticky/delimiter).
   - Added history retention policy controls (`maxEntries`, `maxAgeDays`).
   - Enhanced history diff to report nested changed JSON paths.
5. **Workspace portability**
   - Saved workspace import/export added with metadata envelope and deduped merge behavior.

## Troubleshooting runbook updates

- If users report missing history entries, check retention settings first (Results tab).
- If requests fail before network call, inspect diagnostics panel (`ENDPOINT_URL`, `HEADERS_JSON`, `HEADERS_SHAPE`).
- If workspace import appears incomplete, review activity log entries for payload validity and dedupe outcomes.

## Recommended follow-up

- Add UX polish for retention controls (persist policy in localStorage).
- Expand template library with API-key and OAuth client credential variants.
- Add copy-to-clipboard fallback UI for environments without clipboard API permissions.

## Enhancement batch: diagnostics and editor workflows

- Added deeper diagnostics for duplicate operations/fragments, unknown fragment spreads, multi-anonymous-operation documents, and variable definition/usage mismatches.
- Added query document metrics to surface complexity and scale while authoring.
- Added query minification and `Copy fetch()` snippet generation for better request sharing and debugging workflows.
- Extended schema suggestions to prioritize prefix matching and include argument placeholders in insert text.
- Added tests to cover all new diagnostics and document metric behavior.

## Enhancement batch: diagnostics stabilization + reporting

- Hardened structure scanning to ignore comment/string tokens when checking bracket balance.
- Added deterministic diagnostics ordering to keep UI rendering and snapshots stable.
- Added new diagnostics for insecure endpoint protocol and duplicate variable definitions.
- Added complexity score/label metrics and warnings for deep/high-complexity query documents.
- Added Query Editor diagnostics filters and markdown diagnostics export for bug-report workflows.
- Added shortcut `Ctrl/Cmd+Shift+M` for query minification and updated user-facing guidance.

## Enhancement batch: payload/header diagnostics expansion

- Added diagnostics for empty header names and non-string header values to reduce request serialization surprises.
- Added diagnostics to compare provided variables JSON against declared operation variables (extra keys + missing required values).
- Added warning when a document contains more than five operations, helping teams keep requests reviewable.

- Refined variable diagnostics to avoid false-positive missing-required errors when a document contains multiple operations; now emits an informational guidance diagnostic instead.

## 2026-02-17 — Diagnostics hardening batch (20-item execution)

- Added endpoint quality diagnostics: credentials in URL, query params, hash fragments, and non-graphql path hints.
- Added header recommendation diagnostics: missing Accept / Content-Type, auth scheme checks, duplicate case-insensitive keys, and whitespace checks.
- Added runtime variable-type diagnostics: null for non-null, scalar mismatch, list mismatch, and object mismatch checks.
- Added fragment cycle detection and operation empty-selection detection.
- Fixed variable definition parsing for list signatures (for example `[ID!]!`).
- Added targeted unit tests for every new diagnostics family and parser fix.
