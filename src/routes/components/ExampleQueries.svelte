<script>
  import { graphqlStore } from '../stores/graphql-store.js';


  let showDropdown = $state(false);

  const examples = [
    {
      name: 'Countries Query',
      description: 'Get list of countries with basic info',
      query: `query GetCountries($first: Int) {
  countries(first: $first) {
    code
    name
    emoji
    currency
  }
}`,
      variables: '{\n  "first": 5\n}',
      endpoint: 'https://countries.trevorblades.com/'
    },
    {
      name: 'User Profile Query',
      description: 'Fetch user profile with posts',
      query: `query GetUserProfile($userId: ID!) {
  user(id: $userId) {
    id
    name
    email
    avatar
    posts(first: 10) {
      id
      title
      content
      createdAt
      likes {
        count
      }
    }
  }
}`,
      variables: '{\n  "userId": "1"\n}',
      endpoint: 'https://api.example.com/graphql'
    },
    {
      name: 'Create Post Mutation',
      description: 'Create a new blog post',
      query: `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    title
    content
    author {
      name
    }
    createdAt
  }
}`,
      variables: `{
  "input": {
    "title": "My New Post",
    "content": "This is the content of my post",
    "authorId": "1"
  }
}`,
      endpoint: 'https://api.example.com/graphql'
    },
    {
      name: 'GitHub Repository Query',
      description: 'Get repository information from GitHub',
      query: `query GetRepository($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    description
    stargazerCount
    forkCount
    primaryLanguage {
      name
      color
    }
    issues(first: 5, states: OPEN) {
      nodes {
        title
        createdAt
        author {
          login
        }
      }
    }
  }
}`,
      variables: '{\n  "owner": "facebook",\n  "name": "react"\n}',
      endpoint: 'https://api.github.com/graphql'
    },
    {
      name: 'E-commerce Products',
      description: 'Fetch products with categories and reviews',
      query: `query GetProducts($category: String, $limit: Int) {
  products(category: $category, limit: $limit) {
    id
    name
    price
    description
    images
    category {
      name
      slug
    }
    reviews(first: 3) {
      rating
      comment
      author {
        name
      }
    }
    averageRating
    inStock
  }
}`,
      variables: '{\n  "category": "electronics",\n  "limit": 10\n}',
      endpoint: 'https://api.shop.example.com/graphql'
    },
    {
      name: 'Subscription Example',
      description: 'Subscribe to real-time message updates',
      query: `subscription MessageUpdates($channelId: ID!) {
  messageAdded(channelId: $channelId) {
    id
    content
    author {
      name
      avatar
    }
    createdAt
  }
}`,
      variables: '{\n  "channelId": "general"\n}',
      endpoint: 'wss://api.chat.example.com/graphql'
    }
  ];

  function loadExample(example) {
    
    // Update the store with the example data
    graphqlStore.update(state => ({
      ...state,
      endpoint: example.endpoint,
      query: example.query,
      variables: example.variables,
      queryStructure: parseQuery(example.query)
    }));
    
    showDropdown = false;
  }

  // Simple query parser (reused from store)
  function parseQuery(queryString) {
    
    try {
      const operationMatch = queryString.match(/(query|mutation|subscription)\s+(\w+)?\s*($$[^)]*$$)?\s*{/);
      const operation = operationMatch ? operationMatch[1] : 'query';
      const name = operationMatch ? operationMatch[2] || 'UnnamedOperation' : 'UnnamedOperation';
      
      return {
        operation,
        name,
        variables: [],
        fields: []
      };
    } catch (error) {
      return {
        operation: 'query',
        name: 'ParseError',
        variables: [],
        fields: []
      };
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event) {
    if (!event.target.closest('.example-dropdown')) {
      showDropdown = false;
    }
  }

  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="relative example-dropdown">
  <button
    onclick={toggleDropdown}
    class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center space-x-2"
  >
    <span>Examples</span>
    <svg class="w-4 h-4 transform {showDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </button>

  {#if showDropdown}
    <div class="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
      <div class="p-2">
        <h3 class="text-sm font-semibold text-gray-900 mb-2">Example Queries</h3>
        <div class="space-y-1">
          {#each examples as example}
            <button
              onclick={() => loadExample(example)}
              class="w-full text-left p-3 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
            >
              <div class="font-medium text-sm text-gray-900">{example.name}</div>
              <div class="text-xs text-gray-600 mt-1">{example.description}</div>
              <div class="text-xs text-purple-600 mt-1">
                {example.query.match(/(query|mutation|subscription)/)?.[1] || 'query'}
              </div>
            </button>
          {/each}
        </div>
      </div>
      
      <div class="border-t border-gray-200 p-3 bg-gray-50">
        <p class="text-xs text-gray-600">
          💡 <strong>Tip:</strong> These examples demonstrate different GraphQL features. 
          Some endpoints may require authentication or may not be publicly accessible.
        </p>
      </div>
    </div>
  {/if}
</div>
