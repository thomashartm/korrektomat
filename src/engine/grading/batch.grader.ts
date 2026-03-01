/**
 * batch.grader.ts
 * Sequential batch grading with pause/resume/cancel support.
 *
 * Processes students one at a time with configurable inter-student delays
 * to avoid rate limiting. Emits progress events for each student.
 */

import { gradeStudent } from './grading.pipeline'
import { listStudents } from '../workspace/workspace.manager'
import type {
  GradingCallbacks,
  BatchGradeOptions,
  BatchState,
  GradingProgress,
  GradingCompleteEvent,
  GradingErrorEvent
} from './grading.types'
import { DEFAULT_RETRY_POLICY } from './grading.types'

/** Batch progress event emitted for overall batch tracking. */
export interface BatchProgressEvent {
  /** Current batch state */
  state: BatchState
  /** Total students in the batch */
  total: number
  /** Number of students completed (success or error) */
  completed: number
  /** Number of students graded successfully */
  succeeded: number
  /** Number of students that failed */
  failed: number
  /** Currently grading student slug (if running) */
  currentStudent?: string
  /** Per-student results */
  results: BatchStudentResult[]
}

export interface BatchStudentResult {
  studentSlug: string
  studentName: string
  status: 'pending' | 'grading' | 'success' | 'error' | 'skipped'
  docxPath?: string
  totalNP?: number
  gradeLabel?: string
  error?: string
}

/** Callbacks specific to batch grading. */
export interface BatchCallbacks extends GradingCallbacks {
  onBatchProgress?: (event: BatchProgressEvent) => void
}

/**
 * BatchGrader handles sequential grading of multiple students with
 * pause/resume/cancel control flow.
 */
export class BatchGrader {
  private _state: BatchState = 'idle'
  private _pauseResolve: (() => void) | null = null

  get state(): BatchState {
    return this._state
  }

  /**
   * Start batch grading for a run.
   */
  async start(
    workspaceRoot: string,
    runSlug: string,
    callbacks: BatchCallbacks = {},
    options: BatchGradeOptions = {}
  ): Promise<BatchProgressEvent> {
    if (this._state === 'running') {
      throw new Error('Batch grading is already running')
    }

    this._state = 'running'
    const interDelay = options.interStudentDelayMs ?? 2000

    // Determine which students to grade
    const allStudents = await listStudents(workspaceRoot, runSlug)
    const targetSlugs = options.studentSlugs && options.studentSlugs.length > 0
      ? options.studentSlugs
      : allStudents.map((s) => s.slug)

    const results: BatchStudentResult[] = targetSlugs.map((slug) => {
      const student = allStudents.find((s) => s.slug === slug)
      return {
        studentSlug: slug,
        studentName: student?.name ?? slug,
        status: 'pending' as const
      }
    })

    let succeeded = 0
    let failed = 0

    const emitBatch = (currentStudent?: string): void => {
      callbacks.onBatchProgress?.({
        state: this._state,
        total: results.length,
        completed: succeeded + failed,
        succeeded,
        failed,
        currentStudent,
        results: [...results]
      })
    }

    emitBatch()

    for (let i = 0; i < results.length; i++) {
      // Read state through getter to avoid TypeScript narrowing issues
      // (state can be changed externally via pause/cancel/resume)
      const currentState = (): BatchState => this._state

      // Check for cancellation
      if (currentState() === 'cancelled') {
        for (let j = i; j < results.length; j++) {
          results[j].status = 'skipped'
        }
        break
      }

      // Handle pause
      if (currentState() === 'paused') {
        emitBatch()
        await new Promise<void>((resolve) => {
          this._pauseResolve = resolve
        })
        // After resume, check for cancellation again
        if (currentState() === 'cancelled') {
          for (let j = i; j < results.length; j++) {
            results[j].status = 'skipped'
          }
          break
        }
      }

      const result = results[i]
      result.status = 'grading'
      emitBatch(result.studentSlug)

      try {
        // Check if student should be skipped (already graded and not forcing)
        const student = allStudents.find((s) => s.slug === result.studentSlug)
        if (student?.status === 'graded' && !options.force) {
          result.status = 'skipped'
          result.totalNP = student.finalGrade ?? undefined
          result.gradeLabel = student.gradeLabel ?? undefined
          continue
        }

        const docxPath = await gradeStudent(
          workspaceRoot,
          runSlug,
          result.studentSlug,
          {
            onProgress: (event: GradingProgress) => {
              callbacks.onProgress?.(event)
            },
            onStreamChunk: callbacks.onStreamChunk,
            onComplete: (event: GradingCompleteEvent) => {
              result.docxPath = event.docxPath
              result.totalNP = event.totalNP
              result.gradeLabel = event.gradeLabel
              callbacks.onComplete?.(event)
            },
            onError: (event: GradingErrorEvent) => {
              callbacks.onError?.(event)
            }
          },
          options,
          DEFAULT_RETRY_POLICY
        )

        result.status = 'success'
        result.docxPath = docxPath
        succeeded++
      } catch (error) {
        result.status = 'error'
        result.error = error instanceof Error ? error.message : String(error)
        failed++

        callbacks.onError?.({
          runSlug,
          studentSlug: result.studentSlug,
          error: result.error,
          retryable: false
        })
      }

      emitBatch()

      // Inter-student delay (skip after last student)
      if (i < results.length - 1 && this._state === 'running') {
        await new Promise<void>((resolve) => setTimeout(resolve, interDelay))
      }
    }

    this._state = 'idle'

    const finalEvent: BatchProgressEvent = {
      state: 'idle',
      total: results.length,
      completed: succeeded + failed,
      succeeded,
      failed,
      results
    }

    emitBatch()
    return finalEvent
  }

  /**
   * Pause batch grading. The current student will finish before pausing.
   */
  pause(): void {
    if (this._state === 'running') {
      this._state = 'paused'
    }
  }

  /**
   * Resume batch grading after a pause.
   */
  resume(): void {
    if (this._state === 'paused') {
      this._state = 'running'
      this._pauseResolve?.()
      this._pauseResolve = null
    }
  }

  /**
   * Cancel batch grading. The current student will finish, remaining are skipped.
   */
  cancel(): void {
    if (this._state === 'running' || this._state === 'paused') {
      this._state = 'cancelled'
      // If paused, unblock the pause wait
      this._pauseResolve?.()
      this._pauseResolve = null
    }
  }
}
