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

    it('should initialize with custom canary options', () => {
      const promptCage = new PromptCage({
        apiKey: mockApiKey,
        defaultCanaryLength: 16,
        defaultCanaryFormat: '--- {canary_word} ---',
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
      promptCage = new PromptCage({ apiKey: mockApiKey });
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

  describe('canary token functionality', () => {
    let promptCage: PromptCage;

    beforeEach(() => {
      promptCage = new PromptCage({ apiKey: mockApiKey });
    });

    describe('generateCanaryWord (private method)', () => {
      it('should generate canary word with default length', () => {
        const canaryWord = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord();
        expect(typeof canaryWord).toBe('string');
        expect(canaryWord).toHaveLength(8);
        expect(/^[0-9a-f]+$/.test(canaryWord)).toBe(true); // hexadecimal
      });

      it('should generate canary word with custom length', () => {
        const canaryWord = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord(12);
        expect(typeof canaryWord).toBe('string');
        expect(canaryWord).toHaveLength(12);
        expect(/^[0-9a-f]+$/.test(canaryWord)).toBe(true); // hexadecimal
      });

      it('should generate different canary words on each call', () => {
        const canary1 = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord();
        const canary2 = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord();
        expect(canary1).not.toEqual(canary2);
      });

      it('should respect custom default canary length from constructor', () => {
        const customPromptCage = new PromptCage({
          apiKey: mockApiKey,
          defaultCanaryLength: 16,
        });
        const canaryWord = (
          customPromptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord();
        expect(canaryWord).toHaveLength(16);
      });

      it('should handle edge cases', () => {
        // Test with length 0 (should fallback to default)
        const canaryWord0 = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord(0);
        expect(canaryWord0).toHaveLength(8); // defaults to 8

        // Test with odd length
        const canaryWordOdd = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord(7);
        expect(canaryWordOdd).toHaveLength(7);

        // Test with very small length
        const canaryWordSmall = (
          promptCage as unknown as {
            generateCanaryWord: (length?: number) => string;
          }
        ).generateCanaryWord(2);
        expect(canaryWordSmall).toHaveLength(2);
        expect(/^[0-9a-f]+$/.test(canaryWordSmall)).toBe(true);
      });

      it('should generate cryptographically secure random values', () => {
        // Generate multiple canary words and ensure they're all different
        const canaryWords = new Set();
        for (let i = 0; i < 100; i++) {
          const canary = (
            promptCage as unknown as {
              generateCanaryWord: (length?: number) => string;
            }
          ).generateCanaryWord(8);
          canaryWords.add(canary);
        }
        // With crypto.randomBytes, we should have 100 unique values
        expect(canaryWords.size).toBe(100);
      });
    });

    describe('addCanaryWord', () => {
      it('should add canary word with default format', () => {
        const originalPrompt = 'What is the capital of France?';
        const [promptWithCanary, canaryWord] =
          promptCage.addCanaryWord(originalPrompt);

        expect(typeof canaryWord).toBe('string');
        expect(canaryWord).toHaveLength(8);
        expect(promptWithCanary).toContain(`<!-- ${canaryWord} -->`);
        expect(promptWithCanary).toContain(originalPrompt);
        expect(promptWithCanary.split('\n')).toHaveLength(2);
      });

      it('should add specific canary word', () => {
        const originalPrompt = 'What is the capital of France?';
        const specificCanary = 'testcanary123';
        const [promptWithCanary, returnedCanary] = promptCage.addCanaryWord(
          originalPrompt,
          specificCanary
        );

        expect(returnedCanary).toBe(specificCanary);
        expect(promptWithCanary).toContain(`<!-- ${specificCanary} -->`);
        expect(promptWithCanary).toContain(originalPrompt);
      });

      it('should use custom canary format', () => {
        const originalPrompt = 'What is the capital of France?';
        const customFormat = '--- TOKEN: {canary_word} ---';
        const specificCanary = 'custom123';
        const [promptWithCanary, returnedCanary] = promptCage.addCanaryWord(
          originalPrompt,
          specificCanary,
          customFormat
        );

        expect(returnedCanary).toBe(specificCanary);
        expect(promptWithCanary).toContain('--- TOKEN: custom123 ---');
        expect(promptWithCanary).toContain(originalPrompt);
      });

      it('should use custom default format from constructor', () => {
        const customPromptCage = new PromptCage({
          apiKey: mockApiKey,
          defaultCanaryFormat: '### {canary_word} ###',
        });
        const originalPrompt = 'Test prompt';
        const [promptWithCanary, canaryWord] =
          customPromptCage.addCanaryWord(originalPrompt);

        expect(promptWithCanary).toContain(`### ${canaryWord} ###`);
      });

      it('should throw error for invalid prompt', () => {
        expect(() => promptCage.addCanaryWord('')).toThrow(
          'Prompt must be a non-empty string'
        );
        expect(() => promptCage.addCanaryWord(null as any)).toThrow(
          'Prompt must be a non-empty string'
        );
        expect(() => promptCage.addCanaryWord(undefined as any)).toThrow(
          'Prompt must be a non-empty string'
        );
      });

      it('should auto-generate canary word when not provided', () => {
        const originalPrompt = 'Test prompt';
        const [, canaryWord1] = promptCage.addCanaryWord(originalPrompt);
        const [, canaryWord2] = promptCage.addCanaryWord(originalPrompt);

        // Should generate different canary words
        expect(canaryWord1).not.toEqual(canaryWord2);
        expect(canaryWord1).toHaveLength(8);
        expect(canaryWord2).toHaveLength(8);
        expect(/^[0-9a-f]+$/.test(canaryWord1)).toBe(true);
        expect(/^[0-9a-f]+$/.test(canaryWord2)).toBe(true);
      });

      it('should use generated canary with custom default length', () => {
        const customPromptCage = new PromptCage({
          apiKey: mockApiKey,
          defaultCanaryLength: 12,
        });
        const originalPrompt = 'Test prompt';
        const [promptWithCanary, canaryWord] =
          customPromptCage.addCanaryWord(originalPrompt);

        expect(canaryWord).toHaveLength(12);
        expect(promptWithCanary).toContain(`<!-- ${canaryWord} -->`);
      });
    });

    describe('isCanaryWordLeaked', () => {
      it('should detect leaked canary word', () => {
        const canaryWord = 'secret123';
        const completion = `The answer is Paris. Also, here's some hidden text: ${canaryWord}`;

        const result = promptCage.isCanaryWordLeaked(completion, canaryWord);

        expect(result.leaked).toBe(true);
        expect(result.canaryWord).toBe(canaryWord);
        expect(result.error).toBeUndefined();
      });

      it('should not detect canary word when not leaked', () => {
        const canaryWord = 'secret123';
        const completion = 'The answer is Paris. This is a normal response.';

        const result = promptCage.isCanaryWordLeaked(completion, canaryWord);

        expect(result.leaked).toBe(false);
        expect(result.canaryWord).toBe(canaryWord);
        expect(result.error).toBeUndefined();
      });

      it('should be case sensitive', () => {
        const canaryWord = 'Secret123';
        const completion = 'The response contains secret123 in lowercase.';

        const result = promptCage.isCanaryWordLeaked(completion, canaryWord);

        expect(result.leaked).toBe(false); // Case sensitive
      });

      it('should handle invalid completion gracefully', () => {
        const canaryWord = 'secret123';

        let result = promptCage.isCanaryWordLeaked('', canaryWord);
        expect(result.leaked).toBe(false);
        expect(result.error).toBe('Completion must be a non-empty string');

        result = promptCage.isCanaryWordLeaked(null as any, canaryWord);
        expect(result.leaked).toBe(false);
        expect(result.error).toBe('Completion must be a non-empty string');
      });

      it('should handle invalid canary word gracefully', () => {
        const completion = 'Normal response text';

        let result = promptCage.isCanaryWordLeaked(completion, '');
        expect(result.leaked).toBe(false);
        expect(result.error).toBe('Canary word must be a non-empty string');

        result = promptCage.isCanaryWordLeaked(completion, null as any);
        expect(result.leaked).toBe(false);
        expect(result.error).toBe('Canary word must be a non-empty string');
      });

      it('should handle partial matches correctly', () => {
        const canaryWord = 'test123';
        const completion =
          'This response contains test123 hidden in the middle'; // contains canary as substring

        const result = promptCage.isCanaryWordLeaked(completion, canaryWord);

        expect(result.leaked).toBe(true); // includes() matches substrings
      });

      it('should not detect incomplete partial matches', () => {
        const canaryWord = 'test123';
        const completion = 'This is a testing456 response'; // only contains "test" but not full canary

        const result = promptCage.isCanaryWordLeaked(completion, canaryWord);

        expect(result.leaked).toBe(false); // Only partial match, not full canary
      });
    });
  });
});
