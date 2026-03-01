import { defineStore } from 'pinia'
import { ref } from 'vue'

export type GradingStep =
  | 'preparing'
  | 'transcribing'
  | 'correcting'
  | 'summarizing-errors'
  | 'scoring'
  | 'generating-recommendations'
  | 'generating-docx'
  | 'complete'

export interface GradingProgress {
  studentSlug: string
  studentName: string
  step: GradingStep
  progress: number
  message: string
  streamOutput: string
}

export const useGradingStore = defineStore('grading', () => {
  const isGrading = ref(false)
  const currentStudent = ref<string | null>(null)
  const progress = ref<GradingProgress | null>(null)
  const batchQueue = ref<string[]>([])
  const batchCompleted = ref<string[]>([])
  const batchErrors = ref<Map<string, string>>(new Map())
  const streamOutput = ref('')

  function startGrading(studentSlug: string, studentName: string): void {
    isGrading.value = true
    currentStudent.value = studentSlug
    streamOutput.value = ''
    progress.value = {
      studentSlug,
      studentName,
      step: 'preparing',
      progress: 0,
      message: 'Vorbereitung...',
      streamOutput: ''
    }
  }

  function updateStep(step: GradingStep, message: string, progressPct: number): void {
    if (progress.value) {
      progress.value.step = step
      progress.value.message = message
      progress.value.progress = progressPct
    }
  }

  function appendStream(chunk: string): void {
    streamOutput.value += chunk
    if (progress.value) {
      progress.value.streamOutput = streamOutput.value
    }
  }

  function completeGrading(): void {
    if (currentStudent.value) {
      batchCompleted.value.push(currentStudent.value)
    }
    isGrading.value = false
    currentStudent.value = null
    if (progress.value) {
      progress.value.step = 'complete'
      progress.value.progress = 100
      progress.value.message = 'Korrektur abgeschlossen'
    }
  }

  function errorGrading(error: string): void {
    if (currentStudent.value) {
      batchErrors.value.set(currentStudent.value, error)
    }
    isGrading.value = false
    currentStudent.value = null
  }

  function startBatch(studentSlugs: string[]): void {
    batchQueue.value = [...studentSlugs]
    batchCompleted.value = []
    batchErrors.value = new Map()
  }

  function reset(): void {
    isGrading.value = false
    currentStudent.value = null
    progress.value = null
    batchQueue.value = []
    batchCompleted.value = []
    batchErrors.value = new Map()
    streamOutput.value = ''
  }

  return {
    isGrading,
    currentStudent,
    progress,
    batchQueue,
    batchCompleted,
    batchErrors,
    streamOutput,
    startGrading,
    updateStep,
    appendStream,
    completeGrading,
    errorGrading,
    startBatch,
    reset
  }
})
