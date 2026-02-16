# GraphQL Visualizer (Svelte 5)

An interactive GraphQL editor built with Svelte 5. It includes a query editor, visual builder,
variables editor, schema explorer, and results panel for exploring GraphQL APIs.

## Features

- **Query Editor** with formatting, reset to defaults, and execution controls.
- **Copy cURL** for generating a ready-to-run request from the current query.
- **Visual Builder** for composing queries visually from schema fields.
- **Variables Editor** with JSON validation, error feedback, and a visual helper.
- **Headers Editor** for reusable Authorization/API key headers with JSON validation.
- **Schema Explorer** to introspect or load demo schemas.
- **Results Panel** with formatted/raw/table views, response metadata, quick copy/download, and clearing.
- **Table CSV export** for saving tabular results in spreadsheet-friendly format.
- **Table column selector** to focus on specific fields before exporting or reviewing data.
- **Table row filtering** to quickly narrow down large responses before export.
- **Table row actions** to copy individual rows as JSON.
- **CSV delimiter selector** for comma/semicolon/tab exports.
- **Request Controls** with configurable timeouts, retries, and cancel support for long-running requests.
- **Activity Log** to review structured request events with INFO/WARN/ERROR levels.
- **Query History** to reload, re-run, pin, delete, copy, import, or export past queries/variables.
- **History Notes** to annotate and filter saved requests.
- **History Persistence** to keep recent requests across refreshes.
- **History filters** and status summaries for recent requests.
- **Saved Workspaces** to store and reapply endpoint/query/variable combinations.
- **Auto-saved Drafts** to recover in-progress editor changes after refreshes.
- **UI Preference Persistence** for active tab, schema visibility, and theme mode between sessions.
- **Reset UI Preferences** control to quickly return shell state to defaults.
- **Expanded Diagnostics** for malformed endpoint URLs and invalid headers JSON.
- **Advanced Diagnostics** for duplicate operations/fragments, unknown fragment spreads, variable usage mismatches, duplicate variable definitions, and insecure endpoint protocol checks.
- **Document Metrics** panel to track operations, fragments, depth, and query size while authoring.
- **Diagnostics Filters** to focus quickly on errors vs warnings.
- **Diagnostics Markdown Export** for sharing bug reports and review context.
- **Complexity Badging** with low/medium/high labels and score.
- **Copy fetch()** to generate browser-friendly JavaScript request snippets.
- **Minify Query** action to compact whitespace before sharing payloads (also `Ctrl/Cmd+Shift+M`).
- **Request Templates** to quickly start common auth and pagination request patterns.
- **Saved Workspace Import/Export** for sharing reusable endpoint/query setups with metadata.
- **History Retention Controls** to cap stored entries by count and age.
- **Nested History Diff Paths** to inspect field-level JSON changes between runs.
- **Operation Outline Enhancements** including fragment and anonymous operation visibility.
- **Results View Persistence** for preferred mode/filter/CSV delimiter/sticky column settings.

## Getting Started

Install dependencies and start the dev server:

```bash
npm install
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Scripts

```bash
npm run dev      # start development server
npm run build    # build for production
npm run preview  # preview production build
npm run check    # run Svelte checks
npm run lint     # run Prettier checks
npm test         # run Node-based unit tests
```

## Useful Notes

- Demo schemas can be loaded from the schema explorer or visual builder to try the UI without a live endpoint.
- The reset button in the Query Editor restores the default query and variables so you can quickly recover from edits.
- Recent query history entries can be loaded back into the editor, re-run, pinned, deleted, copied, imported, or exported directly from the Results tab.
- Add notes to history entries to label use cases or expected results.
- Use the history filter and status chips to quickly find past queries by endpoint, status, query snippet, or notes.
- Use "Clear unpinned" to trim history while keeping your pinned highlights.
- Clear the Results panel to remove outdated data or error messages between runs.
- Review response metadata (payload size, top-level data keys) to sanity-check results quickly.
- Export table-mode results as CSV for quick analysis in spreadsheets or BI tools.
- Use the column selector in table mode to hide noisy fields before exporting or scanning results.
- Use the table filter to narrow rows when hunting for specific values in large datasets.
- Use the "Reset view" shortcut in table mode to clear filters, restore columns, and reset layout.
- Pick a delimiter (comma/semicolon/tab) that matches your spreadsheet locale before exporting.
- Use "Copy row" for quick, single-row JSON sharing.

### Table Mode Tips

- Use the filter bar to highlight matches in visible columns while scanning results.
- Enable the sticky first column when tables are wide and you want key identifiers to stay in view.
- If the table feels overwhelming, reset the view to restore all columns and clear filters.
- Variables must be valid JSON objects; arrays or primitives are rejected to keep request payloads predictable.
- History exports include metadata (version + timestamp) and can be re-imported from JSON payloads.
- Use the timeout control in the Query Editor to cancel long-running requests (set to `0` to disable timeouts).
- Use "Copy cURL" to share or debug the current request outside the UI.
- Use "Copy fetch()" to generate a browser-console-ready request script.
- Use "Minify" when you need compact query payloads for logs or snippets.
- Configure retry count + delay in the Query Editor to automatically retry on transient network or 5xx/429 errors.
- Use the Activity Log in the Results tab to inspect request events and debugging context.
- Add request headers (Authorization, API keys) in the Headers tab to reuse them on every request.
- Save common endpoint + query + variables combinations in the Saved Workspaces section of the Query Editor.
- Restore or dismiss auto-saved drafts when prompted in the Query Editor.
- Svelte checks are configured to validate TypeScript/Svelte sources without enforcing type checks on plain JavaScript.
- Tailwind configuration is wired through PostCSS (CommonJS config).

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Batch 1 Enhancements (Items 1-10)

The first enhancement batch now includes:

- Query editor intelligence helpers (operation outline, live diagnostics, lightweight schema suggestions).
- Keyboard shortcuts: `Ctrl/Cmd+Enter` (execute), `Ctrl/Cmd+Space` (autocomplete), `Ctrl/Cmd+Shift+P` (command palette), `Ctrl/Cmd+Shift+F` (format query).
- Command palette quick actions for tab navigation, schema toggle, theme toggle, and endpoint profile save.
- Endpoint manager profiles with local persistence and remove controls.
- Variables editor schema hints derived from operation variable signatures.

See `implementation-plan.md` for item-by-item implementation notes and validation logs.

- Endpoint manager profiles now persist both endpoint and headers for faster environment switching.
- Use the Results history "Compare" action on two entries to view a quick diff summary (query, variables, endpoint, status, result changes).
