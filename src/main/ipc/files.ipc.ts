/**
 * files.ipc.ts
 * IPC handlers for file operations: image selection, inbox processing, image loading.
 */

import { ipcMain, dialog } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

import {
  processStudentInbox,
  loadConfig
} from '../../engine/workspace/workspace.manager'

export function registerFilesIPC(): void {
  /**
   * Open a native file dialog to select image files.
   * Returns an array of selected file paths.
   */
  ipcMain.handle('files:selectImages', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  /**
   * Open a native folder dialog.
   * Returns the selected folder path or null if cancelled.
   */
  ipcMain.handle('files:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  /**
   * Process a student's inbox: compress images and move to scans/.
   */
  ipcMain.handle(
    'files:processInbox',
    async (_event, runSlug: string, studentSlug: string) => {
      const config = await loadConfig()
      return processStudentInbox(config.workspaceRoot, runSlug, studentSlug)
    }
  )

  /**
   * Load an image file as a data URL for display in the renderer.
   */
  ipcMain.handle('files:getImageDataUrl', async (_event, imagePath: string) => {
    const data = await fs.readFile(imagePath)
    const ext = path.extname(imagePath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${data.toString('base64')}`
  })
}
