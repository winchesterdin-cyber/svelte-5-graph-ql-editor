# GraphQL Visualizer (Svelte 5)

An interactive GraphQL editor built with Svelte 5. It includes a query editor, visual builder,
variables editor, schema explorer, and results panel for exploring GraphQL APIs.

## Features

- **Query Editor** with formatting, reset to defaults, and execution controls.
- **Visual Builder** for composing queries visually from schema fields.
- **Variables Editor** with JSON validation, error feedback, and a visual helper.
- **Schema Explorer** to introspect or load demo schemas.
- **Results Panel** with formatted/raw/table views, response metadata, quick copy/download, and clearing.
- **Query History** to reload, re-run, pin, delete, copy, import, or export past queries/variables.
- **History filters** and status summaries for recent requests.

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
- Use the history filter and status chips to quickly find past queries by endpoint, status, or query snippet.
- Use "Clear unpinned" to trim history while keeping your pinned highlights.
- Clear the Results panel to remove outdated data or error messages between runs.
- Review response metadata (payload size, top-level data keys) to sanity-check results quickly.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
