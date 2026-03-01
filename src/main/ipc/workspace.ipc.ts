/**
 * workspace.ipc.ts
 * IPC handlers for run and student CRUD operations.
 * Includes graceful handling of workspace access errors (EPERM).
 */

import { ipcMain, shell, BrowserWindow } from 'electron'

import {
  createRun,
  listRuns,
  getRun,
  updateRun,
  deleteRun,
  setTaskSheet,
  addStudent,
  addStudentsBatch,
  listStudents,
  getStudent,
  removeStudent,
  loadConfig,
  resolveAccessibleWorkspace,
  WorkspaceAccessError
} from '../../engine/workspace/workspace.manager'
import { runDir, studentDir } from '../../engine/workspace/workspace.constants'
import type { CreateRunParams } from '../../engine/workspace/workspace.manager'

/**
 * Load config and resolve an accessible workspace root.
 * Emits workspace:accessError to all renderers if workspace is inaccessible.
 */
async function getWorkspaceRoot(): Promise<string> {
  const config = await loadConfig()
  try {
    return await resolveAccessibleWorkspace(config.workspaceRoot)
  } catch (err) {
    if (err instanceof WorkspaceAccessError) {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('workspace:accessError', {
          path: err.attemptedPath,
          fallbackAttempted: err.fallbackAttempted
        })
      }
    }
    throw err
  }
}

export function registerWorkspaceIPC(): void {
  ipcMain.handle('workspace:listRuns', async () => {
    const workspaceRoot = await getWorkspaceRoot()
    return listRuns(workspaceRoot)
  })

  ipcMain.handle('workspace:createRun', async (_event, params: CreateRunParams) => {
    const workspaceRoot = await getWorkspaceRoot()
    return createRun(workspaceRoot, params)
  })

  ipcMain.handle('workspace:getRun', async (_event, slug: string) => {
    const workspaceRoot = await getWorkspaceRoot()
    return getRun(workspaceRoot, slug)
  })

  ipcMain.handle(
    'workspace:updateRun',
    async (_event, slug: string, updates: any) => {
      const workspaceRoot = await getWorkspaceRoot()
      return updateRun(workspaceRoot, slug, updates)
    }
  )

  ipcMain.handle('workspace:deleteRun', async (_event, slug: string) => {
    const workspaceRoot = await getWorkspaceRoot()
    return deleteRun(workspaceRoot, slug)
  })

  ipcMain.handle(
    'workspace:setTaskSheet',
    async (_event, runSlug: string, filePaths: string[]) => {
      const workspaceRoot = await getWorkspaceRoot()
      return setTaskSheet(workspaceRoot, runSlug, filePaths)
    }
  )

  ipcMain.handle('workspace:openRunFolder', async (_event, slug: string) => {
    const workspaceRoot = await getWorkspaceRoot()
    const dir = runDir(workspaceRoot, slug)
    await shell.openPath(dir)
  })

  // ── Student operations ──────────────────────────────────────────────────

  ipcMain.handle(
    'workspace:addStudent',
    async (_event, runSlug: string, name: string) => {
      const workspaceRoot = await getWorkspaceRoot()
      return addStudent(workspaceRoot, runSlug, name)
    }
  )

  ipcMain.handle(
    'workspace:addStudentsBatch',
    async (_event, runSlug: string, names: string[]) => {
      const workspaceRoot = await getWorkspaceRoot()
      return addStudentsBatch(workspaceRoot, runSlug, names)
    }
  )

  ipcMain.handle('workspace:listStudents', async (_event, runSlug: string) => {
    const workspaceRoot = await getWorkspaceRoot()
    return listStudents(workspaceRoot, runSlug)
  })

  ipcMain.handle(
    'workspace:getStudent',
    async (_event, runSlug: string, studentSlug: string) => {
      const workspaceRoot = await getWorkspaceRoot()
      return getStudent(workspaceRoot, runSlug, studentSlug)
    }
  )

  ipcMain.handle(
    'workspace:removeStudent',
    async (_event, runSlug: string, studentSlug: string) => {
      const workspaceRoot = await getWorkspaceRoot()
      return removeStudent(workspaceRoot, runSlug, studentSlug)
    }
  )

  ipcMain.handle(
    'workspace:openStudentFolder',
    async (_event, runSlug: string, studentSlug: string) => {
      const workspaceRoot = await getWorkspaceRoot()
      const dir = studentDir(workspaceRoot, runSlug, studentSlug)
      await shell.openPath(dir)
    }
  )
}
