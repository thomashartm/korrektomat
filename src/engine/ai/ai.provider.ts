/**
 * ai.provider.ts
 * Abstract interface for AI providers and factory function.
 *
 * Each provider (Claude, Gemini) implements this interface to provide
 * a unified API for the grading pipeline.
 */

import type {
  AIGradingRequest,
  AIGradingResponse,
  AIProviderConfig,
  StreamCallbacks
} from './ai.types'

/**
 * Abstract interface that all AI providers must implement.
 *
 * Providers handle the specifics of API communication (request format,
 * image encoding, streaming protocol) while exposing a uniform interface
 * to the grading pipeline.
 */
export interface AIProvider {
  /** Provider name for logging and manifest entries */
  readonly name: 'anthropic' | 'google'

  /** Model identifier */
  readonly model: string

  /**
   * Send a grading request and get the complete response.
   * Use this for simple, non-streaming calls.
   */
  grade(request: AIGradingRequest): Promise<AIGradingResponse>

  /**
   * Send a grading request with streaming response.
   * Calls onChunk for each text delta, then onComplete with the full response.
   * Returns the final complete response.
   */
  gradeStream(request: AIGradingRequest, callbacks: StreamCallbacks): Promise<AIGradingResponse>

  /**
   * Validate that the API key works by making a minimal API call.
   * Returns true if valid, false otherwise.
   */
  validateApiKey(): Promise<boolean>
}

/**
 * Create an AI provider instance.
 *
 * Provider implementations are lazily imported to avoid loading
 * unused SDK dependencies.
 */
export async function createProvider(config: AIProviderConfig & { provider: 'anthropic' | 'google' }): Promise<AIProvider> {
  switch (config.provider) {
    case 'anthropic': {
      const { ClaudeProvider } = await import('./providers/claude.provider')
      return new ClaudeProvider(config)
    }
    case 'google': {
      const { GeminiProvider } = await import('./providers/gemini.provider')
      return new GeminiProvider(config)
    }
    default:
      throw new Error(`Unknown AI provider: ${(config as { provider: string }).provider}`)
  }
}
