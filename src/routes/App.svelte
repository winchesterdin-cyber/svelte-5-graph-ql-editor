<script>
  import QueryEditor from './components/QueryEditor.svelte';
  import VisualBuilder from './components/VisualBuilder.svelte';
  import VariablesEditor from './components/VariablesEditor.svelte';
  import ResultsPanel from './components/ResultsPanel.svelte';
  import SchemaExplorer from './components/SchemaExplorer.svelte';
  import ExampleQueries from './components/ExampleQueries.svelte';
  import { graphqlStore } from './stores/graphql-store.js';

  let activeTab = $state('editor');
  let showSchema = $state(false);
  let showMobileMenu = $state(false);
  let darkMode = $state(false);
  let endpoint = $state('');

  const tabs = [
    { id: 'editor', label: 'Query Editor' },
    { id: 'visual', label: 'Visual Builder' },
    { id: 'variables', label: 'Variables' },
    { id: 'results', label: 'Results' }
  ];

  $effect(() => {
    const unsubscribe = graphqlStore.subscribe((state) => {
      endpoint = state.endpoint;
    });
    return unsubscribe;
  });

  function switchTab(tabId) {
    activeTab = tabId;
    showMobileMenu = false;
  }

  function toggleSchema() {
    showSchema = !showSchema;
  }

  function toggleMobileMenu() {
    showMobileMenu = !showMobileMenu;
  }

  function toggleDarkMode() {
    darkMode = !darkMode;
  }

  function handleEndpointChange(event) {
    graphqlStore.updateEndpoint(event.target.value);
  }
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
        <div class="flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide">
          {#each tabs as tab}
            <button
              onclick={() => switchTab(tab.id)}
              class="py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200
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
      <div class="flex-1 p-4 sm:p-6 overflow-auto transition-colors duration-200 {darkMode ? 'bg-gray-900' : 'bg-gray-50'}">
        {#if activeTab === 'editor'}
          <QueryEditor {darkMode} />
        {:else if activeTab === 'visual'}
          <VisualBuilder {darkMode} />
        {:else if activeTab === 'variables'}
          <VariablesEditor {darkMode} />
        {:else if activeTab === 'results'}
          <ResultsPanel {darkMode} />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
