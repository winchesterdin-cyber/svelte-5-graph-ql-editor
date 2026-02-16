<script>
  import { onMount } from 'svelte';
  import { graphqlStore } from '../stores/graphql-store.js';
  import SavedPresets from './SavedPresets.svelte';
  import { LEVELS } from '../stores/logger.js';
  import {
    getDiagnostics,
    getOperationOutline,
    getSchemaSuggestions
  } from './editor-intelligence.js';

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
  let schema = $state(null);
  let cursorIndex = $state(0);
  let showSuggestions = $state(false);
  let selectedSuggestionIndex = $state(0);
  let requestTemplates = $state([]);

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
      schema = state.schema;
    });
    return unsubscribe;
  });

  const operationOutline = $derived(() => getOperationOutline(query));
  const diagnostics = $derived(() => getDiagnostics({ query, endpoint, variables, headers }));
  const suggestions = $derived(() => getSchemaSuggestions({ schema, query, cursorIndex }));

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
    requestTemplates = graphqlStore.getRequestTemplates();
  });

  function handleQueryChange(event) {
    const newQuery = event.target.value;
    query = newQuery;
    cursorIndex = event.target.selectionStart ?? newQuery.length;
    graphqlStore.updateQuery(newQuery);
    showSuggestions = false;
  }

  function goToOperation(operation) {
    if (!operation) return;
    const editorEl = document.getElementById('graphql-query-input');
    if (!editorEl) return;
    editorEl.focus();
    editorEl.setSelectionRange(operation.index, operation.index);
    cursorIndex = operation.index;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Jumped to operation from outline', {
      operation: operation.name,
      index: operation.index,
    });
  }

  async function executeQuery() {
    await graphqlStore.executeQuery();
  }

  /**
   * Apply a reusable request starter to reduce repetitive setup work.
   */
  function applyRequestTemplate(event) {
    const templateId = event.target.value;
    if (!templateId) return;
    graphqlStore.applyRequestTemplate(templateId);
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
    graphqlStore.logUiEvent(LEVELS.INFO, 'Formatted query document');
  }

  function resetQuery() {
    graphqlStore.resetDefaults();
    graphqlStore.logUiEvent(LEVELS.INFO, 'Reset query editor to defaults');
  }

  function handleEditorSelect(event) {
    cursorIndex = event.target.selectionStart ?? 0;
  }

  function applySuggestion(suggestion) {
    if (!suggestion) return;
    const editorEl = document.getElementById('graphql-query-input');
    if (!editorEl) return;
    const before = query.slice(0, cursorIndex);
    const after = query.slice(cursorIndex);
    const tokenMatch = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
    const tokenLength = tokenMatch?.[0]?.length ?? 0;
    const replaceFrom = cursorIndex - tokenLength;
    const nextQuery = `${query.slice(0, replaceFrom)}${suggestion.insertText}${after}`;
    graphqlStore.updateQuery(nextQuery);
    cursorIndex = replaceFrom + suggestion.insertText.length;
    showSuggestions = false;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Applied schema suggestion', {
      suggestion: suggestion.label,
    });
    requestAnimationFrame(() => {
      editorEl.focus();
      editorEl.setSelectionRange(cursorIndex, cursorIndex);
    });
  }

  function moveSuggestionSelection(direction = 1) {
    if (!suggestions.length) return;
    selectedSuggestionIndex =
      (selectedSuggestionIndex + direction + suggestions.length) % suggestions.length;
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      executeQuery();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === ' ') {
      event.preventDefault();
      showSuggestions = true;
      selectedSuggestionIndex = 0;
      graphqlStore.logUiEvent(LEVELS.INFO, 'Opened schema autocomplete menu');
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('graphql-command-palette:toggle'));
      return;
    }

    if (!showSuggestions) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSuggestionSelection(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSuggestionSelection(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      applySuggestion(suggestions[selectedSuggestionIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      showSuggestions = false;
    }
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

  <div class="mb-3 flex items-center gap-2">
    <label for="request-template" class="text-xs font-medium text-gray-600">Templates</label>
    <select id="request-template" onchange={applyRequestTemplate} class="rounded border border-gray-200 px-2 py-1 text-xs">
      <option value="">Select request template</option>
      {#each requestTemplates as template}
        <option value={template.id}>{template.label}</option>
      {/each}
    </select>
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
      id="graphql-query-input"
      value={query}
      oninput={handleQueryChange}
      onselect={handleEditorSelect}
      onclick={handleEditorSelect}
      onkeyup={handleEditorSelect}
      onkeydown={handleKeydown}
      placeholder="Enter your GraphQL query here..."
      class="w-full h-full p-4 font-mono text-sm resize-none border-none outline-none"
    ></textarea>
  </div>

  {#if showSuggestions && suggestions.length}
    <div class="mt-3 rounded border border-indigo-200 bg-indigo-50 p-3 text-xs">
      <p class="mb-2 font-semibold text-indigo-900">Schema autocomplete</p>
      <ul class="space-y-1">
        {#each suggestions as suggestion, index}
          <li>
            <button
              onclick={() => applySuggestion(suggestion)}
              class="w-full rounded border px-2 py-1 text-left {index === selectedSuggestionIndex ? 'border-indigo-400 bg-white' : 'border-transparent'}"
            >
              <span class="font-mono text-indigo-900">{suggestion.label}</span>
              <span class="ml-2 text-indigo-700">→ {suggestion.detail}</span>
              <p class="mt-1 text-[11px] text-indigo-600">{suggestion.documentation}</p>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="mt-3 grid gap-3 lg:grid-cols-2">
    <div class="rounded border border-gray-200 bg-white p-3">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-700">Operation explorer</h3>
      {#if operationOutline.length}
        <ul class="mt-2 space-y-2 text-xs">
          {#each operationOutline as operation}
            <li class="rounded border border-gray-100 p-2">
              <button
                onclick={() => goToOperation(operation)}
                class="font-mono text-blue-700 hover:text-blue-900"
              >
                {operation.type} {operation.name}
              </button>
              {#if operation.fields.length}
                <p class="mt-1 text-gray-500">Fields: {operation.fields.join(', ')}</p>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-2 text-xs text-gray-500">No operations discovered yet.</p>
      {/if}
    </div>

    <div class="rounded border border-gray-200 bg-white p-3">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-700">Live diagnostics</h3>
      {#if diagnostics.length}
        <ul class="mt-2 space-y-1 text-xs">
          {#each diagnostics as diagnostic}
            <li class="rounded px-2 py-1 {diagnostic.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}">
              <span class="font-semibold">{diagnostic.code}:</span> {diagnostic.message}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-2 text-xs text-emerald-700">No diagnostics detected.</p>
      {/if}
    </div>
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
      <li>Use Ctrl/Cmd+Enter to execute the query quickly</li>
      <li>Use Ctrl/Cmd+Shift+P to open the global command palette</li>
      <li>Click "Format" to auto-indent your query</li>
      <li>Switch to "Visual Builder" tab to build queries visually</li>
      <li>Check the "Variables" tab to define query variables</li>
      <li>Set timeout to 0 to disable request timeouts</li>
      <li>Increase retries to auto-recover from transient network or server errors</li>
    </ul>
  </div>
</div>
