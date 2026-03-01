/**
 * grading.pipeline.ts
 * Full grading orchestration for a single student.
 *
 * Pipeline steps:
 * 1. Load manifests and validate preconditions
 * 2. Process inbox (if needed)
 * 3. Load task sheet + student scans as base64
 * 4. Build prompt (base + agent + JSON schema)
 * 5. Call AI provider with streaming
 * 6. Parse and validate response
 * 7. Generate DOCX
 * 8. Save state (grading_result.json + student manifest)
 */

import * as fs from 'fs/promises'
import * as path from 'path'

import type { AIProvider } from '../ai/ai.provider'
import { createProvider } from '../ai/ai.provider'
import type { AIGradingRequest, ImageInput } from '../ai/ai.types'
import { buildSystemPrompt, buildUserMessage } from '../ai/prompt/prompt.builder'
import { buildGradingDocument } from '../docx/docx.builder'
import type { GradingResult } from '../docx/docx.types'
import {
  processStudentInbox,
  getRun,
  getStudent,
  getBasePrompt,
  getAgentPrompt,
  markGradingStarted,
  markGradingComplete,
  loadGradingResult,
  loadConfig
} from '../workspace/workspace.manager'
import {
  taskSheetDir,
  scansDir,
  outputDir,
  docxFilename
} from '../workspace/workspace.constants'
import type { ModelConfig } from '../workspace/workspace.schema'
import { MODEL_PRESETS } from '../workspace/workspace.schema'
import { parseGradingResult, GradingParseError, buildRetryNudge } from './grading.parser'
import type {
  GradingCallbacks,
  GradeOptions,
  RetryPolicy,
  GradingProgress
} from './grading.types'
import { DEFAULT_RETRY_POLICY } from './grading.types'

// ── HELPERS ─────────────────────────────────────────────────────────────────

function mimeType(filePath: string): 'image/jpeg' | 'image/png' {
  return filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
}

async function loadImagesFromDir(dir: string): Promise<ImageInput[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const imageFiles = entries
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .sort()

  const images: ImageInput[] = []
  for (const file of imageFiles) {
    const filePath = path.join(dir, file)
    const data = await fs.readFile(filePath)
    images.push({
      data: data.toString('base64'),
      mediaType: mimeType(file)
    })
  }
  return images
}

function emitProgress(
  callbacks: GradingCallbacks,
  runSlug: string,
  studentSlug: string,
  step: GradingProgress['step'],
  progress: number,
  message: string
): void {
  callbacks.onProgress?.({ runSlug, studentSlug, step, progress, message })
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── RETRY LOGIC ─────────────────────────────────────────────────────────────

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  policy: RetryPolicy,
  retryAfterMs?: number
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt >= maxRetries) break

      let delayMs: number
      if (retryAfterMs && attempt === 0) {
        delayMs = retryAfterMs
      } else {
        delayMs = Math.min(
          policy.baseDelayMs * Math.pow(2, attempt),
          policy.maxDelayMs
        )
      }
      await delay(delayMs)
    }
  }
  throw lastError
}

// ── MAIN PIPELINE ───────────────────────────────────────────────────────────

/**
 * Grade a single student's exam through the full pipeline.
 *
 * @param workspaceRoot  Path to the workspace root directory
 * @param runSlug        Run identifier
 * @param studentSlug    Student identifier
 * @param callbacks      Progress and streaming callbacks
 * @param options        Grading options (model override, force, etc.)
 * @param retryPolicy    Retry policy for AI calls
 * @returns              Path to the generated DOCX file
 */
export async function gradeStudent(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string,
  callbacks: GradingCallbacks = {},
  options: GradeOptions = {},
  retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<string> {
  // ── Step 1: Load ──────────────────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'loading', 0, 'Lade Daten...')

  const run = await getRun(workspaceRoot, runSlug)
  const student = await getStudent(workspaceRoot, runSlug, studentSlug)

  if (student.status === 'graded' && !options.force) {
    throw new Error(`Student ${studentSlug} is already graded. Use force=true to re-grade.`)
  }

  // ── Step 2: Process inbox ─────────────────────────────────────────────
  if (!options.skipInboxProcessing) {
    emitProgress(callbacks, runSlug, studentSlug, 'processing-inbox', 0.1, 'Verarbeite Inbox...')
    await processStudentInbox(workspaceRoot, runSlug, studentSlug)
  }

  // ── Step 3: Load images ───────────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'loading-images', 0.2, 'Lade Bilder...')

  const taskImages = await loadImagesFromDir(
    taskSheetDir(workspaceRoot, runSlug)
  )
  const studentImages = await loadImagesFromDir(
    scansDir(workspaceRoot, runSlug, studentSlug)
  )

  if (studentImages.length === 0) {
    throw new Error(`No scan images found for student ${studentSlug}`)
  }

  // ── Step 4: Build prompt ──────────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'building-prompt', 0.3, 'Erstelle Prompt...')

  const bundledPromptPath = path.join(__dirname, '..', '..', '..', 'resources', 'prompts', 'base-prompt-spanisch-lk.md')
  const basePrompt = await getBasePrompt(workspaceRoot, runSlug, bundledPromptPath)
  const agentPrompt = await getAgentPrompt(workspaceRoot, runSlug)
  const systemPrompt = buildSystemPrompt(basePrompt, agentPrompt)
  const userMessage = buildUserMessage(student.name, run.kurs)

  // Resolve model config
  const config = await loadConfig()
  const fallbackModel: ModelConfig = MODEL_PRESETS[config.defaultModel] ?? MODEL_PRESETS['claude-sonnet']
  const modelConfig: ModelConfig = options.modelOverride
    ? {
        provider: options.modelOverride.provider,
        model: options.modelOverride.model,
        maxTokens: options.modelOverride.maxTokens ?? 16384,
        temperature: options.modelOverride.temperature ?? 0.3
      }
    : run.modelConfig ?? fallbackModel

  const apiKey = modelConfig.provider === 'anthropic'
    ? config.anthropicApiKey
    : config.googleApiKey

  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${modelConfig.provider}`)
  }

  // ── Step 5: AI call ───────────────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'calling-ai', 0.4, 'Rufe KI auf...')

  await markGradingStarted(workspaceRoot, runSlug, studentSlug, modelConfig.provider, modelConfig.model)

  const provider: AIProvider = await createProvider({
    provider: modelConfig.provider,
    apiKey,
    model: modelConfig.model
  })

  const request: AIGradingRequest = {
    systemPrompt,
    userMessage,
    taskSheetImages: taskImages,
    studentImages,
    maxTokens: modelConfig.maxTokens,
    temperature: modelConfig.temperature
  }

  let accumulated = ''
  const aiResponse = await retryWithBackoff(
    async () => {
      return provider.gradeStream(request, {
        onChunk: (text) => {
          accumulated += text
          callbacks.onStreamChunk?.({
            runSlug,
            studentSlug,
            text,
            accumulated
          })
        }
      })
    },
    retryPolicy.rateLimitRetries,
    retryPolicy
  )

  // ── Step 6: Parse & validate ──────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'parsing-response', 0.7, 'Validiere Ausgabe...')

  let gradingResult: GradingResult
  try {
    gradingResult = parseGradingResult(aiResponse.text)
  } catch (parseError) {
    if (
      parseError instanceof GradingParseError &&
      retryPolicy.parseFailureRetries > 0
    ) {
      // One retry with nudge message
      const nudge = buildRetryNudge(parseError)
      const retryRequest: AIGradingRequest = {
        ...request,
        userMessage: nudge
      }

      const retryResponse = await provider.gradeStream(retryRequest, {
        onChunk: (text) => {
          callbacks.onStreamChunk?.({
            runSlug,
            studentSlug,
            text,
            accumulated: text
          })
        }
      })

      gradingResult = parseGradingResult(retryResponse.text)
    } else {
      throw parseError
    }
  }

  // Ensure student name is set in meta
  if (!gradingResult.meta.schueler) {
    gradingResult.meta.schueler = student.name
  }

  // ── Step 7: Generate DOCX ─────────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'generating-docx', 0.85, 'Erstelle DOCX...')

  const docxBuffer = await buildGradingDocument(gradingResult)
  const outDir = outputDir(workspaceRoot, runSlug, studentSlug)
  await fs.mkdir(outDir, { recursive: true })
  const docxName = docxFilename(student.name, run.kurs)
  const docxPath = path.join(outDir, docxName)
  await fs.writeFile(docxPath, docxBuffer)

  // ── Step 8: Save state ────────────────────────────────────────────────
  emitProgress(callbacks, runSlug, studentSlug, 'saving-state', 0.95, 'Speichere Ergebnis...')

  await markGradingComplete(workspaceRoot, runSlug, studentSlug, gradingResult, aiResponse.usage)

  emitProgress(callbacks, runSlug, studentSlug, 'saving-state', 1.0, 'Fertig!')

  // Calculate total NP
  const spracheNP =
    gradingResult.scores.sprache.kommunikativ.np +
    gradingResult.scores.sprache.verfuegbarkeit.np +
    gradingResult.scores.sprache.korrektheit.np
  const totalNP = gradingResult.scores.inhalt.np + spracheNP

  callbacks.onComplete?.({
    runSlug,
    studentSlug,
    totalNP,
    gradeLabel: gradingResult.scores.notenbezeichnung,
    docxPath,
    usage: aiResponse.usage
  })

  return docxPath
}

/**
 * Regenerate the DOCX for a student from a saved GradingResult.
 * Useful after manually editing scores in grading_result.json.
 */
export async function regenerateDocx(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): Promise<string> {
  const gradingResult = await loadGradingResult(workspaceRoot, runSlug, studentSlug)
  if (!gradingResult) {
    throw new Error(`No grading result found for student ${studentSlug}`)
  }

  const run = await getRun(workspaceRoot, runSlug)
  const student = await getStudent(workspaceRoot, runSlug, studentSlug)

  const docxBuffer = await buildGradingDocument(gradingResult)
  const outDir = outputDir(workspaceRoot, runSlug, studentSlug)
  await fs.mkdir(outDir, { recursive: true })
  const docxName = docxFilename(student.name, run.kurs)
  const docxPath = path.join(outDir, docxName)
  await fs.writeFile(docxPath, docxBuffer)

  return docxPath
}
