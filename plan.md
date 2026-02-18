# plan.md — Comprehensive Diagnostics & Reliability Expansion Plan

## Goal

Deliver and verify a full enhancement batch focused on diagnostics depth, endpoint/header safety, query quality guidance, naming conventions, and regression coverage.

## Execution status

✅ Fully implemented and validated.

## 20 major improvements (implemented)

1. Added `QUERY_CONTAINS_TABS` style diagnostic for tab-indented query content.
2. Added `QUERY_TRAILING_WHITESPACE` style diagnostic for noisy line endings.
3. Added `QUERY_LONG_LINE` readability warning for very long query lines.
4. Added `QUERY_EXCESSIVE_BLANK_LINES` style diagnostic for large formatting gaps.
5. Added `QUERY_TODO_COMMENT` hint when TODO/FIXME/XXX comments are left in query text.
6. Added `OPERATION_NAME_STYLE` naming convention guidance for non-PascalCase operation names.
7. Added `OPERATION_NAME_TOO_GENERIC` warning for generic operation names (`Query`, `Mutation`, `Subscription`).
8. Added `DUPLICATE_TOP_LEVEL_FIELD` warning when operations repeat the same top-level field selection.
9. Added `TYPENAME_ONLY_SELECTION` informational check for operations selecting only `__typename`.
10. Added `ENDPOINT_LOCALHOST` environment-awareness hint for localhost endpoints.
11. Added `ENDPOINT_DEFAULT_PORT_EXPLICIT` hint for explicit default ports (`:80`, `:443`).
12. Added `ENDPOINT_TRAILING_SLASH` endpoint hygiene hint for trailing path slash usage.
13. Added `ENDPOINT_ROOT_PATH` warning when endpoint path is root (`/`) instead of explicit handler path.
14. Added `ENDPOINT_VERSIONED_PATH` info hint for versioned endpoint paths.
15. Added `ACCEPT_HEADER_WILDCARD` recommendation when `Accept` is set to `*/*`.
16. Added `CONTENT_TYPE_NOT_JSON` warning when `Content-Type` is non-JSON.
17. Added `AUTH_BEARER_MISSING_TOKEN` hard error for empty Bearer auth values.
18. Added `AUTH_BASIC_SCHEME` warning for Basic auth usage awareness.
19. Added `EMPTY_API_KEY_HEADER` error for blank API-key header values.
20. Added `COOKIE_HEADER_PRESENT` and `HOST_HEADER_OVERRIDE` safety warnings for risky manual header overrides.

## Verification completed

- Formatting, linting, type checks, and full unit test suite executed.
- Added dedicated regression tests for all new diagnostics families.
- Existing behavior remained stable and all tests passed.
