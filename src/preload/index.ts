/**
 * Korrektomat - Preload Script
 * Exposes typed IPC API to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  workspace: {
    listRuns: (): Promise<any[]> =>
      ipcRenderer.invoke('workspace:listRuns'),
    createRun: (params: any): Promise<any> =>
      ipcRenderer.invoke('workspace:createRun', params),
    getRun: (slug: string): Promise<any> =>
      ipcRenderer.invoke('workspace:getRun', slug),
    deleteRun: (slug: string): Promise<void> =>
      ipcRenderer.invoke('workspace:deleteRun', slug),
    setTaskSheet: (runSlug: string, filePaths: string[]): Promise<string[]> =>
      ipcRenderer.invoke('workspace:setTaskSheet', runSlug, filePaths),
    openRunFolder: (slug: string): Promise<void> =>
      ipcRenderer.invoke('workspace:openRunFolder', slug),

    addStudent: (runSlug: string, name: string): Promise<any> =>
      ipcRenderer.invoke('workspace:addStudent', runSlug, name),
    addStudentsBatch: (runSlug: string, names: string[]): Promise<any[]> =>
      ipcRenderer.invoke('workspace:addStudentsBatch', runSlug, names),
    listStudents: (runSlug: string): Promise<any[]> =>
      ipcRenderer.invoke('workspace:listStudents', runSlug),
    getStudent: (runSlug: string, studentSlug: string): Promise<any> =>
      ipcRenderer.invoke('workspace:getStudent', runSlug, studentSlug),
    removeStudent: (runSlug: string, studentSlug: string): Promise<void> =>
      ipcRenderer.invoke('workspace:removeStudent', runSlug, studentSlug),
    openStudentFolder: (runSlug: string, studentSlug: string): Promise<void> =>
      ipcRenderer.invoke('workspace:openStudentFolder', runSlug, studentSlug)
  },

  files: {
    selectImages: (): Promise<string[]> =>
      ipcRenderer.invoke('files:selectImages'),
    selectFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('files:selectFolder'),
    processInbox: (runSlug: string, studentSlug: string): Promise<any[]> =>
      ipcRenderer.invoke('files:processInbox', runSlug, studentSlug),
    getImageDataUrl: (imagePath: string): Promise<string> =>
      ipcRenderer.invoke('files:getImageDataUrl', imagePath)
  },

  grading: {
    gradeStudent: (runSlug: string, studentSlug: string, options?: any): Promise<void> =>
      ipcRenderer.invoke('grading:gradeStudent', runSlug, studentSlug, options),
    gradeBatch: (runSlug: string, studentSlugs: string[], options?: any): Promise<void> =>
      ipcRenderer.invoke('grading:gradeBatch', runSlug, studentSlugs, options),
    pauseBatch: (): Promise<void> =>
      ipcRenderer.invoke('grading:pauseBatch'),
    resumeBatch: (): Promise<void> =>
      ipcRenderer.invoke('grading:resumeBatch'),
    cancelBatch: (): Promise<void> =>
      ipcRenderer.invoke('grading:cancelBatch'),
    cancelGrading: (runSlug: string, studentSlug: string): Promise<void> =>
      ipcRenderer.invoke('grading:cancelGrading', runSlug, studentSlug),
    regenerateDocx: (runSlug: string, studentSlug: string): Promise<void> =>
      ipcRenderer.invoke('grading:regenerateDocx', runSlug, studentSlug),

    onGradingProgress: (callback: (event: any) => void): void => {
      ipcRenderer.on('grading:progress', (_event, data) => callback(data))
    },
    onGradingComplete: (callback: (event: any) => void): void => {
      ipcRenderer.on('grading:complete', (_event, data) => callback(data))
    },
    onGradingError: (callback: (event: any) => void): void => {
      ipcRenderer.on('grading:error', (_event, data) => callback(data))
    },
    onStreamChunk: (callback: (event: any) => void): void => {
      ipcRenderer.on('grading:streamChunk', (_event, data) => callback(data))
    },
    onBatchProgress: (callback: (event: any) => void): void => {
      ipcRenderer.on('grading:batchProgress', (_event, data) => callback(data))
    }
  },

  settings: {
    getConfig: (): Promise<any> =>
      ipcRenderer.invoke('settings:getConfig'),
    updateConfig: (partial: any): Promise<void> =>
      ipcRenderer.invoke('settings:updateConfig', partial),
    validateApiKey: (provider: string, key: string): Promise<boolean> =>
      ipcRenderer.invoke('settings:validateApiKey', provider, key)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
