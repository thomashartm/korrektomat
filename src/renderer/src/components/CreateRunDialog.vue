<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './common/BaseModal.vue'
import ModelSelector from './common/ModelSelector.vue'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useSettingsStore, MODEL_PRESETS } from '../stores/settings.store'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [slug: string]
}>()

const workspaceStore = useWorkspaceStore()
const settingsStore = useSettingsStore()

// ── Form state ──────────────────────────────────────────────────────────────

const name = ref('')
const kurs = ref('')
const datum = ref(todayISO())
const showAdvanced = ref(false)
const aufgabenart = ref('Klausur')
const fach = ref('Spanisch')
const selectedModelKey = ref('claude-sonnet')
const submitting = ref(false)
const formError = ref<string | null>(null)

// ── Computed ────────────────────────────────────────────────────────────────

const canSubmit = computed(
  () => name.value.trim() !== '' && kurs.value.trim() !== '' && datum.value !== ''
)

const modelConfig = computed(() => MODEL_PRESETS[selectedModelKey.value] ?? undefined)

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function resetForm(): void {
  name.value = ''
  kurs.value = ''
  datum.value = todayISO()
  showAdvanced.value = false
  aufgabenart.value = 'Klausur'
  fach.value = 'Spanisch'
  submitting.value = false
  formError.value = null
  initModelFromSettings()
}

function initModelFromSettings(): void {
  const currentModel = settingsStore.settings.defaultModel
  for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
    if (preset.model === currentModel.model) {
      selectedModelKey.value = key
      return
    }
  }
  selectedModelKey.value = 'claude-sonnet'
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return

  submitting.value = true
  formError.value = null

  try {
    const slug = await workspaceStore.createRun({
      name: name.value.trim(),
      kurs: kurs.value.trim(),
      datum: datum.value,
      aufgabenart: aufgabenart.value.trim() || undefined,
      fach: fach.value.trim() || undefined,
      modelConfig: modelConfig.value
    })
    resetForm()
    emit('created', slug)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Lauf konnte nicht erstellt werden'
  } finally {
    submitting.value = false
  }
}

function handleClose(): void {
  if (!submitting.value) {
    resetForm()
    emit('close')
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await settingsStore.loadSettings()
      initModelFromSettings()
    }
  }
)
</script>

<template>
  <BaseModal :open="open" title="Neuer Lauf" max-width="560px" @close="handleClose">
    <form @submit.prevent="handleSubmit">
      <!-- Error banner -->
      <div v-if="formError" class="form-error">
        {{ formError }}
      </div>

      <!-- Core fields -->
      <div class="form-section">
        <div class="form-row">
          <label class="form-label">Name *</label>
          <input
            v-model="name"
            type="text"
            class="input-field input-wide"
            placeholder="z.B. Klausur 1 — Kapitel 3"
            autofocus
          />
        </div>

        <div class="form-row-double">
          <div class="form-row">
            <label class="form-label">Kurs *</label>
            <input
              v-model="kurs"
              type="text"
              class="input-field input-wide"
              placeholder="z.B. 10a"
            />
          </div>
          <div class="form-row">
            <label class="form-label">Datum *</label>
            <input
              v-model="datum"
              type="date"
              class="input-field input-wide"
            />
          </div>
        </div>
      </div>

      <!-- Advanced toggle -->
      <button
        type="button"
        class="advanced-toggle"
        @click="showAdvanced = !showAdvanced"
      >
        <span class="toggle-icon">{{ showAdvanced ? '\u25BC' : '\u25B6' }}</span>
        Erweiterte Optionen
      </button>

      <!-- Advanced fields -->
      <div v-show="showAdvanced" class="form-section">
        <div class="form-row-double">
          <div class="form-row">
            <label class="form-label">Aufgabenart</label>
            <input
              v-model="aufgabenart"
              type="text"
              class="input-field input-wide"
              placeholder="Klausur"
            />
          </div>
          <div class="form-row">
            <label class="form-label">Fach</label>
            <input
              v-model="fach"
              type="text"
              class="input-field input-wide"
              placeholder="Spanisch"
            />
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">KI-Modell</label>
          <ModelSelector v-model="selectedModelKey" />
        </div>
      </div>
    </form>

    <template #footer>
      <button
        class="btn-secondary"
        :disabled="submitting"
        @click="handleClose"
      >
        Abbrechen
      </button>
      <button
        class="btn-primary"
        :disabled="!canSubmit || submitting"
        @click="handleSubmit"
      >
        {{ submitting ? 'Wird erstellt...' : 'Erstellen' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-section {
  margin-bottom: 20px;
}

.form-row {
  margin-bottom: 14px;
}

.form-row-double {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  color: #a0a0c0;
  margin-bottom: 6px;
}

.input-field {
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.input-field:focus {
  border-color: #4a90d9;
}

.input-field::placeholder {
  color: #4a4a6a;
}

.input-wide {
  width: 100%;
}

.form-error {
  background: rgba(192, 0, 0, 0.15);
  border: 1px solid #c00000;
  border-radius: 8px;
  padding: 10px 14px;
  color: #ff6666;
  font-size: 13px;
  margin-bottom: 16px;
}

.advanced-toggle {
  background: transparent;
  border: none;
  color: #6a6a8a;
  cursor: pointer;
  font-size: 13px;
  padding: 8px 0;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s ease;
}

.advanced-toggle:hover {
  color: #a0a0c0;
}

.toggle-icon {
  font-size: 10px;
}

.btn-primary {
  background: #c00000;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #e00000;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #2a2a4a;
  color: #c0c0e0;
  border: 1px solid #3a3a5a;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover:not(:disabled) {
  background: #3a3a5a;
  border-color: #4a90d9;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
