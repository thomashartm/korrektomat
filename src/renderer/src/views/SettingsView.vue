<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore, MODEL_PRESETS } from '../stores/settings.store'

const settingsStore = useSettingsStore()
const anthropicKey = ref('')
const googleKey = ref('')
const selectedModel = ref('claude-sonnet')
const validatingAnthropic = ref(false)
const validatingGoogle = ref(false)
const anthropicValid = ref<boolean | null>(null)
const googleValid = ref<boolean | null>(null)

onMounted(async () => {
  await settingsStore.loadSettings()
  anthropicKey.value = settingsStore.settings.apiKeys.anthropic || ''
  googleKey.value = settingsStore.settings.apiKeys.google || ''

  // Find matching preset
  const current = settingsStore.settings.defaultModel
  for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
    if (preset.model === current.model) {
      selectedModel.value = key
      break
    }
  }
})

async function saveApiKeys(): Promise<void> {
  await settingsStore.saveSettings({
    apiKeys: {
      anthropic: anthropicKey.value || undefined,
      google: googleKey.value || undefined
    }
  })
}

async function validateAnthropic(): Promise<void> {
  validatingAnthropic.value = true
  anthropicValid.value = await settingsStore.validateApiKey('anthropic', anthropicKey.value)
  validatingAnthropic.value = false
}

async function validateGoogle(): Promise<void> {
  validatingGoogle.value = true
  googleValid.value = await settingsStore.validateApiKey('google', googleKey.value)
  validatingGoogle.value = false
}

function setDefaultModel(key: string): void {
  selectedModel.value = key
  settingsStore.saveSettings({ defaultModel: MODEL_PRESETS[key] })
}
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <h1>Einstellungen</h1>
    </header>

    <!-- API Keys -->
    <section class="settings-section">
      <h2>API-Schlüssel</h2>

      <div class="setting-row">
        <label>Anthropic (Claude)</label>
        <div class="key-input-row">
          <input
            v-model="anthropicKey"
            type="password"
            placeholder="sk-ant-..."
            class="input-field input-wide"
            @blur="saveApiKeys"
          />
          <button class="btn-small" :disabled="!anthropicKey || validatingAnthropic" @click="validateAnthropic">
            {{ validatingAnthropic ? '...' : 'Testen' }}
          </button>
          <span v-if="anthropicValid === true" class="valid-mark">&#10003;</span>
          <span v-if="anthropicValid === false" class="invalid-mark">&#10007;</span>
        </div>
      </div>

      <div class="setting-row">
        <label>Google (Gemini)</label>
        <div class="key-input-row">
          <input
            v-model="googleKey"
            type="password"
            placeholder="AIza..."
            class="input-field input-wide"
            @blur="saveApiKeys"
          />
          <button class="btn-small" :disabled="!googleKey || validatingGoogle" @click="validateGoogle">
            {{ validatingGoogle ? '...' : 'Testen' }}
          </button>
          <span v-if="googleValid === true" class="valid-mark">&#10003;</span>
          <span v-if="googleValid === false" class="invalid-mark">&#10007;</span>
        </div>
      </div>
    </section>

    <!-- Default Model -->
    <section class="settings-section">
      <h2>Standard-Modell</h2>
      <div class="model-grid">
        <div
          v-for="(config, key) in MODEL_PRESETS"
          :key="key"
          class="model-card"
          :class="{ selected: selectedModel === key }"
          @click="setDefaultModel(key as string)"
        >
          <div class="model-provider">{{ config.provider === 'anthropic' ? 'Anthropic' : 'Google' }}</div>
          <div class="model-name">{{ key }}</div>
          <div class="model-id">{{ config.model }}</div>
        </div>
      </div>
    </section>

    <!-- Workspace -->
    <section class="settings-section">
      <h2>Workspace</h2>
      <div class="setting-row">
        <label>Workspace-Verzeichnis</label>
        <div class="key-input-row">
          <input
            :value="settingsStore.settings.workspaceRoot"
            type="text"
            class="input-field input-wide"
            readonly
          />
          <button class="btn-small" @click="">Ändern</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  max-width: 700px;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
}

.settings-section {
  margin-bottom: 36px;
}

.settings-section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2a4a;
}

.setting-row {
  margin-bottom: 16px;
}

.setting-row label {
  display: block;
  font-size: 13px;
  color: #a0a0c0;
  margin-bottom: 6px;
}

.key-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-field {
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  font-family: 'JetBrains Mono', monospace;
}

.input-field:focus {
  border-color: #4a90d9;
}

.input-wide {
  flex: 1;
}

.btn-small {
  background: #2a2a4a;
  color: #c0c0e0;
  border: 1px solid #3a3a5a;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-small:hover {
  background: #3a3a5a;
}

.btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.valid-mark {
  color: #196f2b;
  font-size: 18px;
  font-weight: bold;
}

.invalid-mark {
  color: #c00000;
  font-size: 18px;
  font-weight: bold;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.model-card {
  background: #1a1a2e;
  border: 2px solid #2a2a4a;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-card:hover {
  border-color: #4a90d9;
}

.model-card.selected {
  border-color: #c00000;
  background: #1a1020;
}

.model-provider {
  font-size: 11px;
  color: #6a6a8a;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.model-id {
  font-size: 11px;
  color: #4a4a6a;
  font-family: 'JetBrains Mono', monospace;
}
</style>
