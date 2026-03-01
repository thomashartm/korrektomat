import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ModelConfig } from './settings.store'

export interface CreateRunParams {
  name: string
  kurs: string
  datum: string
  aufgabenart?: string
  fach?: string
  modelConfig?: ModelConfig
}

// ── Types matching backend workspace.schema.ts ──────────────────────────────

export interface RunManifest {
  name: string
  slug: string
  kurs: string
  aufgabenart: string
  fach: string
  datum: string
  modelConfig?: ModelConfig
  taskSheetPages: number
  studentSlugs: string[]
  createdAt: string
  updatedAt: string
}

export interface ScanFile {
  originalName: string
  generatedName: string
  sizeBytes: number
  width: number
  height: number
}

export interface GradingAttempt {
  startedAt: string
  completedAt?: string
  provider: 'anthropic' | 'google'
  model: string
  success: boolean
  error?: string
  usage?: { inputTokens: number; outputTokens: number }
}

export interface StudentManifest {
  name: string
  slug: string
  status: string
  scans: ScanFile[]
  gradingHistory: GradingAttempt[]
  finalGrade?: number
  gradeLabel?: string
  createdAt: string
  updatedAt: string
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const runs = ref<RunManifest[]>([])
  const activeRun = ref<RunManifest | null>(null)
  const runManifest = ref<RunManifest | null>(null)
  const students = ref<StudentManifest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const workspaceAccessError = ref<{ path: string; fallbackAttempted: boolean } | null>(null)

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

  async function loadRunManifest(slug: string): Promise<void> {
    try {
      runManifest.value = await window.api.workspace.getRun(slug)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lauf konnte nicht geladen werden'
    }
  }

  async function updateRunSettings(
    slug: string,
    updates: Partial<Pick<RunManifest, 'name' | 'kurs' | 'aufgabenart' | 'fach' | 'datum' | 'modelConfig'>>
  ): Promise<void> {
    error.value = null
    try {
      runManifest.value = await window.api.workspace.updateRun(slug, updates)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Einstellungen konnten nicht gespeichert werden'
    }
  }

  async function addStudent(runSlug: string, name: string): Promise<void> {
    error.value = null
    try {
      await window.api.workspace.addStudent(runSlug, name)
      await loadStudents(runSlug)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Schüler konnte nicht hinzugefügt werden'
      throw e
    }
  }

  async function setActiveRun(slug: string): Promise<void> {
    // Load runs list if not yet loaded (direct navigation to /runs/:slug)
    if (runs.value.length === 0) {
      await loadRuns()
    }
    const run = runs.value.find((r) => r.slug === slug)
    if (run) {
      activeRun.value = run
    }
    await Promise.all([loadRunManifest(slug), loadStudents(slug)])
  }

  function clearActiveRun(): void {
    activeRun.value = null
    runManifest.value = null
    students.value = []
  }

  async function createRun(params: CreateRunParams): Promise<string> {
    loading.value = true
    error.value = null
    try {
      const manifest = await window.api.workspace.createRun(params)
      await loadRuns()
      return manifest.slug
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lauf konnte nicht erstellt werden'
      throw e
    } finally {
      loading.value = false
    }
  }

  function registerAccessErrorHandler(): void {
    window.api.workspace.onAccessError((event) => {
      workspaceAccessError.value = event
      error.value = event.fallbackAttempted
        ? `Arbeitsverzeichnis nicht erreichbar: ${event.path} (Fallback ebenfalls fehlgeschlagen)`
        : `Arbeitsverzeichnis nicht erreichbar: ${event.path}`
    })
  }

  return {
    runs,
    activeRun,
    runManifest,
    students,
    loading,
    error,
    workspaceAccessError,
    sortedRuns,
    gradedStudents,
    pendingStudents,
    createRun,
    loadRuns,
    loadRunManifest,
    updateRunSettings,
    addStudent,
    loadStudents,
    setActiveRun,
    clearActiveRun,
    registerAccessErrorHandler
  }
})
