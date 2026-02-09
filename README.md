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
- **Request Controls** with configurable timeouts, retries, and cancel support for long-running requests.
- **Activity Log** to review structured request events with INFO/WARN/ERROR levels.
- **Query History** to reload, re-run, pin, delete, copy, import, or export past queries/variables.
- **History Notes** to annotate and filter saved requests.
- **History Persistence** to keep recent requests across refreshes.
- **History filters** and status summaries for recent requests.
- **Saved Workspaces** to store and reapply endpoint/query/variable combinations.
- **Auto-saved Drafts** to recover in-progress editor changes after refreshes.

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
- Use the timeout control in the Query Editor to cancel long-running requests (set to `0` to disable timeouts).
- Use "Copy cURL" to share or debug the current request outside the UI.
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
