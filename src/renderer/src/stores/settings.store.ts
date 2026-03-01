import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ModelConfig {
  provider: 'anthropic' | 'google'
  model: string
  maxTokens: number
  temperature: number
}

export interface AppSettings {
  workspaceRoot: string
  defaultModel: ModelConfig
  apiKeys: {
    anthropic?: string
    google?: string
  }
}

export const MODEL_PRESETS: Record<string, ModelConfig> = {
  'claude-sonnet': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384,
    temperature: 0.3
  },
  'claude-opus': {
    provider: 'anthropic',
    model: 'claude-opus-4-0-20250514',
    maxTokens: 16384,
    temperature: 0.2
  },
  'gemini-flash': {
    provider: 'google',
    model: 'gemini-2.0-flash',
    maxTokens: 16384,
    temperature: 0.3
  },
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-2.5-pro',
    maxTokens: 16384,
    temperature: 0.2
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({
    workspaceRoot: '',
    defaultModel: MODEL_PRESETS['claude-sonnet'],
    apiKeys: {}
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSettings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      settings.value = await window.api.settings.getConfig()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
    } finally {
      loading.value = false
    }
  }

  async function saveSettings(partial: Partial<AppSettings>): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await window.api.settings.updateConfig(partial)
      settings.value = { ...settings.value, ...partial }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save settings'
    } finally {
      loading.value = false
    }
  }

  async function validateApiKey(
    provider: 'anthropic' | 'google',
    key: string
  ): Promise<boolean> {
    try {
      return await window.api.settings.validateApiKey(provider, key)
    } catch {
      return false
    }
  }

  return {
    settings,
    loading,
    error,
    loadSettings,
    saveSettings,
    validateApiKey
  }
})
