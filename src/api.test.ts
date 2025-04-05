import axios, { AxiosRequestConfig } from 'axios';
import { initApiClient, apiClient, axiosInstance as apiInstanceInternal } from './api';

// Mock the entire axios module
jest.mock('axios');

// Use a type assertion for the mocked module
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the axios.create() function and the instance methods
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  request: jest.fn(),
  // Add other methods used by your apiClient if any
};

// Before each test, setup the mock for axios.create
beforeEach(() => {
  // Reset mocks to clear previous test states
  jest.clearAllMocks();

  // Reset the implementation of axios.create to return the clean mock instance
  mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  // Ensure instance is reset *before* potential init in other test blocks
  (apiInstanceInternal as any) = undefined;
});

describe('initApiClient', () => {
  it('should create an axios instance with given baseURL', () => {
    const config = { baseURL: 'http://test.com' };
    initApiClient(config);
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining(config));
  });

  it('should create an axios instance with default and custom headers merged', () => {
    const config = {
      baseURL: 'http://test.com',
      headers: { 'X-Custom': 'TestValue' }
    };
    initApiClient(config);

    expect(mockedAxios.create).toHaveBeenCalledTimes(1);
    // Assert the whole expression is not undefined
    const callArgs = mockedAxios.create.mock.calls[0][0]!;

    // Check base properties
    expect(callArgs).toMatchObject({
        baseURL: config.baseURL,
        withCredentials: true,
    });

    // Check headers specifically for deep merge
    expect(callArgs.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Custom': 'TestValue'
    });
  });

  it('should allow overriding default axios config', () => {
      const config = {
        baseURL: 'http://test.com',
        timeout: 5000,
        withCredentials: false // Override default
      };
      initApiClient(config);
      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: config.baseURL,
        timeout: config.timeout,
        withCredentials: config.withCredentials
      }));
  });
});

describe('apiClient (after initialization)', () => {
  const baseURL = 'http://test-api.com/api';
  const endpoint = '/users';

  beforeEach(() => {
    // Initialize before tests that require the client
    initApiClient({ baseURL });
  });

  // Test GET
  it('GET should call axiosInstance.request with correct method, url, and params', async () => {
    const params = { page: 1 };
    const mockResponse = { data: [{ id: 1, name: 'Test User' }] };
    mockAxiosInstance.request.mockResolvedValue(mockResponse);

    const result = await apiClient.get(endpoint, params);

    expect(mockAxiosInstance.request).toHaveBeenCalledWith({
      method: 'get',
      url: endpoint,
      params: params
    });
    expect(result).toEqual(mockResponse.data);
  });

  // Test POST
  it('POST should call axiosInstance.request with correct method, url, and data', async () => {
    const payload = { name: 'New User' };
    const mockResponse = { data: { id: 2, ...payload } };
    mockAxiosInstance.request.mockResolvedValue(mockResponse);

    const result = await apiClient.post(endpoint, payload);

    expect(mockAxiosInstance.request).toHaveBeenCalledWith({
      method: 'post',
      url: endpoint,
      data: payload
    });
    expect(result).toEqual(mockResponse.data);
  });

  // Test PUT
  it('PUT should call axiosInstance.request with correct method, url, and data', async () => {
    const userId = 2;
    const payload = { name: 'Updated User' };
    const mockResponse = { data: { id: userId, ...payload } };
    mockAxiosInstance.request.mockResolvedValue(mockResponse);

    const result = await apiClient.put(`${endpoint}/${userId}`, payload);

    expect(mockAxiosInstance.request).toHaveBeenCalledWith({
      method: 'put',
      url: `${endpoint}/${userId}`,
      data: payload
    });
    expect(result).toEqual(mockResponse.data);
  });

  // Test DELETE
  it('DELETE should call axiosInstance.request with correct method and url', async () => {
    const userId = 1;
    const params = { force: true };
    const mockResponse = { data: { success: true } }; // Example response
    mockAxiosInstance.request.mockResolvedValue(mockResponse);

    const result = await apiClient.delete(`${endpoint}/${userId}`, params);

    expect(mockAxiosInstance.request).toHaveBeenCalledWith({
      method: 'delete',
      url: `${endpoint}/${userId}`,
      params: params
    });
    expect(result).toEqual(mockResponse.data);
  });

  // Test postFile
  it('postFile should call axiosInstance.post with FormData and multipart header', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['content']), 'file.txt');
    const mockResponse = { data: { url: 'http://path/to/file.txt' } };
    mockAxiosInstance.post.mockResolvedValue(mockResponse); // postFile uses instance.post directly

    const result = await apiClient.postFile(endpoint, formData);

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    expect(result).toEqual(mockResponse.data);
  });

  // Test Error Handling - API Error (e.g., 4xx, 5xx)
  it('should handle API errors (error.response)', async () => {
    // Temporarily suppress console.error for this expected error log
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockApiError = {
      response: { status: 404, data: { message: 'Not Found' } }
    };
    mockAxiosInstance.request.mockRejectedValue(mockApiError);

    await expect(apiClient.get(endpoint)).rejects.toEqual(mockApiError.response.data);
    expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'get',
        url: endpoint,
        params: {}
    });

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  // Test Error Handling - No Response
   it('should handle network errors (error.request)', async () => {
    // Temporarily suppress console.error for this expected error log
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockNetworkError = {
      request: { /* some request object */ },
      message: 'Network Error'
    };
    mockAxiosInstance.request.mockRejectedValue(mockNetworkError);

    await expect(apiClient.get(endpoint)).rejects.toThrow('No response from server');
     expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'get',
        url: endpoint,
        params: {}
    });

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  // Test Error Handling - Setup Error
  it('should handle request setup errors (error.message)', async () => {
    // Temporarily suppress console.error for this expected error log
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const mockSetupError = new Error('Failed to setup request');
    mockAxiosInstance.request.mockRejectedValue(mockSetupError);

    await expect(apiClient.get(endpoint)).rejects.toThrow(`Request failed: ${mockSetupError.message}`);
     expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'get',
        url: endpoint,
        params: {}
    });

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});

// Separate describe block for testing *before* initialization
describe('apiClient (before initialization)', () => {
  it('should throw error if apiClient methods are called before initApiClient', async () => {
    // Ensure mocks are clear and axiosInstance is undefined
    jest.clearAllMocks();
    (apiInstanceInternal as any) = undefined;
    // Make sure create doesn't accidentally return a usable instance if called
    mockedAxios.create.mockReturnValue(undefined as any);

    // Now test the methods
    await expect(apiClient.get('/test')).rejects.toThrow('apiClient not initialized. Call initApiClient(config) first.');
    await expect(apiClient.post('/test', {})).rejects.toThrow('apiClient not initialized. Call initApiClient(config) first.');
    await expect(apiClient.put('/test', {})).rejects.toThrow('apiClient not initialized. Call initApiClient(config) first.');
    await expect(apiClient.delete('/test')).rejects.toThrow('apiClient not initialized. Call initApiClient(config) first.');
    await expect(apiClient.postFile('/test', new FormData())).rejects.toThrow('apiClient not initialized. Call initApiClient(config) first.');
  });
}); 