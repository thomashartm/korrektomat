/**
 * grading.parser.ts
 * Validates and parses AI output into a typed GradingResult.
 *
 * Uses Zod for runtime validation of the JSON structure. This catches
 * malformed AI output immediately rather than failing during DOCX generation.
 */

import { z } from 'zod'
import type { GradingResult } from '../docx/docx.types'

// ── ZOD SCHEMA FOR AI OUTPUT VALIDATION ─────────────────────────────────────

const ErrorCategorySchema = z.enum(['Gr', 'Ort', 'Voc', 'Expr', 'Präp', 'Akz'])

const InlineSegmentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string()
  }),
  z.object({
    type: z.literal('error'),
    original: z.string(),
    correction: z.string(),
    category: ErrorCategorySchema
  }),
  z.object({
    type: z.literal('insertion'),
    word: z.string(),
    category: ErrorCategorySchema
  }),
  z.object({
    type: z.literal('deletion'),
    word: z.string(),
    category: ErrorCategorySchema
  })
])

const InlineParagraphSchema = z.object({
  segments: z.array(InlineSegmentSchema).min(1)
})

const ContentRowSchema = z.object({
  kriterium: z.string(),
  beobachtung: z.string(),
  np: z.string().optional()
})

const ContentScoreSchema = z.object({
  np: z.number().int().min(0).max(15),
  beschreibung: z.string(),
  rows: z.array(ContentRowSchema)
})

const LanguageDimensionSchema = z.object({
  np: z.number().int().min(0).max(5),
  text: z.string()
})

const LanguageScoreSchema = z.object({
  kommunikativ: LanguageDimensionSchema,
  verfuegbarkeit: LanguageDimensionSchema,
  korrektheit: LanguageDimensionSchema
})

const GradingScoresSchema = z.object({
  inhalt: ContentScoreSchema,
  sprache: LanguageScoreSchema,
  notenbezeichnung: z.string()
})

const ErrorSummaryItemSchema = z.object({
  category: ErrorCategorySchema,
  description: z.string(),
  count: z.number().int().nonnegative().optional(),
  isRepetitionError: z.boolean().optional()
})

const FoerderhinweisItemSchema = z.object({
  prioritaet: z.number().int().min(1).max(10),
  empfehlung: z.string(),
  beispiele: z.array(z.string())
})

const DocumentMetaSchema = z.object({
  titel: z.string(),
  untertitel: z.string(),
  datum: z.string(),
  kurs: z.string(),
  aufgabenart: z.string(),
  schueler: z.string().optional()
})

const GradingResultSchema = z.object({
  meta: DocumentMetaSchema,
  aufgabenstellung: z.string(),
  transcription: z.string(),
  inlineCorrection: z.array(InlineParagraphSchema),
  fehlerUebersicht: z.array(ErrorSummaryItemSchema),
  fehlerBilanz: z.string(),
  scores: GradingScoresSchema,
  foerderhinweise: z.array(FoerderhinweisItemSchema)
})

// ── PARSING ─────────────────────────────────────────────────────────────────

/** Error thrown when AI output cannot be parsed. */
export class GradingParseError extends Error {
  constructor(
    message: string,
    public readonly rawText: string,
    public readonly zodErrors?: z.ZodError
  ) {
    super(message)
    this.name = 'GradingParseError'
  }
}

/**
 * Extract JSON from AI output text.
 * Handles cases where the AI wraps JSON in markdown code blocks.
 */
function extractJSON(text: string): string {
  let cleaned = text.trim()

  // Remove markdown code block wrappers if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  }

  // Find the outermost JSON object
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new GradingParseError(
      'No JSON object found in AI output',
      text
    )
  }

  return cleaned.slice(firstBrace, lastBrace + 1)
}

/**
 * Parse and validate AI output text into a GradingResult.
 *
 * @param text  Raw text output from the AI model
 * @returns     Validated GradingResult
 * @throws      GradingParseError if the output is invalid
 */
export function parseGradingResult(text: string): GradingResult {
  const jsonStr = extractJSON(text)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    throw new GradingParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      text
    )
  }

  const result = GradingResultSchema.safeParse(parsed)
  if (!result.success) {
    throw new GradingParseError(
      `JSON schema validation failed: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      text,
      result.error
    )
  }

  return result.data as GradingResult
}

/**
 * Build a nudge message for the AI to fix its JSON output.
 * Used on parse failure retry.
 */
export function buildRetryNudge(error: GradingParseError): string {
  const parts = ['Dein vorheriger Output war kein valides JSON.']

  if (error.zodErrors) {
    const issues = error.zodErrors.issues.slice(0, 5).map(
      (i) => `- ${i.path.join('.')}: ${i.message}`
    )
    parts.push('Folgende Felder sind fehlerhaft:')
    parts.push(...issues)
  } else {
    parts.push(`Fehler: ${error.message}`)
  }

  parts.push('')
  parts.push('Bitte gib deine Korrektur erneut als valides JSON aus.')
  parts.push('Achte auf korrekte Escape-Zeichen und vollständige Struktur.')

  return parts.join('\n')
}
