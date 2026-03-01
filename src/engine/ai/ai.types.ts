/**
 * ai.types.ts
 * Types for the AI provider abstraction layer.
 *
 * These types define the contract between the grading pipeline and
 * the AI provider implementations (Claude, Gemini).
 */

/** A single image input for the AI vision call. */
export interface ImageInput {
  /** Base64-encoded image data (no data URI prefix) */
  data: string
  /** MIME type of the image */
  mediaType: 'image/jpeg' | 'image/png'
}

/** Request payload for an AI grading call. */
export interface AIGradingRequest {
  /** Assembled system prompt (base + agent + JSON schema instructions) */
  systemPrompt: string
  /** User message text (e.g. "Korrigiere die folgende Klausur...") */
  userMessage: string
  /** Task sheet images (shared across all students in a run) */
  taskSheetImages: ImageInput[]
  /** Student scan images */
  studentImages: ImageInput[]
  /** Maximum tokens for the response */
  maxTokens: number
  /** Temperature for the AI model */
  temperature: number
}

/** Token usage statistics from an AI call. */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

/** Response from a non-streaming AI grading call. */
export interface AIGradingResponse {
  /** Raw text output from the AI model */
  text: string
  /** Token usage statistics */
  usage: TokenUsage
  /** Model ID that was actually used */
  model: string
  /** Response latency in ms */
  latencyMs: number
}

/** Callbacks for streaming AI responses. */
export interface StreamCallbacks {
  /** Called for each text delta from the stream */
  onChunk?: (text: string) => void
  /** Called when the stream completes with the full response */
  onComplete?: (response: AIGradingResponse) => void
  /** Called if the stream encounters an error */
  onError?: (error: Error) => void
}

/** Configuration for an AI provider instance. */
export interface AIProviderConfig {
  /** API key for the provider */
  apiKey: string
  /** Model identifier */
  model: string
}

/** AI error categories for retry logic. */
export type AIErrorCategory =
  | 'rate_limit'      // 429 - back off and retry
  | 'server_error'    // 500/503 - exponential backoff
  | 'auth_error'      // 401/403 - no retry, surface to user
  | 'invalid_request' // 400 - no retry, likely a prompt issue
  | 'network_error'   // Connection issues - retry with backoff
  | 'unknown'         // Unexpected errors

/** Structured error from an AI provider call. */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly category: AIErrorCategory,
    public readonly statusCode?: number,
    public readonly retryAfterMs?: number
  ) {
    super(message)
    this.name = 'AIProviderError'
  }

  get isRetryable(): boolean {
    return (
      this.category === 'rate_limit' ||
      this.category === 'server_error' ||
      this.category === 'network_error'
    )
  }
}
