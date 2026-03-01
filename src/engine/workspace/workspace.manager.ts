/**
 * workspace.manager.ts
 * Manages the on-disk workspace: run CRUD, student CRUD,
 * inbox processing, and grading result persistence.
 *
 * All operations are file-system based (JSON manifests, no database).
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import slugify from 'slugify'

import type { ZodType } from 'zod'

import {
  RunManifestSchema,
  StudentManifestSchema,
  AppConfigSchema,
  type RunManifest,
  type StudentManifest,
  type AppConfig,
  type ScanFile,
  type GradingAttempt,
  type ModelConfig
} from './workspace.schema'

import {
  DEFAULT_WORKSPACE_ROOT,
  DEFAULT_CONFIG_DIR,
  DEFAULT_CONFIG_PATH,
  FILE_BASE_PROMPT,
  DIR_PROMPTS,
  DIR_TASK_SHEET,
  DIR_TASK_SHEET_COMPRESSED,
  DIR_STUDENTS,
  DIR_INBOX,
  DIR_SCANS,
  DIR_OUTPUT,
  runDir,
  runManifestPath,
  studentDir,
  studentManifestPath,
  taskSheetDir,
  gradingResultPath
} from './workspace.constants'

import { processImage } from '../image/image.processor'
import type { GradingResult } from '../docx/docx.types'

// ── HELPERS ─────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString()
}

function makeSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, locale: 'de' })
}

async function readJSON<T>(filePath: string, schema: ZodType<T>): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8')
  return schema.parse(JSON.parse(raw))
}

async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

// ── APP CONFIG ──────────────────────────────────────────────────────────────

/**
 * Load app config from disk. Creates default config if none exists.
 */
export async function loadConfig(): Promise<AppConfig> {
  if (await fileExists(DEFAULT_CONFIG_PATH)) {
    return readJSON(DEFAULT_CONFIG_PATH, AppConfigSchema)
  }
  const defaultConfig: AppConfig = {
    workspaceRoot: DEFAULT_WORKSPACE_ROOT,
    anthropicApiKey: '',
    googleApiKey: '',
    defaultModel: 'claude-sonnet',
    defaultTemperature: 0.3
  }
  await saveConfig(defaultConfig)
  return defaultConfig
}

/**
 * Save app config to disk with restricted permissions (0600).
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(DEFAULT_CONFIG_DIR, { recursive: true })
  await fs.writeFile(DEFAULT_CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: 'utf-8',
    mode: 0o600
  })
}

/**
 * Update app config partially, merging with existing values.
 */
export async function updateConfig(partial: Partial<AppConfig>): Promise<void> {
  const current = await loadConfig()
  const updated = AppConfigSchema.parse({ ...current, ...partial })
  await saveConfig(updated)
}

// ── RUN CRUD ────────────────────────────────────────────────────────────────

export interface CreateRunParams {
  name: string
  kurs: string
  datum: string
  aufgabenart?: string
  fach?: string
  modelConfig?: ModelConfig
}

/**
 * Create a new exam run with its full directory scaffold.
 */
export async function createRun(
  workspaceRoot: string,
  params: CreateRunParams
): Promise<RunManifest> {
  const slug = makeSlug(params.name)
  const dir = runDir(workspaceRoot, slug)

  if (await dirExists(dir)) {
    throw new Error(`Run directory already exists: ${slug}`)
  }

  // Create directory scaffold
  await fs.mkdir(path.join(dir, DIR_PROMPTS), { recursive: true })
  await fs.mkdir(path.join(dir, DIR_TASK_SHEET, DIR_TASK_SHEET_COMPRESSED), { recursive: true })
  await fs.mkdir(path.join(dir, DIR_STUDENTS), { recursive: true })

  const now = nowISO()
  const manifest: RunManifest = {
    name: params.name,
    slug,
    kurs: params.kurs,
    aufgabenart: params.aufgabenart ?? 'Klausur',
    fach: params.fach ?? 'Spanisch',
    datum: params.datum,
    modelConfig: params.modelConfig,
    taskSheetPages: 0,
    studentSlugs: [],
    createdAt: now,
    updatedAt: now
  }

  await writeJSON(runManifestPath(workspaceRoot, slug), manifest)
  return manifest
}

/**
 * List all runs in the workspace.
 */
export async function listRuns(workspaceRoot: string): Promise<RunManifest[]> {
  await fs.mkdir(workspaceRoot, { recursive: true })

  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true })
  const runs: RunManifest[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifestPath = runManifestPath(workspaceRoot, entry.name)
    if (await fileExists(manifestPath)) {
      try {
        const manifest = await readJSON(manifestPath, RunManifestSchema)
        runs.push(manifest)
      } catch {
        // Skip directories with invalid manifests
      }
    }
  }

  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Get a single run by slug.
 */
export async function getRun(workspaceRoot: string, slug: string): Promise<RunManifest> {
  const manifestPath = runManifestPath(workspaceRoot, slug)
  if (!(await fileExists(manifestPath))) {
    throw new Error(`Run not found: ${slug}`)
  }
  return readJSON(manifestPath, RunManifestSchema)
}

/**
 * Delete a run and all its contents.
 */
export async function deleteRun(workspaceRoot: string, slug: string): Promise<void> {
  const dir = runDir(workspaceRoot, slug)
  if (!(await dirExists(dir))) {
    throw new Error(`Run not found: ${slug}`)
  }
  await fs.rm(dir, { recursive: true, force: true })
}

/**
 * Update a run manifest with partial data.
 */
async function updateRunManifest(
  workspaceRoot: string,
  slug: string,
  updater: (manifest: RunManifest) => RunManifest
): Promise<RunManifest> {
  const manifest = await getRun(workspaceRoot, slug)
  const updated = updater({ ...manifest, updatedAt: nowISO() })
  await writeJSON(runManifestPath(workspaceRoot, slug), updated)
  return updated
}

// ── TASK SHEET ──────────────────────────────────────────────────────────────

/**
 * Process and store task sheet images for a run.
 * Images are compressed and saved to the task-sheet/compressed/ directory.
 * Returns the generated filenames.
 */
export async function setTaskSheet(
  workspaceRoot: string,
  runSlug: string,
  imagePaths: string[]
): Promise<string[]> {
  const outDir = taskSheetDir(workspaceRoot, runSlug)

  // Clear existing task sheet images
  await fs.rm(outDir, { recursive: true, force: true })
  await fs.mkdir(outDir, { recursive: true })

  const generatedNames: string[] = []
  for (let i = 0; i < imagePaths.length; i++) {
    const result = await processImage(imagePaths[i], outDir, i + 1)
    generatedNames.push(result.generatedName)
  }

  await updateRunManifest(workspaceRoot, runSlug, (m) => ({
    ...m,
    taskSheetPages: imagePaths.length
  }))

  return generatedNames
}

// ── STUDENT CRUD ────────────────────────────────────────────────────────────

/**
 * Add a student to a run. Creates the student directory scaffold.
 */
export async function addStudent(
  workspaceRoot: string,
  runSlug: string,
  studentName: string
): Promise<StudentManifest> {
  const slug = makeSlug(studentName)
  const dir = studentDir(workspaceRoot, runSlug, slug)

  if (await dirExists(dir)) {
    throw new Error(`Student already exists: ${slug}`)
  }

  // Create student directory scaffold
  await fs.mkdir(path.join(dir, DIR_INBOX), { recursive: true })
  await fs.mkdir(path.join(dir, DIR_SCANS), { recursive: true })
  await fs.mkdir(path.join(dir, DIR_OUTPUT), { recursive: true })

  const now = nowISO()
  const manifest: StudentManifest = {
    name: studentName,
    slug,
    status: 'new',
    scans: [],
    gradingHistory: [],
    createdAt: now,
    updatedAt: now
  }

  await writeJSON(studentManifestPath(workspaceRoot, runSlug, slug), manifest)

  // Add to run's student list
  await updateRunManifest(workspaceRoot, runSlug, (m) => ({
    ...m,
    studentSlugs: [...m.studentSlugs, slug]
  }))

  return manifest
}

/**
 * Add multiple students to a run in batch.
 */
export async function addStudentsBatch(
  workspaceRoot: string,
  runSlug: string,
  names: string[]
): Promise<StudentManifest[]> {
  const results: StudentManifest[] = []
  for (const name of names) {
    const manifest = await addStudent(workspaceRoot, runSlug, name.trim())
    results.push(manifest)
  }
  return results
}

/**
 * List all students in a run.
 */
export async function listStudents(
  workspaceRoot: string,
  runSlug: string
): Promise<StudentManifest[]> {
  const run = await getRun(workspaceRoot, runSlug)
  const students: StudentManifest[] = []

  for (const slug of run.studentSlugs) {
    try {
      const manifest = await getStudent(workspaceRoot, runSlug, slug)
      students.push(manifest)
    } catch {
      // Skip students with missing/invalid manifests
    }
  }

  return students
}

/**
 * Get a single student by slug.
 */
export async function getStudent(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): Promise<StudentManifest> {
  const manifestPath = studentManifestPath(workspaceRoot, runSlug, studentSlug)
  if (!(await fileExists(manifestPath))) {
    throw new Error(`Student not found: ${studentSlug} in run ${runSlug}`)
  }
  return readJSON(manifestPath, StudentManifestSchema)
}

/**
 * Remove a student from a run (deletes directory and manifest).
 */
export async function removeStudent(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): Promise<void> {
  const dir = studentDir(workspaceRoot, runSlug, studentSlug)
  if (!(await dirExists(dir))) {
    throw new Error(`Student not found: ${studentSlug}`)
  }

  await fs.rm(dir, { recursive: true, force: true })

  // Remove from run's student list
  await updateRunManifest(workspaceRoot, runSlug, (m) => ({
    ...m,
    studentSlugs: m.studentSlugs.filter((s) => s !== studentSlug)
  }))
}

/**
 * Update a student manifest with partial data.
 */
async function updateStudentManifest(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string,
  updater: (manifest: StudentManifest) => StudentManifest
): Promise<StudentManifest> {
  const manifest = await getStudent(workspaceRoot, runSlug, studentSlug)
  const updated = updater({ ...manifest, updatedAt: nowISO() })
  await writeJSON(studentManifestPath(workspaceRoot, runSlug, studentSlug), updated)
  return updated
}

// ── INBOX PROCESSING ────────────────────────────────────────────────────────

/**
 * Process all images in a student's inbox.
 * Compresses them and moves to scans/ directory.
 * Updates the student manifest with scan metadata.
 * Returns the new scan files.
 */
export async function processStudentInbox(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): Promise<ScanFile[]> {
  const inbox = path.join(studentDir(workspaceRoot, runSlug, studentSlug), DIR_INBOX)
  const scansOutput = path.join(studentDir(workspaceRoot, runSlug, studentSlug), DIR_SCANS)

  // Check if inbox has any images
  let inboxEntries: string[]
  try {
    inboxEntries = await fs.readdir(inbox)
  } catch {
    return []
  }

  const imageFiles = inboxEntries.filter((f) => {
    const ext = path.extname(f).toLowerCase()
    return ['.jpg', '.jpeg', '.png'].includes(ext)
  })

  if (imageFiles.length === 0) return []

  // Get current scan count for indexing
  const existingScans = await getStudent(workspaceRoot, runSlug, studentSlug)
  const startIndex = existingScans.scans.length + 1

  const newScans: ScanFile[] = []

  for (let i = 0; i < imageFiles.length; i++) {
    const inputPath = path.join(inbox, imageFiles[i])
    const result = await processImage(inputPath, scansOutput, startIndex + i)

    newScans.push({
      originalName: result.originalName,
      generatedName: result.generatedName,
      sizeBytes: result.compressedSizeBytes,
      width: result.width,
      height: result.height
    })

    // Remove processed file from inbox
    await fs.unlink(inputPath)
  }

  // Update student manifest
  await updateStudentManifest(workspaceRoot, runSlug, studentSlug, (m) => ({
    ...m,
    scans: [...m.scans, ...newScans],
    status: m.status === 'new' ? 'scanned' : m.status
  }))

  return newScans
}

// ── GRADING STATE ───────────────────────────────────────────────────────────

/**
 * Mark a student as currently being graded.
 */
export async function markGradingStarted(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string,
  provider: 'anthropic' | 'google',
  model: string
): Promise<GradingAttempt> {
  const attempt: GradingAttempt = {
    startedAt: nowISO(),
    provider,
    model,
    success: false
  }

  await updateStudentManifest(workspaceRoot, runSlug, studentSlug, (m) => ({
    ...m,
    status: 'grading',
    gradingHistory: [...m.gradingHistory, attempt]
  }))

  return attempt
}

/**
 * Mark a student's grading as complete. Saves the grading result JSON.
 */
export async function markGradingComplete(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string,
  result: GradingResult,
  usage?: { inputTokens: number; outputTokens: number }
): Promise<void> {
  // Save grading result JSON
  const resultPath = gradingResultPath(workspaceRoot, runSlug, studentSlug)
  await writeJSON(resultPath, result)

  // Calculate total NP: Inhalt (0-15) + Sprache (3 dimensions, each 0-5 = 0-15)
  const spracheNP =
    result.scores.sprache.kommunikativ.np +
    result.scores.sprache.verfuegbarkeit.np +
    result.scores.sprache.korrektheit.np
  const totalNP = result.scores.inhalt.np + spracheNP

  await updateStudentManifest(workspaceRoot, runSlug, studentSlug, (m) => {
    // Update the last grading attempt
    const history = [...m.gradingHistory]
    if (history.length > 0) {
      history[history.length - 1] = {
        ...history[history.length - 1],
        completedAt: nowISO(),
        success: true,
        usage
      }
    }
    return {
      ...m,
      status: 'graded',
      gradingHistory: history,
      finalGrade: totalNP,
      gradeLabel: result.scores.notenbezeichnung
    }
  })
}

/**
 * Mark a student's grading as failed.
 */
export async function markGradingFailed(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string,
  error: string
): Promise<void> {
  await updateStudentManifest(workspaceRoot, runSlug, studentSlug, (m) => {
    const history = [...m.gradingHistory]
    if (history.length > 0) {
      history[history.length - 1] = {
        ...history[history.length - 1],
        completedAt: nowISO(),
        success: false,
        error
      }
    }
    return {
      ...m,
      status: 'error',
      gradingHistory: history
    }
  })
}

// ── GRADING RESULT PERSISTENCE ──────────────────────────────────────────────

/**
 * Load a saved grading result for a student (for DOCX regeneration).
 */
export async function loadGradingResult(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): Promise<GradingResult | null> {
  const resultPath = gradingResultPath(workspaceRoot, runSlug, studentSlug)
  if (!(await fileExists(resultPath))) {
    return null
  }
  const raw = await fs.readFile(resultPath, 'utf-8')
  return JSON.parse(raw) as GradingResult
}

// ── BASE PROMPT ─────────────────────────────────────────────────────────────

/**
 * Get the base prompt for a run. Falls back to bundled default if none set.
 */
export async function getBasePrompt(
  workspaceRoot: string,
  runSlug: string,
  bundledPromptPath: string
): Promise<string> {
  const customPath = path.join(runDir(workspaceRoot, runSlug), DIR_PROMPTS, FILE_BASE_PROMPT)
  if (await fileExists(customPath)) {
    return fs.readFile(customPath, 'utf-8')
  }
  return fs.readFile(bundledPromptPath, 'utf-8')
}

/**
 * Set a custom base prompt for a run.
 */
export async function setBasePrompt(
  workspaceRoot: string,
  runSlug: string,
  content: string
): Promise<void> {
  const promptPath = path.join(runDir(workspaceRoot, runSlug), DIR_PROMPTS, FILE_BASE_PROMPT)
  await fs.mkdir(path.dirname(promptPath), { recursive: true })
  await fs.writeFile(promptPath, content, 'utf-8')
}

/**
 * Get the agent prompt for a run (optional override).
 */
export async function getAgentPrompt(
  workspaceRoot: string,
  runSlug: string
): Promise<string | null> {
  const agentPath = path.join(runDir(workspaceRoot, runSlug), DIR_PROMPTS, 'agent.md')
  if (await fileExists(agentPath)) {
    return fs.readFile(agentPath, 'utf-8')
  }
  return null
}
