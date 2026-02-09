<script>
  import { onMount } from 'svelte';
  import { graphqlStore } from '../stores/graphql-store.js';
  import SavedPresets from './SavedPresets.svelte';

  let query = $state('');
  let endpoint = $state('');
  let variables = $state('');
  let draft = $state(null);
  let isExecuting = $state(false);
  let requestTimeoutMs = $state(15000);

  // Subscribe to store changes
  $effect(() => {
    const unsubscribe = graphqlStore.subscribe((state) => {
      query = state.query;
      endpoint = state.endpoint;
      variables = state.variables;
      draft = state.draft;
      isExecuting = state.loading;
      requestTimeoutMs = state.requestTimeoutMs ?? 0;
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
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-900">GraphQL Query Editor</h2>
    <div class="flex flex-wrap gap-2">
      <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1">
        <label class="text-xs text-gray-600">Timeout (ms)</label>
        <input
          type="number"
          min="0"
          step="500"
          value={requestTimeoutMs}
          oninput={handleTimeoutChange}
          class="w-24 px-2 py-1 text-xs border border-gray-200 rounded"
        />
      </div>
      <button
        onclick={formatQuery}
        class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
      >
        Format
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

  <div class="mt-4 text-sm text-gray-600">
    <p>💡 <strong>Tips:</strong></p>
    <ul class="list-disc list-inside space-y-1 mt-2">
      <li>Use Ctrl+Space for autocomplete (when schema is loaded)</li>
      <li>Click "Format" to auto-indent your query</li>
      <li>Switch to "Visual Builder" tab to build queries visually</li>
      <li>Check the "Variables" tab to define query variables</li>
      <li>Set timeout to 0 to disable request timeouts</li>
    </ul>
  </div>
</div>
