/**
 * docx.styles.ts
 * Color constants and reusable style presets for DOCX generation.
 *
 * All color values match the original klausur_engine.js exactly.
 */

import { BorderStyle, type IBorderOptions } from 'docx'

// ── FARBEN ─────────────────────────────────────────────────────────────────
export const BLUE = '1E4E79'
export const RED = 'C00000'
export const GREEN = '196F2B'
export const BLACK = '000000'
export const BG_BLUE = 'D6E4F0'
export const BG_GRN = 'E2EFDA'
export const BG_GRAY = 'F2F2F2'
export const BG_YEL = 'FFF2CC'

// ── BORDER PRESETS ─────────────────────────────────────────────────────────
/** Single border segment used for table cells (gray, 4pt) */
export const CELL_BORDER: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'AAAAAA'
}

/** All four sides with the standard cell border */
export const CELL_BORDERS_ALL = {
  top: CELL_BORDER,
  bottom: CELL_BORDER,
  left: CELL_BORDER,
  right: CELL_BORDER
} as const

// ── MARGIN PRESETS ─────────────────────────────────────────────────────────
/** Standard cell margins (DXA units) */
export const CELL_MARGINS = {
  top: 100,
  bottom: 100,
  left: 150,
  right: 150
} as const
