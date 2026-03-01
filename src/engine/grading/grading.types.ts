/**
 * grading.types.ts
 * Types for the grading pipeline: steps, callbacks, options, and retry policy.
 *
 * Re-exports GradingResult from docx.types for convenience, as the grading
 * pipeline produces GradingResult objects consumed by the DOCX builder.
 */

export type { GradingResult } from '../docx/docx.types'

/** Steps in the grading pipeline, in execution order. */
export type GradingStep =
  | 'loading'          // Loading manifests and validating preconditions
  | 'processing-inbox' // Processing raw scans from inbox
  | 'loading-images'   // Reading task sheet + student scans as base64
  | 'building-prompt'  // Assembling the full grading prompt
  | 'calling-ai'       // Sending to AI provider (streaming)
  | 'parsing-response' // Parsing and validating AI JSON output
  | 'generating-docx'  // Building the DOCX document
  | 'saving-state'     // Persisting results and updating manifests

/** Progress callback payload for pipeline step transitions. */
export interface GradingProgress {
  runSlug: string
  studentSlug: string
  step: GradingStep
  /** 0-1 progress within the current step */
  progress: number
  /** Human-readable message */
  message: string
}

/** Streaming chunk from AI response. */
export interface StreamChunk {
  runSlug: string
  studentSlug: string
  /** The text delta from the AI stream */
  text: string
  /** Accumulated text so far */
  accumulated: string
}

/** Event emitted when grading completes for a student. */
export interface GradingCompleteEvent {
  runSlug: string
  studentSlug: string
  /** Total NP (Inhalt + Sprache) */
  totalNP: number
  /** Grade label, e.g. "gut-" */
  gradeLabel: string
  /** Path to generated DOCX file */
  docxPath: string
  /** Token usage stats */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/** Event emitted when grading fails for a student. */
export interface GradingErrorEvent {
  runSlug: string
  studentSlug: string
  error: string
  /** Whether this error is retryable */
  retryable: boolean
}

/** Callbacks for pipeline progress events. */
export interface GradingCallbacks {
  onProgress?: (event: GradingProgress) => void
  onStreamChunk?: (chunk: StreamChunk) => void
  onComplete?: (event: GradingCompleteEvent) => void
  onError?: (event: GradingErrorEvent) => void
}

/** Options for a single grading invocation. */
export interface GradeOptions {
  /** Override the model config for this grading */
  modelOverride?: {
    provider: 'anthropic' | 'google'
    model: string
    maxTokens?: number
    temperature?: number
  }
  /** Force re-grading even if already graded */
  force?: boolean
  /** Skip inbox processing (assume scans are already in place) */
  skipInboxProcessing?: boolean
}

/** Retry policy for AI calls. */
export interface RetryPolicy {
  /** Max retries for rate limit errors (429) */
  rateLimitRetries: number
  /** Max retries for server errors (500/503) */
  serverErrorRetries: number
  /** Max retries for JSON parse failures */
  parseFailureRetries: number
  /** Base delay in ms for exponential backoff */
  baseDelayMs: number
  /** Maximum delay in ms */
  maxDelayMs: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  rateLimitRetries: 5,
  serverErrorRetries: 2,
  parseFailureRetries: 1,
  baseDelayMs: 1000,
  maxDelayMs: 60000
}

/** Batch grading control state. */
export type BatchState = 'idle' | 'running' | 'paused' | 'cancelled'

/** Batch grading options. */
export interface BatchGradeOptions extends GradeOptions {
  /** Student slugs to grade. If empty, grades all students in the run. */
  studentSlugs?: string[]
  /** Delay between students in ms (to avoid rate limiting) */
  interStudentDelayMs?: number
}
