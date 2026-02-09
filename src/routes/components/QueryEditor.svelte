<script>
  import { onMount } from 'svelte';
  import { graphqlStore } from '../stores/graphql-store.js';
  import SavedPresets from './SavedPresets.svelte';
  import { LEVELS } from '../stores/logger.js';

  let query = $state('');
  let endpoint = $state('');
  let variables = $state('');
  let headers = $state('');
  let draft = $state(null);
  let isExecuting = $state(false);
  let requestTimeoutMs = $state(15000);
  let retryMax = $state(0);
  let retryDelayMs = $state(1000);
  let copyStatus = $state('');

  // Subscribe to store changes
  $effect(() => {
    const unsubscribe = graphqlStore.subscribe((state) => {
      query = state.query;
      endpoint = state.endpoint;
      variables = state.variables;
      headers = state.headers;
      draft = state.draft;
      isExecuting = state.loading;
      requestTimeoutMs = state.requestTimeoutMs ?? 0;
      retryMax = state.retryPolicy?.maxRetries ?? 0;
      retryDelayMs = state.retryPolicy?.retryDelayMs ?? 1000;
    });
    return unsubscribe;
  });

  const draftToRestore = $derived(() => {
    if (!draft) return null;
    const hasChanges =
      draft.endpoint !== endpoint ||
      draft.query !== query ||
      draft.variables !== variables;
    return hasChanges ? draft : null;
  });

  onMount(() => {
    graphqlStore.loadDraft();
  });

  function handleQueryChange(event) {
    const newQuery = event.target.value;
    query = newQuery;
    graphqlStore.updateQuery(newQuery);
  }

  async function executeQuery() {
    await graphqlStore.executeQuery();
  }

  function cancelQuery() {
    graphqlStore.cancelActiveRequest();
  }

  function formatQuery() {
    // Simple formatting - add proper indentation
    const formatted = query
      .replace(/{\s*/g, '{\n  ')
      .replace(/}\s*/g, '\n}\n')
      .replace(/,\s*/g, ',\n  ')
      .replace(/\n\s*\n/g, '\n');
    
    graphqlStore.updateQuery(formatted);
  }

  function resetQuery() {
    graphqlStore.resetDefaults();
  }

  function handleTimeoutChange(event) {
    const rawValue = event.target.value;
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0) return;
    graphqlStore.setRequestTimeoutMs(parsed);
  }

  function handleRetryChange(event) {
    const rawValue = event.target.value;
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0) return;
    graphqlStore.setRetryPolicy({ maxRetries: parsed, retryDelayMs });
  }

  function handleRetryDelayChange(event) {
    const rawValue = event.target.value;
    const parsed = rawValue === '' ? 0 : Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0) return;
    graphqlStore.setRetryPolicy({ maxRetries: retryMax, retryDelayMs: parsed });
  }

  function restoreDraft() {
    graphqlStore.applyDraft();
  }

  function dismissDraft() {
    graphqlStore.clearDraft();
  }

  function formatDraftTime(timestamp) {
    if (!timestamp) return 'unknown time';
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Build a curl command to reproduce the current query execution.
   * This helps users debug outside the UI or share a request quickly.
   */
  function buildCurlCommand() {
    if (!endpoint) return null;
    let parsedVariables = null;
    if (variables?.trim()) {
      parsedVariables = JSON.parse(variables);
    }
    const { headers: parsedHeaders, error: headerError } =
      graphqlStore.parseHeadersJson(headers);
    if (headerError) {
      throw new Error(headerError);
    }

    const payload = JSON.stringify({
      query,
      variables: parsedVariables ?? undefined
    });

    const headerFlags = Object.entries({
      'Content-Type': 'application/json',
      ...(parsedHeaders ?? {})
    }).flatMap(([key, value]) => [
      '-H',
      `'${`${key}: ${value}`.replace(/'/g, "'\\''")}'`
    ]);

    return [
      "curl",
      "-X",
      "POST",
      `'${endpoint}'`,
      ...headerFlags,
      "-d",
      `'${payload.replace(/'/g, "'\\''")}'`
    ].join(' ');
  }

  async function copyCurlCommand() {
    copyStatus = '';
    if (!endpoint) {
      copyStatus = 'Set an endpoint to generate a cURL command.';
      graphqlStore.logUiEvent(LEVELS.WARN, 'Missing endpoint for cURL copy');
      return;
    }

    let command;
    try {
      command = buildCurlCommand();
    } catch (error) {
      copyStatus = `${error.message}`;
      graphqlStore.logUiEvent(LEVELS.WARN, 'Invalid JSON for cURL copy', {
        error: error.message
      });
      return;
    }

    if (!command) {
      copyStatus = 'Unable to generate cURL command.';
      graphqlStore.logUiEvent(LEVELS.ERROR, 'Failed to generate cURL command');
      return;
    }

    try {
      await navigator.clipboard?.writeText(command);
      copyStatus = 'cURL command copied to clipboard.';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Copied cURL command');
    } catch (error) {
      copyStatus = 'Clipboard copy failed. Try again or copy manually.';
      graphqlStore.logUiEvent(LEVELS.ERROR, 'Clipboard copy failed', {
        error: error.message
      });
    }
  }

  // Surface retry behavior so users understand slow/unstable network handling.
  const retrySummary = $derived(() => {
    if (!isExecuting) return null;
    const totalAttempts = retryMax + 1;
    if (totalAttempts <= 1) return 'Running request...';
    return `Attempting request (up to ${totalAttempts} tries).`;
  });
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-900">GraphQL Query Editor</h2>
    <div class="flex flex-wrap gap-2">
      <div class="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
        <label for="request-timeout" class="text-xs text-gray-600">Timeout (ms)</label>
        <input
          id="request-timeout"
          type="number"
          min="0"
          step="500"
          value={requestTimeoutMs}
          oninput={handleTimeoutChange}
          class="w-24 px-2 py-1 text-xs border border-gray-200 rounded"
        />
        <label for="request-retries" class="text-xs text-gray-600">Retries</label>
        <input
          id="request-retries"
          type="number"
          min="0"
          step="1"
          value={retryMax}
          oninput={handleRetryChange}
          class="w-16 px-2 py-1 text-xs border border-gray-200 rounded"
        />
        <label for="retry-delay" class="text-xs text-gray-600">Delay (ms)</label>
        <input
          id="retry-delay"
          type="number"
          min="0"
          step="250"
          value={retryDelayMs}
          oninput={handleRetryDelayChange}
          class="w-20 px-2 py-1 text-xs border border-gray-200 rounded"
        />
      </div>
      <button
        onclick={formatQuery}
        class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
      >
        Format
      </button>
      <button
        onclick={copyCurlCommand}
        class="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
      >
        Copy cURL
      </button>
      <button
        onclick={resetQuery}
        class="px-3 py-1 bg-amber-500 text-white rounded text-sm hover:bg-amber-600"
      >
        Reset
      </button>
      <button
        onclick={executeQuery}
        disabled={isExecuting}
        class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExecuting ? 'Executing...' : 'Execute Query'}
      </button>
      {#if isExecuting}
        <button
          onclick={cancelQuery}
          class="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
        >
          Cancel
        </button>
      {/if}
    </div>
  </div>

  {#if draftToRestore}
    <div class="mb-4 flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="font-semibold">Draft detected</p>
        <p class="text-xs text-amber-700">
          Restore your auto-saved draft from {formatDraftTime(draftToRestore.updatedAt)}?
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          onclick={restoreDraft}
          class="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700"
        >
          Restore draft
        </button>
        <button
          onclick={dismissDraft}
          class="rounded bg-white px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  <div class="flex-1 border border-gray-300 rounded">
    <textarea
      value={query}
      oninput={handleQueryChange}
      placeholder="Enter your GraphQL query here..."
      class="w-full h-full p-4 font-mono text-sm resize-none border-none outline-none"
    ></textarea>
  </div>

  <SavedPresets />

  {#if retrySummary}
    <div class="mt-3 text-xs text-gray-500">
      {retrySummary}
    </div>
  {/if}

  {#if copyStatus}
    <div class="mt-2 text-xs text-gray-500">
      {copyStatus}
    </div>
  {/if}

  <div class="mt-4 text-sm text-gray-600">
    <p>💡 <strong>Tips:</strong></p>
    <ul class="list-disc list-inside space-y-1 mt-2">
      <li>Use Ctrl+Space for autocomplete (when schema is loaded)</li>
      <li>Click "Format" to auto-indent your query</li>
      <li>Switch to "Visual Builder" tab to build queries visually</li>
      <li>Check the "Variables" tab to define query variables</li>
      <li>Set timeout to 0 to disable request timeouts</li>
      <li>Increase retries to auto-recover from transient network or server errors</li>
    </ul>
  </div>
</div>
