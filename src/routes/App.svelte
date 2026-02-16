<script>
  import QueryEditor from './components/QueryEditor.svelte';
  import { onMount } from 'svelte';
  import VisualBuilder from './components/VisualBuilder.svelte';
  import VariablesEditor from './components/VariablesEditor.svelte';
  import HeadersEditor from './components/HeadersEditor.svelte';
  import ResultsPanel from './components/ResultsPanel.svelte';
  import SchemaExplorer from './components/SchemaExplorer.svelte';
  import ExampleQueries from './components/ExampleQueries.svelte';
  import { graphqlStore } from './stores/graphql-store.js';
  import {
    DEFAULT_UI_PREFERENCES,
    parseUiPreferences,
    serializeUiPreferences
  } from './stores/ui-preferences.js';

  let activeTab = $state('editor');
  let showSchema = $state(false);
  let showMobileMenu = $state(false);
  let darkMode = $state(false);
  let endpoint = $state('');
  let headers = $state('{}');
  let endpointProfiles = $state([]);
  let showCommandPalette = $state(false);
  const ENDPOINT_PROFILES_STORAGE_KEY = 'graphql-editor-endpoint-profiles';
  const UI_PREFERENCES_STORAGE_KEY = 'graphql-editor-ui-preferences';

  const tabs = [
    { id: 'editor', label: 'Query Editor' },
    { id: 'visual', label: 'Visual Builder' },
    { id: 'variables', label: 'Variables' },
    { id: 'headers', label: 'Headers' },
    { id: 'results', label: 'Results' }
  ];

  $effect(() => {
    const unsubscribe = graphqlStore.subscribe((state) => {
      endpoint = state.endpoint;
      headers = state.headers;
    });
    return unsubscribe;
  });

  function switchTab(tabId) {
    activeTab = tabId;
    showMobileMenu = false;
    graphqlStore.logUiEvent('INFO', 'Switched main application tab', { tabId });
  }

  function toggleSchema() {
    showSchema = !showSchema;
    graphqlStore.logUiEvent('INFO', 'Toggled schema explorer visibility', { visible: showSchema });
  }

  function toggleMobileMenu() {
    showMobileMenu = !showMobileMenu;
  }

  function toggleDarkMode() {
    darkMode = !darkMode;
    graphqlStore.logUiEvent('INFO', 'Toggled theme preference', { darkMode });
  }

  /**
   * Persist frequently used shell preferences so the editor resumes in a familiar state.
   */
  function persistUiPreferences() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      UI_PREFERENCES_STORAGE_KEY,
      serializeUiPreferences({ activeTab, showSchema, darkMode })
    );
  }

  /**
   * Reset saved shell preferences while preserving endpoint/query workspace data.
   */
  function resetUiPreferences() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(UI_PREFERENCES_STORAGE_KEY);
    activeTab = DEFAULT_UI_PREFERENCES.activeTab;
    showSchema = DEFAULT_UI_PREFERENCES.showSchema;
    darkMode = DEFAULT_UI_PREFERENCES.darkMode;
    showCommandPalette = false;
    graphqlStore.logUiEvent('INFO', 'Reset UI preferences to defaults');
  }

  function handleEndpointChange(event) {
    graphqlStore.updateEndpoint(event.target.value);
  }

  function saveEndpointProfile() {
    const normalizedEndpoint = endpoint.trim();
    if (!normalizedEndpoint) return;
    const existingProfile = endpointProfiles.find((profile) => profile.endpoint === normalizedEndpoint);
    const nextIndex = endpointProfiles.length + 1;
    const profileName = existingProfile?.name ?? `Endpoint ${nextIndex}`;
    // Keep stable identifiers for existing profiles to avoid stale select references.
    const nextProfile = {
      id: existingProfile?.id ?? crypto.randomUUID(),
      name: profileName,
      endpoint: normalizedEndpoint,
      headers,
      savedAt: new Date().toISOString(),
    };
    const nextProfiles = existingProfile
      ? endpointProfiles.map((profile) => (profile.id === existingProfile.id ? nextProfile : profile))
      : [nextProfile, ...endpointProfiles].slice(0, 10);
    endpointProfiles = nextProfiles;
    localStorage.setItem(ENDPOINT_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
    graphqlStore.logUiEvent('INFO', 'Saved endpoint profile', {
      endpoint: normalizedEndpoint,
      hasHeaders: Boolean(headers?.trim() && headers.trim() !== '{}'),
      count: nextProfiles.length,
    });
  }

  function selectEndpointProfile(event) {
    const profileId = event.target.value;
    const profile = endpointProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    graphqlStore.updateEndpoint(profile.endpoint);
    graphqlStore.updateHeaders(profile.headers ?? '{}');
    graphqlStore.logUiEvent('INFO', 'Applied endpoint profile', {
      endpoint: profile.endpoint,
      hasHeaders: Boolean(profile.headers?.trim() && profile.headers.trim() !== '{}'),
    });
  }

  function removeEndpointProfile(profileId) {
    endpointProfiles = endpointProfiles.filter((profile) => profile.id !== profileId);
    localStorage.setItem(ENDPOINT_PROFILES_STORAGE_KEY, JSON.stringify(endpointProfiles));
    graphqlStore.logUiEvent('INFO', 'Removed endpoint profile', {
      remaining: endpointProfiles.length,
    });
  }

  function executeShortcutCommand(commandId) {
    if (commandId === 'switch-editor-tab') switchTab('editor');
    if (commandId === 'switch-results-tab') switchTab('results');
    if (commandId === 'toggle-schema') toggleSchema();
    if (commandId === 'toggle-theme') toggleDarkMode();
    if (commandId === 'save-endpoint') saveEndpointProfile();
    showCommandPalette = false;
  }

  onMount(() => {
    const savedUiPreferences = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    const parsedUiPreferences = parseUiPreferences(savedUiPreferences, tabs);
    activeTab = parsedUiPreferences.activeTab;
    showSchema = parsedUiPreferences.showSchema;
    darkMode = parsedUiPreferences.darkMode;

    const savedProfiles = localStorage.getItem(ENDPOINT_PROFILES_STORAGE_KEY);
    if (savedProfiles) {
      try {
        endpointProfiles = JSON.parse(savedProfiles);
      } catch {
        endpointProfiles = [];
      }
    }

    const handleTogglePalette = () => {
      showCommandPalette = !showCommandPalette;
    };

    const handleKeyboardShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        showCommandPalette = !showCommandPalette;
        return;
      }

      if (event.key === 'Escape' && showCommandPalette) {
        event.preventDefault();
        showCommandPalette = false;
      }
    };

    window.addEventListener('graphql-command-palette:toggle', handleTogglePalette);
    window.addEventListener('keydown', handleKeyboardShortcut);

    return () => {
      window.removeEventListener('graphql-command-palette:toggle', handleTogglePalette);
      window.removeEventListener('keydown', handleKeyboardShortcut);
    };
  });

  $effect(() => {
    persistUiPreferences();
  });
</script>

<div class="min-h-screen transition-colors duration-200 {darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}">
  <!-- Header -->
  <header class="border-b px-4 sm:px-6 py-3 sm:py-4 transition-colors duration-200 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2 sm:space-x-4">
        <h1 class="text-lg sm:text-2xl font-bold transition-colors duration-200 {darkMode ? 'text-white' : 'text-gray-900'}">GraphQL Visualizer</h1>
        <!-- Hide endpoint input on mobile, show on larger screens -->
        <div class="hidden md:flex items-center space-x-2">
          <span class="text-sm transition-colors duration-200 {darkMode ? 'text-gray-400' : 'text-gray-500'}">Endpoint:</span>
          <input 
            type="text" 
            value={endpoint}
            oninput={handleEndpointChange}
            placeholder="https://api.example.com/graphql"
            class="px-3 py-1 border rounded text-sm w-64 transition-colors duration-200 {darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
          />
          <button
            onclick={saveEndpointProfile}
            class="px-2 py-1 rounded bg-indigo-500 text-white text-xs hover:bg-indigo-600"
          >
            Save
          </button>
          {#if endpointProfiles.length}
            <select
              onchange={selectEndpointProfile}
              class="px-2 py-1 border rounded text-xs {darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}"
            >
              <option value="">Saved endpoints</option>
              {#each endpointProfiles as profile}
                <option value={profile.id}>{profile.name}</option>
              {/each}
            </select>
          {/if}
        </div>
      </div>
      
      <!-- Mobile menu button and desktop controls -->
      <div class="flex items-center space-x-2">
        <!-- Dark mode toggle button -->
        <button 
          onclick={toggleDarkMode}
          class="p-2 rounded transition-colors duration-200 {darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
          aria-label="Toggle dark mode"
        >
          {#if darkMode}
            <!-- Sun icon for light mode -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
          {:else}
            <!-- Moon icon for dark mode -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
            </svg>
          {/if}
        </button>
        
        <!-- Mobile menu button -->
        <button 
          onclick={toggleMobileMenu}
          class="md:hidden p-2 rounded transition-colors duration-200 {darkMode ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
          aria-label="Toggle menu"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        
        <!-- Desktop controls -->
        <div class="hidden md:flex items-center space-x-2">
          <button 
            onclick={toggleSchema}
            class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors duration-200"
          >
            {showSchema ? 'Hide' : 'Show'} Schema
          </button>
          <button
            onclick={resetUiPreferences}
            class="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-colors duration-200"
          >
            Reset UI
          </button>
          <ExampleQueries />
        </div>
      </div>
    </div>
    
    <!-- Mobile menu dropdown -->
    {#if showMobileMenu}
      <div class="md:hidden mt-3 pt-3 border-t transition-colors duration-200 {darkMode ? 'border-gray-700' : 'border-gray-200'}">
        <div class="space-y-3">
          <!-- Mobile endpoint input -->
          <div class="flex flex-col space-y-1">
            <span class="text-sm transition-colors duration-200 {darkMode ? 'text-gray-400' : 'text-gray-500'}">Endpoint:</span>
            <input 
              type="text" 
              value={endpoint}
              oninput={handleEndpointChange}
              placeholder="https://api.example.com/graphql"
              class="px-3 py-2 border rounded text-sm w-full transition-colors duration-200 {darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
            />
          </div>
          
          <!-- Mobile controls -->
          <div class="flex flex-col sm:flex-row gap-2">
            <button 
              onclick={toggleSchema}
              class="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors duration-200"
            >
              {showSchema ? 'Hide' : 'Show'} Schema
            </button>
            <ExampleQueries />
          </div>
        </div>
      </div>
    {/if}
  </header>

  <!-- Responsive layout with mobile-friendly sidebar -->
  <div class="flex flex-col md:flex-row h-[calc(100vh-80px)] md:h-[calc(100vh-80px)]">
    <!-- Schema Explorer Sidebar -->
    {#if showSchema}
      <!-- Mobile overlay sidebar, desktop fixed sidebar -->
      <div class="md:w-80 border-b md:border-b-0 md:border-r overflow-y-auto transition-colors duration-200
                  {showSchema ? 'block' : 'hidden'} 
                  md:block
                  fixed md:relative inset-0 md:inset-auto z-50 md:z-auto
                  md:h-auto h-full
                  {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
        <!-- Mobile close button for schema -->
        <div class="md:hidden flex justify-between items-center p-4 border-b transition-colors duration-200 {darkMode ? 'border-gray-700' : 'border-gray-200'}">
          <h2 class="text-lg font-semibold transition-colors duration-200 {darkMode ? 'text-white' : 'text-gray-900'}">Schema Explorer</h2>
          <button 
            onclick={toggleSchema}
            class="p-1 rounded transition-colors duration-200 {darkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
            aria-label="Close schema"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <SchemaExplorer {darkMode} />
      </div>
    {/if}

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Tab Navigation -->
      <!-- Responsive tab navigation with horizontal scroll on mobile -->
      <nav class="border-b px-4 sm:px-6 transition-colors duration-200 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
        <div
          role="tablist"
          aria-label="Application views"
          class="flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide"
        >
          {#each tabs as tab}
            <button
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onclick={() => switchTab(tab.id)}
              class="py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                     {activeTab === tab.id 
                       ? 'border-blue-500 text-blue-600' 
                       : darkMode 
                         ? 'border-transparent text-gray-400 hover:text-gray-200' 
                         : 'border-transparent text-gray-500 hover:text-gray-700'}"
            >
              {tab.label}
            </button>
          {/each}
        </div>
      </nav>

      <!-- Tab Content -->
      <!-- Responsive padding and overflow handling -->
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        class="flex-1 p-4 sm:p-6 overflow-auto transition-colors duration-200 {darkMode ? 'bg-gray-900' : 'bg-gray-50'}"
      >
        {#if activeTab === 'editor'}
          <QueryEditor {darkMode} />
        {:else if activeTab === 'visual'}
          <VisualBuilder {darkMode} />
        {:else if activeTab === 'variables'}
          <VariablesEditor {darkMode} />
        {:else if activeTab === 'headers'}
          <HeadersEditor {darkMode} />
        {:else if activeTab === 'results'}
          <ResultsPanel {darkMode} />
        {/if}
      </div>
    </div>
  </div>
</div>

{#if showCommandPalette}
  <div class="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-20">
    <button
      type="button"
      class="absolute inset-0 bg-black/40"
      aria-label="Close command palette"
      onclick={() => (showCommandPalette = false)}
    ></button>
    <div
      class="relative w-full max-w-lg rounded border border-gray-200 bg-white p-4 shadow-xl"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-900">Command Palette</h2>
        <button
          class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          onclick={() => (showCommandPalette = false)}
        >
          Close
        </button>
      </div>
      <p class="mt-1 text-xs text-gray-500">Use quick commands and shortcuts for frequent actions.</p>
      <ul class="mt-3 space-y-2 text-sm">
        <li><button onclick={() => executeShortcutCommand('switch-editor-tab')} class="w-full rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">Open Query Editor tab</button></li>
        <li><button onclick={() => executeShortcutCommand('switch-results-tab')} class="w-full rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">Open Results tab</button></li>
        <li><button onclick={() => executeShortcutCommand('toggle-schema')} class="w-full rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">Toggle Schema Explorer</button></li>
        <li><button onclick={() => executeShortcutCommand('toggle-theme')} class="w-full rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">Toggle Light/Dark Theme</button></li>
        <li><button onclick={() => executeShortcutCommand('save-endpoint')} class="w-full rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50">Save Current Endpoint Profile</button></li>
      </ul>
      {#if endpointProfiles.length}
        <div class="mt-4 border-t pt-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Endpoint manager</p>
          <ul class="mt-2 space-y-2">
            {#each endpointProfiles as profile}
              <li class="flex items-center justify-between gap-2 rounded border border-gray-200 px-2 py-1 text-xs">
                <span class="truncate">{profile.endpoint}</span>
                <button onclick={() => removeEndpointProfile(profile.id)} class="rounded bg-red-100 px-2 py-0.5 text-red-700 hover:bg-red-200">Remove</button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
