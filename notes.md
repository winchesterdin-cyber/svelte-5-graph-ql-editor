# Team Notes

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
