/**
 * workspace.constants.ts
 * Directory structure constants, file patterns, and default paths
 * for the Korrektomat workspace layout.
 */

import * as path from 'path'
import { homedir } from 'os'

// ── DIRECTORY NAMES ─────────────────────────────────────────────────────────

/** Top-level directories within a run */
export const DIR_PROMPTS = 'prompts'
export const DIR_TASK_SHEET = 'task-sheet'
export const DIR_TASK_SHEET_COMPRESSED = 'compressed'
export const DIR_STUDENTS = 'students'

/** Subdirectories within each student folder */
export const DIR_INBOX = 'inbox'
export const DIR_SCANS = 'scans'
export const DIR_OUTPUT = 'output'

// ── FILE NAMES ──────────────────────────────────────────────────────────────

/** Manifest files */
export const FILE_RUN_MANIFEST = 'run.json'
export const FILE_STUDENT_MANIFEST = 'student.json'

/** Prompt files */
export const FILE_BASE_PROMPT = 'base-prompt.md'
export const FILE_AGENT_PROMPT = 'agent.md'

/** Output files */
export const FILE_GRADING_RESULT = 'grading_result.json'

// ── DEFAULT PATHS ───────────────────────────────────────────────────────────

/** Default workspace root directory */
export const DEFAULT_WORKSPACE_ROOT = path.join(homedir(), 'Documents', 'Korrekturen')

/** Default config directory */
export const DEFAULT_CONFIG_DIR = path.join(homedir(), '.korrekturen')

/** Default config file path */
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, 'config.json')

// ── IMAGE PATTERNS ──────────────────────────────────────────────────────────

/** Supported image file extensions (lowercase) */
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

// ── PATH BUILDERS ───────────────────────────────────────────────────────────

/** Build the full path to a run directory */
export function runDir(workspaceRoot: string, runSlug: string): string {
  return path.join(workspaceRoot, runSlug)
}

/** Build the full path to a run manifest */
export function runManifestPath(workspaceRoot: string, runSlug: string): string {
  return path.join(workspaceRoot, runSlug, FILE_RUN_MANIFEST)
}

/** Build the full path to a run's prompts directory */
export function promptsDir(workspaceRoot: string, runSlug: string): string {
  return path.join(workspaceRoot, runSlug, DIR_PROMPTS)
}

/** Build the full path to a run's task sheet compressed directory */
export function taskSheetDir(workspaceRoot: string, runSlug: string): string {
  return path.join(workspaceRoot, runSlug, DIR_TASK_SHEET, DIR_TASK_SHEET_COMPRESSED)
}

/** Build the full path to a student directory */
export function studentDir(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): string {
  return path.join(workspaceRoot, runSlug, DIR_STUDENTS, studentSlug)
}

/** Build the full path to a student manifest */
export function studentManifestPath(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): string {
  return path.join(workspaceRoot, runSlug, DIR_STUDENTS, studentSlug, FILE_STUDENT_MANIFEST)
}

/** Build the full path to a student's inbox directory */
export function inboxDir(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): string {
  return path.join(workspaceRoot, runSlug, DIR_STUDENTS, studentSlug, DIR_INBOX)
}

/** Build the full path to a student's scans directory */
export function scansDir(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): string {
  return path.join(workspaceRoot, runSlug, DIR_STUDENTS, studentSlug, DIR_SCANS)
}

/** Build the full path to a student's output directory */
export function outputDir(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): string {
  return path.join(workspaceRoot, runSlug, DIR_STUDENTS, studentSlug, DIR_OUTPUT)
}

/** Build the full path to a student's grading result JSON */
export function gradingResultPath(
  workspaceRoot: string,
  runSlug: string,
  studentSlug: string
): string {
  return path.join(workspaceRoot, runSlug, DIR_STUDENTS, studentSlug, DIR_OUTPUT, FILE_GRADING_RESULT)
}

/** Build the DOCX output filename for a student */
export function docxFilename(studentName: string, kurs: string): string {
  return `Klausurkorrektur_${studentName}_${kurs}.docx`
}
