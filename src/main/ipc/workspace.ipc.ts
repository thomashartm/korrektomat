/**
 * workspace.ipc.ts
 * IPC handlers for run and student CRUD operations.
 */

import { ipcMain, shell } from 'electron'

import {
  createRun,
  listRuns,
  getRun,
  deleteRun,
  setTaskSheet,
  addStudent,
  addStudentsBatch,
  listStudents,
  getStudent,
  removeStudent,
  loadConfig
} from '../../engine/workspace/workspace.manager'
import { runDir, studentDir } from '../../engine/workspace/workspace.constants'
import type { CreateRunParams } from '../../engine/workspace/workspace.manager'

export function registerWorkspaceIPC(): void {
  ipcMain.handle('workspace:listRuns', async () => {
    const config = await loadConfig()
    return listRuns(config.workspaceRoot)
  })

  ipcMain.handle('workspace:createRun', async (_event, params: CreateRunParams) => {
    const config = await loadConfig()
    return createRun(config.workspaceRoot, params)
  })

  ipcMain.handle('workspace:getRun', async (_event, slug: string) => {
    const config = await loadConfig()
    return getRun(config.workspaceRoot, slug)
  })

  ipcMain.handle('workspace:deleteRun', async (_event, slug: string) => {
    const config = await loadConfig()
    return deleteRun(config.workspaceRoot, slug)
  })

  ipcMain.handle(
    'workspace:setTaskSheet',
    async (_event, runSlug: string, filePaths: string[]) => {
      const config = await loadConfig()
      return setTaskSheet(config.workspaceRoot, runSlug, filePaths)
    }
  )

  ipcMain.handle('workspace:openRunFolder', async (_event, slug: string) => {
    const config = await loadConfig()
    const dir = runDir(config.workspaceRoot, slug)
    await shell.openPath(dir)
  })

  // ── Student operations ──────────────────────────────────────────────────

  ipcMain.handle(
    'workspace:addStudent',
    async (_event, runSlug: string, name: string) => {
      const config = await loadConfig()
      return addStudent(config.workspaceRoot, runSlug, name)
    }
  )

  ipcMain.handle(
    'workspace:addStudentsBatch',
    async (_event, runSlug: string, names: string[]) => {
      const config = await loadConfig()
      return addStudentsBatch(config.workspaceRoot, runSlug, names)
    }
  )

  ipcMain.handle('workspace:listStudents', async (_event, runSlug: string) => {
    const config = await loadConfig()
    return listStudents(config.workspaceRoot, runSlug)
  })

  ipcMain.handle(
    'workspace:getStudent',
    async (_event, runSlug: string, studentSlug: string) => {
      const config = await loadConfig()
      return getStudent(config.workspaceRoot, runSlug, studentSlug)
    }
  )

  ipcMain.handle(
    'workspace:removeStudent',
    async (_event, runSlug: string, studentSlug: string) => {
      const config = await loadConfig()
      return removeStudent(config.workspaceRoot, runSlug, studentSlug)
    }
  )

  ipcMain.handle(
    'workspace:openStudentFolder',
    async (_event, runSlug: string, studentSlug: string) => {
      const config = await loadConfig()
      const dir = studentDir(config.workspaceRoot, runSlug, studentSlug)
      await shell.openPath(dir)
    }
  )
}
