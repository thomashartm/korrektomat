import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Types will be shared via preload API - for now define locally
export interface RunSummary {
  id: string
  slug: string
  name: string
  subject: string
  courseLevel: string
  gradeLevel: number
  createdAt: string
  updatedAt: string
  studentCount: number
  gradedCount: number
}

export interface StudentSummary {
  id: string
  slug: string
  displayName: string
  status: string
  scanCount: number
  grade?: { total: number; inhalt: number; sprache: number }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const runs = ref<RunSummary[]>([])
  const activeRun = ref<RunSummary | null>(null)
  const students = ref<StudentSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const sortedRuns = computed(() =>
    [...runs.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  )

  const gradedStudents = computed(() =>
    students.value.filter((s) => s.status === 'graded')
  )

  const pendingStudents = computed(() =>
    students.value.filter((s) => s.status !== 'graded' && s.status !== 'grading')
  )

  async function loadRuns(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      runs.value = await window.api.workspace.listRuns()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load runs'
    } finally {
      loading.value = false
    }
  }

  async function loadStudents(runSlug: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      students.value = await window.api.workspace.listStudents(runSlug)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load students'
    } finally {
      loading.value = false
    }
  }

  async function setActiveRun(slug: string): Promise<void> {
    const run = runs.value.find((r) => r.slug === slug)
    if (run) {
      activeRun.value = run
      await loadStudents(slug)
    }
  }

  function clearActiveRun(): void {
    activeRun.value = null
    students.value = []
  }

  return {
    runs,
    activeRun,
    students,
    loading,
    error,
    sortedRuns,
    gradedStudents,
    pendingStudents,
    loadRuns,
    loadStudents,
    setActiveRun,
    clearActiveRun
  }
})
