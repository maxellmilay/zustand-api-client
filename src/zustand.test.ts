import { createGenericStore, GenericState, GenericActions } from './zustand';
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

    // Create a fresh store instance for each test
    useTestStore = createGenericStore<TestItem>(endpoint);

    // No need for manual reset if store is recreated
    // // Reset store state manually before each test
    // act(() => {
    //   useTestStore.setState({ ...initial state... }, true);
    // });
  });

  it('should initialize with correct default state', () => {
    const { items, item, loading, error, meta } = useTestStore.getState();
    expect(items).toEqual([]);
    expect(item).toBeNull();
    expect(loading).toBe(false);
    expect(error).toBeNull();
    expect(meta).toEqual({ currentPage: 1, totalPages: 1, totalCount: 0 });
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

      // Call action
      const fetchPromise = useTestStore.getState().fetchAll(params);

      // Check intermediate loading state
      expect(useTestStore.getState().loading).toBe(true);
      expect(useTestStore.getState().error).toBeNull();

      await fetchPromise; // Wait for completion

      // Check final state and mocks
      expect(mockedApiClient.get).toHaveBeenCalledWith(endpoint, params);
      expect(useTestStore.getState().items).toEqual(mockItems);
      expect(useTestStore.getState().meta).toEqual({
        currentPage: mockResponse.current_page,
        totalPages: mockResponse.num_pages,
        totalCount: mockResponse.total_count,
      });
      expect(useTestStore.getState().loading).toBe(false);
      expect(useTestStore.getState().error).toBeNull();
    });

    it('should handle API errors and update error state', async () => {
      const mockError = new Error('Failed to fetch');
      mockedApiClient.get.mockRejectedValue(mockError);

      const fetchPromise = useTestStore.getState().fetchAll();

      expect(useTestStore.getState().loading).toBe(true);

      await fetchPromise;

      expect(mockedApiClient.get).toHaveBeenCalledWith(endpoint, {});
      expect(useTestStore.getState().items).toEqual([]);
      expect(useTestStore.getState().error).toEqual(mockError);
      expect(useTestStore.getState().loading).toBe(false);
    });

    it('should handle missing fields in API response gracefully', async () => {
      const incompleteResponse = { objects: mockItems };
      mockedApiClient.get.mockResolvedValue(incompleteResponse);

      await useTestStore.getState().fetchAll();

      expect(useTestStore.getState().items).toEqual(mockItems);
      expect(useTestStore.getState().meta).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: mockItems.length,
      });
      expect(useTestStore.getState().loading).toBe(false);
    });
  });

  describe('fetchOne', () => {
    const mockItem: TestItem = { id: 1, name: 'Fetched Item' };
    const itemId = 1;

    it('should set loading state, call apiClient.get, and update state on success', async () => {
      mockedApiClient.get.mockResolvedValue(mockItem);

      const fetchPromise = useTestStore.getState().fetchOne(itemId);
      expect(useTestStore.getState().loading).toBe(true);

      await fetchPromise;

      expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/${itemId}`);
      expect(useTestStore.getState().item).toEqual(mockItem);
      expect(useTestStore.getState().loading).toBe(false);
      expect(useTestStore.getState().error).toBeNull();
    });

    it('should handle API errors and update error state', async () => {
      const mockError = new Error('Fetch single failed');
      mockedApiClient.get.mockRejectedValue(mockError);

      const fetchPromise = useTestStore.getState().fetchOne(itemId);
      expect(useTestStore.getState().loading).toBe(true);

      await fetchPromise;

      expect(mockedApiClient.get).toHaveBeenCalledWith(`${endpoint}/${itemId}`);
      expect(useTestStore.getState().item).toBeNull();
      expect(useTestStore.getState().error).toEqual(mockError);
      expect(useTestStore.getState().loading).toBe(false);
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

      // Check loading state during the operation
      const createPromise = useTestStore.getState().create(newItemPayload);
      expect(useTestStore.getState().loading).toBe(true);

      const result = await createPromise;

      expect(mockedApiClient.post).toHaveBeenCalledWith(endpoint, newItemPayload);
      expect(result).toEqual(createdItem);
      // Expect fetchAll to have been called AFTER post is resolved
      expect(mockedApiClient.get).toHaveBeenCalledWith(endpoint, {});
      expect(useTestStore.getState().items).toEqual([createdItem]);
      expect(useTestStore.getState().loading).toBe(false); // Check final loading state
      expect(useTestStore.getState().error).toBeNull();
    });

    it('should handle API errors, update error state, and return undefined', async () => {
      const mockError = new Error('Create failed');
      mockedApiClient.post.mockRejectedValue(mockError);

      const createPromise = useTestStore.getState().create(newItemPayload);
      expect(useTestStore.getState().loading).toBe(true);

      const result = await createPromise;

      expect(mockedApiClient.post).toHaveBeenCalledWith(endpoint, newItemPayload);
      expect(result).toBeUndefined();
      expect(mockedApiClient.get).not.toHaveBeenCalled();
      expect(useTestStore.getState().error).toEqual(mockError);
      expect(useTestStore.getState().loading).toBe(false);
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

      const updatePromise = useTestStore.getState().update(itemId, updatePayload);
      expect(useTestStore.getState().loading).toBe(true);

      const result = await updatePromise;

      expect(mockedApiClient.put).toHaveBeenCalledWith(`${endpoint}/${itemId}`, updatePayload);
      expect(result).toEqual(updatedItem);
      expect(mockedApiClient.get).toHaveBeenCalledWith(endpoint, {});
      expect(useTestStore.getState().items).toEqual([updatedItem]);
      expect(useTestStore.getState().loading).toBe(false);
      expect(useTestStore.getState().error).toBeNull();
    });

    it('should handle API errors, update error state, and return undefined', async () => {
      const mockError = new Error('Update failed');
      mockedApiClient.put.mockRejectedValue(mockError);

      const updatePromise = useTestStore.getState().update(itemId, updatePayload);
      expect(useTestStore.getState().loading).toBe(true);

      const result = await updatePromise;

      expect(mockedApiClient.put).toHaveBeenCalledWith(`${endpoint}/${itemId}`, updatePayload);
      expect(result).toBeUndefined();
      expect(mockedApiClient.get).not.toHaveBeenCalled();
      expect(useTestStore.getState().error).toEqual(mockError);
      expect(useTestStore.getState().loading).toBe(false);
    });
  });

  describe('remove', () => {
    const itemId = 1;

    beforeEach(() => {
      mockedApiClient.get.mockResolvedValue({ objects: [] }); // Mock fetchAll
    });

    it('should call apiClient.delete, then fetchAll', async () => {
      mockedApiClient.delete.mockResolvedValue(undefined);

      const removePromise = useTestStore.getState().remove(itemId);
      expect(useTestStore.getState().loading).toBe(true);

      await removePromise;

      expect(mockedApiClient.delete).toHaveBeenCalledWith(`${endpoint}/${itemId}`);
      expect(mockedApiClient.get).toHaveBeenCalledWith(endpoint, {});
      expect(useTestStore.getState().items).toEqual([]);
      expect(useTestStore.getState().loading).toBe(false);
      expect(useTestStore.getState().error).toBeNull();
    });

    it('should handle API errors and update error state', async () => {
      const mockError = new Error('Delete failed');
      mockedApiClient.delete.mockRejectedValue(mockError);

      const removePromise = useTestStore.getState().remove(itemId);
      expect(useTestStore.getState().loading).toBe(true);

      await removePromise;

      expect(mockedApiClient.delete).toHaveBeenCalledWith(`${endpoint}/${itemId}`);
      expect(mockedApiClient.get).not.toHaveBeenCalled();
      expect(useTestStore.getState().error).toEqual(mockError);
      expect(useTestStore.getState().loading).toBe(false);
    });
  });

  // Test extending store
  describe('extendStore', () => {
    // Define the shape of the extended part
    interface ExtendedState {
        customState: string;
        customAction: (value: string) => void;
    }
    // Define the full state shape of the extended store
    type FullExtendedState = GenericState<TestItem> & GenericActions<TestItem> & ExtendedState;

    const extendedActionMock = jest.fn();
    let useExtendedStore: ReturnType<typeof createGenericStore<TestItem, ExtendedState>>;

    beforeEach(() => {
        extendedActionMock.mockClear();
        useExtendedStore = createGenericStore<TestItem, ExtendedState>(
            endpoint,
            (set, get) => ({
                customState: 'initial',
                customAction: (value: string) => {
                    extendedActionMock(value);
                    set({ customState: value }); // Merge state, don't replace
                }
            })
        );
        // Reset extended store state (merge, not replace)
        useExtendedStore.setState({ customState: 'initial' });
    });

    it('should initialize with custom state', () => {
        // Cast getState() result to the known extended type
        expect((useExtendedStore.getState() as FullExtendedState).customState).toBe('initial');
    });

    it('should allow calling custom actions which modify state', () => {
        // Cast getState() result to call custom action
        (useExtendedStore.getState() as FullExtendedState).customAction('updated');

        expect(extendedActionMock).toHaveBeenCalledWith('updated');
        expect((useExtendedStore.getState() as FullExtendedState).customState).toBe('updated');
    });
  });
}); 