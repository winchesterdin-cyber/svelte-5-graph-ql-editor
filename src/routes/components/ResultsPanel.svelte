<script>
  import { graphqlStore } from '../stores/graphql-store.js';
  import { LEVELS } from '../stores/logger.js';
  import {
    buildColumnOrder,
    buildCsv,
    filterTableRows,
    formatCellValue,
    getHighlightParts
  } from './table-utils.js';
  import { buildHistoryDiff } from './history-diff.js';


  let viewMode = $state('formatted'); // 'formatted', 'raw', 'table'
  let storeState = $state({});
  let tableData = $state(null);
  let historyFilter = $state('');
  let historyStatusFilter = $state('all');
  let logLevelFilter = $state('all');
  let editingNoteId = $state(null);
  let noteDrafts = $state({});
  let showColumnManager = $state(false);
  let visibleColumns = $state([]);
  let tableFilter = $state('');
  let lastLoggedFilter = $state('');
  let filterLogTimeout;
  let stickyFirstColumn = $state(false);
  let csvDelimiter = $state(',');
  let selectedHistoryIds = $state([]);

  // Subscribe to store changes
  graphqlStore.subscribe(state => {
    storeState = state;
    tableData = renderTableView(state.results);
  });

  const tableColumnOrder = $derived(() => buildColumnOrder(tableData ?? []));
  const tableColumns = $derived(() => tableColumnOrder);
  const firstVisibleColumn = $derived(() => {
    const visible = tableColumnOrder.filter((column) =>
      visibleColumns.includes(column),
    );
    return visible[0] ?? null;
  });

  $effect(() => {
    if (!tableColumns.length) {
      visibleColumns = [];
      showColumnManager = false;
      tableFilter = '';
      return;
    }
    const nextColumns = tableColumns;
    const shouldResetSelection =
      visibleColumns.length === 0 ||
      !visibleColumns.every((column) => nextColumns.includes(column));
    if (shouldResetSelection) {
      visibleColumns = [...nextColumns];
    }
  });

  const filteredTableRows = $derived(() =>
    filterTableRows(tableData, tableFilter, visibleColumns),
  );

  $effect(() => {
    if (tableFilter === lastLoggedFilter) return;
    if (filterLogTimeout) clearTimeout(filterLogTimeout);
    const nextFilter = tableFilter;
    filterLogTimeout = setTimeout(() => {
      lastLoggedFilter = nextFilter;
      const rowCount = Array.isArray(tableData) ? tableData.length : 0;
      const filteredCount = Array.isArray(filteredTableRows)
        ? filteredTableRows.length
        : 0;
      const isFilterApplied = Boolean(nextFilter);
      const shouldWarn = isFilterApplied && filteredCount === 0;
      graphqlStore.logUiEvent(
        shouldWarn ? LEVELS.WARN : LEVELS.INFO,
        isFilterApplied ? 'Applied table filter' : 'Cleared table filter',
        {
          filter: nextFilter,
          rowCount,
          filteredCount,
        },
      );
    }, 400);
    return () => {
      if (filterLogTimeout) clearTimeout(filterLogTimeout);
    };
  });

  const filteredHistory = $derived(() => {
    const entries = storeState.history ?? [];
    const filter = historyFilter.trim().toLowerCase();
    return entries
      .filter(entry => {
        const matchesStatus = historyStatusFilter === 'all' || entry.status === historyStatusFilter;
        if (!matchesStatus) return false;
        if (!filter) return true;
        return [entry.endpoint, entry.query, entry.status, entry.error, entry.statusCode, entry.note]
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
    const cancelledCount = entries.filter(entry => entry.status === 'cancelled').length;
    return {
      total,
      successCount,
      errorCount,
      invalidCount,
      cancelledCount,
      successRate: total ? Math.round((successCount / total) * 100) : 0
    };
  });

  const selectedHistoryEntries = $derived(() =>
    (storeState.history ?? []).filter((entry) => selectedHistoryIds.includes(entry.id)).slice(0, 2),
  );

  const historyDiff = $derived(() =>
    selectedHistoryEntries.length === 2
      ? buildHistoryDiff(selectedHistoryEntries[0], selectedHistoryEntries[1])
      : null,
  );

  const responseSummary = $derived(() => {
    if (!storeState.results) return null;
    const serialized = JSON.stringify(storeState.results);
    const dataKeys = storeState.results?.data ? Object.keys(storeState.results.data) : [];
    return {
      size: serialized.length,
      dataKeys,
    };
  });

  const filteredLogs = $derived(() => {
    const entries = storeState.logs ?? [];
    if (logLevelFilter === 'all') return entries;
    return entries.filter(entry => entry.level === logLevelFilter);
  });

  const loadingSummary = $derived(() => {
    if (!storeState.loading) return null;
    const retryAttempt = storeState.retryAttempt ?? 0;
    const maxRetries = storeState.retryPolicy?.maxRetries ?? 0;
    const maxAttempts = maxRetries + 1;
    if (maxAttempts <= 1) return 'Executing query...';
    return `Executing query (attempt ${retryAttempt + 1} of ${maxAttempts})...`;
  });

  async function copyResults() {
    if (!storeState.results) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Copy results skipped: no data available');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Copy results skipped: clipboard unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(storeState.results, null, 2));
      graphqlStore.logUiEvent(LEVELS.INFO, 'Copied query results to clipboard', {
        byteSize: JSON.stringify(storeState.results).length,
      });
    } catch (error) {
      graphqlStore.logUiEvent(LEVELS.ERROR, 'Failed to copy query results', {
        error: error?.message ?? 'Unknown clipboard error',
      });
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
      graphqlStore.logUiEvent(LEVELS.INFO, 'Downloaded query results as JSON', {
        byteSize: blob.size,
      });
    } else {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Download results skipped: no data available');
    }
  }

  /**
   * Calculate a stable column order for table rendering + CSV export.
   * We preserve the first row's keys first, then append any missing keys.
   * @param {Array<Record<string, unknown>>} rows
   */
  function downloadTableCsv() {
    if (!Array.isArray(tableData)) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'CSV export skipped: no table data available');
      return;
    }
    const rowsToExport = filteredTableRows ?? [];
    if (rowsToExport.length === 0) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'CSV export skipped: table data is empty');
      return;
    }
    const csv = buildCsv(rowsToExport, visibleColumns, csvDelimiter);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graphql-results.csv';
    a.click();
    URL.revokeObjectURL(url);
    graphqlStore.logUiEvent(LEVELS.INFO, 'Downloaded table data as CSV', {
      rows: rowsToExport.length,
      columns: visibleColumns.length,
      delimiter: csvDelimiter === '\t' ? 'tab' : csvDelimiter,
      byteSize: blob.size,
    });
  }

  function toggleColumnManager() {
    showColumnManager = !showColumnManager;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Toggled column manager', {
      open: showColumnManager,
    });
  }

  function toggleColumn(column) {
    if (!column) return;
    const isSelected = visibleColumns.includes(column);
    if (isSelected && visibleColumns.length === 1) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Column toggle blocked: at least one column required', {
        column,
      });
      return;
    }
    visibleColumns = isSelected
      ? visibleColumns.filter((item) => item !== column)
      : [...visibleColumns, column];
    graphqlStore.logUiEvent(LEVELS.INFO, 'Toggled table column visibility', {
      column,
      visible: !isSelected,
      visibleCount: visibleColumns.length,
    });
  }

  function showAllColumns() {
    if (!tableColumns.length) return;
    visibleColumns = [...tableColumns];
    graphqlStore.logUiEvent(LEVELS.INFO, 'Reset table columns to show all', {
      columnCount: tableColumns.length,
    });
  }

  function clearTableFilter() {
    tableFilter = '';
  }

  /**
   * Reset table-specific controls to their default, fully visible state.
   * This gives users a quick escape hatch if the view becomes too filtered.
   */
  function resetTableView() {
    showAllColumns();
    tableFilter = '';
    showColumnManager = false;
    stickyFirstColumn = false;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Reset table view to defaults');
  }

  function toggleStickyFirstColumn() {
    stickyFirstColumn = !stickyFirstColumn;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Toggled sticky first column', {
      enabled: stickyFirstColumn,
    });
  }

  function handleDelimiterChange(event) {
    const nextDelimiter = event.target.value;
    csvDelimiter = nextDelimiter;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Updated CSV delimiter', {
      delimiter: nextDelimiter === '\t' ? 'tab' : nextDelimiter,
    });
  }

  async function copyRowAsJson(row) {
    if (!row) return;
    if (!navigator.clipboard?.writeText) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Copy row skipped: clipboard unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      graphqlStore.logUiEvent(LEVELS.INFO, 'Copied table row as JSON', {
        columnCount: Object.keys(row).length,
      });
    } catch (error) {
      graphqlStore.logUiEvent(LEVELS.ERROR, 'Failed to copy table row', {
        error: error?.message ?? 'Unknown clipboard error',
      });
    }
  }

  function clearResults() {
    graphqlStore.clearResults();
    graphqlStore.logUiEvent(LEVELS.INFO, 'Cleared query results panel');
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

  function clearLogs() {
    graphqlStore.clearLogs();
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
    graphqlStore.logUiEvent(LEVELS.INFO, 'Downloaded query history JSON', {
      entryCount: storeState.history.length,
      byteSize: blob.size,
    });
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
    graphqlStore.logUiEvent(LEVELS.INFO, 'Toggled history pin', {
      entryId: entry.id,
      pinned: !entry.pinned,
    });
  }

  function removeHistoryEntry(entry) {
    graphqlStore.removeHistoryEntry(entry.id);
    selectedHistoryIds = selectedHistoryIds.filter((id) => id !== entry.id);
    graphqlStore.logUiEvent(LEVELS.INFO, 'Removed history entry', {
      entryId: entry.id,
    });
  }

  /**
   * Toggle an entry for diff comparison.
   * We cap selections at two to keep the compare interaction focused.
   */
  function toggleHistoryCompare(entry) {
    if (!entry?.id) return;
    const isSelected = selectedHistoryIds.includes(entry.id);
    if (isSelected) {
      selectedHistoryIds = selectedHistoryIds.filter((id) => id !== entry.id);
    } else if (selectedHistoryIds.length >= 2) {
      selectedHistoryIds = [selectedHistoryIds[1], entry.id];
    } else {
      selectedHistoryIds = [...selectedHistoryIds, entry.id];
    }

    graphqlStore.logUiEvent(LEVELS.INFO, 'Updated history diff selection', {
      selectedCount: selectedHistoryIds.length,
      selectedIds: selectedHistoryIds,
    });
  }

  async function copyHistoryQuery(entry) {
    if (!entry?.query) return;
    if (!navigator.clipboard?.writeText) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Copy history query skipped: clipboard unavailable', {
        entryId: entry.id,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(entry.query);
      graphqlStore.logUiEvent(LEVELS.INFO, 'Copied history query', {
        entryId: entry.id,
      });
    } catch (error) {
      graphqlStore.logUiEvent(LEVELS.ERROR, 'Failed to copy history query', {
        entryId: entry.id,
        error: error?.message ?? 'Unknown clipboard error',
      });
    }
  }

  async function copyHistoryVariables(entry) {
    if (!entry?.variables) return;
    if (!navigator.clipboard?.writeText) {
      graphqlStore.logUiEvent(LEVELS.WARN, 'Copy history variables skipped: clipboard unavailable', {
        entryId: entry.id,
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(entry.variables);
      graphqlStore.logUiEvent(LEVELS.INFO, 'Copied history variables', {
        entryId: entry.id,
      });
    } catch (error) {
      graphqlStore.logUiEvent(LEVELS.ERROR, 'Failed to copy history variables', {
        entryId: entry.id,
        error: error?.message ?? 'Unknown clipboard error',
      });
    }
  }

  /**
   * Begin editing a history note by seeding draft state.
   * This keeps edits local until the user explicitly saves.
   */
  function startNoteEdit(entry) {
    if (!entry) return;
    editingNoteId = entry.id;
    noteDrafts = {
      ...noteDrafts,
      [entry.id]: entry.note ?? ''
    };
  }

  function updateNoteDraft(entryId, value) {
    noteDrafts = {
      ...noteDrafts,
      [entryId]: value
    };
  }

  function saveNote(entry) {
    if (!entry) return;
    const draft = noteDrafts[entry.id] ?? '';
    graphqlStore.updateHistoryNote(entry.id, draft);
    editingNoteId = null;
    graphqlStore.logUiEvent(LEVELS.INFO, 'Saved history note', {
      entryId: entry.id,
      noteLength: draft.length,
    });
  }

  function cancelNoteEdit() {
    editingNoteId = null;
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
        {#if tableData}
          <button
            onclick={downloadTableCsv}
            class="px-3 py-1 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600"
          >
            CSV
          </button>
          <select
            value={csvDelimiter}
            onchange={handleDelimiterChange}
            class="px-2 py-1 text-sm border border-gray-200 rounded"
            aria-label="CSV delimiter"
          >
            <option value=",">Comma</option>
            <option value=";">Semicolon</option>
            <option value="\t">Tab</option>
          </select>
          <button
            onclick={toggleColumnManager}
            class="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded text-sm hover:bg-gray-50"
          >
            Columns
          </button>
        {/if}
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
          <p class="text-gray-600">{loadingSummary ?? 'Executing query...'}</p>
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
        {#if tableData.length === 0}
          <div class="h-full flex items-center justify-center text-sm text-gray-500">
            No rows available for table view.
          </div>
        {:else if filteredTableRows && filteredTableRows.length === 0}
          <div class="h-full flex items-center justify-center text-sm text-gray-500">
            No rows match the current filter.
          </div>
        {:else}
          <div class="h-full overflow-auto">
            {#if tableColumns.length}
              <div class="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span>Showing {visibleColumns.length} of {tableColumns.length} columns</span>
                  <div class="flex flex-wrap items-center gap-2">
                    <span>
                      Rows {filteredTableRows?.length ?? 0} / {tableData.length}
                    </span>
                    <button
                      onclick={showAllColumns}
                      class="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Show all
                    </button>
                    <button
                      onclick={resetTableView}
                      class="text-xs text-gray-600 hover:text-gray-800"
                    >
                      Reset view
                    </button>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={tableFilter}
                    oninput={(event) => (tableFilter = event.target.value)}
                    placeholder="Filter rows..."
                    class="w-full max-w-xs rounded border border-gray-200 px-2 py-1 text-xs"
                  />
                  {#if tableFilter}
                    <button
                      onclick={clearTableFilter}
                      class="text-xs text-gray-600 hover:text-gray-800"
                    >
                      Clear filter
                    </button>
                  {/if}
                  <label class="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={stickyFirstColumn}
                      onchange={toggleStickyFirstColumn}
                    />
                    Sticky first column
                  </label>
                </div>
                {#if showColumnManager}
                  <div class="mt-2 flex flex-wrap gap-2">
                    {#each tableColumns as column}
                      <label class="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(column)}
                          onchange={() => toggleColumn(column)}
                        />
                        <span>{column}</span>
                      </label>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
            <table class="w-full text-sm">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  {#each tableColumnOrder as header}
                    {#if visibleColumns.includes(header)}
                      <th
                        class="px-4 py-2 text-left font-medium text-gray-900 border-b {stickyFirstColumn && header === firstVisibleColumn ? 'sticky left-0 bg-gray-50 shadow-sm' : ''}"
                      >
                        {header}
                      </th>
                    {/if}
                  {/each}
                  <th class="px-4 py-2 text-left font-medium text-gray-900 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredTableRows ?? [] as row, index}
                  <tr class="{index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    {#each tableColumnOrder as header}
                      {#if visibleColumns.includes(header)}
                        <td
                          class="px-4 py-2 border-b {stickyFirstColumn && header === firstVisibleColumn ? 'sticky left-0 bg-white shadow-sm' : ''}"
                        >
                          {#each getHighlightParts(formatCellValue(row?.[header]), tableFilter) as part}
                            <span class={part.isMatch ? 'bg-yellow-200' : ''}>{part.text}</span>
                          {/each}
                        </td>
                      {/if}
                    {/each}
                    <td class="px-4 py-2 border-b">
                      <button
                        onclick={() => copyRowAsJson(row)}
                        class="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Copy row
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
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
            placeholder="Filter by endpoint, query, status, or note"
            class="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-200 rounded"
          />
          <div class="text-xs text-gray-600 flex items-center gap-3">
            <span>Total: {historySummary.total}</span>
            <span>✅ {historySummary.successCount}</span>
            <span>❌ {historySummary.errorCount}</span>
            <span>⚠️ {historySummary.invalidCount}</span>
            <span>⏹️ {historySummary.cancelledCount}</span>
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
          <button
            onclick={() => (historyStatusFilter = 'cancelled')}
            class="px-2 py-1 rounded border {historyStatusFilter === 'cancelled' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-gray-700 border-gray-200'}"
          >
            ⏹️ Cancelled
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
                          : entry.status === 'cancelled'
                            ? '⏹️'
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
                  {#if entry.note}
                    <p class="text-xs text-blue-600 mt-1">Note: {entry.note}</p>
                  {/if}
                  {#if entry.error}
                    <p class="text-xs text-red-500 mt-1">{entry.error}</p>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <button
                    onclick={() => toggleHistoryCompare(entry)}
                    class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                  >
                    {selectedHistoryIds.includes(entry.id) ? 'Compared' : 'Compare'}
                  </button>
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
                  <button
                    onclick={() => startNoteEdit(entry)}
                    class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                  >
                    {entry.note ? 'Edit note' : 'Add note'}
                  </button>
                </div>
              </div>
              {#if editingNoteId === entry.id}
                <div class="mt-3 border-t border-gray-200 pt-3">
                  <label
                    class="text-xs font-medium text-gray-600"
                    for={`history-note-${entry.id}`}
                  >
                    History note
                  </label>
                  <textarea
                    id={`history-note-${entry.id}`}
                    value={noteDrafts[entry.id] ?? ''}
                    oninput={(event) => updateNoteDraft(entry.id, event.target.value)}
                    rows="2"
                    class="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs"
                    placeholder="Add a short note to describe this request"
                  ></textarea>
                  <div class="mt-2 flex items-center gap-2">
                    <button
                      onclick={() => saveNote(entry)}
                      class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Save note
                    </button>
                    <button
                      onclick={cancelNoteEdit}
                      class="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        {/if}
      </ul>

      {#if historyDiff}
        <div class="border-t border-gray-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <p class="font-semibold text-slate-900">History diff summary</p>
          <p class="mt-1">Comparing selected entries: {historyDiff.leftId} ↔ {historyDiff.rightId}</p>
          <ul class="mt-2 grid gap-1 sm:grid-cols-2">
            <li>Query changed: {historyDiff.queryChanged ? 'Yes' : 'No'}</li>
            <li>Variables changed: {historyDiff.variablesChanged ? 'Yes' : 'No'}</li>
            <li>Endpoint changed: {historyDiff.endpointChanged ? 'Yes' : 'No'}</li>
            <li>Status changed: {historyDiff.statusChanged ? 'Yes' : 'No'}</li>
            <li>Result changed: {historyDiff.resultChanged ? 'Yes' : 'No'}</li>
            <li>Result line delta: {historyDiff.resultLineDelta}</li>
          </ul>
          <p class="mt-2 font-medium text-slate-800">Total changed dimensions: {historyDiff.changeCount}</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if storeState.logs?.length}
    <div class="mt-4 border border-gray-200 rounded">
      <div class="flex items-center justify-between px-4 py-2 bg-gray-50">
        <h3 class="text-sm font-semibold text-gray-800">Activity Log</h3>
        <div class="flex items-center gap-2 text-xs">
          <select
            value={logLevelFilter}
            onchange={(event) => (logLevelFilter = event.target.value)}
            class="border border-gray-200 rounded px-2 py-1 text-xs"
          >
            <option value="all">All levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button
            onclick={clearLogs}
            class="text-xs text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      </div>
      <ul class="divide-y divide-gray-200 max-h-40 overflow-auto text-xs">
        {#if filteredLogs.length === 0}
          <li class="px-4 py-3 text-gray-500">No log entries match the selected level.</li>
        {:else}
          {#each filteredLogs as entry}
            <li class="px-4 py-2">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-900">{entry.level}</span>
                    <span class="text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <p class="text-gray-700 mt-1">{entry.message}</p>
                  {#if entry.context && Object.keys(entry.context).length}
                    <pre class="mt-1 text-[11px] text-gray-500 whitespace-pre-wrap">{JSON.stringify(entry.context, null, 2)}</pre>
                  {/if}
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
              : storeState.lastExecution.status === 'cancelled'
                ? '⏹️'
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
