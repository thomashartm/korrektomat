# Korrektomat

> **Experimental** — This project is an experimental approach to AI-assisted exam grading. It has been validated with anonymized Oberstufen written exams in a foreign language, but remains a work in progress. Results should always be reviewed by a qualified teacher before use. The quality of grading depends on the AI model, prompt design, and scan quality. Expect rough edges.

AI-powered desktop application for grading handwritten exam papers (Klassenarbeiten). Korrektomat processes scanned student submissions alongside a task sheet and uses large language models (Claude or Gemini) to produce detailed grading reports with inline corrections as professional DOCX documents.

## Purpose

Korrektomat automates the labor-intensive process of grading handwritten exams in the German school system. It was originally designed around foreign-language assessments (e.g. Spanish, French, English) but the architecture is intended to generalize to any subject that relies on written assessments — essays, history exams, philosophy papers, and similar formats.

Korrektomat does not replace a teacher's assessment and qualified judgement. It is a tool that eases the correction process and can reduce the effort involved massively — but the final grade and feedback always remain the teacher's responsibility.

Teachers scan student papers, configure a grading run, and the application handles the rest.

## Features

- **Multimodal AI grading** — analyzes handwritten answers against the task sheet using vision-capable LLMs (Claude, Gemini)
- **Multi-provider support** — swap between Anthropic Claude and Google Gemini models without workflow changes
- **Structured scoring** — evaluates content accuracy (Inhalt) and language proficiency (Sprache) across multiple dimensions: communicative competence, vocabulary availability, and grammatical correctness
- **Error categorization** — classifies language errors by type (Grammatik, Orthografie, Vokabular, Ausdruck, etc.)
- **German grading scale** — calculates scores in Notenpunkte (0–15) with automatic grade labels
- **Professional DOCX output** — generates correction documents with inline annotations, scoring tables, and comments ready for distribution
- **Batch processing** — grade entire classes sequentially with pause/resume, progress tracking, and inter-request delays for rate-limit safety
- **File-system workspace** — all data stored as JSON manifests and images on disk; no database required
- **Inbox watching** — monitors student inbox folders for new scans and processes them automatically
- **Customizable prompts** — per-run prompt templates allow tailoring grading criteria to specific exam types
- **Streaming responses** — real-time display of AI output as it generates
- **DOCX regeneration** — re-generate the correction document after manual edits to `grading_result.json`
- **Cross-platform** — runs on macOS, Windows, and Linux via Electron

## Architecture

Korrektomat is an **Electron** desktop application with a clear three-layer separation:

```
┌──────────────────────────────────────────────────────┐
│                   Renderer (Vue 3)                    │
│   Views · Components · Pinia Stores · Vue Router      │
├────────────────────── IPC ───────────────────────────┤
│               Main Process (Electron)                 │
│   Window management · IPC handlers · File watcher     │
├──────────────────────────────────────────────────────┤
│                Engine (Node.js / TS)                   │
│   AI providers · Grading pipeline · Workspace mgmt    │
│   Image processing · DOCX generation                  │
└──────────────────────────────────────────────────────┘
```

### Source Layout

```
src/
├── main/                       # Electron main process
│   ├── index.ts                # Window creation, IPC registration
│   ├── ipc/                    # IPC handler modules
│   │   ├── grading.ipc.ts      #   Grading operations
│   │   ├── workspace.ipc.ts    #   Workspace CRUD
│   │   ├── settings.ipc.ts     #   App configuration
│   │   └── files.ipc.ts        #   File operations
│   └── services/
│       └── file-watcher.service.ts
│
├── preload/                    # Electron preload (safe API bridge)
│   └── index.ts
│
├── renderer/                   # Vue 3 frontend
│   └── src/
│       ├── App.vue
│       ├── router/             # Hash-based routing
│       ├── stores/             # Pinia state management
│       │   ├── grading.store.ts
│       │   ├── workspace.store.ts
│       │   └── settings.store.ts
│       ├── views/              # Page-level components
│       │   ├── DashboardView.vue
│       │   ├── RunView.vue
│       │   ├── StudentView.vue
│       │   ├── GradingView.vue
│       │   └── SettingsView.vue
│       └── components/         # Reusable UI components
│
└── engine/                     # Core business logic (framework-agnostic)
    ├── ai/                     # AI provider abstraction
    │   ├── ai.provider.ts      #   Provider interface + factory
    │   ├── providers/
    │   │   ├── claude.provider.ts
    │   │   └── gemini.provider.ts
    │   └── prompt/
    │       └── prompt.builder.ts
    ├── grading/                # Grading orchestration
    │   ├── grading.pipeline.ts #   Single-student pipeline
    │   ├── batch.grader.ts     #   Batch processing
    │   └── grading.parser.ts   #   AI response parsing + validation
    ├── workspace/              # File-system workspace management
    │   ├── workspace.manager.ts
    │   ├── workspace.schema.ts #   Zod schemas + model presets
    │   └── workspace.constants.ts
    ├── image/                  # Image processing (Sharp)
    │   └── image.processor.ts
    └── docx/                   # DOCX document generation
        ├── docx.builder.ts
        ├── docx.generator.ts
        └── docx.styles.ts
```

### Key Design Decisions

- **No database.** All state is persisted as JSON manifest files on disk. The file system is the single source of truth.
- **AI provider abstraction.** A common `AIProvider` interface allows swapping between Anthropic Claude and Google Gemini without changing pipeline code.
- **Engine is framework-agnostic.** The `src/engine/` layer has no dependency on Electron or Vue and could be reused in other contexts.
- **Zod validation at boundaries.** All manifests are validated with Zod schemas when read from disk, catching corruption early.

## Grading Pipeline

When a student is graded, the pipeline executes these steps:

1. **Load** — Read run manifest and student manifest, validate preconditions
2. **Process inbox** — Move scanned images from `inbox/` to `scans/`, compress with Sharp
3. **Load images** — Read task sheet pages and student scans as base64
4. **Build prompt** — Assemble system prompt from base template + agent rules + JSON schema
5. **Call AI** — Stream the request to Claude or Gemini with all images attached
6. **Parse & validate** — Extract structured JSON from the AI response, validate with Zod. On parse failure, retry with a corrective nudge message
7. **Generate DOCX** — Build a professional correction document with inline annotations and scoring tables
8. **Save state** — Persist `grading_result.json` and update the student manifest

## Workspace Structure

Korrektomat organizes all data under a configurable workspace root (default: `~/Documents/Korrekturen`):

```
~/Documents/Korrekturen/
└── {run-slug}/
    ├── run.json                        # Run manifest (metadata, student list)
    ├── prompts/
    │   ├── base-prompt.md              # Grading instructions for the AI
    │   └── agent.md                    # Additional agent rules
    ├── task-sheet/
    │   └── compressed/                 # Processed task sheet images
    └── students/
        └── {student-slug}/
            ├── student.json            # Student manifest (status, scan list, history)
            ├── inbox/                  # Drop scanned images here
            ├── scans/                  # Processed scans (compressed)
            └── output/
                ├── grading_result.json # Structured AI grading output
                └── Klausurkorrektur_*.docx
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 39 |
| Frontend | Vue 3 (Composition API), Pinia, Vue Router, TailwindCSS 4 |
| Build tooling | electron-vite (Vite 7), TypeScript 5.9 |
| AI providers | Anthropic Claude SDK, Google Generative AI SDK |
| Document generation | docx (OOXML) |
| Image processing | Sharp |
| Validation | Zod |
| Code quality | ESLint 9, Prettier, Vitest |
| Packaging | electron-builder |

## Supported AI Models

| Preset | Provider | Model | Default Temperature |
|--------|----------|-------|-------------------|
| `claude-sonnet` | Anthropic | `claude-sonnet-4-20250514` | 0.3 |
| `claude-opus` | Anthropic | `claude-opus-4-0-20250514` | 0.2 |
| `gemini-flash` | Google | `gemini-2.0-flash` | 0.3 |
| `gemini-pro` | Google | `gemini-2.5-pro` | 0.2 |

## Prerequisites

- **Node.js** (LTS recommended)
- **npm**
- At least one AI provider API key:
  - [Anthropic API key](https://console.anthropic.com/) for Claude models
  - [Google AI API key](https://aistudio.google.com/apikey) for Gemini models

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

This starts Electron with hot-reload via electron-vite. The app opens a window at 1280x800 (minimum 900x600).

### Configure the App

On first launch, open **Settings** and configure:

1. **Workspace root** — where grading runs are stored (default: `~/Documents/Korrekturen`)
2. **API keys** — enter your Anthropic and/or Google API key
3. **Default model** — select which AI model to use for grading

Configuration is saved to `~/.korrekturen/config.json`.

## Building for Production

### Type-check and Bundle

```bash
npm run build
```

This runs TypeScript type checking for both the Node.js and Vue layers, then bundles with electron-vite.

### Package as Distributable

```bash
# macOS (.dmg)
npm run build:mac

# Windows (NSIS installer)
npm run build:win

# Linux (AppImage, snap, deb)
npm run build:linux
```

Packaged output lands in the `dist/` directory.

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Type-check + bundle for production |
| `npm run start` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript checks (both layers) |
| `npm run typecheck:node` | Type-check main/preload/engine only |
| `npm run typecheck:web` | Type-check renderer/Vue only |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run build:unpack` | Build + unpack (no installer, for testing) |

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) with:
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
  - [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Roadmap / Known Gaps

Korrektomat was built around foreign-language exam grading. Generalizing to other subjects will require work in these areas:

- [ ] **Subject-agnostic scoring dimensions** — the current scoring model (Inhalt + Sprache with sub-dimensions) is specific to language exams. Other subjects need configurable rubric structures.
- [ ] **Prompt template library** — ship a set of base prompts for common exam types (essays, history, STEM written exams) rather than only the bundled language prompt.
- [ ] **Rubric editor** — UI for teachers to define custom scoring criteria, point distributions, and error categories per run.
- [ ] **Multi-language UI** — the interface and status messages are currently a mix of German and English. Full i18n support would make the tool accessible to a wider audience.
- [ ] **PDF scan import** — accept PDF uploads directly instead of requiring pre-extracted images.
- [ ] **Result comparison / calibration** — tools for comparing AI grades against manual grades to measure accuracy and tune prompts.
- [ ] **Test coverage** — expand unit and integration tests across the engine layer.
- [ ] **Auto-update infrastructure** — the update URL is currently a placeholder; wire up a real update server.

## License

Private — not licensed for redistribution.
