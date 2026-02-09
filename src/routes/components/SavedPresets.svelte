<script>
  import { onMount } from 'svelte';
  import { graphqlStore } from '../stores/graphql-store.js';

  let presetName = $state('');
  let savedPresets = $state([]);
  let hasLoaded = $state(false);

  $effect(() => {
    const unsubscribe = graphqlStore.subscribe((state) => {
      savedPresets = state.savedPresets ?? [];
    });
    return unsubscribe;
  });

  onMount(() => {
    graphqlStore.loadSavedPresets();
    hasLoaded = true;
  });

  function savePreset() {
    const trimmedName = presetName.trim();
    if (!trimmedName) return;
    graphqlStore.savePreset(trimmedName);
    presetName = '';
  }

  function loadPreset(preset) {
    graphqlStore.applyPreset(preset);
  }

  function deletePreset(preset) {
    graphqlStore.deletePreset(preset.id);
  }
</script>

<section class="mt-6 bg-white border border-gray-200 rounded p-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 class="text-sm font-semibold text-gray-900">Saved Workspaces</h3>
      <p class="text-xs text-gray-500">
        Store endpoint, query, and variables together for quick reloads.
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
      <input
        type="text"
        placeholder="Name this workspace"
        value={presetName}
        oninput={(event) => (presetName = event.target.value)}
        class="flex-1 sm:w-56 px-3 py-2 text-sm border border-gray-200 rounded"
      />
      <button
        onclick={savePreset}
        disabled={!presetName.trim()}
        class="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>
  </div>

  <div class="mt-4">
    {#if savedPresets.length === 0}
      <p class="text-xs text-gray-500">
        {hasLoaded
          ? 'No saved workspaces yet. Save one to quickly reload common setups.'
          : 'Loading saved workspaces…'}
      </p>
    {:else}
      <ul class="space-y-2">
        {#each savedPresets as preset}
          <li class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-gray-100 rounded px-3 py-2">
            <div>
              <p class="text-sm font-medium text-gray-800">{preset.name}</p>
              <p class="text-xs text-gray-500">{preset.endpoint || 'No endpoint set'}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                onclick={() => loadPreset(preset)}
                class="px-3 py-1 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Load
              </button>
              <button
                onclick={() => deletePreset(preset)}
                class="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Delete
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>
