/**
 * docx.builder.ts
 * High-level builder that takes a GradingResult object and produces a DOCX Buffer.
 *
 * This is the primary entry point for generating grading documents from
 * structured AI output.
 */

import { Paragraph, Table, PageBreak } from 'docx'
import type { TextRun } from 'docx'

import type {
  GradingResult,
  InlineParagraph,
  InlineSegment,
  ErrorSummaryItem,
  FoerderhinweisItem
} from './docx.types'

import {
  t,
  err,
  ins,
  del_,
  p,
  pb,
  h2,
  ep,
  tc,
  tr_,
  mkTable,
  buildTitlePage,
  buildLegendTable,
  buildVarietatBox,
  buildBewertungTables,
  buildDocument,
  type BewertungScores
} from './docx.generator'

import { BG_BLUE, BG_GRAY, BG_GRN, RED } from './docx.styles'

// ── INLINE SEGMENT CONVERSION ─────────────────────────────────────────────

/**
 * Convert a single InlineSegment to one or more TextRun objects.
 */
function segmentToRuns(seg: InlineSegment): TextRun[] {
  switch (seg.type) {
    case 'text':
      return [t(seg.content)]
    case 'error':
      return err(seg.original, seg.correction, seg.category)
    case 'insertion':
      return ins(seg.word, seg.category)
    case 'deletion':
      return del_(seg.word, seg.category)
  }
}

/**
 * Convert an InlineParagraph (array of segments) to a Paragraph with TextRuns.
 */
function inlineParagraphToDocx(ip: InlineParagraph): Paragraph {
  const runs: TextRun[] = ip.segments.flatMap(segmentToRuns)
  return p([runs])
}

// ── SECTION BUILDERS ──────────────────────────────────────────────────────

/**
 * Build the Aufgabenstellung section.
 */
function buildAufgabenstellungSection(aufgabenstellung: string): (Paragraph | Table)[] {
  return [pb('1  Aufgabenstellung'), ep(), p([t(aufgabenstellung)]), ep()]
}

/**
 * Build the Transkription section (original student text).
 */
function buildTranskriptionSection(transcription: string): (Paragraph | Table)[] {
  const paragraphs = transcription.split('\n').filter((line) => line.trim().length > 0)
  return [
    pb('2  Sch\u00FClertext (Transkription)'),
    ep(),
    ...paragraphs.map((text) => p([t(text)])),
    ep()
  ]
}

/**
 * Build the inline correction section from InlineParagraph[].
 */
function buildInlineCorrectionSection(
  inlineCorrection: InlineParagraph[]
): (Paragraph | Table)[] {
  return [
    pb('3  Inline-Korrektur'),
    ep(),
    buildLegendTable(),
    ep(),
    buildVarietatBox(),
    ep(),
    ...inlineCorrection.map(inlineParagraphToDocx),
    ep()
  ]
}

/**
 * Build the Fehleruebersicht section from ErrorSummaryItem[].
 */
function buildFehlerUebersichtSection(
  fehlerUebersicht: ErrorSummaryItem[],
  fehlerBilanz: string
): (Paragraph | Table)[] {
  const headerRow = tr_([
    tc('Kategorie', 1600, { bg: BG_BLUE, bold: true }),
    tc('Beschreibung', 5500, { bg: BG_BLUE, bold: true }),
    tc('Anzahl', 1200, { bg: BG_BLUE, bold: true, center: true }),
    tc('Typ', 1140, { bg: BG_BLUE, bold: true, center: true })
  ])

  const dataRows = fehlerUebersicht.map((item) =>
    tr_([
      tc(item.category, 1600, { bg: BG_GRAY, bold: true, color: RED }),
      tc(item.description, 5500),
      tc(item.count !== undefined ? String(item.count) : '', 1200, { center: true }),
      tc(item.isRepetitionError ? 'WF' : '', 1140, { center: true })
    ])
  )

  return [
    pb('4  Fehler\u00FCbersicht'),
    ep(),
    mkTable([headerRow, ...dataRows], [1600, 5500, 1200, 1140]),
    ep(),
    h2('Fehlerbilanz'),
    p([t(fehlerBilanz)]),
    ep()
  ]
}

/**
 * Build the Bewertung section from GradingScores.
 *
 * Converts the GradingResult.scores shape to the BewertungScores shape
 * expected by the generator's buildBewertungTables().
 */
function buildBewertungSection(scores: GradingResult['scores']): (Paragraph | Table)[] {
  // Map from GradingResult's LanguageScore shape to the generator's BewertungScores shape
  const bewertungScores: BewertungScores = {
    inhalt: scores.inhalt,
    sprache: {
      komm: scores.sprache.kommunikativ,
      verfug: scores.sprache.verfuegbarkeit,
      korrektheit: scores.sprache.korrektheit
    },
    notenbezeichnung: scores.notenbezeichnung
  }

  const { inhaltTable, spracheTable, gesamtTable } = buildBewertungTables(bewertungScores)

  return [
    pb('5  Bewertung'),
    ep(),
    h2('Inhalt'),
    inhaltTable,
    ep(),
    h2('Sprache'),
    spracheTable,
    ep(),
    h2('Gesamtnote'),
    gesamtTable,
    ep()
  ]
}

/**
 * Build the Foerderhinweise section from FoerderhinweisItem[].
 */
function buildFoerderhinweiseSection(
  foerderhinweise: FoerderhinweisItem[]
): (Paragraph | Table)[] {
  const headerRow = tr_([
    tc('Prio', 800, { bg: BG_BLUE, bold: true, center: true }),
    tc('Empfehlung', 5000, { bg: BG_BLUE, bold: true }),
    tc('Beispiele', 3640, { bg: BG_BLUE, bold: true })
  ])

  const dataRows = foerderhinweise
    .sort((a, b) => a.prioritaet - b.prioritaet)
    .map((item) =>
      tr_([
        tc(String(item.prioritaet), 800, { center: true, bg: BG_GRN }),
        tc(item.empfehlung, 5000),
        tc(item.beispiele.join('; '), 3640)
      ])
    )

  return [
    pb('6  F\u00F6rderhinweise'),
    ep(),
    mkTable([headerRow, ...dataRows], [800, 5000, 3640]),
    ep()
  ]
}

// ── MAIN BUILDER ──────────────────────────────────────────────────────────

/**
 * Build a complete grading document from a GradingResult.
 *
 * @param result  The structured grading result produced by the AI
 * @returns       A Buffer containing the DOCX file
 */
export async function buildGradingDocument(result: GradingResult): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [
    // 1. Title page
    ...buildTitlePage(result.meta),

    // 2. Aufgabenstellung
    ...buildAufgabenstellungSection(result.aufgabenstellung),

    // 3. Transkription (original student text)
    ...buildTranskriptionSection(result.transcription),

    // Page break before inline correction
    new Paragraph({ children: [new PageBreak()] }),

    // 4. Inline correction
    ...buildInlineCorrectionSection(result.inlineCorrection),

    // Page break before error overview
    new Paragraph({ children: [new PageBreak()] }),

    // 5. Fehleruebersicht
    ...buildFehlerUebersichtSection(result.fehlerUebersicht, result.fehlerBilanz),

    // 6. Bewertung
    ...buildBewertungSection(result.scores),

    // Page break before Foerderhinweise
    new Paragraph({ children: [new PageBreak()] }),

    // 7. Foerderhinweise
    ...buildFoerderhinweiseSection(result.foerderhinweise)
  ]

  return buildDocument({ sections })
}
