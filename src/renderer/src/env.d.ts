/// <reference types="vite/client" />

// Type declarations for the Korrektomat preload API
// These match the IPC handlers exposed via contextBridge

interface KorrekturWorkspaceAPI {
  listRuns(): Promise<any[]>
  createRun(params: any): Promise<any>
  getRun(slug: string): Promise<any>
  updateRun(slug: string, updates: any): Promise<any>
  deleteRun(slug: string): Promise<void>
  setTaskSheet(runSlug: string, filePaths: string[]): Promise<string[]>
  openRunFolder(slug: string): Promise<void>

  addStudent(runSlug: string, name: string): Promise<any>
  addStudentsBatch(runSlug: string, names: string[]): Promise<any[]>
  listStudents(runSlug: string): Promise<any[]>
  getStudent(runSlug: string, studentSlug: string): Promise<any>
  removeStudent(runSlug: string, studentSlug: string): Promise<void>
  openStudentFolder(runSlug: string, studentSlug: string): Promise<void>
  onAccessError(callback: (event: { path: string; fallbackAttempted: boolean }) => void): void
}

interface KorrekturFilesAPI {
  selectImages(): Promise<string[]>
  selectFolder(): Promise<string | null>
  processInbox(runSlug: string, studentSlug: string): Promise<any[]>
  getImageDataUrl(imagePath: string): Promise<string>
}

interface KorrekturGradingAPI {
  gradeStudent(runSlug: string, studentSlug: string, options?: any): Promise<void>
  gradeBatch(runSlug: string, studentSlugs: string[], options?: any): Promise<void>
  pauseBatch(): Promise<void>
  resumeBatch(): Promise<void>
  cancelBatch(): Promise<void>
  cancelGrading(runSlug: string, studentSlug: string): Promise<void>
  regenerateDocx(runSlug: string, studentSlug: string): Promise<void>
  onGradingProgress(callback: (event: any) => void): void
  onGradingComplete(callback: (event: any) => void): void
  onGradingError(callback: (event: any) => void): void
  onStreamChunk(callback: (event: any) => void): void
  onBatchProgress(callback: (event: any) => void): void
}

interface KorrekturSettingsAPI {
  getConfig(): Promise<any>
  updateConfig(partial: any): Promise<void>
  validateApiKey(provider: string, key: string): Promise<boolean>
}

interface KorrekturAPI {
  workspace: KorrekturWorkspaceAPI
  files: KorrekturFilesAPI
  grading: KorrekturGradingAPI
  settings: KorrekturSettingsAPI
}

declare global {
  interface Window {
    api: KorrekturAPI
    electron: {
      ipcRenderer: {
        send(channel: string, ...args: any[]): void
        on(channel: string, func: (...args: any[]) => void): void
      }
    }
  }
}

export {}
