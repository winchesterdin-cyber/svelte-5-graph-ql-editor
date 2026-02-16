# Implementation Plan (20 Major Improvements)

> Tracking format: checklist TODO items with impact/effort evaluation and execution notes.

## Legend

- **Impact**: H (high), M (medium)
- **Effort**: H (high), M (medium), L (low)
- **Status**: ✅ Done

1. ✅ **Persist workspace UI preferences** (tab, schema panel, theme) between sessions.
   - Impact: H | Effort: M
   - Notes: Implemented localStorage-backed persistence/hydration with validated parsing helpers.
2. ✅ **Add workspace reset control** to clear persisted UI preferences safely.
   - Impact: H | Effort: L
   - Notes: Added `Reset UI` action to reset shell preferences without clearing query/history data.
3. ✅ **Harden endpoint profile management** with deterministic profile names and safer updates.
   - Impact: H | Effort: M
   - Notes: Endpoint profile upsert now preserves stable IDs and deterministic naming for existing endpoints.
4. ✅ **Add endpoint URL diagnostics** to catch obviously invalid endpoints before execution.
   - Impact: H | Effort: L
   - Notes: Added `ENDPOINT_URL` validation in editor diagnostics.
5. ✅ **Add headers JSON diagnostics** in the editor diagnostics panel.
   - Impact: H | Effort: L
   - Notes: Added `HEADERS_JSON` and `HEADERS_SHAPE` diagnostics and wiring in QueryEditor.
6. ✅ **Persist results view preferences** (formatted/raw/table) and table options.
   - Impact: M | Effort: M
   - Notes: Persisted Results panel mode/filter/sticky/delimiter preferences in localStorage.
7. ✅ **Add quick clear action for activity logs** in Results panel.
   - Impact: M | Effort: L
   - Notes: Added explicit quick clear logs action in the Activity Log controls.
8. ✅ **Improve keyboard accessibility for command palette** (Esc close + backdrop click close).
   - Impact: H | Effort: L
   - Notes: Added Escape key close and semantic backdrop close behavior.
9. ✅ **Add diagnostics coverage tests** for endpoint and headers validation paths.
   - Impact: H | Effort: L
   - Notes: Added tests for `HEADERS_JSON` and `ENDPOINT_URL` diagnostics.
10. ✅ **Add workspace preference tests** for serialization and hydration helpers.

- Impact: H | Effort: M
- Notes: Added unit tests for UI preference parsing/normalization/serialization helpers.

11. ✅ **Schema explorer search performance pass** (debounced filter, memoized tree flattening).

- Impact: M | Effort: M
- Notes: Added debounced search filtering and search update logging in SchemaExplorer.

12. ✅ **Operation outline enhancements** (fragments and anonymous operation grouping).

- Impact: M | Effort: M
- Notes: Outline now includes fragments and explicit anonymous-operation metadata.

13. ✅ **Results diff enhancements** with field-level nested path counts.

- Impact: M | Effort: M
- Notes: History diff now computes changed JSON paths and exposes sample nested path deltas.

14. ✅ **Request history retention policy controls** (max entries, expiry rules).

- Impact: H | Effort: M
- Notes: Added configurable store retention policy with max entries and max age days controls.

15. ✅ **Saved workspace import/export format v2** with schema compatibility metadata.

- Impact: M | Effort: M
- Notes: Added workspace export/import methods with metadata envelope and deduped import merge.

16. ✅ **Add request templates library** for common auth flows and pagination.

- Impact: M | Effort: H
- Notes: Added request template catalog + QueryEditor template selector/apply flow.

17. ✅ **Accessibility pass for tab semantics and focus rings** across app shell.

- Impact: H | Effort: M
- Notes: Added tablist/tab/tabpanel semantics and focus-visible ring styling on shell tabs.

18. ✅ **Error messaging standardization** across components and store logs.

- Impact: H | Effort: M
- Notes: Added shared error message normalizer for store parse/persistence/import paths.

19. ✅ **Developer observability notes** (where to find logs, common failure signatures).

- Impact: M | Effort: L
- Notes: Updated team notes with validation code meanings and troubleshooting sequence.

20. ✅ **Documentation refresh** for new persistence + diagnostics + results controls.

- Impact: H | Effort: L
- Notes: Updated README and notes with all newly implemented workflows and controls.
