# plan.md — Comprehensive Diagnostics Enhancement Plan (Fully Implemented)

## Objective

Deliver a full diagnostics-hardening batch for the GraphQL editor with **20 major improvements**, comprehensive automated verification, and updated documentation/notes.

## Execution status

✅ Completed end-to-end. Every listed improvement was implemented and validated with lint, static checks, and unit tests.

## 20 major improvements implemented

1. Added endpoint credentials detection (`ENDPOINT_CREDENTIALS_IN_URL`) to prevent unsafe URL auth usage.
2. Added endpoint query-string awareness (`ENDPOINT_QUERY_PARAMS`) to highlight implicit gateway behavior.
3. Added endpoint hash-fragment detection (`ENDPOINT_HASH_FRAGMENT`) because fragments are ignored by HTTP requests.
4. Added endpoint path-quality guidance (`ENDPOINT_NON_GRAPHQL_PATH`) when paths do not resemble GraphQL handlers.
5. Added case-insensitive duplicate-header detection (`DUPLICATE_HEADER_CASE_INSENSITIVE`).
6. Added missing `Accept` header recommendation (`MISSING_ACCEPT_HEADER`).
7. Added missing `Content-Type` header recommendation (`MISSING_CONTENT_TYPE_HEADER`).
8. Added Authorization scheme validation (`AUTH_HEADER_SCHEME`) for malformed auth values.
9. Added header leading/trailing whitespace detection (`HEADER_VALUE_WHITESPACE`).
10. Added runtime null check for required variables (`NULL_FOR_NON_NULL_VARIABLE`).
11. Added scalar runtime type validation (`VARIABLE_SCALAR_TYPE_MISMATCH`) for `Int`/`Float`/`Boolean`/`String`/`ID`.
12. Added list runtime shape validation (`VARIABLE_LIST_TYPE_MISMATCH`).
13. Added input-object runtime shape validation (`VARIABLE_OBJECT_TYPE_MISMATCH`).
14. Added fragment dependency graph analysis for cycle detection (`CYCLIC_FRAGMENT_SPREAD`).
15. Added operation selection validation (`EMPTY_OPERATION_SELECTION`) for operations with no resolved top-level fields.
16. Fixed variable-type extraction to support bracketed list signatures (for example `[ID!]!`).
17. Expanded diagnostics pipeline ordering to include endpoint quality checks after URL parsing.
18. Expanded diagnostics pipeline ordering to include header recommendations after JSON shape checks.
19. Expanded diagnostics pipeline ordering to include runtime variable type checks after JSON validity checks.
20. Added broad regression tests for all new diagnostics and parser fixes.

## Tooling/dependency review

- No missing packages were identified for this enhancement batch.
- Existing project toolchain remains sufficient: Prettier (`npm run lint`/`npm run format`), Svelte checks (`npm run check`), and Node test runner (`npm test`).

## Validation protocol executed

- `npm run format`
- `npm run lint`
- `npm run check`
- `npm test`

All commands passed after implementation.
