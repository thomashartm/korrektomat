/**
 * grading.ipc.ts
 * IPC handlers for grading operations (single + batch).
 */

import { ipcMain, BrowserWindow } from 'electron'

import { gradeStudent, regenerateDocx } from '../../engine/grading/grading.pipeline'
import { BatchGrader } from '../../engine/grading/batch.grader'
import { loadConfig } from '../../engine/workspace/workspace.manager'
import type { GradeOptions, BatchGradeOptions } from '../../engine/grading/grading.types'

/** Active batch grader instance (one at a time). */
let activeBatchGrader: BatchGrader | null = null

/**
 * Send an event to all renderer windows.
 */
function sendToRenderers(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

export function registerGradingIPC(): void {
  // ── Single student grading ────────────────────────────────────────────

  ipcMain.handle(
    'grading:gradeStudent',
    async (_event, runSlug: string, studentSlug: string, options?: GradeOptions) => {
      const config = await loadConfig()
      await gradeStudent(config.workspaceRoot, runSlug, studentSlug, {
        onProgress: (event) => sendToRenderers('grading:progress', event),
        onStreamChunk: (chunk) => sendToRenderers('grading:streamChunk', chunk),
        onComplete: (event) => sendToRenderers('grading:complete', event),
        onError: (event) => sendToRenderers('grading:error', event)
      }, options)
    }
  )

  // ── Batch grading ─────────────────────────────────────────────────────

  ipcMain.handle(
    'grading:gradeBatch',
    async (_event, runSlug: string, studentSlugs: string[], options?: BatchGradeOptions) => {
      if (activeBatchGrader && activeBatchGrader.state === 'running') {
        throw new Error('A batch grading session is already running')
      }

      activeBatchGrader = new BatchGrader()
      const config = await loadConfig()

      const batchOptions: BatchGradeOptions = {
        ...options,
        studentSlugs: studentSlugs.length > 0 ? studentSlugs : undefined
      }

      // Run in background (don't await)
      activeBatchGrader.start(config.workspaceRoot, runSlug, {
        onProgress: (event) => sendToRenderers('grading:progress', event),
        onStreamChunk: (chunk) => sendToRenderers('grading:streamChunk', chunk),
        onComplete: (event) => sendToRenderers('grading:complete', event),
        onError: (event) => sendToRenderers('grading:error', event),
        onBatchProgress: (event) => sendToRenderers('grading:batchProgress', event)
      }, batchOptions).catch((err) => {
        sendToRenderers('grading:error', {
          runSlug,
          studentSlug: '',
          error: err instanceof Error ? err.message : String(err),
          retryable: false
        })
      })
    }
  )

  ipcMain.handle('grading:pauseBatch', async () => {
    activeBatchGrader?.pause()
  })

  ipcMain.handle('grading:resumeBatch', async () => {
    activeBatchGrader?.resume()
  })

  ipcMain.handle('grading:cancelBatch', async () => {
    activeBatchGrader?.cancel()
  })

  // ── Cancel individual grading ─────────────────────────────────────────

  ipcMain.handle(
    'grading:cancelGrading',
    async (_event, _runSlug: string, _studentSlug: string) => {
      // Individual cancellation is handled by aborting the AI provider call
      // For now, cancel the batch if running
      activeBatchGrader?.cancel()
    }
  )

  // ── Regenerate DOCX ───────────────────────────────────────────────────

  ipcMain.handle(
    'grading:regenerateDocx',
    async (_event, runSlug: string, studentSlug: string) => {
      const config = await loadConfig()
      return regenerateDocx(config.workspaceRoot, runSlug, studentSlug)
    }
  )
}
