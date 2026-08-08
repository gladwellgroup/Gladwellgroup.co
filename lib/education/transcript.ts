/** Limpia la transcripción que exportan Zoom, Meet y Teams (.vtt / .srt) para
 *  dejar solo el texto hablado. Un .txt plano pasa prácticamente intacto. */

const TIMESTAMP_LINE = /^\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/
const CUE_NUMBER_LINE = /^\s*\d+\s*$/
const VTT_HEADER = /^\s*WEBVTT/i
const VTT_NOTE = /^\s*(NOTE|STYLE|REGION)\b/
/** <v Nombre>texto</v> — la etiqueta de hablante de WebVTT. */
const VOICE_TAG = /<\/?v[^>]*>/gi
const OTHER_TAGS = /<\/?(c|b|i|u|ruby|rt|lang)[^>]*>/gi

export function normalizeTranscript(raw: string): string {
  if (!raw.trim()) return ''

  const kept: string[] = []

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line) continue
    if (VTT_HEADER.test(line)) continue
    if (VTT_NOTE.test(line)) continue
    if (TIMESTAMP_LINE.test(line)) continue
    if (CUE_NUMBER_LINE.test(line)) continue

    const cleaned = line.replace(VOICE_TAG, '').replace(OTHER_TAGS, '').trim()
    if (!cleaned) continue

    // Los subtítulos repiten la misma frase en cues consecutivos cuando el
    // texto se muestra durante varios segundos.
    if (kept[kept.length - 1] === cleaned) continue

    kept.push(cleaned)
  }

  return kept.join('\n')
}

export const TRANSCRIPT_ACCEPT = '.txt,.vtt,.srt,text/plain,text/vtt'
