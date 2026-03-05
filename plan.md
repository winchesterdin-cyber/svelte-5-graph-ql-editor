# plan.md — Comprehensive Feature Enhancement & Verification Plan

## Objective

Ship a full reliability and UX hardening batch for the Svelte GraphQL editor, complete implementation, and full verification.

## Completion Status

✅ Completed in full and validated with lint, type-check, and unit tests.

## 20 Major Improvements (Implemented)

1. Added query indentation consistency diagnostics for mixed tab/space prefixes (`QUERY_MIXED_INDENTATION`).
2. Added header control-character security validation (`HEADER_VALUE_CONTROL_CHAR`).
3. Added oversized header payload warnings (`HEADER_VALUE_TOO_LONG`).
4. Added endpoint protocol restrictions for non-HTTP(S) URLs (`ENDPOINT_UNSUPPORTED_PROTOCOL`).
5. Added sentinel-string variable validation for quoted `null`/`undefined` mistakes (`VARIABLE_STRING_SENTINEL`).
6. Preserved previous style diagnostics for tabs/trailing whitespace/long lines/blank-line gaps and TODO markers.
7. Preserved operation naming diagnostics for PascalCase conventions.
8. Preserved operation generic-name diagnostics for `Query`/`Mutation`/`Subscription`.
9. Preserved top-level duplicate field diagnostics.
10. Preserved `__typename`-only selection diagnostics.
11. Preserved endpoint hygiene diagnostics (credentials/query/hash/path/localhost/default-port/root/versioning).
12. Preserved insecure HTTP endpoint warnings.
13. Preserved header-structure and non-string-value diagnostics.
14. Preserved header recommendation diagnostics (Accept/Content-Type/auth scheme/trim checks).
15. Preserved header security diagnostics (Bearer token, Basic auth, API key emptiness, Cookie/Host overrides).
16. Preserved variable shape and required-variable diagnostics.
17. Preserved variable runtime type diagnostics for scalar/object/list mismatches.
18. Preserved fragment validation diagnostics (duplicate/unknown/cycle checks).
19. Preserved deterministic diagnostic sorting and stable severity ordering.
20. Added regression tests covering all newly introduced diagnostics in this batch.

## Verification

- Ran `npm run lint`.
- Ran `npm run check`.
- Ran `npm test`.
- Confirmed all checks pass with no failing tests.
