<script>
  import { graphqlStore } from '../stores/graphql-store.js';


  let { darkMode = false } = $props();

  let currentOperation = $state(null);
  let currentSchema = $state(null);
  let availableSchemas = $state({});
  let showFieldSelector = $state(false);
  let showArgSelector = $state(false);
  let currentFieldContext = $state(null);
  
  let draggedItem = null;
  let hoveredField = $state(null);
  let selectedFields = $state(new Set());
  let showQuickAdd = null;
  let searchTerm = $state('');

  $effect(() => {
    const unsubscribe = graphqlStore.subscribe(state => {
      
      // Update current operation from queryStructure when text editor changes
      if (state.queryStructure && state.queryStructure.operations.length > 0) {
        const activeOp = state.queryStructure.operations[state.queryStructure.activeOperationIndex];
        if (activeOp && (!currentOperation || JSON.stringify(currentOperation) !== JSON.stringify(activeOp))) {
          currentOperation = { ...activeOp };
        }
      }
      
      currentSchema = state.schema;
      availableSchemas = state.availableSchemas;
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  function updateCurrentOperation() {
    graphqlStore.updateCurrentOperation(currentOperation);
    
    // Rebuild query text from visual structure
    const queryText = buildQueryFromStructure(currentOperation);
    graphqlStore.updateQuery(queryText);
  }

  function buildQueryFromStructure(operation) {
    if (!operation) return '';
    
    let query = `${operation.type}`;
    if (operation.name && operation.name !== 'UnnamedOperation') {
      query += ` ${operation.name}`;
    }
    
    // Add variables
    if (operation.variables && operation.variables.length > 0) {
      const vars = operation.variables.map(v => `$${v.name}: ${v.type}`).join(', ');
      query += `(${vars})`;
    }
    
    query += ' {\n';
    query += buildFieldsString(operation.fields, 1);
    query += '}';
    
    return query;
  }

  function buildFieldsString(fields, indent = 0) {
    if (!fields || fields.length === 0) return '';
    
    const indentStr = '  '.repeat(indent);
    let result = '';
    
    for (const field of fields) {
      result += indentStr + field.name;
      
      // Add arguments
      if (field.args && field.args.length > 0) {
        const args = field.args.map(arg => `${arg.name}: ${arg.value}`).join(', ');
        result += `(${args})`;
      }
      
      // Add nested fields
      if (field.fields && field.fields.length > 0) {
        result += ' {\n';
        result += buildFieldsString(field.fields, indent + 1);
        result += indentStr + '}';
      }
      
      result += '\n';
    }
    
    return result;
  }

  function addField(parentFields = currentOperation?.fields || [], typeName = 'Query', fieldPath = []) {
    
    if (currentSchema) {
      const availableFields = graphqlStore.getValidFieldsForType(typeName);
      if (availableFields.length > 0) {
        currentFieldContext = { parentFields, typeName, fieldPath };
        showFieldSelector = true;
        return;
      }
    }
    
    // Only allow if no schema is loaded (for manual editing)
    if (!currentSchema) {
      parentFields.push(createNewField());
      updateCurrentOperation();
    }
  }

  function addFieldFromSchema(field, parentFields) {
    // Validate field is supported
    const typeName = currentFieldContext?.typeName || 'Query';
    if (!graphqlStore.isValidField(typeName, field.name)) {
      return;
    }
    
    const fieldArgs = field.args?.map(arg => createNewArgument(arg.name, arg.type.name)) || [];
    const newField = createNewField(field.name, fieldArgs);
    newField.returnType = field.type.name;
    parentFields.push(newField);
    showFieldSelector = false;
    currentFieldContext = null;
    updateCurrentOperation();
  }

  function addArgument(field, parentTypeName = 'Query') {
    
    if (currentSchema) {
      const availableArgs = graphqlStore.getValidArgsForField(parentTypeName, field.name);
      if (availableArgs.length > 0) {
        currentFieldContext = { field, parentTypeName };
        showArgSelector = true;
        return;
      }
    }
    
    // Only allow if no schema is loaded (for manual editing)
    if (!currentSchema) {
      field.args.push(createNewArgument());
      updateCurrentOperation();
    }
  }

  function addArgumentFromSchema(arg, field) {
    
    // Validate argument is supported
    const typeName = currentFieldContext?.parentTypeName || 'Query';
    if (!graphqlStore.isValidArgument(typeName, field.name, arg.name)) {
      return;
    }
    
    field.args.push(createNewArgument(arg.name, arg.type.name));
    showArgSelector = false;
    currentFieldContext = null;
    updateCurrentOperation();
  }

  function addOperation(type = 'query') {
    graphqlStore.addOperation(type);
  }

  function removeOperation(index) {
    graphqlStore.removeOperation(index);
  }

  function setActiveOperation(index) {
    graphqlStore.setActiveOperation(index);
  }

  function createNewField(fieldName = 'newField', fieldArgs = []) {
    return {
      name: fieldName,
      args: fieldArgs,
      fields: [],
      expanded: true
    };
  }

  function createNewArgument(argName = 'newArg', argType = 'String') {
    return {
      name: argName,
      value: argType.includes('!') ? `$${argName}` : 'value',
      type: argType
    };
  }

  function createNewVariable() {
    return {
      name: 'newVar',
      type: 'String',
      defaultValue: null
    };
  }

  function removeField(parentFields, index) {
    parentFields.splice(index, 1);
    updateCurrentOperation();
  }

  function removeArgument(field, argIndex) {
    field.args.splice(argIndex, 1);
    updateCurrentOperation();
  }

  function toggleFieldExpansion(field) {
    field.expanded = !field.expanded;
    updateCurrentOperation();
  }

  function selectSchema(schemaKey) {
    graphqlStore.loadDemoSchema(schemaKey);
  }

  function duplicateField(field, parentFields) {
    const duplicated = JSON.parse(JSON.stringify(field));
    duplicated.name = `${field.name}Copy`;
    parentFields.push(duplicated);
    updateCurrentOperation();
  }

  function moveField(fromIndex, toIndex, parentFields) {
    const [movedField] = parentFields.splice(fromIndex, 1);
    parentFields.splice(toIndex, 0, movedField);
    updateCurrentOperation();
  }

  function bulkRemoveFields() {
    // Implementation for bulk operations
    selectedFields = new Set();
    updateCurrentOperation();
  }

  function handleKeydown(event, context) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      if (context.type === 'field') {
        addField(context.parentFields, context.typeName, context.fieldPath);
      } else if (context.type === 'arg') {
        addArgument(context.field, context.parentTypeName);
      }
    } else if (event.key === 'Delete' && event.ctrlKey) {
      event.preventDefault();
      if (context.type === 'field') {
        removeField(context.parentFields, context.index);
      }
    } else if (event.key === 'd' && event.ctrlKey) {
      event.preventDefault();
      if (context.type === 'field') {
        duplicateField(context.field, context.parentFields);
      }
    }
  }

  function handleDragStart(event, field, index, parentFields) {
    draggedItem = { field, index, parentFields };
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(event, targetIndex, targetParentFields) {
    event.preventDefault();
    if (draggedItem && draggedItem.parentFields === targetParentFields) {
      moveField(draggedItem.index, targetIndex, targetParentFields);
    }
    draggedItem = null;
  }

  function handleOperationTypeChange(event) {
    if (currentOperation) {
      currentOperation.type = event.target.value;
      updateCurrentOperation();
    }
  }

  function handleOperationNameInput(event) {
    if (currentOperation) {
      currentOperation.name = event.target.value;
      updateCurrentOperation();
    }
  }

  function handleVariableNameInput(variable, event) {
    variable.name = event.target.value;
    updateCurrentOperation();
  }

  function handleVariableTypeChange(variable, event) {
    variable.type = event.target.value;
    updateCurrentOperation();
  }
</script>

<div class="h-full overflow-y-auto transition-colors duration-200 {darkMode ? 'text-white' : 'text-gray-900'}">
  <div class="space-y-6">
    <!-- Added keyboard shortcuts help -->
    <div class="p-3 rounded-lg border transition-colors duration-200 {darkMode ? 'bg-blue-900 border-blue-700 text-blue-200' : 'bg-blue-50 border-blue-200'}">
      <div class="text-sm {darkMode ? 'text-blue-200' : 'text-blue-800'}">
        <strong>Shortcuts:</strong> Ctrl+Enter (Add), Ctrl+Delete (Remove), Ctrl+D (Duplicate), Drag to reorder
      </div>
    </div>

    <!-- Added Schema Selector -->
    <div class="p-4 rounded-lg border transition-colors duration-200 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
      <h3 class="text-md font-semibold mb-3 {darkMode ? 'text-white' : 'text-gray-900'}">Demo Schema</h3>
      <div class="flex space-x-2">
        {#each Object.entries(availableSchemas) as [key, schema]}
          <button
            onclick={() => selectSchema(key)}
            class="px-3 py-2 rounded text-sm border transition-colors duration-200 {currentSchema === schema.schema 
              ? 'bg-blue-500 text-white border-blue-500' 
              : darkMode 
                ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
            tabindex="0"
          >
            {schema.name}
          </button>
        {/each}
      </div>
      {#if currentSchema}
        <div class="mt-2 text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">
          Schema loaded: {Object.values(availableSchemas).find(s => s.schema === currentSchema)?.description || 'Custom schema'}
        </div>
      {/if}
    </div>

    <!-- Added multiple operations management -->
    <div class="p-4 rounded-lg border transition-colors duration-200 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-md font-semibold {darkMode ? 'text-white' : 'text-gray-900'}">Operations</h3>
        <div class="flex space-x-2">
          <button
            onclick={() => addOperation('query')}
            class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors duration-200"
          >
            + Query
          </button>
          <button
            onclick={() => addOperation('mutation')}
            class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors duration-200"
          >
            + Mutation
          </button>
          <button
            onclick={() => addOperation('subscription')}
            class="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors duration-200"
          >
            + Subscription
          </button>
        </div>
      </div>

      <!-- Operation tabs -->
      {#if currentOperation}
        <div class="flex space-x-2 mb-4 border-b transition-colors {darkMode ? 'border-gray-600' : 'border-gray-200'}">
          {#each graphqlStore.queryStructure.operations as operation, index}
            <!-- Fixed nested button issue by separating tab button and close button -->
            <div class="flex items-center border-b-2 transition-colors {index === graphqlStore.queryStructure.activeOperationIndex 
              ? 'border-blue-500 text-blue-600' + (darkMode ? ' bg-gray-700' : ' bg-blue-50')
              : 'border-transparent' + (darkMode ? ' text-gray-300 hover:text-gray-100' : ' text-gray-600 hover:text-gray-800')}">
              <button
                onclick={() => setActiveOperation(index)}
                class="px-3 py-2 text-sm"
              >
                {operation.type}: {operation.name}
              </button>
              {#if graphqlStore.queryStructure.operations.length > 1}
                <button
                  onclick={() => removeOperation(index)}
                  class="ml-1 mr-2 text-red-500 hover:text-red-700 text-sm transition-colors duration-200"
                  title="Remove operation"
                >
                  ×
                </button>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Current operation details -->
        <div class="space-y-4">
          <div class="flex space-x-4">
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1 {darkMode ? 'text-gray-300' : 'text-gray-700'}" for="operation-type">Operation Type</label>
              <select
                id="operation-type"
                value={currentOperation.type}
                onchange={handleOperationTypeChange}
                class="w-full px-3 py-2 border rounded text-sm transition-colors duration-200 {darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}"
              >
                <option value="query">Query</option>
                <option value="mutation">Mutation</option>
                <option value="subscription">Subscription</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium mb-1 {darkMode ? 'text-gray-300' : 'text-gray-700'}" for="operation-name">Operation Name</label>
              <input
                id="operation-name"
                type="text"
                value={currentOperation.name}
                oninput={handleOperationNameInput}
                placeholder="MyOperation"
                class="w-full px-3 py-2 border rounded text-sm transition-colors duration-200 {darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
              />
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Variables for current operation -->
    {#if currentOperation}
      <div class="p-4 rounded-lg border transition-colors duration-200 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-md font-semibold {darkMode ? 'text-white' : 'text-gray-900'}">Variables</h3>
          <button
            onclick={() => { currentOperation.variables.push(createNewVariable()); updateCurrentOperation(); }}
            class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors duration-200"
          >
            Add Variable
          </button>
        </div>
        
        {#each currentOperation.variables as variable, index}
          <div class="flex items-center space-x-2 mb-2 p-2 rounded transition-colors duration-200 {darkMode ? 'bg-gray-700' : 'bg-gray-50'}">
            <span class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">$</span>
            <input
              type="text"
              bind:value={variable.name}
              oninput={(e) => handleVariableNameInput(variable, e)}
              placeholder="variableName"
              class="flex-1 px-2 py-1 border rounded text-sm font-medium focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all {darkMode ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
              list="field-suggestions-{depth}-{fieldIndex}"
            />
            
            <span class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">:</span>
            <select
              value={variable.type}
              onchange={(e) => handleVariableTypeChange(variable, e)}
              class="px-1 py-1 border rounded text-sm focus:ring-1 focus:ring-purple-200 transition-colors duration-200 {darkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}"
            >
              <option value="String">String</option>
              <option value="String!">String!</option>
              <option value="Int">Int</option>
              <option value="Int!">Int!</option>
              <option value="Float">Float</option>
              <option value="Boolean">Boolean</option>
              <option value="ID">ID</option>
            </select>
            <button
              onclick={() => { currentOperation.variables.splice(index, 1); updateCurrentOperation(); }}
              class="px-1 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors duration-200"
            >
              ×
            </button>
          </div>
        {/each}
      </div>

      <!-- Fields Tree for current operation -->
      <div class="p-4 rounded-lg border transition-colors duration-200 {darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-md font-semibold {darkMode ? 'text-white' : 'text-gray-900'}">Fields</h3>
          <div class="flex items-center space-x-2">
            <input
              type="text"
              bind:value={searchTerm}
              placeholder="Search fields..."
              class="px-3 py-1 border rounded text-sm w-32 transition-colors duration-200 {darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
            />
            <button
              onclick={() => addField(currentOperation.fields, currentOperation.type === 'query' ? 'Query' : currentOperation.type === 'mutation' ? 'Mutation' : 'Subscription')}
              class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors duration-200"
            >
              Add Field
            </button>
            {#if selectedFields.size > 0}
              <button
                onclick={bulkRemoveFields}
                class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors duration-200"
              >
                Remove Selected ({selectedFields.size})
              </button>
            {/if}
          </div>
        </div>

        {#if !currentOperation.fields || currentOperation.fields.length === 0}
          <!-- Enhanced empty state -->
          <div class="text-center py-12 {darkMode ? 'text-gray-400' : 'text-gray-500'}">
            <div class="text-4xl mb-4">🌳</div>
            <div class="text-lg font-medium mb-2">No fields yet</div>
            <div class="text-sm mb-4">Start building your GraphQL {currentOperation.type} by adding fields</div>
            {#if currentSchema}
              <div class="text-xs mb-4 {darkMode ? 'text-blue-400' : 'text-blue-600'}">Schema loaded - only valid fields can be added</div>
            {/if}
            <button
              onclick={() => addField(currentOperation.fields, currentOperation.type === 'query' ? 'Query' : currentOperation.type === 'mutation' ? 'Mutation' : 'Subscription')}
              class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-200"
            >
              Add Your First Field
            </button>
          </div>
        {:else}
          {@render FieldTree(currentOperation.fields, 0, currentOperation.type === 'query' ? 'Query' : currentOperation.type === 'mutation' ? 'Mutation' : 'Subscription', [])}
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Updated field selector to show only valid fields -->
{#if showFieldSelector && currentFieldContext}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="p-6 rounded-lg max-w-md w-full mx-4 max-h-96 overflow-y-auto transition-colors duration-200 {darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}">
      <h3 class="text-lg font-semibold mb-4">Select Valid Field for {currentFieldContext.typeName}</h3>
      <div class="text-sm mb-4 {darkMode ? 'text-gray-400' : 'text-gray-600'}">Only fields supported by the current schema are shown</div>
      <div class="space-y-2">
        {#each graphqlStore.getValidFieldsForType(currentFieldContext.typeName) as field}
          <button
            onclick={() => addFieldFromSchema(field, currentFieldContext.parentFields)}
            class="w-full text-left p-3 border rounded transition-colors duration-200 {darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}"
          >
            <div class="font-medium">{field.name}</div>
            <div class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">{field.type.name}</div>
            {#if field.args?.length > 0}
              <div class="text-xs mt-1 {darkMode ? 'text-purple-400' : 'text-purple-600'}">
                Args: {field.args.map(a => a.name).join(', ')}
              </div>
            {/if}
          </button>
        {/each}
      </div>
      <div class="flex justify-end space-x-2 mt-4">
        <button
          onclick={() => { showFieldSelector = false; currentFieldContext = null; }}
          class="px-4 py-2 border rounded transition-colors duration-200 {darkMode ? 'text-gray-300 border-gray-600 hover:bg-gray-700' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Updated argument selector to show only valid arguments -->
{#if showArgSelector && currentFieldContext}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="p-6 rounded-lg max-w-md w-full mx-4 max-h-96 overflow-y-auto transition-colors duration-200 {darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}">
      <h3 class="text-lg font-semibold mb-4">Select Valid Argument for {currentFieldContext.field.name}</h3>
      <div class="text-sm mb-4 {darkMode ? 'text-gray-400' : 'text-gray-600'}">Only arguments supported by the current schema are shown</div>
      <div class="space-y-2">
        {#each graphqlStore.getValidArgsForField(currentFieldContext.parentTypeName, currentFieldContext.field.name) as arg}
          <button
            onclick={() => addArgumentFromSchema(arg, currentFieldContext.field)}
            class="w-full text-left p-3 border rounded transition-colors duration-200 {darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}"
          >
            <div class="font-medium">{arg.name}</div>
            <div class="text-sm {darkMode ? 'text-gray-400' : 'text-gray-600'}">{arg.type.name}</div>
          </button>
        {/each}
      </div>
      <div class="flex justify-end space-x-2 mt-4">
        <button
          onclick={() => { showArgSelector = false; currentFieldContext = null; }}
          class="px-4 py-2 border rounded transition-colors duration-200 {darkMode ? 'text-gray-300 border-gray-600 hover:bg-gray-700' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- FieldTree snippet -->
{#snippet FieldTree(fields, depth = 0, parentTypeName = 'Query', fieldPath = [])}
  {#each fields as field, fieldIndex}
    {#if !searchTerm || field.name.toLowerCase().includes(searchTerm.toLowerCase())}
      <div 
        class="mb-2 group" 
        style="margin-left: {depth * 20}px"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, field, fieldIndex, fields)}
        ondragover={handleDragOver}
        ondrop={(e) => handleDrop(e, fieldIndex, fields)}
        onmouseenter={() => hoveredField = `${fieldPath.join('.')}.${field.name}`}
        onmouseleave={() => hoveredField = null}
        role="button"
        tabindex="0"
      >
        <!-- Tree connector lines -->
        <div class="flex items-start">
          {#if depth > 0}
            <div class="flex-shrink-0 w-5 h-6 relative">
              <div class="absolute top-0 left-2 w-px h-3 {darkMode ? 'bg-gray-600' : 'bg-gray-300'}"></div>
              <div class="absolute top-3 left-2 w-3 h-px {darkMode ? 'bg-gray-600' : 'bg-gray-300'}"></div>
            </div>
          {/if}
          
          <div class="flex-1 border rounded-lg p-3 transition-colors duration-200 {darkMode ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'} {hoveredField === `${fieldPath.join('.')}.${field.name}` ? (darkMode ? 'ring-2 ring-blue-400' : 'ring-2 ring-blue-200') : ''}">
            <!-- Enhanced field header with better UX -->
            <div class="flex items-center space-x-2 mb-2">
              <!-- Selection checkbox -->
              <input
                type="checkbox"
                class="w-3 h-3"
                onchange={(e) => {
                  if (e.target.checked) {
                    selectedFields.add(`${fieldPath.join('.')}.${field.name}`);
                  } else {
                    selectedFields.delete(`${fieldPath.join('.')}.${field.name}`);
                  }
                  selectedFields = new Set(selectedFields);
                }}
              />
              
              <!-- Drag handle -->
              <div class="w-4 h-4 flex items-center justify-center text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                ⋮⋮
              </div>
              
              <!-- Expand/collapse button -->
              <button
                onclick={() => toggleFieldExpansion(field)}
                class="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-700 border rounded text-xs hover:bg-white transition-colors duration-200"
                tabindex="0"
              >
                {field.expanded ? '−' : '+'}
              </button>
              
              <!-- Enhanced field name input with auto-complete -->
              <input
                type="text"
                bind:value={field.name}
                oninput={updateCurrentOperation}
                onkeydown={(e) => handleKeydown(e, { type: 'field', field, parentFields: fields, index: fieldIndex, typeName: parentTypeName, fieldPath })}
                placeholder="fieldName"
                class="flex-1 px-2 py-1 border rounded text-sm font-medium focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all {darkMode ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
                list="field-suggestions-{depth}-{fieldIndex}"
              />
              
              <!-- Quick action buttons that appear on hover -->
              <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onclick={() => duplicateField(field, fields)}
                  class="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors duration-200"
                  title="Duplicate field (Ctrl+D)"
                  tabindex="0"
                >
                  ⧉
                </button>
                <button
                  onclick={() => {
                    const fieldReturnType = graphqlStore.getFieldReturnType(parentTypeName, field.name) || 'Query';
                    const newFieldPath = [...fieldPath, field.name];
                    addField(field.fields, fieldReturnType, newFieldPath);
                  }}
                  onkeydown={(e) => handleKeydown(e, { type: 'field', parentFields: field.fields, typeName: graphqlStore.getFieldReturnType(parentTypeName, field.name) || 'Query', fieldPath: [...fieldPath, field.name] })}
                  class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors duration-200"
                  title="Add nested field (Ctrl+Enter)"
                  tabindex="0"
                >
                  + Field
                </button>
                <button
                  onclick={() => addArgument(field, parentTypeName)}
                  class="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition-colors duration-200"
                  title="Add argument"
                  tabindex="0"
                >
                  + Arg
                </button>
                <button
                  onclick={() => removeField(fields, fieldIndex)}
                  onkeydown={(e) => handleKeydown(e, { type: 'field', parentFields: fields, index: fieldIndex })}
                  class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors duration-200"
                  title="Remove field (Ctrl+Delete)"
                  tabindex="0"
                >
                  ×
                </button>
              </div>
            </div>

            {#if field.expanded}
              <!-- Enhanced arguments section -->
              {#if field.args.length > 0}
                <div class="mb-3 pl-4 border-l-2 border-purple-200 transition-colors duration-200 {darkMode ? 'border-purple-400' : ''}">
                  <div class="text-xs font-medium text-purple-700 mb-2 flex items-center justify-between">
                    <span>Arguments ({field.args.length})</span>
                    <button
                      onclick={() => addArgument(field, parentTypeName)}
                      class="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition-colors duration-200"
                      tabindex="0"
                    >
                      + Add
                    </button>
                  </div>
                  {#each field.args as arg, argIndex}
                    <div class="flex items-center space-x-2 mb-1 group/arg">
                      <input
                        type="text"
                        bind:value={arg.name}
                        oninput={updateCurrentOperation}
                        placeholder="argName"
                        class="flex-1 px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-200 transition-colors duration-200 {darkMode ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
                      />
                      <span class="text-xs text-gray-600 transition-colors duration-200 {darkMode ? 'text-gray-400' : ''}">:</span>
                      <input
                        type="text"
                        bind:value={arg.value}
                        oninput={updateCurrentOperation}
                        placeholder="value"
                        class="flex-1 px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-200 transition-colors duration-200 {darkMode ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}"
                      />
                      <select
                        bind:value={arg.type}
                        onchange={updateCurrentOperation}
                        class="px-1 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-200 transition-colors duration-200 {darkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-900'}"
                      >
                        <option value="String">String</option>
                        <option value="Int">Int</option>
                        <option value="Float">Float</option>
                        <option value="Boolean">Boolean</option>
                        <option value="ID">ID</option>
                      </select>
                      <button
                        onclick={() => removeArgument(field, argIndex)}
                        class="px-1 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 opacity-0 group-hover/arg:opacity-100 transition-opacity duration-200"
                        tabindex="0"
                      >
                        ×
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Enhanced nested fields section -->
              {#if field.fields.length > 0}
                <div class="pl-2 border-l-2 border-green-200 transition-colors duration-200 {darkMode ? 'border-green-400' : ''}">
                  <div class="text-xs font-medium text-green-700 mb-2 flex items-center justify-between">
                    <span>Nested Fields ({field.fields.length})</span>
                    <button
                      onclick={() => {
                        const fieldReturnType = graphqlStore.getFieldReturnType(parentTypeName, field.name) || 'Query';
                        const newFieldPath = [...fieldPath, field.name];
                        addField(field.fields, fieldReturnType, newFieldPath);
                      }}
                      class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors duration-200"
                      tabindex="0"
                    >
                      + Add
                    </button>
                  </div>
                  {@render FieldTree(field.fields, depth + 1, graphqlStore.getFieldReturnType(parentTypeName, field.name) || 'Query', [...fieldPath, field.name])}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/each}
{/snippet}
