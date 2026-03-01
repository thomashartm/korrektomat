<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '../stores/workspace.store'
import { useSettingsStore, MODEL_PRESETS } from '../stores/settings.store'
import ModelSelector from '../components/common/ModelSelector.vue'

const props = defineProps<{ slug: string }>()
const router = useRouter()
const workspaceStore = useWorkspaceStore()
const settingsStore = useSettingsStore()

// ── Local form state ────────────────────────────────────────────────────────

const runName = ref('')
const kurs = ref('')
const datum = ref('')
const aufgabenart = ref('')
const fach = ref('')
const selectedModelKey = ref('')
const newStudentName = ref('')
const addingStudent = ref(false)
const saving = ref(false)
const settingsOpen = ref(false)
const saveSuccess = ref(false)

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  await settingsStore.loadSettings()
  await workspaceStore.setActiveRun(props.slug)
  syncFormFromManifest()
})

watch(
  () => workspaceStore.runManifest,
  () => syncFormFromManifest(),
  { deep: true }
)

function syncFormFromManifest(): void {
  const m = workspaceStore.runManifest
  if (!m) return
  runName.value = m.name
  kurs.value = m.kurs
  datum.value = m.datum
  aufgabenart.value = m.aufgabenart
  fach.value = m.fach

  if (m.modelConfig) {
    let found = false
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      if (preset.model === m.modelConfig.model) {
        selectedModelKey.value = key
        found = true
        break
      }
    }
    if (!found) selectedModelKey.value = ''
  } else {
    const defaultModel = settingsStore.settings.defaultModel
    for (const [key, preset] of Object.entries(MODEL_PRESETS)) {
      if (preset.model === defaultModel.model) {
        selectedModelKey.value = key
        break
      }
    }
  }
}

// ── Settings summary (shown when collapsed) ─────────────────────────────────

function settingsSummary(): string {
  const m = workspaceStore.runManifest
  if (!m) return ''
  const parts: string[] = []
  if (m.kurs) parts.push(m.kurs)
  if (m.fach) parts.push(m.fach)
  if (m.aufgabenart) parts.push(m.aufgabenart)
  if (m.datum) {
    try {
      parts.push(new Date(m.datum).toLocaleDateString('de-DE'))
    } catch {
      parts.push(m.datum)
    }
  }
  return parts.join(' · ')
}

// ── Save settings ───────────────────────────────────────────────────────────

async function saveSettings(): Promise<void> {
  if (!workspaceStore.runManifest) return
  saving.value = true
  saveSuccess.value = false
  try {
    await workspaceStore.updateRunSettings(props.slug, {
      name: runName.value.trim(),
      kurs: kurs.value.trim(),
      datum: datum.value,
      aufgabenart: aufgabenart.value.trim(),
      fach: fach.value.trim(),
      modelConfig: MODEL_PRESETS[selectedModelKey.value] ?? undefined
    })
    saveSuccess.value = true
    settingsOpen.value = false
    // Clear success indicator after a moment
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } finally {
    saving.value = false
  }
}

// ── Student management ──────────────────────────────────────────────────────

async function handleAddStudent(): Promise<void> {
  const name = newStudentName.value.trim()
  if (!name || addingStudent.value) return

  addingStudent.value = true
  try {
    await workspaceStore.addStudent(props.slug, name)
    newStudentName.value = ''
  } catch {
    // Error already set in store
  } finally {
    addingStudent.value = false
  }
}

// ── Navigation ──────────────────────────────────────────────────────────────

function openStudent(studentSlug: string): void {
  router.push({ name: 'student', params: { slug: props.slug, studentSlug } })
}

function startBatchGrading(): void {
  router.push({ name: 'grading', params: { slug: props.slug } })
}

// ── Status helpers ──────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'graded': return '#196f2b'
    case 'grading': return '#4a90d9'
    case 'error': return '#c00000'
    case 'scans-ready': return '#d4a017'
    default: return '#6a6a8a'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'inbox-empty': return 'Keine Scans'
    case 'scans-pending': return 'Scans verarbeiten'
    case 'scans-ready': return 'Bereit'
    case 'grading': return 'Wird korrigiert...'
    case 'graded': return 'Korrigiert'
    case 'error': return 'Fehler'
    default: return status
  }
}
</script>

<template>
  <div class="run-view">
    <header class="page-header">
      <div class="breadcrumb">
        <router-link to="/" class="breadcrumb-link">Dashboard</router-link>
        <span class="breadcrumb-sep">/</span>
        <span>{{ workspaceStore.runManifest?.name || workspaceStore.activeRun?.name || slug }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="startBatchGrading">
          Alle korrigieren
        </button>
      </div>
    </header>

    <!-- Error banner -->
    <div v-if="workspaceStore.error" class="error-banner">
      {{ workspaceStore.error }}
    </div>

    <!-- Run Settings (collapsible) -->
    <section class="settings-section">
      <button class="settings-toggle" @click="settingsOpen = !settingsOpen">
        <span class="toggle-icon">{{ settingsOpen ? '\u25BC' : '\u25B6' }}</span>
        <h2>Einstellungen</h2>
        <span v-if="!settingsOpen && workspaceStore.runManifest" class="settings-summary">
          {{ settingsSummary() }}
        </span>
        <span v-if="saveSuccess" class="save-indicator">&check; Gespeichert</span>
      </button>

      <div v-show="settingsOpen" class="settings-body">
        <div class="setting-row">
          <label>Name</label>
          <input
            v-model="runName"
            type="text"
            class="input-field input-wide"
            placeholder="Laufname..."
          />
        </div>

        <div class="settings-row-double">
          <div class="setting-row">
            <label>Kurs</label>
            <input
              v-model="kurs"
              type="text"
              class="input-field input-wide"
              placeholder="z.B. 10a"
            />
          </div>
          <div class="setting-row">
            <label>Datum</label>
            <input
              v-model="datum"
              type="date"
              class="input-field input-wide"
            />
          </div>
        </div>

        <div class="settings-row-double">
          <div class="setting-row">
            <label>Fach</label>
            <input
              v-model="fach"
              type="text"
              class="input-field input-wide"
              placeholder="Spanisch"
            />
          </div>
          <div class="setting-row">
            <label>Aufgabenart</label>
            <input
              v-model="aufgabenart"
              type="text"
              class="input-field input-wide"
              placeholder="Klausur"
            />
          </div>
        </div>

        <div class="setting-row">
          <label>KI-Modell</label>
          <ModelSelector v-model="selectedModelKey" />
        </div>

        <div class="settings-actions">
          <button
            class="btn-primary"
            :disabled="saving"
            @click="saveSettings"
          >
            {{ saving ? 'Speichern...' : 'Speichern' }}
          </button>
          <button
            class="btn-secondary"
            @click="settingsOpen = false; syncFormFromManifest()"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </section>

    <!-- Student list -->
    <section class="students-section">
      <div class="section-header">
        <h2>Schüler ({{ workspaceStore.students.length }})</h2>
        <div class="add-student">
          <input
            v-model="newStudentName"
            type="text"
            placeholder="Name eingeben..."
            class="input-field"
            :disabled="addingStudent"
            @keyup.enter="handleAddStudent"
          />
          <button
            class="btn-add"
            :disabled="!newStudentName.trim() || addingStudent"
            @click="handleAddStudent"
          >
            {{ addingStudent ? '...' : '+' }}
          </button>
        </div>
      </div>

      <div v-if="workspaceStore.students.length === 0" class="empty-state">
        <p>Noch keine Schüler hinzugefügt.</p>
      </div>

      <div v-else class="student-list">
        <div
          v-for="student in workspaceStore.students"
          :key="student.slug"
          class="student-card"
          @click="openStudent(student.slug)"
        >
          <div class="student-info">
            <span class="student-name">{{ student.name }}</span>
            <span class="student-scans">{{ student.scans.length }} Scans</span>
          </div>
          <div class="student-status">
            <span
              class="status-badge"
              :style="{ background: statusColor(student.status) }"
            >
              {{ statusLabel(student.status) }}
            </span>
            <span v-if="student.finalGrade != null" class="student-grade">
              {{ student.finalGrade }} NP
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.run-view {
  max-width: 900px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-link {
  color: #6a6a8a;
  text-decoration: none;
}

.breadcrumb-link:hover {
  color: #a0a0c0;
}

.breadcrumb-sep {
  color: #3a3a5a;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-secondary {
  background: #2a2a4a;
  color: #c0c0e0;
  border: 1px solid #3a3a5a;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: #3a3a5a;
  border-color: #4a90d9;
}

/* ── Error Banner ──────────────────────────────────────────────────────────── */

.error-banner {
  background: rgba(192, 0, 0, 0.15);
  border: 1px solid #c00000;
  border-radius: 8px;
  padding: 10px 14px;
  color: #ff6666;
  font-size: 13px;
  margin-bottom: 24px;
}

/* ── Settings Section (collapsible) ────────────────────────────────────────── */

.settings-section {
  margin-bottom: 32px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  overflow: hidden;
}

.settings-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 16px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.settings-toggle:hover {
  background: rgba(255, 255, 255, 0.03);
}

.toggle-icon {
  font-size: 10px;
  color: #6a6a8a;
  flex-shrink: 0;
}

.settings-toggle h2 {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  flex-shrink: 0;
}

.settings-summary {
  font-size: 13px;
  color: #6a6a8a;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-indicator {
  font-size: 12px;
  color: #196f2b;
  font-weight: 600;
  margin-left: auto;
  flex-shrink: 0;
}

.settings-body {
  padding: 0 20px 20px;
  border-top: 1px solid #2a2a4a;
}

.setting-row {
  margin-bottom: 14px;
  margin-top: 14px;
}

.setting-row label {
  display: block;
  font-size: 13px;
  color: #a0a0c0;
  margin-bottom: 6px;
}

.settings-row-double {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #2a2a4a;
}

.input-field {
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #e0e0e0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}

.input-field:focus {
  border-color: #4a90d9;
}

.input-wide {
  width: 100%;
  box-sizing: border-box;
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

/* ── Students Section ──────────────────────────────────────────────────────── */

.students-section {
  margin-bottom: 36px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
}

.add-student {
  display: flex;
  gap: 8px;
}

.btn-add {
  background: #c00000;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-add:hover:not(:disabled) {
  background: #e00000;
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  color: #6a6a8a;
  padding: 40px 0;
  text-align: center;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.student-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 10px;
  padding: 14px 18px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.student-card:hover {
  border-color: #4a90d9;
}

.student-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.student-name {
  font-weight: 600;
  font-size: 15px;
  color: #ffffff;
}

.student-scans {
  font-size: 12px;
  color: #6a6a8a;
}

.student-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  color: white;
  padding: 3px 10px;
  border-radius: 12px;
}

.student-grade {
  font-size: 16px;
  font-weight: 700;
  color: #4a90d9;
}
</style>
