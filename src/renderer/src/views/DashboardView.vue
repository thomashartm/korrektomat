<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkspaceStore } from '../stores/workspace.store'
import CreateRunDialog from '../components/CreateRunDialog.vue'

const router = useRouter()
const workspaceStore = useWorkspaceStore()
const showCreateDialog = ref(false)

onMounted(() => {
  workspaceStore.loadRuns()
})

function openRun(slug: string): void {
  router.push({ name: 'run', params: { slug } })
}

function onRunCreated(slug: string): void {
  showCreateDialog.value = false
  router.push({ name: 'run', params: { slug } })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="dashboard">
    <header class="page-header">
      <h1>Dashboard</h1>
      <button class="btn-primary" @click="showCreateDialog = true">
        + Neuer Lauf
      </button>
    </header>

    <div v-if="workspaceStore.loading" class="loading">Lade Klassenarbeiten...</div>

    <div v-else-if="workspaceStore.sortedRuns.length === 0" class="empty-state">
      <div class="empty-icon">&#128221;</div>
      <h2>Noch keine Klassenarbeiten</h2>
      <p>Erstelle einen neuen Lauf, um mit der Korrektur zu beginnen.</p>
    </div>

    <div v-else class="runs-grid">
      <div
        v-for="run in workspaceStore.sortedRuns"
        :key="run.slug"
        class="run-card"
        @click="openRun(run.slug)"
      >
        <div class="run-card-header">
          <h3>{{ run.name }}</h3>
          <span class="run-badge">{{ run.kurs }}</span>
        </div>
        <div class="run-card-meta">
          <span>{{ run.fach }} &middot; {{ run.aufgabenart }}</span>
          <span>{{ formatDate(run.datum || run.createdAt) }}</span>
        </div>
        <div class="run-card-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: run.studentSlugs.length > 0 ? '0%' : '0%' }"
            ></div>
          </div>
          <span class="progress-text">{{ run.studentSlugs.length }} Schüler</span>
        </div>
      </div>
    </div>
    <CreateRunDialog
      :open="showCreateDialog"
      @close="showCreateDialog = false"
      @created="onRunCreated"
    />
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
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

.btn-primary:hover {
  background: #e00000;
}

.loading {
  color: #6a6a8a;
  font-size: 16px;
  padding: 40px 0;
  text-align: center;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #6a6a8a;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h2 {
  color: #a0a0c0;
  margin-bottom: 8px;
}

.runs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.run-card {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.run-card:hover {
  border-color: #c00000;
  transform: translateY(-2px);
}

.run-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.run-card-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.run-badge {
  background: #2a2a4a;
  color: #4a90d9;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.run-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #6a6a8a;
  margin-bottom: 16px;
}

.run-card-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #2a2a4a;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #196f2b;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #6a6a8a;
  white-space: nowrap;
}
</style>
