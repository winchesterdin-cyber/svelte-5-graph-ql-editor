<script>
  import { onDestroy } from 'svelte';
  import { graphqlStore } from '../stores/graphql-store.js';
  import { LEVELS } from '../stores/logger.js';

  let headers = $state('{}');
  let isValidJson = $state(true);
  let parsedHeaders = $state({});
  let jsonError = $state('');
  let newHeaderName = $state('');
  let newHeaderValue = $state('');

  const unsubscribe = graphqlStore.subscribe((state) => {
    headers = state.headers;
    validateAndParseJson();
  });

  onDestroy(() => {
    unsubscribe();
  });

  function handleHeadersChange(event) {
    const newHeaders = event.target.value;
    headers = newHeaders;
    validateAndParseJson();
    graphqlStore.updateHeaders(newHeaders);
  }

  /**
   * Validate header JSON and enforce a simple object shape for safe fetch usage.
   * This prevents accidental array payloads or nested structures in headers.
   */
  function validateAndParseJson() {
    try {
      const parsed = JSON.parse(headers || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        isValidJson = false;
        jsonError = 'Headers must be a JSON object.';
        return;
      }

      parsedHeaders = parsed;
      isValidJson = true;
      jsonError = '';
    } catch (error) {
      isValidJson = false;
      jsonError = error.message;
    }
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(headers || '{}');
      const formatted = JSON.stringify(parsed, null, 2);
      graphqlStore.updateHeaders(formatted);
      jsonError = '';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Formatted request headers');
    } catch (error) {
      jsonError = error.message;
      graphqlStore.logUiEvent(LEVELS.WARN, 'Failed to format request headers', {
        error: error.message
      });
    }
  }

  function addHeader(name, value) {
    try {
      const current = JSON.parse(headers || '{}');
      current[name] = value;
      const updated = JSON.stringify(current, null, 2);
      graphqlStore.updateHeaders(updated);
      jsonError = '';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Added request header', {
        headerName: name
      });
    } catch (error) {
      jsonError = error.message;
      graphqlStore.logUiEvent(LEVELS.WARN, 'Failed to add request header', {
        error: error.message
      });
    }
  }

  function removeHeader(name) {
    try {
      const current = JSON.parse(headers || '{}');
      delete current[name];
      const updated = JSON.stringify(current, null, 2);
      graphqlStore.updateHeaders(updated);
      jsonError = '';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Removed request header', {
        headerName: name
      });
    } catch (error) {
      jsonError = error.message;
      graphqlStore.logUiEvent(LEVELS.WARN, 'Failed to remove request header', {
        error: error.message
      });
    }
  }

  function handleAddHeader() {
    const name = newHeaderName.trim();
    if (!name) {
      jsonError = 'Header name is required.';
      return;
    }

    addHeader(name, newHeaderValue);
    newHeaderName = '';
    newHeaderValue = '';
  }

  function applyHeaderSuggestion(name, value) {
    addHeader(name, value);
  }
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-900">Request Headers</h2>
    <div class="flex items-center space-x-2">
      <div class="flex items-center space-x-2">
        <div class="w-3 h-3 rounded-full" class:bg-green-500={isValidJson} class:bg-red-500={!isValidJson}></div>
        <span class="text-sm" class:text-green-600={isValidJson} class:text-red-600={!isValidJson}>
          {isValidJson ? 'Valid JSON' : 'Invalid JSON'}
        </span>
      </div>
      <button
        onclick={formatJson}
        disabled={!isValidJson}
        class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Format
      </button>
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <div class="bg-white border border-gray-200 rounded p-3">
      <p class="text-xs text-gray-500">
        Add authorization or API key headers to reuse across requests. Header values are sent with every query execution.
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          onclick={() => applyHeaderSuggestion('Authorization', 'Bearer <token>')}
          class="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Add Authorization
        </button>
        <button
          onclick={() => applyHeaderSuggestion('X-API-Key', '<api-key>')}
          class="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
        >
          Add API Key
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col">
      <h3 class="text-md font-medium mb-2">JSON Editor</h3>
      <div class="flex-1 border border-gray-300 rounded" class:border-red-500={!isValidJson}>
        <textarea
          bind:value={headers}
          oninput={handleHeadersChange}
          placeholder={`{\n  \"Authorization\": \"Bearer <token>\"\n}`}
          class="w-full h-48 p-4 font-mono text-sm resize-none border-none outline-none"
        ></textarea>
      </div>
      {#if !isValidJson && jsonError}
        <p class="mt-2 text-xs text-red-600">JSON error: {jsonError}</p>
      {/if}
    </div>

    <div class="flex-1 flex flex-col">
      <h3 class="text-md font-medium mb-2">Header List</h3>
      <div class="bg-gray-50 border border-gray-300 rounded p-4 overflow-y-auto">
        {#if isValidJson}
          <div class="space-y-3">
            {#each Object.entries(parsedHeaders) as [key, value]}
              <div class="bg-white p-3 rounded border">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-gray-900">{key}</span>
                  <button
                    onclick={() => removeHeader(key)}
                    class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Value:</span>
                  <code class="bg-gray-100 px-1 rounded">{String(value)}</code>
                </div>
              </div>
            {/each}

            <div class="bg-white p-3 rounded border border-dashed border-gray-300">
              <h4 class="font-medium mb-2">Add Header</h4>
              <div class="space-y-2">
                <input
                  type="text"
                  placeholder="Header name"
                  class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  bind:value={newHeaderName}
                />
                <input
                  type="text"
                  placeholder="Header value"
                  class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  bind:value={newHeaderValue}
                />
                <button
                  onclick={handleAddHeader}
                  class="w-full px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  Add Header
                </button>
              </div>
            </div>
          </div>
        {:else}
          <div class="text-center text-gray-500 mt-8">
            <p>Fix JSON syntax to edit headers visually</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
