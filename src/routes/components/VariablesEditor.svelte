<script>
  import { graphqlStore } from '../stores/graphql-store.js';
  import { LEVELS } from '../stores/logger.js';
  import { getVariableDefinitions } from './editor-intelligence.js';

  let variables = $state('{}');
  let query = $state('');
  let isValidJson = $state(true);
  let parsedVariables = $state({});
  let jsonError = $state('');
  let schema = $state(null);

  const unsubscribe = graphqlStore.subscribe((state) => {
    variables = state.variables;
    query = state.query;
    schema = state.schema;
    validateAndParseJson();
  });

  const variableHints = $derived(() => {
    const definitions = getVariableDefinitions(query);
    return Object.entries(definitions).map(([name, type]) => ({
      name,
      type,
      hasValue: Object.prototype.hasOwnProperty.call(parsedVariables ?? {}, name),
    }));
  });

  function handleVariablesChange(event) {
    const newVariables = event.target.value;
    variables = newVariables;
    validateAndParseJson();
    graphqlStore.updateVariables(newVariables);
  }

  function validateAndParseJson() {
    try {
      parsedVariables = JSON.parse(variables);
      isValidJson = true;
      jsonError = '';
    } catch (error) {
      isValidJson = false;
      jsonError = error.message;
    }
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(variables);
      const formatted = JSON.stringify(parsed, null, 2);
      graphqlStore.updateVariables(formatted);
      jsonError = '';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Formatted variables JSON');
    } catch (error) {
      jsonError = error.message;
      graphqlStore.logUiEvent(LEVELS.WARN, 'Failed to format variables JSON', {
        error: error.message,
      });
    }
  }

  /**
   * Add a typed variable to the JSON editor payload.
   * This keeps users in valid JSON state while using the visual form controls.
   */
  function addVariable(name, value) {
    try {
      const current = JSON.parse(variables);
      current[name] = value;
      const updated = JSON.stringify(current, null, 2);
      graphqlStore.updateVariables(updated);
      jsonError = '';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Added variable', {
        name,
        type: typeof value,
      });
    } catch (error) {
      jsonError = error.message;
    }
  }

  function removeVariable(name) {
    try {
      const current = JSON.parse(variables);
      delete current[name];
      const updated = JSON.stringify(current, null, 2);
      graphqlStore.updateVariables(updated);
      jsonError = '';
      graphqlStore.logUiEvent(LEVELS.INFO, 'Removed variable', { name });
    } catch (error) {
      jsonError = error.message;
    }
  }

  function handleAddVariable() {
    const nameEl = document.getElementById('newVarName');
    const typeEl = document.getElementById('newVarType');
    const valueEl = document.getElementById('newVarValue');

    if (!nameEl || !typeEl || !valueEl) return;

    const name = nameEl.value;
    const type = typeEl.value;
    const valueInput = valueEl.value;

    let value;
    try {
      if (type === 'number') {
        value = Number(valueInput);
      } else if (type === 'boolean') {
        value = valueInput.toLowerCase() === 'true';
      } else if (type === 'array' || type === 'object') {
        value = JSON.parse(valueInput);
      } else {
        value = valueInput;
      }

      if (name) {
        addVariable(name, value);
        nameEl.value = '';
        valueEl.value = '';
      }
    } catch (error) {
      jsonError = error.message;
    }
  }
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-lg font-semibold text-gray-900">Query Variables</h2>
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

  {#if variableHints.length}
    <div class="mb-3 rounded border border-blue-100 bg-blue-50 p-3 text-xs">
      <p class="font-semibold text-blue-900">Variable schema hints</p>
      <ul class="mt-2 space-y-1">
        {#each variableHints as hint}
          <li class="text-blue-800">
            <code>${hint.name}</code> → <strong>{hint.type}</strong>
            <span class={hint.hasValue ? 'text-emerald-700' : 'text-amber-700'}>
              ({hint.hasValue ? 'value provided' : 'missing value'})
            </span>
          </li>
        {/each}
      </ul>
      {#if schema}
        <p class="mt-2 text-[11px] text-blue-700">Hints are inferred from operation signatures in the current query and validated against JSON object shape.</p>
      {/if}
    </div>
  {/if}

  <div class="flex-1 flex space-x-4">
    <div class="flex-1 flex flex-col">
      <h3 class="text-md font-medium mb-2">JSON Editor</h3>
      <div class="flex-1 border border-gray-300 rounded" class:border-red-500={!isValidJson}>
        <textarea
          bind:value={variables}
          oninput={handleVariablesChange}
          placeholder="Enter JSON variables here"
          class="w-full h-full p-4 font-mono text-sm resize-none border-none outline-none"
        ></textarea>
      </div>
      {#if !isValidJson && jsonError}
        <p class="mt-2 text-xs text-red-600">JSON error: {jsonError}</p>
      {/if}
    </div>

    <div class="flex-1 flex flex-col">
      <h3 class="text-md font-medium mb-2">Visual Editor</h3>
      <div class="flex-1 bg-gray-50 border border-gray-300 rounded p-4 overflow-y-auto">
        {#if isValidJson}
          <div class="space-y-3">
            {#each Object.entries(parsedVariables) as [key, value]}
              <div class="bg-white p-3 rounded border">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-gray-900">{key}</span>
                  <button
                    onclick={() => removeVariable(key)}
                    class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Type:</span> {typeof value}
                </div>
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Value:</span>
                  <code class="bg-gray-100 px-1 rounded">{JSON.stringify(value)}</code>
                </div>
              </div>
            {/each}

            <div class="bg-white p-3 rounded border border-dashed border-gray-300">
              <h4 class="font-medium mb-2">Add Variable</h4>
              <div class="space-y-2">
                <input
                  type="text"
                  placeholder="Variable name"
                  class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  id="newVarName"
                />
                <select
                  class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  id="newVarType"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="array">Array</option>
                  <option value="object">Object</option>
                </select>
                <input
                  type="text"
                  placeholder="Value"
                  class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  id="newVarValue"
                />
                <button
                  onclick={handleAddVariable}
                  class="w-full px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  Add Variable
                </button>
              </div>
            </div>
          </div>
        {:else}
          <div class="text-center text-gray-500 mt-8">
            <p>Fix JSON syntax to use visual editor</p>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="mt-4 text-sm text-gray-600">
    <p>💡 <strong>Tips:</strong></p>
    <ul class="list-disc list-inside space-y-1 mt-2">
      <li>Variables must be valid JSON format</li>
      <li>Use the visual editor to add/remove variables easily</li>
      <li>Variables are referenced in queries using $ syntax</li>
      <li>Click Format to auto-indent your JSON</li>
      <li>Check variable schema hints to confirm expected GraphQL types</li>
    </ul>
  </div>
</div>
