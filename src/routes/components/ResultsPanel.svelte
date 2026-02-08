<script>
  import { graphqlStore } from '../stores/graphql-store.js';


  let viewMode = $state('formatted'); // 'formatted', 'raw', 'table'
  let storeState = $state({});
  let tableData = $state(null);
  let historyFilter = $state('');
  let historyStatusFilter = $state('all');

  // Subscribe to store changes
  graphqlStore.subscribe(state => {
    storeState = state;
    tableData = renderTableView(state.results);
  });

  const filteredHistory = $derived(() => {
    const entries = storeState.history ?? [];
    const filter = historyFilter.trim().toLowerCase();
    return entries
      .filter(entry => {
        const matchesStatus = historyStatusFilter === 'all' || entry.status === historyStatusFilter;
        if (!matchesStatus) return false;
        if (!filter) return true;
        return [entry.endpoint, entry.query, entry.status, entry.error, entry.statusCode]
          .filter(Boolean)
          .some(value => value.toString().toLowerCase().includes(filter));
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  });

  const historySummary = $derived(() => {
    const entries = storeState.history ?? [];
    const total = entries.length;
    const successCount = entries.filter(entry => entry.status === 'success').length;
    const errorCount = entries.filter(entry => entry.status === 'error').length;
    const invalidCount = entries.filter(entry => entry.status === 'invalid').length;
    return {
      total,
      successCount,
      errorCount,
      invalidCount,
      successRate: total ? Math.round((successCount / total) * 100) : 0
    };
  });

  const responseSummary = $derived(() => {
    if (!storeState.results) return null;
    const serialized = JSON.stringify(storeState.results);
    const dataKeys = storeState.results?.data ? Object.keys(storeState.results.data) : [];
    return {
      size: serialized.length,
      dataKeys,
    };
  });

  function copyResults() {
    if (storeState.results) {
      navigator.clipboard?.writeText(JSON.stringify(storeState.results, null, 2));
    }
  }

  function downloadResults() {
    if (storeState.results) {
      const blob = new Blob([JSON.stringify(storeState.results, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graphql-results.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function clearResults() {
    graphqlStore.clearResults();
  }

  function restoreHistory(entry) {
    graphqlStore.loadHistoryEntry(entry);
  }

  async function runHistory(entry) {
    graphqlStore.loadHistoryEntry(entry);
    await graphqlStore.executeQuery();
  }

  function clearHistory() {
    graphqlStore.clearHistory();
  }

  function clearUnpinnedHistory() {
    graphqlStore.clearUnpinnedHistory();
  }

  function downloadHistory() {
    if (!storeState.history?.length) return;
    const blob = new Blob([JSON.stringify(storeState.history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graphql-history.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importHistory(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const entries = JSON.parse(text);
      if (Array.isArray(entries)) {
        graphqlStore.importHistory(entries);
      }
    } finally {
      event.target.value = '';
    }
  }

  function togglePinned(entry) {
    graphqlStore.toggleHistoryPin(entry.id);
  }

  function removeHistoryEntry(entry) {
    graphqlStore.removeHistoryEntry(entry.id);
  }

  function copyHistoryQuery(entry) {
    if (!entry?.query) return;
    navigator.clipboard?.writeText(entry.query);
  }

  function copyHistoryVariables(entry) {
    if (!entry?.variables) return;
    navigator.clipboard?.writeText(entry.variables);
  }

  function renderTableView(data) {
    
    if (!data || typeof data !== 'object') return null;
    
    // Handle GraphQL response structure
    if (data.data) {
      const firstKey = Object.keys(data.data)[0];
      const firstValue = data.data[firstKey];
      
      if (Array.isArray(firstValue)) {
        return firstValue;
      }
    }
    
    return null;
  }
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-900">Query Results</h2>
    <div class="flex items-center space-x-2">
      <!-- View Mode Selector -->
      <div class="flex bg-gray-100 rounded">
        <button
          onclick={() => viewMode = 'formatted'}
          class="px-3 py-1 text-sm rounded {viewMode === 'formatted' ? 'bg-white shadow' : ''}"
        >
          Formatted
        </button>
        <button
          onclick={() => viewMode = 'raw'}
          class="px-3 py-1 text-sm rounded {viewMode === 'raw' ? 'bg-white shadow' : ''}"
        >
          Raw
        </button>
        {#if tableData}
          <button
            onclick={() => viewMode = 'table'}
            class="px-3 py-1 text-sm rounded {viewMode === 'table' ? 'bg-white shadow' : ''}"
          >
            Table
          </button>
        {/if}
      </div>
      
      {#if storeState.results}
        <button
          onclick={copyResults}
          class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Copy
        </button>
        <button
          onclick={downloadResults}
          class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
        >
          Download
        </button>
      {/if}
      {#if storeState.results || storeState.error}
        <button
          onclick={clearResults}
          class="px-3 py-1 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
        >
          Clear
        </button>
      {/if}
    </div>
  </div>

  <div class="flex-1 border border-gray-300 rounded overflow-hidden">
    {#if storeState.loading}
      <div class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p class="text-gray-600">Executing query...</p>
        </div>
      </div>
    {:else if storeState.error}
      <div class="h-full flex items-center justify-center">
        <div class="text-center text-red-600">
          <div class="text-4xl mb-2">⚠️</div>
          <p class="font-medium">Query Error</p>
          <p class="text-sm mt-1">{storeState.error}</p>
        </div>
      </div>
    {:else if storeState.results}
      {#if viewMode === 'formatted'}
        <div class="h-full overflow-auto p-4">
          <pre class="text-sm font-mono whitespace-pre-wrap">{JSON.stringify(storeState.results, null, 2)}</pre>
        </div>
      {:else if viewMode === 'raw'}
        <div class="h-full overflow-auto p-4">
          <pre class="text-sm font-mono whitespace-pre-wrap">{JSON.stringify(storeState.results)}</pre>
        </div>
      {:else if viewMode === 'table' && tableData}
        <div class="h-full overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                {#each Object.keys(tableData[0] || {}) as header}
                  <th class="px-4 py-2 text-left font-medium text-gray-900 border-b">{header}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each tableData as row, index}
                <tr class="{index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                  {#each Object.values(row) as cell}
                    <td class="px-4 py-2 border-b">
                      {typeof cell === 'object' ? JSON.stringify(cell) : cell}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {:else}
      <div class="h-full flex items-center justify-center">
        <div class="text-center text-gray-500">
          <div class="text-4xl mb-2">📊</div>
          <p>No results yet</p>
          <p class="text-sm mt-1">Execute a query to see results here</p>
        </div>
      </div>
    {/if}
  </div>

  {#if storeState.history?.length}
    <div class="mt-4 border border-gray-200 rounded">
      <div class="flex items-center justify-between px-4 py-2 bg-gray-50">
        <h3 class="text-sm font-semibold text-gray-800">Recent Queries</h3>
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-600 hover:text-gray-900 cursor-pointer">
            Import
            <input
              type="file"
              accept="application/json"
              class="hidden"
              onchange={importHistory}
            />
          </label>
          <button
            onclick={downloadHistory}
            class="text-xs text-gray-600 hover:text-gray-900"
          >
            Export
          </button>
          <button
            onclick={clearUnpinnedHistory}
            class="text-xs text-gray-600 hover:text-gray-900"
          >
            Clear unpinned
          </button>
          <button
            onclick={clearHistory}
            class="text-xs text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      </div>
      <div class="px-4 py-2 border-b border-gray-200 bg-white space-y-3">
        <div class="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={historyFilter}
            oninput={(event) => (historyFilter = event.target.value)}
            placeholder="Filter by endpoint, query, or status"
            class="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-200 rounded"
          />
          <div class="text-xs text-gray-600 flex items-center gap-3">
            <span>Total: {historySummary.total}</span>
            <span>✅ {historySummary.successCount}</span>
            <span>❌ {historySummary.errorCount}</span>
            <span>⚠️ {historySummary.invalidCount}</span>
            <span>Success rate: {historySummary.successRate}%</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <button
            onclick={() => (historyStatusFilter = 'all')}
            class="px-2 py-1 rounded border {historyStatusFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}"
          >
            All
          </button>
          <button
            onclick={() => (historyStatusFilter = 'success')}
            class="px-2 py-1 rounded border {historyStatusFilter === 'success' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'}"
          >
            ✅ Success
          </button>
          <button
            onclick={() => (historyStatusFilter = 'error')}
            class="px-2 py-1 rounded border {historyStatusFilter === 'error' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200'}"
          >
            ❌ Error
          </button>
          <button
            onclick={() => (historyStatusFilter = 'invalid')}
            class="px-2 py-1 rounded border {historyStatusFilter === 'invalid' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-200'}"
          >
            ⚠️ Invalid
          </button>
        </div>
      </div>
      <ul class="divide-y divide-gray-200 max-h-48 overflow-auto">
        {#if filteredHistory.length === 0}
          <li class="px-4 py-3 text-xs text-gray-500">No history entries match the current filters.</li>
        {:else}
          {#each filteredHistory as entry}
            <li class="px-4 py-3 text-sm">
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">
                      {entry.status === 'success'
                        ? '✅'
                        : entry.status === 'error'
                          ? '❌'
                          : '⚠️'} {entry.endpoint || 'No endpoint'}
                    </span>
                    {#if entry.pinned}
                      <span class="text-xs text-amber-500">★</span>
                    {/if}
                    <span class="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                    {#if entry.durationMs !== undefined}
                      <span class="text-xs text-gray-400">{entry.durationMs}ms</span>
                    {/if}
                    {#if entry.statusCode}
                      <span class="text-xs text-gray-400">{entry.statusCode}{entry.statusText ? ` ${entry.statusText}` : ''}</span>
                    {/if}
                  </div>
                  <p class="text-xs text-gray-600 truncate mt-1">{entry.query.replace(/\s+/g, ' ')}</p>
                  {#if entry.variables}
                    <p class="text-xs text-gray-500 truncate mt-1">Vars: {entry.variables.replace(/\s+/g, ' ')}</p>
                  {/if}
                  {#if entry.error}
                    <p class="text-xs text-red-500 mt-1">{entry.error}</p>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <button
                    onclick={() => togglePinned(entry)}
                    class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                  >
                    {entry.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onclick={() => removeHistoryEntry(entry)}
                    class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                  >
                    Delete
                  </button>
                  <button
                    onclick={() => restoreHistory(entry)}
                    class="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Load
                  </button>
                  <button
                    onclick={() => runHistory(entry)}
                    class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Run
                  </button>
                  <button
                    onclick={() => copyHistoryQuery(entry)}
                    class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                  >
                    Copy query
                  </button>
                  <button
                    onclick={() => copyHistoryVariables(entry)}
                    class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                  >
                    Copy vars
                  </button>
                </div>
              </div>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  {/if}

  {#if storeState.results}
    <div class="mt-4 text-sm text-gray-600">
      <div class="flex flex-wrap items-center gap-4">
        {#if storeState.results.data}
          <span>✅ Query successful</span>
        {/if}
        {#if storeState.results.errors}
          <span class="text-red-600">❌ {storeState.results.errors.length} error(s)</span>
        {/if}
        {#if storeState.results.extensions?.tracing?.duration}
          <span>⏱️ {storeState.results.extensions.tracing.duration}ms</span>
        {/if}
        {#if responseSummary}
          <span>📦 {responseSummary.size} bytes</span>
          {#if responseSummary.dataKeys.length}
            <span>🧩 {responseSummary.dataKeys.join(', ')}</span>
          {/if}
        {/if}
      </div>
    </div>
  {/if}

  {#if storeState.lastExecution && !storeState.results}
    <div class="mt-4 text-sm text-gray-600">
      <div class="flex flex-wrap items-center gap-4">
        <span>
          {storeState.lastExecution.status === 'success'
            ? '✅'
            : storeState.lastExecution.status === 'error'
              ? '❌'
              : '⚠️'}
          Last run {storeState.lastExecution.status}
        </span>
        {#if storeState.lastExecution.durationMs !== undefined}
          <span>⏱️ {storeState.lastExecution.durationMs}ms</span>
        {/if}
        {#if storeState.lastExecution.statusCode}
          <span>🌐 {storeState.lastExecution.statusCode}{storeState.lastExecution.statusText ? ` ${storeState.lastExecution.statusText}` : ''}</span>
        {/if}
        {#if storeState.lastExecution.error}
          <span class="text-red-600">⚠️ {storeState.lastExecution.error}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>
