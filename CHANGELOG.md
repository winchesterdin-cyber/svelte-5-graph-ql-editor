# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- Query editor reset action to restore the default query and variables.
- Expanded GraphQL helper and store tests to cover nested parsing, history validation, and clear results logic.
- Extracted GraphQL query helpers into a dedicated module to allow lightweight unit testing.
- Added a minimal Tailwind configuration for tooling discovery.
- Simplified the global stylesheet to avoid build-time Tailwind plugin errors.
- Added a recent query history panel with load/run actions.
- Added history filtering, status chips, copy actions, and summary stats for recent queries.
- Added a results clear action to reset error/results state between runs.
- Added history export and last-execution metadata for better run visibility.
- Added response metadata in the results panel (payload size + data keys).
- Added history import and pinning with pinned-first sorting in the results panel.
- Added history deletion and clear-unpinned controls plus store helpers for targeted cleanup.
- Added JSON error feedback in the variables editor.

### Fixed
- Improved default query/variables handling in the GraphQL store to keep state consistent after resets.
- Replaced dynamic Tailwind utility interpolation with inline styles in the schema field tree for reliable rendering.
- Removed unused placeholder dependencies to prevent install failures.
- Added validation for missing endpoints and invalid variables before executing queries.
- Recorded execution durations and error details in history entries.
- Fixed query execution to read the latest store state before dispatching requests.
