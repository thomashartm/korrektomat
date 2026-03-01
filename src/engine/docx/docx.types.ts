/**
 * docx.types.ts
 * TypeScript type definitions for the structured grading data
 * that the AI produces and the DOCX generator consumes.
 */

/** Supported error category abbreviations used in inline correction markup. */
export type ErrorCategory = 'Gr' | 'Ort' | 'Voc' | 'Expr' | 'Präp' | 'Akz'

/**
 * An inline segment within a corrected paragraph.
 * - text:      plain text that needs no correction
 * - error:     original word replaced by a correction (~~orig~~ -> korr^cat)
 * - insertion: a missing word that should be inserted ([word]^cat)
 * - deletion:  a word that should be removed (~~word~~ -> empty-set^cat)
 */
export type InlineSegment =
  | { type: 'text'; content: string }
  | { type: 'error'; original: string; correction: string; category: ErrorCategory }
  | { type: 'insertion'; word: string; category: ErrorCategory }
  | { type: 'deletion'; word: string; category: ErrorCategory }

/** A single paragraph of inline-corrected text. */
export interface InlineParagraph {
  segments: InlineSegment[]
}

/** A single row in the content (Inhalt) scoring rubric. */
export interface ContentRow {
  kriterium: string
  beobachtung: string
  np?: string
}

/** Content (Inhalt) scoring: 0-15 NP with rubric rows. */
export interface ContentScore {
  /** Notenpunkte for content, 0-15 */
  np: number
  /** Summary sentence describing the overall content performance */
  beschreibung: string
  /** Individual rubric rows */
  rows: ContentRow[]
}

/** A single language dimension score (0-5 NP). */
export interface LanguageDimension {
  /** Notenpunkte for this dimension, 0-5 */
  np: number
  /** Evaluative text for this dimension */
  text: string
}

/** Language (Sprache) scoring across three dimensions, each 0-5 NP. */
export interface LanguageScore {
  /** Kommunikative Gestaltung */
  kommunikativ: LanguageDimension
  /** Verfuegbarkeit sprachlicher Mittel */
  verfuegbarkeit: LanguageDimension
  /** Sprachliche Korrektheit */
  korrektheit: LanguageDimension
}

/** Combined grading scores for content and language. */
export interface GradingScores {
  inhalt: ContentScore
  sprache: LanguageScore
  /** Human-readable grade label, e.g. "gut-" */
  notenbezeichnung: string
}

/** A single entry in the error summary (Fehleruebersicht). */
export interface ErrorSummaryItem {
  category: ErrorCategory
  description: string
  count?: number
  isRepetitionError?: boolean
}

/** A single recommendation in the Foerderhinweise section. */
export interface FoerderhinweisItem {
  prioritaet: number
  empfehlung: string
  beispiele: string[]
}

/** Metadata for the grading document cover page. */
export interface DocumentMeta {
  titel: string
  untertitel: string
  datum: string
  kurs: string
  aufgabenart: string
  schueler?: string
}

/**
 * The complete grading result produced by the AI.
 * This is the top-level input for buildGradingDocument().
 */
export interface GradingResult {
  meta: DocumentMeta
  aufgabenstellung: string
  transcription: string
  inlineCorrection: InlineParagraph[]
  fehlerUebersicht: ErrorSummaryItem[]
  fehlerBilanz: string
  scores: GradingScores
  foerderhinweise: FoerderhinweisItem[]
}
