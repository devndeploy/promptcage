const mockFetch = jest.fn();
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: mockFetch,
}));

import { PromptCage } from '../src';

describe('PromptCage', () => {
  const mockApiKey = 'test-api-key';
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with provided API key (string)', () => {
      const promptCage = new PromptCage(mockApiKey);
      expect(promptCage).toBeInstanceOf(PromptCage);
    });

    it('should initialize with options object', () => {
      const promptCage = new PromptCage({ apiKey: mockApiKey });
      expect(promptCage).toBeInstanceOf(PromptCage);
    });

    it('should initialize with custom max wait time', () => {
      const promptCage = new PromptCage({
        apiKey: mockApiKey,
        maxWaitTime: 10000,
      });
      expect(promptCage).toBeInstanceOf(PromptCage);
    });

    it('should initialize with API key from environment variable', () => {
      process.env.PROMPTCAGE_API_KEY = mockApiKey;
      const promptCage = new PromptCage();
      expect(promptCage).toBeInstanceOf(PromptCage);
    });

    it('should throw error when no API key is provided', () => {
      delete process.env.PROMPTCAGE_API_KEY;
      expect(() => new PromptCage()).toThrow('API key is required');
    });
  });

  describe('detectInjection', () => {
    let promptCage: PromptCage;

    beforeEach(() => {
      promptCage = new PromptCage(mockApiKey);
    });

    it('should make successful API call and return safe result', async () => {
      const mockResponse = {
        safe: true,
        detectionId: 'det_123456',
        error: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await promptCage.detectInjection('test prompt');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://promptcage.com/api/v1/detect',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'test prompt',
          }),
          signal: expect.any(AbortSignal),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should return safe false when API detects injection', async () => {
      const mockResponse = {
        safe: false,
        detectionId: 'det_789',
        error: 'Prompt injection detected',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await promptCage.detectInjection('test prompt');

      expect(result).toEqual({
        safe: false,
        detectionId: 'det_789',
        error: 'Prompt injection detected',
      });
    });

    it('should include userAnonId and metadata in request', async () => {
      const mockResponse = {
        safe: false,
        detectionId: 'det_789',
        error: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await promptCage.detectInjection(
        'test prompt',
        'user-123',
        { source: 'test', version: '1.0' }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://promptcage.com/api/v1/detect',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'test prompt',
            userAnonId: 'user-123',
            metadata: { source: 'test', version: '1.0' },
          }),
          signal: expect.any(AbortSignal),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      } as any);

      const result = await promptCage.detectInjection('test prompt');

      expect(result).toEqual({
        safe: true,
        detectionId: '',
        error: 'API request failed with status 401: Unauthorized',
      });
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error') as any);

      const result = await promptCage.detectInjection('test prompt');

      expect(result).toEqual({
        safe: true,
        detectionId: '',
        error: 'Network error',
      });
    });

    it('should throw error for invalid prompt input', async () => {
      await expect(promptCage.detectInjection('')).rejects.toThrow(
        'Prompt must be a non-empty string'
      );
      await expect(promptCage.detectInjection(null as any)).rejects.toThrow(
        'Prompt must be a non-empty string'
      );
      await expect(
        promptCage.detectInjection(undefined as any)
      ).rejects.toThrow('Prompt must be a non-empty string');
    });

    it('should handle max wait time gracefully', async () => {
      const promptCageWithTimeout = new PromptCage({
        apiKey: mockApiKey,
        maxWaitTime: 10,
      });

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await promptCageWithTimeout.detectInjection('test prompt');

      expect(result).toEqual({
        safe: true,
        detectionId: '',
        error: 'Request exceeded max wait time of 10ms',
      });
    });
  });
});
