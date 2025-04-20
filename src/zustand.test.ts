import { createGenericStore, GenericState, GenericActions, ActionType } from './zustand';
import { apiClient } from './api';

// Mock the api module
jest.mock('./api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

interface TestItem {
  id: number;
  name: string;
  value?: string;
}

interface MockListResponse {
    objects: TestItem[];
    current_page: number;
    num_pages: number;
    total_count: number;
}

// Define the type for the store hook returned by createGenericStore
// This makes it easier to reference the store type
type TestStore = ReturnType<typeof createGenericStore<TestItem>>;

describe('createGenericStore', () => {
  const endpoint = '/test-items';
  let useTestStore: TestStore;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedApiClient.get.mockResolvedValue({ objects: [] }); // Default mock
    mockedApiClient.post.mockResolvedValue({});
    mockedApiClient.put.mockResolvedValue({});
    mockedApiClient.delete.mockResolvedValue(undefined);

    // Create a fresh store instance for each test with all actions
    useTestStore = createGenericStore<TestItem>(endpoint, {
      actions: ['fetchAll', 'fetchOne', 'create', 'update', 'remove']
    });
  });

  it('should initialize with correct default state', () => {
    const { items, item, loading, error, meta } = useTestStore.getState();
    expect(items).toEqual([]);
    expect(item).toBeNull();
    expect(loading).toBe(false);
    expect(error).toBeNull();
    expect(meta).toEqual({ currentPage: 1, totalPages: 1, totalCount: 0 });
  });

  // Tests for selective actions feature
  describe('action selection', () => {
    it('should include only specified actions', () => {
      const readOnlyStore = createGenericStore<TestItem>(endpoint, {
        actions: ['fetchAll', 'fetchOne']
      });
      
      const state = readOnlyStore.getState();
      
      // Should have these actions
      expect(typeof state.fetchAll).toBe('function');
      expect(typeof state.fetchOne).toBe('function');
      
      // Should not have these actions
      expect(state.create).toBeUndefined();
      expect(state.update).toBeUndefined();
      expect(state.remove).toBeUndefined();
    });
    
    it('should include all actions when none specified', () => {
      const allActionsStore = createGenericStore<TestItem>(endpoint);
      
      const state = allActionsStore.getState();
      
      // Should have all actions
      expect(typeof state.fetchAll).toBe('function');
      expect(typeof state.fetchOne).toBe('function');
      expect(typeof state.create).toBe('function');
      expect(typeof state.update).toBe('function');
      expect(typeof state.remove).toBe('function');
    });
    
    it('should handle dependency between actions when some are excluded', async () => {
      // Create a store without fetchAll but with create
      const storeWithoutFetchAll = createGenericStore<TestItem>(endpoint, {
        actions: ['create', 'update', 'remove']
      });
      
      const createdItem: TestItem = { id: 3, name: 'New Item' };
      mockedApiClient.post.mockResolvedValue(createdItem);
      
      // Create should work without error even though fetchAll is missing
      const state = storeWithoutFetchAll.getState();
      if (state.create) {
        await state.create({ name: 'New Item' });
      }
      
      expect(mockedApiClient.post).toHaveBeenCalledWith(`${endpoint}/`, { name: 'New Item' });
      // Shouldn't try to call fetchAll
      expect(mockedApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('fetchAll', () => {
    const mockItems: TestItem[] = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
    const mockResponse: MockListResponse = {
      objects: mockItems,
      current_page: 1,
      num_pages: 2,
      total_count: 20,
    };

    it('should set loading state, call apiClient.get, and update state on success', async () => {
      mockedApiClient.get.mockResolvedValue(mockResponse);
      const params = { page: 1 };

      const state = useTestStore.getState();
      if (state.fetchAll) {
        // Call action
        const fetchPromise = state.fetchAll(params);

        // Check intermediate loading state
        expect(useTestStore.getState().loading).toBe(true);
        expect(useTestStore.getState().error).toBeNull();

        await fetchPromise; // Wait for completion

        // Check final state and mocks
        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/`, params);
        expect(useTestStore.getState().items).toEqual(mockItems);
        expect(useTestStore.getState().meta).toEqual({
          currentPage: mockResponse.current_page,
          totalPages: mockResponse.num_pages,
          totalCount: mockResponse.total_count,
        });
        expect(useTestStore.getState().loading).toBe(false);
        expect(useTestStore.getState().error).toBeNull();
      }
    });

    it('should handle API errors and update error state', async () => {
      const mockError = new Error('Failed to fetch');
      mockedApiClient.get.mockRejectedValue(mockError);

      const state = useTestStore.getState();
      if (state.fetchAll) {
        const fetchPromise = state.fetchAll();
        expect(useTestStore.getState().loading).toBe(true);
        await fetchPromise;

        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/`, {});
        expect(useTestStore.getState().items).toEqual([]);
        expect(useTestStore.getState().error).toEqual(mockError);
        expect(useTestStore.getState().loading).toBe(false);
      }
    });

    it('should handle missing fields in API response gracefully', async () => {
      const incompleteResponse = { objects: mockItems };
      mockedApiClient.get.mockResolvedValue(incompleteResponse);

      const state = useTestStore.getState();
      if (state.fetchAll) {
        await state.fetchAll();

        expect(useTestStore.getState().items).toEqual(mockItems);
        expect(useTestStore.getState().meta).toEqual({
          currentPage: 1,
          totalPages: 1,
          totalCount: mockItems.length,
        });
        expect(useTestStore.getState().loading).toBe(false);
      }
    });
  });

  describe('fetchOne', () => {
    const mockItem: TestItem = { id: 1, name: 'Fetched Item' };
    const itemId = 1;

    it('should set loading state, call apiClient.get, and update state on success', async () => {
      mockedApiClient.get.mockResolvedValue(mockItem);

      const state = useTestStore.getState();
      if (state.fetchOne) {
        const fetchPromise = state.fetchOne(itemId);
        expect(useTestStore.getState().loading).toBe(true);

        await fetchPromise;

        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/${itemId}/`);
        expect(useTestStore.getState().item).toEqual(mockItem);
        expect(useTestStore.getState().loading).toBe(false);
        expect(useTestStore.getState().error).toBeNull();
      }
    });

    it('should handle API errors and update error state', async () => {
      const mockError = new Error('Fetch single failed');
      mockedApiClient.get.mockRejectedValue(mockError);

      const state = useTestStore.getState();
      if (state.fetchOne) {
        const fetchPromise = state.fetchOne(itemId);
        expect(useTestStore.getState().loading).toBe(true);

        await fetchPromise;

        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/${itemId}/`);
        expect(useTestStore.getState().item).toBeNull();
        expect(useTestStore.getState().error).toEqual(mockError);
        expect(useTestStore.getState().loading).toBe(false);
      }
    });
  });

  describe('create', () => {
    const newItemPayload: Partial<TestItem> = { name: 'New Item' };
    const createdItem: TestItem = { id: 3, name: 'New Item' };

    beforeEach(() => {
      mockedApiClient.get.mockResolvedValue({ objects: [createdItem] }); // Mock fetchAll
    });

    it('should call apiClient.post, then fetchAll, and return created item', async () => {
      mockedApiClient.post.mockResolvedValue(createdItem);

      const state = useTestStore.getState();
      if (state.create) {
        // Check loading state during the operation
        const createPromise = state.create(newItemPayload);
        expect(useTestStore.getState().loading).toBe(true);

        const result = await createPromise;

        expect(mockedApiClient.post).toHaveBeenCalledWith(`${endpoint}/`, newItemPayload);
        expect(result).toEqual(createdItem);
        // Expect fetchAll to have been called AFTER post is resolved
        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/`, {});
        expect(useTestStore.getState().items).toEqual([createdItem]);
        expect(useTestStore.getState().loading).toBe(false); // Check final loading state
        expect(useTestStore.getState().error).toBeNull();
      }
    });

    it('should handle API errors, update error state, and return undefined', async () => {
      const mockError = new Error('Create failed');
      mockedApiClient.post.mockRejectedValue(mockError);

      const state = useTestStore.getState();
      if (state.create) {
        const createPromise = state.create(newItemPayload);
        expect(useTestStore.getState().loading).toBe(true);

        const result = await createPromise;

        expect(mockedApiClient.post).toHaveBeenCalledWith(`${endpoint}/`, newItemPayload);
        expect(result).toBeUndefined();
        expect(mockedApiClient.get).not.toHaveBeenCalled();
        expect(useTestStore.getState().error).toEqual(mockError);
        expect(useTestStore.getState().loading).toBe(false);
      }
    });
  });

  describe('update', () => {
    const itemId = 1;
    const updatePayload: Partial<TestItem> = { name: 'Updated Item' };
    const updatedItem: TestItem = { id: 1, name: 'Updated Item' };

    beforeEach(() => {
      mockedApiClient.get.mockResolvedValue({ objects: [updatedItem] }); // Mock fetchAll
    });

    it('should call apiClient.put, then fetchAll, and return updated item', async () => {
      mockedApiClient.put.mockResolvedValue(updatedItem);

      const state = useTestStore.getState();
      if (state.update) {
        const updatePromise = state.update(itemId, updatePayload);
        expect(useTestStore.getState().loading).toBe(true);

        const result = await updatePromise;

        expect(mockedApiClient.put).toHaveBeenCalledWith(`${endpoint}/${itemId}/`, updatePayload);
        expect(result).toEqual(updatedItem);
        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/`, {});
        expect(useTestStore.getState().items).toEqual([updatedItem]);
        expect(useTestStore.getState().loading).toBe(false);
        expect(useTestStore.getState().error).toBeNull();
      }
    });

    it('should handle API errors, update error state, and return undefined', async () => {
      const mockError = new Error('Update failed');
      mockedApiClient.put.mockRejectedValue(mockError);

      const state = useTestStore.getState();
      if (state.update) {
        const updatePromise = state.update(itemId, updatePayload);
        expect(useTestStore.getState().loading).toBe(true);

        const result = await updatePromise;

        expect(mockedApiClient.put).toHaveBeenCalledWith(`${endpoint}/${itemId}/`, updatePayload);
        expect(result).toBeUndefined();
        expect(mockedApiClient.get).not.toHaveBeenCalled();
        expect(useTestStore.getState().error).toEqual(mockError);
        expect(useTestStore.getState().loading).toBe(false);
      }
    });
  });

  describe('remove', () => {
    const itemId = 1;
    
    beforeEach(() => {
      mockedApiClient.get.mockResolvedValue({ objects: [] }); // Mock fetchAll after delete
    });

    it('should call apiClient.delete, then fetchAll', async () => {
      const state = useTestStore.getState();
      if (state.remove) {
        const removePromise = state.remove(itemId);
        expect(useTestStore.getState().loading).toBe(true);

        await removePromise;

        expect(mockedApiClient.delete).toHaveBeenCalledWith(`${endpoint}/${itemId}/`);
        expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/`, {});
        expect(useTestStore.getState().loading).toBe(false);
        expect(useTestStore.getState().error).toBeNull();
      }
    });

    it('should handle API errors and update error state', async () => {
      const mockError = new Error('Delete failed');
      mockedApiClient.delete.mockRejectedValue(mockError);

      const state = useTestStore.getState();
      if (state.remove) {
        const removePromise = state.remove(itemId);
        expect(useTestStore.getState().loading).toBe(true);

        await removePromise;

        expect(mockedApiClient.delete).toHaveBeenCalledWith(`${endpoint}/${itemId}/`);
        expect(mockedApiClient.get).not.toHaveBeenCalled();
        expect(useTestStore.getState().error).toEqual(mockError);
        expect(useTestStore.getState().loading).toBe(false);
      }
    });
  });

  // Test for extending the store with custom state/actions
  describe('extending the store', () => {
    interface ExtendedState {
      customState: string;
      customAction: (value: string) => void;
    }

    type FullExtendedState = GenericState<TestItem> & GenericActions<TestItem> & ExtendedState;

    it('should allow extending the store with custom state and actions', () => {
      // Create a store with custom state and actions
      const extendedStore = createGenericStore<TestItem, ExtendedState>(
        endpoint,
        {
          actions: ['fetchAll', 'fetchOne'], // Only include these actions
          extendStore: (set) => ({
            customState: 'initial',
            customAction: (value: string) => set({ customState: value } as Partial<FullExtendedState>),
          })
        }
      );

      // Check if the custom state and actions are available
      const state = extendedStore.getState();
      expect(state.customState).toBe('initial');
      expect(typeof state.customAction).toBe('function');

      // Use the custom action
      state.customAction('updated');
      expect(extendedStore.getState().customState).toBe('updated');

      // Verify only specified actions are available
      expect(typeof state.fetchAll).toBe('function');
      expect(typeof state.fetchOne).toBe('function');
      expect(state.create).toBeUndefined();
      expect(state.update).toBeUndefined();
      expect(state.remove).toBeUndefined();
    });
  });
}); 