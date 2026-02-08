<script>
  import FieldRenderer from './FieldRenderer.svelte';
  import { graphqlStore } from '../stores/graphql-store.js';
  

  let { 
    field, 
    typeName, 
    selectedFields, 
    expandedFields, 
    depth = 0,
    onFieldToggle,
    onExpandToggle 
  } = $props();


  // Get the base type (unwrap NonNull and List wrappers)
  function getBaseType(type) {
    if (!type) return null;
    
    if (type.kind === 'NON_NULL' || type.kind === 'LIST') {
      return getBaseType(type.ofType);
    }
    return type;
  }

  // Check if field type is an object that can be expanded
  function isExpandableType(type) {
    const baseType = getBaseType(type);
    const result = baseType && baseType.kind === 'OBJECT';
    return result;
  }

  // Get fields for a type from schema
  function getFieldsForType(typeName) {
    const storeValue = graphqlStore.getState();
    const type = storeValue.schema?.types?.find(t => t.name === typeName);
    return type?.fields || [];
  }

  // Format field type for display
  function formatFieldType(type) {
    if (!type) return 'Unknown';
    
    if (type.kind === 'NON_NULL') {
      return formatFieldType(type.ofType) + '!';
    }
    if (type.kind === 'LIST') {
      return '[' + formatFieldType(type.ofType) + ']';
    }
    return type.name || type.kind;
  }

  // Handle field selection toggle
  function handleFieldToggle() {
    onFieldToggle?.(field.name);
  }

  // Handle expand/collapse toggle
  function handleExpandToggle() {
    onExpandToggle?.(field.name);
  }

  // Handle arguments expand/collapse
  function handleArgumentsToggle() {
    onExpandToggle?.(`${field.name}:args`);
  }

  // Format argument type and default value
  function formatArgument(arg) {
    const type = formatFieldType(arg.type);
    const defaultValue = arg.defaultValue ? ` = ${arg.defaultValue}` : '';
    return `${arg.name}: ${type}${defaultValue}`;
  }

  const baseType = $derived(getBaseType(field.type));
  const canExpand = $derived(isExpandableType(field.type));
  const subFields = $derived(canExpand ? getFieldsForType(baseType?.name) : []);
  const isSelected = $derived(selectedFields.has(field.name));
  const isExpanded = $derived(expandedFields.has(field.name));
  const hasArguments = $derived(field.args && field.args.length > 0);
  const argumentsExpanded = $derived(expandedFields.has(`${field.name}:args`));
  
  // Check if we should show the field as expandable (has sub-fields or arguments)
  const shouldShowExpander = $derived(canExpand || hasArguments);
  const hasAnyExpanded = $derived(isExpanded || argumentsExpanded);

</script>

<div class="relative">
  <!-- Tree connection lines -->
  {#if depth > 0}
    <div class="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-gray-200 rounded-bl-md"></div>
    <div class="absolute left-0 top-6 bottom-0 w-0 border-l-2 border-gray-200"></div>
  {/if}

  <div
    class="field-item flex items-start gap-2 py-1 relative"
    style={`padding-left: ${depth * 1.5}rem;`}
  >
    <!-- Tree connector -->
    {#if depth > 0}
      <div
        class="absolute top-0 w-4 h-6 border-l-2 border-gray-200"
        style={`left: ${(depth - 1) * 1.5 + 0.5}rem;`}
      ></div>
    {/if}

    <!-- Expand/Collapse Button -->
    {#if shouldShowExpander}
      <button
        onclick={handleExpandToggle}
        class="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors bg-white border border-gray-300 rounded-sm mt-0.5"
        title={hasAnyExpanded ? 'Collapse' : 'Expand'}
      >
        {#if hasAnyExpanded}
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
        {:else}
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        {/if}
      </button>
    {:else}
      <div class="w-5 h-5 flex items-center justify-center mt-0.5">
        <div class="w-2 h-2 bg-gray-300 rounded-full"></div>
      </div>
    {/if}

    <!-- Field Checkbox -->
    <input
      type="checkbox"
      checked={isSelected}
      onchange={handleFieldToggle}
      class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
    />

    <!-- Field Content -->
    <div class="flex-1 min-w-0">
      <!-- Field Name and Type -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-medium text-gray-900">{field.name}</span>
          {#if hasArguments}
            <span class="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
              {field.args.length} arg{field.args.length !== 1 ? 's' : ''}
            </span>
          {/if}
        </div>
        <span class="text-sm text-gray-500 ml-2 font-mono">{formatFieldType(field.type)}</span>
      </div>

      <!-- Field Description -->
      {#if field.description}
        <div class="text-xs text-gray-600 mt-1 italic">{field.description}</div>
      {/if}
    </div>
  </div>

  <!-- Arguments Section -->
  {#if hasArguments && (isExpanded || argumentsExpanded)}
    <div class="relative" style={`margin-left: ${(depth + 1) * 1.5}rem;`}>
      <!-- Arguments Header -->
      <div class="flex items-center gap-2 py-1 text-sm text-gray-700">
        <button
          onclick={handleArgumentsToggle}
          class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          {#if argumentsExpanded}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          {:else}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          {/if}
        </button>
        <span class="font-medium text-purple-700">Arguments</span>
      </div>

      <!-- Arguments List -->
      {#if argumentsExpanded}
        <div class="ml-6 border-l-2 border-purple-200 pl-4">
          {#each field.args as arg (arg.name)}
            <div class="flex items-center gap-2 py-1">
              <div class="w-3 h-3 bg-purple-300 rounded-full"></div>
              <span class="font-mono text-sm text-gray-800">{formatArgument(arg)}</span>
              {#if arg.description}
                <span class="text-xs text-gray-500 italic">- {arg.description}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Recursive nested fields -->
  {#if canExpand && isExpanded && subFields.length > 0}
    <div class="relative" style={`margin-left: ${(depth + 1) * 1.5}rem;`}>
      <!-- Sub-fields Header -->
      <div class="flex items-center gap-2 py-1 text-sm text-green-700">
        <div class="w-4 h-4 flex items-center justify-center">
          <div class="w-2 h-2 bg-green-400 rounded-full"></div>
        </div>
        <span class="font-medium">Fields</span>
      </div>

      <!-- Sub-fields List -->
      <div class="border-l-2 border-green-200 pl-2">
        {#each subFields as subField (subField.name)}
          <FieldRenderer
            field={subField}
            typeName={baseType?.name}
            {selectedFields}
            {expandedFields}
            depth={depth + 1}
            {onFieldToggle}
            {onExpandToggle}
          />
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .field-item {
    transition: all 0.2s ease;
  }
  
  .field-item:hover {
    background-color: rgba(59, 130, 246, 0.05);
    border-radius: 4px;
  }

</style>
