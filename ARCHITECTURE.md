# Architecture

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

## Source Layout

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

## Key Design Decisions

- **No database.** All state is persisted as JSON manifest files on disk. The file system is the single source of truth.
- **Split workspace layout.** Human-facing files (prompts, scans, DOCX) live in visible directories. Manifests and metadata live in a hidden `.korrektomat/` subdirectory within each run. App-level config lives in `~/.korrektomat/`.
- **AI provider abstraction.** A common `AIProvider` interface allows swapping between Anthropic Claude and Google Gemini without changing pipeline code.
- **Engine is framework-agnostic.** The `src/engine/` layer has no dependency on Electron or Vue and could be reused in other contexts.
- **Zod validation at boundaries.** All manifests are validated with Zod schemas when read from disk, catching corruption early.
- **Graceful EPERM handling.** If the workspace directory is inaccessible (e.g. macOS TCC restrictions), the app tries a fallback path before surfacing an error to the user.

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

Korrektomat uses a split layout. App config lives in `~/.korrektomat/`. Per-run data lives under a configurable workspace root (default: `~/Korrekturen`), with manifests hidden in a `.korrektomat/` subdirectory within each run:

```
~/.korrektomat/
└── config.json                             # App config (API keys, workspace root, default model)

~/Korrekturen/
└── {run-slug}/
    ├── .korrektomat/                       # Hidden metadata
    │   ├── run.json                        # Run manifest (metadata, student list)
    │   └── students/
    │       └── {student-slug}/
    │           ├── student.json            # Student manifest (status, scan list, history)
    │           └── grading_result.json     # Structured AI grading output
    ├── prompts/                            # Human-facing
    │   ├── base-prompt.md                  # Grading instructions for the AI
    │   └── agent.md                        # Additional agent rules
    ├── task-sheet/
    │   └── compressed/                     # Processed task sheet images
    └── students/
        └── {student-slug}/
            ├── inbox/                      # Drop scanned images here
            ├── scans/                      # Processed scans (compressed)
            └── output/
                └── Klausurkorrektur_*.docx # Generated correction document
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
