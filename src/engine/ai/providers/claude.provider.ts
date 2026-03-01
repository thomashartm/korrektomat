/**
 * claude.provider.ts
 * Anthropic Claude provider implementation with vision and streaming support.
 *
 * Uses @anthropic-ai/sdk for API communication. Supports all Claude models
 * with vision capability (Sonnet, Opus).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, ContentBlockParam, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages'

import type { AIProvider } from '../ai.provider'
import type {
  AIGradingRequest,
  AIGradingResponse,
  AIProviderConfig,
  StreamCallbacks,
  TokenUsage
} from '../ai.types'
import { AIProviderError } from '../ai.types'

export class ClaudeProvider implements AIProvider {
  readonly name = 'anthropic' as const
  readonly model: string
  private client: Anthropic

  constructor(config: AIProviderConfig) {
    this.model = config.model
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async grade(request: AIGradingRequest): Promise<AIGradingResponse> {
    const startTime = Date.now()
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [this.buildUserMessage(request)]
      })

      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')

      const usage: TokenUsage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }

      return {
        text,
        usage,
        model: message.model,
        latencyMs: Date.now() - startTime
      }
    } catch (error) {
      throw this.wrapError(error)
    }
  }

  async gradeStream(
    request: AIGradingRequest,
    callbacks: StreamCallbacks
  ): Promise<AIGradingResponse> {
    const startTime = Date.now()
    let accumulated = ''

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [this.buildUserMessage(request)]
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          accumulated += event.delta.text
          callbacks.onChunk?.(event.delta.text)
        }
      }

      const finalMessage = await stream.finalMessage()

      const usage: TokenUsage = {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens
      }

      const response: AIGradingResponse = {
        text: accumulated,
        usage,
        model: finalMessage.model,
        latencyMs: Date.now() - startTime
      }

      callbacks.onComplete?.(response)
      return response
    } catch (error) {
      const wrapped = this.wrapError(error)
      callbacks.onError?.(wrapped)
      throw wrapped
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Make a minimal API call to verify the key
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
      return true
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false
      }
      // Network errors etc. - key might be valid but service unavailable
      return false
    }
  }

  /**
   * Build the multimodal user message with images.
   */
  private buildUserMessage(request: AIGradingRequest): MessageParam {
    const content: ContentBlockParam[] = []

    // Task sheet images first
    for (const img of request.taskSheetImages) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.data
        }
      } as ImageBlockParam)
    }

    // Student scan images
    for (const img of request.studentImages) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.data
        }
      } as ImageBlockParam)
    }

    // Text instruction
    content.push({
      type: 'text',
      text: request.userMessage
    })

    return { role: 'user', content }
  }

  /**
   * Convert SDK errors to AIProviderError with proper categorization.
   */
  private wrapError(error: unknown): AIProviderError {
    if (error instanceof Anthropic.APIError) {
      const status = error.status

      if (status === 429) {
        const retryAfter = this.parseRetryAfter(error)
        return new AIProviderError(
          `Rate limited: ${error.message}`,
          'rate_limit',
          429,
          retryAfter
        )
      }
      if (status === 401 || status === 403) {
        return new AIProviderError(
          `Authentication failed: ${error.message}`,
          'auth_error',
          status
        )
      }
      if (status === 400) {
        return new AIProviderError(
          `Invalid request: ${error.message}`,
          'invalid_request',
          400
        )
      }
      if (status && status >= 500) {
        return new AIProviderError(
          `Server error: ${error.message}`,
          'server_error',
          status
        )
      }
    }

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
        return new AIProviderError(error.message, 'network_error')
      }
      return new AIProviderError(error.message, 'unknown')
    }

    return new AIProviderError(String(error), 'unknown')
  }

  /**
   * Parse retry-after header from rate limit response.
   */
  private parseRetryAfter(error: InstanceType<typeof Anthropic.APIError>): number | undefined {
    const headers = error.headers
    if (!headers) return undefined
    const retryAfter = headers['retry-after']
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10)
      if (!isNaN(seconds)) return seconds * 1000
    }
    return undefined
  }
}
