# Zustand API Helper

A helper library integrating Zustand state management with a configurable Axios API client for RESTful endpoints, written in TypeScript.

## Features

*   Initialize a shared Axios instance for your API.
*   Generic Zustand store creator for common CRUD operations.
*   Type-safe when used with TypeScript.
*   Extensible stores for custom state and actions.
*   Handles loading and error states automatically.

## Installation

```bash
npm install zustand-api-helper axios zustand
# or
yarn add zustand-api-helper axios zustand
```

This package has `axios` and `zustand` as peer dependencies, so you need to install them alongside this library.

## Usage

### 1. Initialize the API Client

Configure the API client with your API's base URL and any other custom [Axios configuration](https://axios-http.com/docs/req_config). This should be done once when your application starts.

```typescript
// e.g., in your main application file (index.ts or App.tsx)
import { initApiClient } from 'zustand-api-helper';

initApiClient({
  baseURL: 'https://your-api.com/api', // Replace with your actual API base URL
  // headers: { 'X-Custom-Header': 'value' } // Optional: Custom headers
});
```

### 2. Define Your Data Type

Create a TypeScript interface or type for the data structure returned by your API endpoints.

```typescript
// interfaces/User.ts
interface User {
  id: number; // Or string, depending on your API
  name: string;
  email: string;
  // ... other properties
}

export default User;
```

### 3. Create Generic Stores

Use the `createGenericStore` factory to create Zustand stores. Provide the endpoint path (relative to the `baseURL`) and your data type as a generic parameter.

```typescript
// stores/userStore.ts
import { createGenericStore } from 'zustand-api-helper';
import User from '../interfaces/User'; // Adjust path as needed

// Pass the User interface as the generic type
const useUserStore = createGenericStore<User>('/users');

export default useUserStore;
```

### 4. Use the Store

Use the created store hook in your components (React shown) or other parts of your application.

```typescript
// components/UserList.tsx
import React, { useEffect } from 'react';
import useUserStore from '../stores/userStore'; // Adjust path as needed

function UserList(): JSX.Element {
  // Types for state (users, loading, error, etc.) and actions (fetchAll) are inferred
  const { items: users, loading, error, fetchAll, create, remove } = useUserStore();

  useEffect(() => {
    fetchAll({ page: 1 }); // Fetch users on mount, optionally pass params
  }, [fetchAll]); // fetchAll is stable

  const handleCreateUser = () => {
    const name = prompt("Enter user name:");
    if (name) {
        create({ name, email: `${name.toLowerCase()}@example.com` });
    }
  };

  if (loading && users.length === 0) return <p>Loading users...</p>;
  if (error) return <p>Error loading users: {error.message}</p>;

  return (
    <div>
      <button onClick={handleCreateUser} disabled={loading}>
        Add User
      </button>
      {loading && <p>Updating...</p>}
      <ul>
        {/* `users` is typed as User[] */}
        {users.map(user => (
          <li key={user.id}>
            {user.name} ({user.email})
            <button onClick={() => remove(user.id)} disabled={loading} style={{ marginLeft: '10px' }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserList;
```

### 5. Extending Stores (Optional)

Add custom state or actions using the second argument of `createGenericStore`. Define an interface for your extensions.

```typescript
// stores/productStore.ts
import {
    createGenericStore,
    apiClient, // You can import the configured apiClient
    GenericState, // Import base types if needed for extension definition
    GenericActions
} from 'zustand-api-helper';

// 1. Define Product type
interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
}

// 2. Define the shape of the store extensions
interface ProductStoreExtension {
    featuredProduct: Product | null;
    categories: string[];
    fetchFeaturedProduct: () => Promise<void>;
    fetchCategories: () => Promise<void>;
    applyDiscount: (percentage: number) => void;
}

// 3. Create the store, passing Product and the extension type
const useProductStore = createGenericStore<Product, ProductStoreExtension>(
    '/products',
    (set, get): ProductStoreExtension => ({ // Return type must match interface
        // Custom state
        featuredProduct: null,
        categories: [],

        // Custom action using apiClient
        fetchFeaturedProduct: async () => {
            set({ loading: true });
            try {
                // Type argument <Product> specifies expected response type
                const featured = await apiClient.get<Product>('/products/featured');
                set({ featuredProduct: featured, loading: false });
            } catch (error: any) {
                set({ error: error instanceof Error ? error : new Error(String(error)), loading: false });
            }
        },

        fetchCategories: async () => {
            // Example: Use generic fetchAll from the base store
            await get().fetchAll({ fields: 'category' }); // Hypothetical API param
            // Process results to populate categories
            const fetchedItems = get().items;
            const uniqueCategories = [...new Set(fetchedItems.map(p => p.category))];
            set({ categories: uniqueCategories });
        },

        // Custom action modifying state
        applyDiscount: (percentage: number) => {
            const discountMultiplier = (100 - percentage) / 100;
            set(state => ({
                // Important: Ensure state access is type-safe
                // Cast state to full type if TypeScript needs help
                items: (state as GenericState<Product>).items.map(p => (
                    { ...p, price: p.price * discountMultiplier }
                ))
            }));
            // Also update the single item if it exists
             const currentItem = (get() as GenericState<Product>).item;
             if (currentItem) {
                 set({ item: { ...currentItem, price: currentItem.price * discountMultiplier } });
             }
        },
    })
);

export default useProductStore;
```

## API Reference

### `initApiClient(config)`

*   Initializes the internal Axios instance.
*   `config` (Object): Configuration object.
    *   `baseURL` (String, **required**): The base URL for your API.
    *   Any other valid [Axios request config](https://axios-http.com/docs/req_config) options.

### `apiClient`

*   The configured Axios instance wrapper.
*   Methods: `get`, `post`, `put`, `delete`, `postFile`. These methods automatically handle errors using the internal `handleError` function (which logs and re-throws).
*   Methods accept an optional type argument for the expected response data (e.g., `apiClient.get<User>('/users/1')`).

### `createGenericStore<T, TExtension = {}>(endpoint, extendStore?)`

*   Creates a Zustand store bound to an API endpoint.
*   `T`: The TypeScript type of the items being managed (e.g., `User`). Must have an `id` property.
*   `TExtension`: (Optional) The TypeScript type for the custom state and actions added via `extendStore`.
*   `endpoint` (String): The API endpoint path relative to the `baseURL` (e.g., '/users').
*   `extendStore` (Function, optional): `(set, get) => TExtension`. A function defining custom state and actions.
*   Returns: A Zustand store hook (`UseBoundStore<StoreApi<CombinedState>>`).

#### Generic Store State

*   `items` (`T[]`): List of resources (result of `fetchAll`).
*   `item` (`T | null`): Single resource (result of `fetchOne`).
*   `loading` (`boolean`): Indicates if a store action (API request) is in progress.
*   `error` (`Error | null`): Stores the last error encountered during store actions.
*   `meta` (`Meta`): Pagination metadata (`currentPage`, `totalPages`, `totalCount`).

#### Generic Store Actions

*   `fetchAll(params?)`: Fetches a list of resources. Updates `items` and `meta`.
*   `fetchOne(id)`: Fetches a single resource by ID. Updates `item`.
*   `create(payload)`: Creates a new resource. Calls `fetchAll` on success.
*   `update(id, payload)`: Updates an existing resource. Calls `fetchAll` on success.
*   `remove(id)`: Deletes a resource. Calls `fetchAll` on success.

#### Exported Helper Types

*   `GenericState<T>`: Interface for the base state.
*   `GenericActions<T>`: Interface for the base actions.
*   `Meta`: Interface for the pagination metadata.

## Testing

This package uses Jest for testing.

*   Run tests: `npm test` or `yarn test`
*   Run tests in watch mode: `npm run test:watch` or `yarn test:watch`

The tests mock `axios` and the internal `apiClient` to avoid actual network requests.

## License

MIT
