/**
 * settings.ipc.ts
 * IPC handlers for app configuration management.
 */

import { ipcMain } from 'electron'

import {
  loadConfig,
  updateConfig
} from '../../engine/workspace/workspace.manager'
import { createProvider } from '../../engine/ai/ai.provider'
import type { AppConfig } from '../../engine/workspace/workspace.schema'

export function registerSettingsIPC(): void {
  ipcMain.handle('settings:getConfig', async () => {
    return loadConfig()
  })

  ipcMain.handle('settings:updateConfig', async (_event, partial: Partial<AppConfig>) => {
    return updateConfig(partial)
  })

  ipcMain.handle(
    'settings:validateApiKey',
    async (_event, provider: 'anthropic' | 'google', key: string) => {
      try {
        const model = provider === 'anthropic'
          ? 'claude-sonnet-4-20250514'
          : 'gemini-2.0-flash'

        const aiProvider = await createProvider({
          provider,
          apiKey: key,
          model
        })

        return aiProvider.validateApiKey()
      } catch {
        return false
      }
    }
  )
}
