/**
 * gemini.provider.ts
 * Google Gemini provider implementation with vision and streaming support.
 *
 * Uses @google/generative-ai SDK for API communication. Supports Gemini models
 * with vision capability (Flash, Pro).
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Part,
  type GenerateContentResult
} from '@google/generative-ai'

import type { AIProvider } from '../ai.provider'
import type {
  AIGradingRequest,
  AIGradingResponse,
  AIProviderConfig,
  StreamCallbacks,
  TokenUsage
} from '../ai.types'
import { AIProviderError } from '../ai.types'

/** Safety settings: disable all blocking for educational grading content. */
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
]

export class GeminiProvider implements AIProvider {
  readonly name = 'google' as const
  readonly model: string
  private genAI: GoogleGenerativeAI

  constructor(config: AIProviderConfig) {
    this.model = config.model
    this.genAI = new GoogleGenerativeAI(config.apiKey)
  }

  async grade(request: AIGradingRequest): Promise<AIGradingResponse> {
    const startTime = Date.now()
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: request.systemPrompt,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: request.temperature
        }
      })

      const parts = this.buildParts(request)
      const result: GenerateContentResult = await model.generateContent(parts)
      const response = result.response
      const text = response.text()

      const usage = this.extractUsage(response)

      return {
        text,
        usage,
        model: this.model,
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
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: request.systemPrompt,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: request.temperature
        }
      })

      const parts = this.buildParts(request)
      const result = await model.generateContentStream(parts)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) {
          accumulated += text
          callbacks.onChunk?.(text)
        }
      }

      const finalResponse = await result.response
      const usage = this.extractUsage(finalResponse)

      const response: AIGradingResponse = {
        text: accumulated,
        usage,
        model: this.model,
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
      const model = this.genAI.getGenerativeModel({ model: this.model })
      await model.generateContent('Hi')
      return true
    } catch {
      return false
    }
  }

  /**
   * Build the multimodal parts array for a Gemini API call.
   * Images are passed as inline data, text as the final part.
   */
  private buildParts(request: AIGradingRequest): Part[] {
    const parts: Part[] = []

    // Task sheet images
    for (const img of request.taskSheetImages) {
      parts.push({
        inlineData: {
          mimeType: img.mediaType,
          data: img.data
        }
      })
    }

    // Student scan images
    for (const img of request.studentImages) {
      parts.push({
        inlineData: {
          mimeType: img.mediaType,
          data: img.data
        }
      })
    }

    // Text instruction
    parts.push({ text: request.userMessage })

    return parts
  }

  /**
   * Extract token usage from a Gemini response.
   */
  private extractUsage(response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): TokenUsage {
    const meta = response.usageMetadata
    return {
      inputTokens: meta?.promptTokenCount ?? 0,
      outputTokens: meta?.candidatesTokenCount ?? 0
    }
  }

  /**
   * Convert SDK errors to AIProviderError with proper categorization.
   */
  private wrapError(error: unknown): AIProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('429') || message.includes('resource_exhausted') || message.includes('rate')) {
        return new AIProviderError(error.message, 'rate_limit', 429)
      }
      if (message.includes('401') || message.includes('403') || message.includes('api key') || message.includes('permission')) {
        return new AIProviderError(error.message, 'auth_error')
      }
      if (message.includes('400') || message.includes('invalid')) {
        return new AIProviderError(error.message, 'invalid_request', 400)
      }
      if (message.includes('500') || message.includes('503') || message.includes('internal')) {
        return new AIProviderError(error.message, 'server_error')
      }
      if (message.includes('econnrefused') || message.includes('etimedout') || message.includes('network')) {
        return new AIProviderError(error.message, 'network_error')
      }
      return new AIProviderError(error.message, 'unknown')
    }

    return new AIProviderError(String(error), 'unknown')
  }
}
