/**
 * workspace.schema.ts
 * Zod schemas for runtime validation and TypeScript types for workspace manifests.
 *
 * RunManifest and StudentManifest are persisted as JSON files on disk.
 * Types are defined explicitly for clarity; schemas validate at read time.
 */

import { z } from 'zod'

// ── STUDENT STATUS ──────────────────────────────────────────────────────────

export type StudentStatus = 'new' | 'scanned' | 'grading' | 'graded' | 'error'

export const StudentStatusSchema = z.enum(['new', 'scanned', 'grading', 'graded', 'error'])

// ── SCAN FILE ───────────────────────────────────────────────────────────────

export interface ScanFile {
  originalName: string
  generatedName: string
  sizeBytes: number
  width: number
  height: number
}

export const ScanFileSchema: z.ZodType<ScanFile> = z.object({
  originalName: z.string(),
  generatedName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
})

// ── GRADING ATTEMPT ─────────────────────────────────────────────────────────

export interface GradingAttempt {
  startedAt: string
  completedAt?: string
  provider: 'anthropic' | 'google'
  model: string
  success: boolean
  error?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export const GradingAttemptSchema: z.ZodType<GradingAttempt> = z.object({
  startedAt: z.string(),
  completedAt: z.string().optional(),
  provider: z.enum(['anthropic', 'google']),
  model: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative()
  }).optional()
})

// ── STUDENT MANIFEST ────────────────────────────────────────────────────────

export interface StudentManifest {
  name: string
  slug: string
  status: StudentStatus
  scans: ScanFile[]
  gradingHistory: GradingAttempt[]
  finalGrade?: number
  gradeLabel?: string
  createdAt: string
  updatedAt: string
}

export const StudentManifestSchema: z.ZodType<StudentManifest> = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  status: StudentStatusSchema,
  scans: z.array(ScanFileSchema),
  gradingHistory: z.array(GradingAttemptSchema),
  finalGrade: z.number().int().min(0).max(15).optional(),
  gradeLabel: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// ── MODEL CONFIG ────────────────────────────────────────────────────────────

export interface ModelConfig {
  provider: 'anthropic' | 'google'
  model: string
  maxTokens: number
  temperature: number
}

export const ModelConfigSchema: z.ZodType<ModelConfig> = z.object({
  provider: z.enum(['anthropic', 'google']),
  model: z.string(),
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2)
})

// ── RUN MANIFEST ────────────────────────────────────────────────────────────

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

export const RunManifestSchema: z.ZodType<RunManifest> = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  kurs: z.string().min(1),
  aufgabenart: z.string(),
  fach: z.string(),
  datum: z.string(),
  modelConfig: ModelConfigSchema.optional(),
  taskSheetPages: z.number().int().nonnegative(),
  studentSlugs: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
})

// ── APP CONFIG ──────────────────────────────────────────────────────────────

export interface AppConfig {
  workspaceRoot: string
  anthropicApiKey: string
  googleApiKey: string
  defaultModel: string
  defaultTemperature: number
}

export const AppConfigSchema: z.ZodType<AppConfig> = z.object({
  workspaceRoot: z.string(),
  anthropicApiKey: z.string(),
  googleApiKey: z.string(),
  defaultModel: z.string(),
  defaultTemperature: z.number().min(0).max(2)
})

// ── MODEL PRESETS ───────────────────────────────────────────────────────────

export const MODEL_PRESETS: Record<string, ModelConfig> = {
  'claude-sonnet': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384,
    temperature: 0.3
  },
  'claude-opus': {
    provider: 'anthropic',
    model: 'claude-opus-4-0-20250514',
    maxTokens: 16384,
    temperature: 0.2
  },
  'gemini-flash': {
    provider: 'google',
    model: 'gemini-2.0-flash',
    maxTokens: 16384,
    temperature: 0.3
  },
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-2.5-pro',
    maxTokens: 16384,
    temperature: 0.2
  }
}
