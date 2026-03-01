/**
 * file-watcher.service.ts
 * Watches student inbox directories for new scan files using chokidar.
 *
 * When images are dropped into a student's inbox/, the watcher notifies
 * the renderer so it can prompt the user to process them.
 */

import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import * as path from 'path'

import { loadConfig } from '../../engine/workspace/workspace.manager'

/** Active watcher instance. */
let watcher: FSWatcher | null = null

/** Currently watched workspace root. */
let currentRoot: string | null = null

/**
 * Send an event to all renderer windows.
 */
function sendToRenderers(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

/**
 * Parse an inbox file path to extract run and student slugs.
 * Expected path format: <workspaceRoot>/<runSlug>/students/<studentSlug>/inbox/<filename>
 */
function parseInboxPath(
  filePath: string,
  workspaceRoot: string
): { runSlug: string; studentSlug: string; filename: string } | null {
  const relative = path.relative(workspaceRoot, filePath)
  const parts = relative.split(path.sep)

  // Expected: [runSlug, 'students', studentSlug, 'inbox', filename]
  if (
    parts.length >= 5 &&
    parts[1] === 'students' &&
    parts[3] === 'inbox'
  ) {
    return {
      runSlug: parts[0],
      studentSlug: parts[2],
      filename: parts.slice(4).join(path.sep)
    }
  }
  return null
}

/**
 * Start watching all inbox directories in the workspace.
 * Handles macOS permission restrictions gracefully - if the workspace
 * directory doesn't exist or isn't accessible, the watcher silently
 * skips until the directory becomes available.
 */
export async function startFileWatcher(): Promise<void> {
  let config
  try {
    config = await loadConfig()
  } catch {
    console.warn('File watcher: Could not load config, skipping')
    return
  }
  const workspaceRoot = config.workspaceRoot

  // Don't restart if already watching the same root
  if (watcher && currentRoot === workspaceRoot) return

  // Stop any existing watcher
  await stopFileWatcher()

  // Verify workspace root exists and is accessible before watching
  try {
    const fs = await import('fs/promises')
    await fs.access(workspaceRoot)
  } catch {
    console.warn(`File watcher: Workspace root not accessible: ${workspaceRoot}`)
    return
  }

  currentRoot = workspaceRoot

  // Watch for new files in any student inbox
  const pattern = path.join(workspaceRoot, '*/students/*/inbox/**/*.{jpg,jpeg,png,JPG,JPEG,PNG}')

  watcher = watch(pattern, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    },
    // Suppress EPERM errors on macOS when watching protected directories
    ignorePermissionErrors: true
  })

  watcher.on('add', (filePath) => {
    const parsed = parseInboxPath(filePath, workspaceRoot)
    if (parsed) {
      sendToRenderers('files:inboxChanged', {
        type: 'add',
        ...parsed
      })
    }
  })

  watcher.on('error', (error) => {
    console.warn('File watcher error (non-fatal):', error.message)
  })
}

/**
 * Stop the file watcher.
 */
export async function stopFileWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close()
    watcher = null
    currentRoot = null
  }
}

/**
 * Restart the file watcher (e.g. after workspace root changes).
 */
export async function restartFileWatcher(): Promise<void> {
  await stopFileWatcher()
  await startFileWatcher()
}
