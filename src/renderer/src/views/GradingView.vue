<script setup lang="ts">
import { ref } from 'vue'
import { useGradingStore } from '../stores/grading.store'
import { useWorkspaceStore } from '../stores/workspace.store'

const props = defineProps<{ slug: string }>()
const gradingStore = useGradingStore()
const workspaceStore = useWorkspaceStore()

const selectedStudents = ref<string[]>([])

function toggleStudent(slug: string): void {
  const idx = selectedStudents.value.indexOf(slug)
  if (idx >= 0) {
    selectedStudents.value.splice(idx, 1)
  } else {
    selectedStudents.value.push(slug)
  }
}

function selectAllPending(): void {
  selectedStudents.value = workspaceStore.pendingStudents.map((s) => s.slug)
}

function startBatch(): void {
  // TODO: invoke batch grading via IPC
  gradingStore.startBatch(selectedStudents.value)
}

function stepLabel(step: string): string {
  switch (step) {
    case 'preparing': return 'Vorbereitung'
    case 'transcribing': return 'Transkription'
    case 'correcting': return 'Inline-Korrektur'
    case 'summarizing-errors': return 'Fehlerübersicht'
    case 'scoring': return 'Bewertung'
    case 'generating-recommendations': return 'Förderhinweise'
    case 'generating-docx': return 'DOCX-Generierung'
    case 'complete': return 'Abgeschlossen'
    default: return step
  }
}
</script>

<template>
  <div class="grading-view">
    <header class="page-header">
      <div class="breadcrumb">
        <router-link to="/" class="breadcrumb-link">Dashboard</router-link>
        <span class="breadcrumb-sep">/</span>
        <router-link :to="{ name: 'run', params: { slug } }" class="breadcrumb-link">
          {{ slug }}
        </router-link>
        <span class="breadcrumb-sep">/</span>
        <span>Stapelkorrektur</span>
      </div>
    </header>

    <div class="grading-layout">
      <!-- Left: Student queue -->
      <div class="queue-panel">
        <div class="panel-header">
          <h3>Warteschlange</h3>
          <button class="btn-link" @click="selectAllPending">Alle auswählen</button>
        </div>

        <div class="queue-list">
          <div
            v-for="student in workspaceStore.students"
            :key="student.id"
            class="queue-item"
            :class="{
              selected: selectedStudents.includes(student.slug),
              active: gradingStore.currentStudent === student.slug,
              completed: gradingStore.batchCompleted.includes(student.slug),
              error: gradingStore.batchErrors.has(student.slug),
              disabled: student.status === 'graded'
            }"
            @click="student.status !== 'graded' ? toggleStudent(student.slug) : null"
          >
            <span class="queue-name">{{ student.displayName }}</span>
            <span v-if="student.status === 'graded'" class="queue-status done">&#10003;</span>
            <span v-else-if="gradingStore.currentStudent === student.slug" class="queue-status active">&#9679;</span>
            <span v-else-if="gradingStore.batchCompleted.includes(student.slug)" class="queue-status done">&#10003;</span>
            <span v-else-if="gradingStore.batchErrors.has(student.slug)" class="queue-status error">&#10007;</span>
          </div>
        </div>

        <button
          class="btn-primary btn-full"
          :disabled="selectedStudents.length === 0 || gradingStore.isGrading"
          @click="startBatch"
        >
          {{ gradingStore.isGrading ? 'Läuft...' : `${selectedStudents.length} korrigieren` }}
        </button>
      </div>

      <!-- Right: Live output -->
      <div class="output-panel">
        <div v-if="!gradingStore.isGrading && !gradingStore.progress" class="empty-output">
          <p>Wähle Schüler aus und starte die Stapelkorrektur.</p>
        </div>

        <div v-else>
          <div class="output-header">
            <h3>{{ gradingStore.progress?.studentName || '' }}</h3>
            <span class="step-badge">{{ stepLabel(gradingStore.progress?.step || '') }}</span>
          </div>

          <div class="progress-bar-large">
            <div class="progress-fill" :style="{ width: (gradingStore.progress?.progress || 0) + '%' }"></div>
          </div>

          <pre class="stream-output">{{ gradingStore.streamOutput }}</pre>

          <div class="batch-stats">
            <span>Abgeschlossen: {{ gradingStore.batchCompleted.length }}/{{ gradingStore.batchQueue.length }}</span>
            <span v-if="gradingStore.batchErrors.size">Fehler: {{ gradingStore.batchErrors.size }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grading-view {
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 24px;
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

.breadcrumb-sep {
  color: #3a3a5a;
}

.grading-layout {
  flex: 1;
  display: flex;
  gap: 24px;
  overflow: hidden;
}

.queue-panel {
  width: 260px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.btn-link {
  background: none;
  border: none;
  color: #4a90d9;
  font-size: 12px;
  cursor: pointer;
}

.queue-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #a0a0c0;
  transition: background 0.1s ease;
}

.queue-item:hover:not(.disabled) {
  background: #2a2a4a;
}

.queue-item.selected {
  background: #2a2a4a;
  color: #ffffff;
  border-left: 3px solid #4a90d9;
}

.queue-item.active {
  background: #1e3a5e;
  color: #7ab8ff;
}

.queue-item.completed {
  color: #196f2b;
}

.queue-item.error {
  color: #c00000;
}

.queue-item.disabled {
  opacity: 0.5;
  cursor: default;
}

.queue-status.done { color: #196f2b; }
.queue-status.active { color: #4a90d9; animation: pulse 1s infinite; }
.queue-status.error { color: #c00000; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.btn-primary {
  background: #c00000;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-full {
  width: 100%;
}

.output-panel {
  flex: 1;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-output {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6a6a8a;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.output-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.step-badge {
  background: #2a2a4a;
  color: #4a90d9;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
}

.progress-bar-large {
  height: 6px;
  background: #2a2a4a;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: #4a90d9;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.stream-output {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: #a0a0c0;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  margin-bottom: 12px;
}

.batch-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6a6a8a;
}
</style>
