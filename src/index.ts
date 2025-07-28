import fetch from 'node-fetch';
import crypto from 'crypto';

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
  /** Default canary word length in characters (default: 8) */
  defaultCanaryLength?: number;
  /** Default format for embedding canary words (default: "<!-- {canary_word} -->") */
  defaultCanaryFormat?: string;
}

/**
 * Result of a canary word leakage check
 */
export interface CanaryLeakageResult {
  /** Whether the canary word was leaked in the completion */
  leaked: boolean;
  /** The canary word that was checked */
  canaryWord: string;
  /** Optional error message if the check failed */
  error?: string;
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
  /** Default canary word length */
  private defaultCanaryLength: number;
  /** Default format for embedding canary words */
  private defaultCanaryFormat: string;

  /**
   * Creates a new PromptCage client instance
   *
   * @param options - Configuration options
   * @throws {Error} When no API key is provided (neither in options nor environment variable)
   *
   * @example
   * ```ts
   * // Using environment variable
   * const promptCage = new PromptCage();
   *
   * // Using options object
   * const promptCage = new PromptCage({
   *   apiKey: 'your-api-key',
   *   maxWaitTime: 2000,
   *   defaultCanaryLength: 12,
   *   defaultCanaryFormat: '<!-- CANARY: {canary_word} -->'
   * });
   * ```
   */
  constructor(options?: PromptCageOptions) {
    this.apiKey = options?.apiKey || process.env.PROMPTCAGE_API_KEY || '';
    this.maxWaitTime = options?.maxWaitTime || 1000;
    this.defaultCanaryLength = options?.defaultCanaryLength || 8;
    this.defaultCanaryFormat =
      options?.defaultCanaryFormat || '<!-- {canary_word} -->'; // as a markdown comment

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

  /**
   * Generates a secure random canary word for injection testing
   *
   * @param length - Length of the canary word in characters (default: uses defaultCanaryLength)
   * @returns A secure random hexadecimal canary word
   */
  private generateCanaryWord(length?: number): string {
    const canaryLength = length || this.defaultCanaryLength;
    // Generate a secure random hexadecimal canary word
    return crypto
      .randomBytes(Math.ceil(canaryLength / 2))
      .toString('hex')
      .slice(0, canaryLength);
  }

  /**
   * Embeds a canary word into a prompt using the specified format
   *
   * @param prompt - The original prompt text
   * @param canaryWord - The canary word to embed (if not provided, generates one)
   * @param canaryFormat - Format string with {canary_word} placeholder (default: uses defaultCanaryFormat)
   * @returns Tuple of [prompt with canary, canary word used]
   *
   * @example
   * ```ts
   * const [promptWithCanary, canaryWord] = promptCage.addCanaryWord(
   *   'What is the capital of France?'
   * );
   * console.log(promptWithCanary);
   * // <!-- a1b2c3d4 -->
   * // What is the capital of France?
   *
   * // Custom canary word and format
   * const [customPrompt, customCanary] = promptCage.addCanaryWord(
   *   'Translate this text',
   *   'secret123',
   *   '--- TOKEN: {canary_word} ---'
   * );
   * ```
   */
  addCanaryWord(
    prompt: string,
    canaryWord?: string,
    canaryFormat?: string
  ): [string, string] {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }

    const canary = canaryWord || this.generateCanaryWord();
    const format = canaryFormat || this.defaultCanaryFormat;

    // Embed the canary word in the specified format
    const canaryComment = format.replace('{canary_word}', canary);
    const promptWithCanary = `${canaryComment}\n${prompt}`;

    return [promptWithCanary, canary];
  }

  /**
   * Checks if a canary word has been leaked in a completion/response
   *
   * This method performs a case-sensitive search for the canary word in the
   * completion text. It's designed to be fail-safe and will return leaked: false
   * in case of any errors during the check.
   *
   * @param completion - The AI model's response/completion to check
   * @param canaryWord - The canary word to look for
   * @returns Result indicating whether the canary was leaked
   *
   * @example
   * ```ts
   * const [promptWithCanary, canaryWord] = promptCage.addCanaryWord(
   *   'What is the capital of France?'
   * );
   *
   * // Send promptWithCanary to your AI model and get completion
   * const aiResponse = await yourAiModel.complete(promptWithCanary);
   *
   * const leakageResult = promptCage.isCanaryWordLeaked(aiResponse, canaryWord);
   * if (leakageResult.leaked) {
   *   console.log('Canary word was leaked! Possible injection detected.');
   * } else {
   *   console.log('Canary word was not leaked.');
   * }
   * ```
   */
  isCanaryWordLeaked(
    completion: string,
    canaryWord: string
  ): CanaryLeakageResult {
    try {
      if (!completion || typeof completion !== 'string') {
        return {
          leaked: false,
          canaryWord,
          error: 'Completion must be a non-empty string',
        };
      }

      if (!canaryWord || typeof canaryWord !== 'string') {
        return {
          leaked: false,
          canaryWord: canaryWord || '',
          error: 'Canary word must be a non-empty string',
        };
      }

      // Check if the canary word appears in the completion (case-sensitive)
      const leaked = completion.includes(canaryWord);

      return {
        leaked,
        canaryWord,
      };
    } catch (error) {
      // Fail-safe: return not leaked if there's any error
      return {
        leaked: false,
        canaryWord: canaryWord || '',
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during canary check',
      };
    }
  }
}

export default PromptCage;
