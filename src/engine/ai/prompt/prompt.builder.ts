/**
 * prompt.builder.ts
 * Assembles the complete grading prompt from layered sources:
 * 1. Base prompt (grading criteria, error categories, scoring rubric)
 * 2. Agent prompt (optional per-run override instructions)
 * 3. JSON schema instructions (output format specification)
 *
 * The base prompt is the calibrated grading prompt (adapted from
 * Klausurkorrektur_Prompt_v2.md) which defines the grading methodology.
 * The JSON schema section is always appended to instruct the AI to
 * produce structured GradingResult output.
 */

/**
 * JSON schema output instructions appended to every grading prompt.
 * This tells the AI exactly what JSON structure to produce.
 */
const JSON_SCHEMA_INSTRUCTIONS = `
## Ausgabeformat: Strukturiertes JSON

Du MUSST deine Antwort als **valides JSON-Objekt** ausgeben. Kein Markdown, kein Codeblock, nur reines JSON.

Das JSON-Objekt muss exakt folgendes Schema haben:

\`\`\`json
{
  "meta": {
    "titel": "Klausurkorrektur Spanisch",
    "untertitel": "<Titel der Klausur>",
    "datum": "<Datum der Klausur, z.B. Februar 2026>",
    "kurs": "<Kursbezeichnung, z.B. LK12>",
    "aufgabenart": "<z.B. Klausur>",
    "schueler": "<Name des Schülers>"
  },
  "aufgabenstellung": "<Zusammenfassung der Aufgabenstellung in 1-2 Sätzen>",
  "transcription": "<Vollständige Transkription des Schülertextes, Absätze durch \\\\n getrennt>",
  "inlineCorrection": [
    {
      "segments": [
        { "type": "text", "content": "<unveränderter Text>" },
        { "type": "error", "original": "<Originalwort>", "correction": "<Korrektur>", "category": "<Gr|Ort|Voc|Expr|Präp|Akz>" },
        { "type": "insertion", "word": "<fehlendes Wort>", "category": "<Kategorie>" },
        { "type": "deletion", "word": "<zu entfernendes Wort>", "category": "<Kategorie>" }
      ]
    }
  ],
  "fehlerUebersicht": [
    {
      "category": "<Gr|Ort|Voc|Expr|Präp|Akz>",
      "description": "<Beschreibung des Fehlertyps>",
      "count": <Anzahl>,
      "isRepetitionError": <true|false>
    }
  ],
  "fehlerBilanz": "<Zusammenfassende Bilanz der Fehler, 2-3 Sätze>",
  "scores": {
    "inhalt": {
      "np": <0-15>,
      "beschreibung": "<Zusammenfassung der Inhaltsleistung>",
      "rows": [
        { "kriterium": "<Bewertungskriterium>", "beobachtung": "<konkrete Beobachtung>", "np": "<Teilpunkte oder leer>" }
      ]
    },
    "sprache": {
      "kommunikativ": { "np": <0-5>, "text": "<Bewertungstext>" },
      "verfuegbarkeit": { "np": <0-5>, "text": "<Bewertungstext>" },
      "korrektheit": { "np": <0-5>, "text": "<Bewertungstext>" }
    },
    "notenbezeichnung": "<z.B. gut-, befriedigend+>"
  },
  "foerderhinweise": [
    {
      "prioritaet": <1-5>,
      "empfehlung": "<Förderempfehlung>",
      "beispiele": ["<Beispiel 1>", "<Beispiel 2>"]
    }
  ]
}
\`\`\`

### Wichtige Regeln für das JSON:
- Gib NUR das JSON-Objekt aus, keine zusätzlichen Erklärungen davor oder danach.
- Alle Strings müssen korrekt escaped sein (z.B. Anführungszeichen als \\").
- Die Fehlerkategorien müssen exakt sein: Gr, Ort, Voc, Expr, Präp, Akz.
- NP-Werte: Inhalt 0-15, Sprache je Dimension 0-5.
- inlineCorrection muss den GESAMTEN Schülertext abbilden, jeder Absatz als eigenes Objekt.
- Wiederholungsfehler (WF) in fehlerUebersicht mit "isRepetitionError": true markieren.
`

/**
 * Build the complete system prompt for a grading call.
 *
 * @param basePrompt    The base grading prompt (criteria, categories, scoring)
 * @param agentPrompt   Optional per-run agent instructions (appended after base)
 * @returns             The assembled system prompt
 */
export function buildSystemPrompt(
  basePrompt: string,
  agentPrompt?: string | null
): string {
  const parts: string[] = [basePrompt.trim()]

  if (agentPrompt) {
    parts.push('\n\n---\n\n## Zusätzliche Anweisungen\n\n' + agentPrompt.trim())
  }

  parts.push('\n\n---\n' + JSON_SCHEMA_INSTRUCTIONS.trim())

  return parts.join('')
}

/**
 * Build the user message for a grading call.
 * This is the text portion of the multimodal message.
 *
 * @param studentName  The student's name
 * @param kurs         The course identifier
 * @returns            The user message text
 */
export function buildUserMessage(studentName: string, kurs: string): string {
  return (
    `Korrigiere die folgende Klausur von ${studentName} (${kurs}). ` +
    `Die Aufgabenstellung ist in den ersten Bildern zu sehen, ` +
    `die Schülerarbeit in den folgenden Bildern. ` +
    `Gib deine Korrektur als JSON-Objekt aus.`
  )
}
