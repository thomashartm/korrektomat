<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGradingStore } from '../stores/grading.store'

const props = defineProps<{ slug: string; studentSlug: string }>()
const gradingStore = useGradingStore()
const student = ref<any>(null)

onMounted(async () => {
  try {
    student.value = await window.api.workspace.getStudent(props.slug, props.studentSlug)
  } catch {
    // Handle error
  }
})

function startGrading(): void {
  // TODO: invoke grading pipeline via IPC
}
</script>

<template>
  <div class="student-view">
    <header class="page-header">
      <div class="breadcrumb">
        <router-link to="/" class="breadcrumb-link">Dashboard</router-link>
        <span class="breadcrumb-sep">/</span>
        <router-link :to="{ name: 'run', params: { slug } }" class="breadcrumb-link">
          {{ slug }}
        </router-link>
        <span class="breadcrumb-sep">/</span>
        <span>{{ student?.displayName || studentSlug }}</span>
      </div>
    </header>

    <div class="student-content" v-if="student">
      <!-- Scan Gallery -->
      <section class="section">
        <h2>Scans ({{ student.scans?.length || 0 }})</h2>
        <div v-if="!student.scans?.length" class="empty-state">
          <p>Keine Scans vorhanden. Lege Bilder in den Inbox-Ordner.</p>
          <button class="btn-secondary" @click="">
            Inbox-Ordner öffnen
          </button>
        </div>
        <div v-else class="scan-gallery">
          <div v-for="scan in student.scans" :key="scan.compressedPath" class="scan-thumb">
            <div class="scan-placeholder">{{ scan.originalName }}</div>
          </div>
        </div>
      </section>

      <!-- Grading -->
      <section class="section">
        <div class="section-header">
          <h2>Bewertung</h2>
          <button
            v-if="student.status !== 'graded'"
            class="btn-primary"
            :disabled="gradingStore.isGrading || !student.scans?.length"
            @click="startGrading"
          >
            {{ gradingStore.isGrading ? 'Wird korrigiert...' : 'Jetzt korrigieren' }}
          </button>
        </div>

        <!-- Grading progress -->
        <div v-if="gradingStore.isGrading && gradingStore.currentStudent === studentSlug" class="grading-progress">
          <div class="progress-bar-large">
            <div class="progress-fill" :style="{ width: (gradingStore.progress?.progress || 0) + '%' }"></div>
          </div>
          <p class="progress-message">{{ gradingStore.progress?.message }}</p>
          <pre class="stream-output" v-if="gradingStore.streamOutput">{{ gradingStore.streamOutput.slice(-2000) }}</pre>
        </div>

        <!-- Graded result -->
        <div v-if="student.status === 'graded'" class="grading-result">
          <div class="grade-summary">
            <div class="grade-card">
              <span class="grade-label">Gesamt</span>
              <span class="grade-value">{{ student.grade?.total || '—' }} NP</span>
            </div>
            <div class="grade-card">
              <span class="grade-label">Inhalt (40%)</span>
              <span class="grade-value">{{ student.grade?.inhalt || '—' }}/15</span>
            </div>
            <div class="grade-card">
              <span class="grade-label">Sprache (60%)</span>
              <span class="grade-value">{{ student.grade?.sprache || '—' }}/15</span>
            </div>
          </div>
          <div class="grade-actions">
            <button class="btn-secondary" @click="">
              DOCX öffnen
            </button>
            <button class="btn-secondary" @click="">
              Neu generieren
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.student-view {
  max-width: 900px;
}

.page-header {
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

.section {
  margin-bottom: 32px;
}

.section h2 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  margin-bottom: 0;
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
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #2a2a4a;
  color: #c0c0e0;
  border: 1px solid #3a3a5a;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #3a3a5a;
}

.empty-state {
  color: #6a6a8a;
  text-align: center;
  padding: 32px;
  background: #1a1a2e;
  border: 1px dashed #3a3a5a;
  border-radius: 12px;
}

.empty-state p {
  margin-bottom: 12px;
}

.scan-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.scan-thumb {
  aspect-ratio: 0.7;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  overflow: hidden;
}

.scan-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #6a6a8a;
  padding: 8px;
  text-align: center;
  word-break: break-all;
}

.grading-progress {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 20px;
}

.progress-bar-large {
  height: 8px;
  background: #2a2a4a;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: #4a90d9;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-message {
  font-size: 13px;
  color: #a0a0c0;
  margin-bottom: 12px;
}

.stream-output {
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 12px;
  font-size: 11px;
  color: #6a6a8a;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-family: 'JetBrains Mono', monospace;
}

.grading-result {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 20px;
}

.grade-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.grade-card {
  background: #2a2a4a;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.grade-label {
  display: block;
  font-size: 12px;
  color: #6a6a8a;
  margin-bottom: 4px;
}

.grade-value {
  font-size: 24px;
  font-weight: 700;
  color: #4a90d9;
}

.grade-actions {
  display: flex;
  gap: 8px;
}
</style>
