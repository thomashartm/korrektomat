<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '../stores/workspace.store'

const props = defineProps<{ slug: string }>()
const router = useRouter()
const workspaceStore = useWorkspaceStore()
const newStudentName = ref('')

onMounted(() => {
  workspaceStore.setActiveRun(props.slug)
})

function openStudent(studentSlug: string): void {
  router.push({ name: 'student', params: { slug: props.slug, studentSlug } })
}

function startBatchGrading(): void {
  router.push({ name: 'grading', params: { slug: props.slug } })
}

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
        <span>{{ workspaceStore.activeRun?.name || slug }}</span>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="startBatchGrading">
          Alle korrigieren
        </button>
      </div>
    </header>

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
            @keyup.enter=""
          />
          <button class="btn-small" @click="">+</button>
        </div>
      </div>

      <div v-if="workspaceStore.students.length === 0" class="empty-state">
        <p>Noch keine Schüler hinzugefügt.</p>
      </div>

      <div v-else class="student-list">
        <div
          v-for="student in workspaceStore.students"
          :key="student.id"
          class="student-card"
          @click="openStudent(student.slug)"
        >
          <div class="student-info">
            <span class="student-name">{{ student.displayName }}</span>
            <span class="student-scans">{{ student.scanCount }} Scans</span>
          </div>
          <div class="student-status">
            <span
              class="status-badge"
              :style="{ background: statusColor(student.status) }"
            >
              {{ statusLabel(student.status) }}
            </span>
            <span v-if="student.grade" class="student-grade">
              {{ student.grade.total }} NP
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

.input-field {
  background: #2a2a4a;
  border: 1px solid #3a3a5a;
  color: #e0e0e0;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.input-field:focus {
  border-color: #4a90d9;
}

.btn-small {
  background: #c00000;
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
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
