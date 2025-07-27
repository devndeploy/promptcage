import fetch from 'node-fetch';

/**
 * Response from the PromptCage API detection endpoint
 */
export interface DetectionResponse {
  /** Whether the prompt is considered safe from injection attacks */
  safe: boolean;
  /** Unique identifier for this detection request */
  detectionId: string;
  /** Error message if the request failed (optional) */
  error?: string;
}

/**
 * Request payload sent to the PromptCage API
 */
export interface DetectionRequest {
  /** The text prompt to analyze for injection attacks */
  prompt: string;
  /** Anonymous user identifier for tracking and analytics */
  userAnonId?: string;
  /** Additional metadata for the detection request */
  metadata?: Record<string, any>;
}

/**
 * Configuration options for the PromptCage client
 */
export interface PromptCageOptions {
  /** Your PromptCage API key. If not provided, will use PROMPTCAGE_API_KEY environment variable */
  apiKey?: string;
  /** Maximum wait time in milliseconds before treating request as safe (default: 1000ms) */
  maxWaitTime?: number;
}

/**
 * PromptCage client for detecting prompt injection attacks
 *
 * This class provides a fail-safe interface to the PromptCage API for detecting
 * potential prompt injection attacks in user input. The client is designed to
 * never block your application - it fails open in all error scenarios.
 *
 * @example
 * ```ts
 * // Basic usage with environment variable
 * const promptCage = new PromptCage();
 *
 * // With API key directly
 * const promptCage = new PromptCage('your-api-key');
 *
 * // With configuration options
 * const promptCage = new PromptCage({
 *   apiKey: 'your-api-key',
 *   maxWaitTime: 3000
 * });
 * ```
 */
export class PromptCage {
  /** The API key for authentication with PromptCage */
  private apiKey: string;
  /** Base URL for the PromptCage API */
  private baseUrl = 'https://promptcage.com/api/v1';
  /** Maximum wait time in milliseconds before aborting requests */
  private maxWaitTime: number;

  /**
   * Creates a new PromptCage client instance
   *
   * @param options - Configuration options or API key string
   * @throws {Error} When no API key is provided (neither in options nor environment variable)
   *
   * @example
   * ```ts
   * // Using environment variable
   * const promptCage = new PromptCage();
   *
   * // Using API key string
   * const promptCage = new PromptCage('your-api-key');
   *
   * // Using options object
   * const promptCage = new PromptCage({
   *   apiKey: 'your-api-key',
   *   maxWaitTime: 2000
   * });
   * ```
   */
  constructor(options?: PromptCageOptions | string) {
    if (typeof options === 'string') {
      this.apiKey = options;
      this.maxWaitTime = 1000;
    } else {
      this.apiKey = options?.apiKey || process.env.PROMPTCAGE_API_KEY || '';
      this.maxWaitTime = options?.maxWaitTime || 1000;
    }

    if (!this.apiKey) {
      throw new Error(
        'API key is required. Set PROMPTCAGE_API_KEY environment variable or pass it to the constructor.'
      );
    }
  }

  /**
   * Detects potential prompt injection attacks in the given text
   *
   * This method sends the prompt to the PromptCage API for analysis. The method
   * is designed to be fail-safe - if the API is unavailable, slow, or returns
   * an error, the method will return `safe: true` with an error message.
   *
   * @param prompt - The text to analyze for prompt injection attacks
   * @param userAnonId - Optional anonymous user identifier for tracking
   * @param metadata - Optional metadata object for additional context
   * @returns Promise that resolves to detection results
   * @throws {Error} When prompt is empty or not a string
   *
   * @example
   * ```ts
   * const result = await promptCage.detectInjection('User input here');
   *
   * if (result.safe) {
   *   console.log('Prompt is safe');
   * } else {
   *   console.log('Injection detected!');
   *   console.log('Detection ID:', result.detectionId);
   * }
   *
   * // With user tracking and metadata
   * const result = await promptCage.detectInjection(
   *   'User input here',
   *   'user-123',
   *   { source: 'web-app', sessionId: 'sess_456' }
   * );
   * ```
   */
  async detectInjection(
    prompt: string,
    userAnonId?: string,
    metadata?: Record<string, any>
  ): Promise<DetectionResponse> {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }

    const requestBody: DetectionRequest = {
      prompt,
      ...(userAnonId && { userAnonId }),
      ...(metadata && { metadata }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.maxWaitTime);

    try {
      const response = await fetch(`${this.baseUrl}/detect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          safe: true,
          detectionId: '',
          error: `API request failed with status ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as DetectionResponse;

      return {
        safe: data.safe || false,
        detectionId: data.detectionId || '',
        error: data.error,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          safe: true,
          detectionId: '',
          error: `Request exceeded max wait time of ${this.maxWaitTime}ms`,
        };
      }

      return {
        safe: true,
        detectionId: '',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export default PromptCage;
