/**
 * docx.generator.ts
 * Direct TypeScript port of klausur_engine.js.
 *
 * Every function, constant, DXA width, font size, color value, and border style
 * is faithfully preserved from the original JavaScript source.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Footer,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageNumber,
  PageBreak,
  type IRunOptions,
  type IParagraphOptions
} from 'docx'

import {
  BLUE,
  RED,
  GREEN,
  BLACK,
  BG_BLUE,
  BG_GRN,
  BG_GRAY,
  BG_YEL,
  CELL_BORDERS_ALL,
  CELL_MARGINS
} from './docx.styles'

import type { DocumentMeta } from './docx.types'

// Re-export docx primitives for advanced usage in correction scripts
export {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  PageBreak,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType
}

// ── TEXT-HELFER ────────────────────────────────────────────────────────────

/** Normaler Textlauf (Arial 11pt, schwarz) */
export const t = (text: string, x: Partial<IRunOptions> = {}): TextRun =>
  new TextRun({ text, font: 'Arial', size: 22, color: BLACK, ...x })

/** Fehlertext: rot + durchgestrichen */
export const E = (text: string): TextRun => t(text, { color: RED, strike: true })

/** Korrekturtext: gruen + fett */
export const C = (text: string): TextRun => t(text, { color: GREEN, bold: true })

/** Fehlerkoerzel: rot + hochgestellt */
export const K = (text: string): TextRun => t(text, { color: RED, size: 17, superScript: true })

/** Pfeil zwischen Fehler und Korrektur */
export const AR = (): TextRun => t(' \u2192 ', { color: RED, size: 20 })

/**
 * Inline-Fehlermarkierung: ~~Original~~ -> Korrektur^Kuerzel
 * Gibt ein Array von TextRun-Objekten zurueck.
 */
export function err(orig: string, korr: string, kuerzel: string): TextRun[] {
  return [E(orig), AR(), C(korr), K(kuerzel), t(' ')]
}

/**
 * Fehlende Wortmarkierung: zeigt [Wort]^Kuerzel in Gruen.
 * Fuer fehlende Woerter (Einfuegung).
 */
export function ins(word: string, kuerzel: string): TextRun[] {
  return [C('[' + word + ']'), K(kuerzel), t(' ')]
}

/**
 * Loeschmarkierung: ~~Wort~~ -> empty-set^Kuerzel
 * Fuer Woerter, die ersatzlos gestrichen werden sollen.
 */
export function del_(word: string, kuerzel: string): TextRun[] {
  return [E(word), AR(), C('\u2205'), K(kuerzel), t(' ')]
}

// ── ABSATZ-HELFER ──────────────────────────────────────────────────────────

/** Absatz mit flachen TextRun-Arrays */
export const p = (
  runs: (TextRun | TextRun[])[],
  bef = 80,
  aft = 80,
  extra: Omit<IParagraphOptions, 'children' | 'spacing'> = {}
): Paragraph =>
  new Paragraph({
    children: runs.flat(),
    spacing: { before: bef, after: aft },
    ...extra
  })

/** Blau unterstrichene Abschnittsueberschrift (H1) */
export const pb = (text: string, sz = 26, bef = 300, aft = 100): Paragraph =>
  new Paragraph({
    children: [t(text, { color: BLUE, bold: true, size: sz })],
    spacing: { before: bef, after: aft },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } }
  })

/** Blau-fette Unterueberschrift (H2) */
export const h2 = (text: string): Paragraph =>
  new Paragraph({
    children: [t(text, { color: BLUE, bold: true, size: 24 })],
    spacing: { before: 200, after: 80 }
  })

/** Leerer Abstand-Absatz */
export const ep = (): Paragraph =>
  new Paragraph({ children: [t('')], spacing: { before: 40, after: 40 } })

// ── TABELLEN-HELFER ────────────────────────────────────────────────────────

/** Options for table cell creation. */
interface TcOptions {
  bg?: string | null
  bold?: boolean
  center?: boolean
  color?: string
  runs?: (TextRun | TextRun[])[] | null
}

/**
 * Tabellenzelle.
 * @param content  Text, Array von Paragraph-Objekten, or null when using runs
 * @param w        Breite in DXA
 * @param opts     bg, bold, center, color, runs
 */
export function tc(
  content: string | (Paragraph | Table)[],
  w: number,
  { bg = null, bold = false, center = false, color = BLACK, runs = null }: TcOptions = {}
): TableCell {
  let children: (Paragraph | Table)[]

  if (runs) {
    children = [
      new Paragraph({
        children: runs.flat(),
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 0 }
      })
    ]
  } else if (typeof content === 'string') {
    children = [
      new Paragraph({
        children: [t(content, { bold, color })],
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 0, after: 0 }
      })
    ]
  } else {
    children = content // Array von Paragraph-Objekten
  }

  return new TableCell({
    borders: CELL_BORDERS_ALL,
    width: { size: w, type: WidthType.DXA },
    margins: CELL_MARGINS,
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    children
  })
}

/** Tabellenzeile */
export const tr_ = (cells: TableCell[]): TableRow => new TableRow({ children: cells })

/** Tabelle mit expliziten Spaltenbreiten (DXA) */
export function mkTable(rows: TableRow[], colWidths: number[]): Table {
  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows
  })
}

// ── STANDARD-ABSCHNITTS-BUILDER ────────────────────────────────────────────

/**
 * Titelseite.
 * @param meta  Document metadata (titel, untertitel, datum, kurs, aufgabenart, schueler)
 */
export function buildTitlePage(meta: DocumentMeta): (Paragraph | Table)[] {
  const rows: TableRow[] = [
    tr_([
      tc('Korrigiert am', 3500, { bg: BG_BLUE, bold: true }),
      tc(meta.datum || '', 5940, { bg: BG_GRAY })
    ]),
    tr_([
      tc('Kurs', 3500, { bg: BG_BLUE, bold: true }),
      tc(meta.kurs || '', 5940)
    ]),
    tr_([
      tc('Aufgabenart', 3500, { bg: BG_BLUE, bold: true }),
      tc(meta.aufgabenart || '', 5940)
    ])
  ]

  if (meta.schueler) {
    rows.push(
      tr_([
        tc('Sch\u00FCler/in', 3500, { bg: BG_BLUE, bold: true }),
        tc(meta.schueler, 5940)
      ])
    )
  }

  return [
    ep(),
    ep(),
    new Paragraph({
      children: [
        t(meta.titel || 'Klausurkorrektur Spanisch Leistungskurs 12', {
          bold: true,
          size: 40,
          color: BLUE
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 }
    }),
    new Paragraph({
      children: [t(meta.untertitel || '', { size: 28, color: '444444' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 }
    }),
    new Paragraph({
      children: [
        t(
          'Bewertungsrahmen: LK-Standards Baden-W\u00FCrttemberg, Jgst. 12, Niveau B2/C1',
          { size: 20, color: '555555' }
        )
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 }
    }),
    ep(),
    mkTable(rows, [3500, 5940]),
    ep(),
    new Paragraph({ children: [new PageBreak()] })
  ]
}

/** Legende der Korrekturkuerzel */
export function buildLegendTable(): Table {
  return mkTable(
    [
      tr_([
        tc('K\u00FCrzel', 1600, { bg: BG_BLUE, bold: true }),
        tc('Bedeutung', 7840, { bg: BG_BLUE, bold: true })
      ]),
      tr_([
        tc('Gr', 1600, { bg: BG_GRAY }),
        tc('Grammatik (Tempus, Modus, Kongruenz, Genus, ser/estar)', 7840)
      ]),
      tr_([
        tc('Ort', 1600, { bg: BG_GRAY }),
        tc('Rechtschreibung', 7840)
      ]),
      tr_([
        tc('Voc', 1600, { bg: BG_GRAY }),
        tc('Wortschatz (falsche Wahl, Verwechslung)', 7840)
      ]),
      tr_([
        tc('Expr', 1600, { bg: BG_GRAY }),
        tc('Ausdruck / Stil (Register, Anakoluth, unidiomatische Konstruktion)', 7840)
      ]),
      tr_([
        tc('Pr\u00E4p', 1600, { bg: BG_GRAY }),
        tc('Pr\u00E4position (falsche oder fehlende Pr\u00E4position)', 7840)
      ]),
      tr_([
        tc('Akz', 1600, { bg: BG_GRAY }),
        tc('Akzentfehler (fehlendes oder falsches Akzentzeichen)', 7840)
      ])
    ],
    [1600, 7840]
  )
}

/** Hinweisbox Sprachvarietaeten */
export function buildVarietatBox(): Table {
  return mkTable(
    [
      tr_([
        tc('', 200, { bg: BLUE }),
        tc(
          [
            new Paragraph({
              children: [
                t('Hinweis zu Sprachvariet\u00E4ten: ', { bold: true }),
                t(
                  'Lateinamerikanische Konstruktionen und Formen werden grunds\u00E4tzlich nicht als Fehler gewertet, sofern sie in der Norma Culta oder im DRAE anerkannt sind.'
                )
              ],
              spacing: { before: 0, after: 0 }
            })
          ],
          9240,
          { bg: BG_YEL }
        )
      ])
    ],
    [200, 9240]
  )
}

/** Scores input shape matching the original JS scores object. */
export interface BewertungScores {
  inhalt: {
    np: number
    beschreibung: string
    rows: { kriterium: string; beobachtung: string; np?: string }[]
  }
  sprache: {
    komm: { np: number; text: string }
    verfug: { np: number; text: string }
    korrektheit: { np: number; text: string }
  }
  notenbezeichnung: string
}

/** Return type for buildBewertungTables. */
export interface BewertungTables {
  inhaltTable: Table
  spracheTable: Table
  gesamtTable: Table
}

/**
 * Bewertungstabellen aus Punktedaten erzeugen.
 * Gesamtnote wird automatisch berechnet: round(inhalt*0.4 + sprache*0.6)
 */
export function buildBewertungTables(scores: BewertungScores): BewertungTables {
  const { inhalt, sprache } = scores

  // ── Inhalt ──
  const inhaltRows: TableRow[] = [
    tr_([
      tc('Kriterium', 3000, { bg: BG_BLUE, bold: true }),
      tc('Beobachtung', 5500, { bg: BG_BLUE, bold: true }),
      tc('NP', 940, { bg: BG_BLUE, bold: true, center: true })
    ]),
    ...(inhalt.rows || []).map((r) =>
      tr_([
        tc(r.kriterium, 3000),
        tc(r.beobachtung, 5500),
        tc(r.np || '', 940, { center: true })
      ])
    ),
    tr_([
      tc('Inhalt gesamt', 3000, { bg: BG_GRN, bold: true }),
      tc(inhalt.beschreibung || '', 5500, { bg: BG_GRN }),
      tc(inhalt.np + ' / 15', 940, { bg: BG_GRN, bold: true, center: true })
    ])
  ]

  // ── Sprache ──
  const sprachTotal = sprache.komm.np + sprache.verfug.np + sprache.korrektheit.np

  const spracheRows: TableRow[] = [
    tr_([
      tc('Dimension (je 0\u20135 NP)', 3000, { bg: BG_BLUE, bold: true }),
      tc('Bewertung', 5500, { bg: BG_BLUE, bold: true }),
      tc('NP', 940, { bg: BG_BLUE, bold: true, center: true })
    ]),
    tr_([
      tc('Kommunikative Gestaltung', 3000),
      tc(sprache.komm.text, 5500),
      tc(sprache.komm.np + ' / 5', 940, { center: true })
    ]),
    tr_([
      tc('Verf\u00FCgbarkeit sprachlicher Mittel', 3000),
      tc(sprache.verfug.text, 5500),
      tc(sprache.verfug.np + ' / 5', 940, { center: true })
    ]),
    tr_([
      tc('Sprachliche Korrektheit', 3000),
      tc(sprache.korrektheit.text, 5500),
      tc(sprache.korrektheit.np + ' / 5', 940, { center: true })
    ]),
    tr_([
      tc('Sprache gesamt', 3000, { bg: BG_GRN, bold: true }),
      tc('', 5500, { bg: BG_GRN }),
      tc(sprachTotal + ' / 15', 940, { bg: BG_GRN, bold: true, center: true })
    ])
  ]

  // ── Gesamtnote (automatisch berechnet) ──
  const gesamtRaw = inhalt.np * 0.4 + sprachTotal * 0.6
  const gesamt = Math.round(gesamtRaw)

  const gesamtRows: TableRow[] = [
    tr_([
      tc('Inhalt (40 %)', 3000, { bg: BG_BLUE, bold: true }),
      tc(
        `${inhalt.np} NP \u00D7 0,4 = ${(inhalt.np * 0.4).toFixed(1)}`,
        4220,
        { center: true }
      ),
      tc('', 2220)
    ]),
    tr_([
      tc('Sprache (60 %)', 3000, { bg: BG_BLUE, bold: true }),
      tc(
        `${sprachTotal} NP \u00D7 0,6 = ${(sprachTotal * 0.6).toFixed(1)}`,
        4220,
        { center: true }
      ),
      tc('', 2220)
    ]),
    tr_([
      tc('Gesamtnote', 3000, { bg: BG_GRN, bold: true }),
      tc(
        `${gesamtRaw.toFixed(1)} NP  \u2192  ${gesamt} NP  \u2192  ${scores.notenbezeichnung || ''}`,
        4220,
        { bg: BG_GRN, bold: true, center: true }
      ),
      tc(
        'Skala: 15\u202F=\u202Fsehr gut+ | 13\u202F=\u202Fgut+ | 11\u202F=\u202Fgut | 10\u202F=\u202Fgut\u2013 | 7\u202F=\u202Fbefr.\u2013 | 5\u202F=\u202Fausreichend',
        2220,
        { bg: BG_GRN }
      )
    ])
  ]

  return {
    inhaltTable: mkTable(inhaltRows, [3000, 5500, 940]),
    spracheTable: mkTable(spracheRows, [3000, 5500, 940]),
    gesamtTable: mkTable(gesamtRows, [3000, 4220, 2220])
  }
}

/** Options for buildDocument. */
export interface BuildDocumentOptions {
  sections: (Paragraph | Table)[]
}

/**
 * Dokument zusammenbauen und als DOCX Buffer zurueckgeben.
 *
 * Unlike the original JS version which wrote to a file, this returns a Buffer
 * so the caller can decide what to do with it (save to file, send over IPC, etc.).
 */
export async function buildDocument({ sections }: BuildDocumentOptions): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } // ~2 cm
          }
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  t('Spanisch LK 12 \u2014 Klausurkorrektur  |  Seite ', {
                    size: 18,
                    color: '888888'
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Arial',
                    size: 18,
                    color: '888888'
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        children: sections
      }
    ]
  })

  return Packer.toBuffer(doc)
}
