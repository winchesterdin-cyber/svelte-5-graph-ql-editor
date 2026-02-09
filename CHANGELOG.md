# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Added repository-level agent guidelines in `agents.md`.
- Added CSV export for table-mode query results in the Results panel.
- Added a table column selector to focus on specific fields in Results table view.
- Added a table row filter to quickly narrow results before exporting.
- Added CSV delimiter selection and per-row JSON copy actions in Results table view.
- Added reset-view controls and match highlighting for table filtering.
- Added optional sticky-first-column support for wide tables.
- Added a headers editor with JSON validation, visual management, and quick add buttons for auth/API key headers.
- Query editor reset action to restore the default query and variables.
- Added a Copy cURL action in the Query Editor for sharing and debugging requests.
- Added configurable retry controls (count + delay) with automatic retries for transient GraphQL request failures.
- Added a UI logging hook to emit structured client-side events consistently.
- Expanded GraphQL helper and store tests to cover nested parsing, history validation, and clear results logic.
- Extracted GraphQL query helpers into a dedicated module to allow lightweight unit testing.
- Added a minimal Tailwind configuration for tooling discovery.
- Simplified the global stylesheet to avoid build-time Tailwind plugin errors.
- Added a recent query history panel with load/run actions.
- Added history filtering, status chips, copy actions, and summary stats for recent queries.
- Added a results clear action to reset error/results state between runs.
- Added history export and last-execution metadata for better run visibility.
- Added JSON history export/import helpers with metadata for easier sharing.
- Added response metadata in the results panel (payload size + data keys).
- Added history import and pinning with pinned-first sorting in the results panel.
- Added history deletion and clear-unpinned controls plus store helpers for targeted cleanup.
- Added persisted query history with per-entry notes for annotating requests.
- Added JSON error feedback in the variables editor.
- Added auto-saved editor drafts with restore/dismiss controls in the query editor.

### Fixed

- Added missing Autoprefixer dev dependency to keep Svelte checks working.
- Switched Tailwind config to CommonJS for better compatibility with the Vite Tailwind plugin.
- Pointed the Vite Tailwind plugin at the CommonJS config to avoid SSR build errors.
- Updated Vite Tailwind plugin usage to match current plugin signatures.
- Disabled JS type checking in svelte-check to focus diagnostics on TS/Svelte sources.
- Migrated Tailwind processing to PostCSS to avoid Vite plugin SSR errors.
- Kept Tailwind config in CommonJS for PostCSS compatibility.
- Improved default query/variables handling in the GraphQL store to keep state consistent after resets.
- Replaced dynamic Tailwind utility interpolation with inline styles in the schema field tree for reliable rendering.
- Removed unused placeholder dependencies to prevent install failures.
- Added validation for missing endpoints and invalid variables before executing queries.
- Rejected non-object variables payloads to avoid sending invalid GraphQL requests.
- Skipped loading malformed history entries instead of mutating editor state.
- Reused the same history import normalization logic for JSON payload imports.
- Recorded execution durations and error details in history entries.
- Fixed query execution to read the latest store state before dispatching requests.
