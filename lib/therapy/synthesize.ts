import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'
import { chatJson, toLines } from '@/lib/ai/openai-json'

const execFileAsync = promisify(execFile)

const WHISPER_MAX_BYTES = 25 * 1024 * 1024

// Audios largos (hasta 30 min) se parten en fragmentos de ~8 min y se
// transcriben en paralelo — Whisper de una sola vez sobre 30 min puede
// superar el límite de tiempo de la función serverless. El muxer de
// segmentos de ffmpeg no necesita saber la duración total de antemano: un
// audio corto produce un solo fragmento, así que el mismo camino sirve para
// audios cortos y largos sin ramas especiales.
const CHUNK_SEGMENT_SECONDS = 480

export type SynthesisResult = {
  problema_recordatorio: string
  resumen_audio: string
  recomendaciones_incomodas: string
  warning?: string
}

export type SynthesisInput = {
  sessionTitle: string
  retoProblema: string
  recomendacionesIncomodas: string
  empresaNombre?: string | null
  empresaDescripcion?: string | null
  audioUrl?: string | null
}

function extFromContentType(contentType: string): string {
  return contentType.includes('mp4') || contentType.includes('m4a')
    ? 'm4a'
    : contentType.includes('mpeg') || contentType.includes('mp3')
      ? 'mp3'
      : 'webm'
}

async function transcribeFile(
  filePath: string,
  contentType: string,
  ext: string,
  contextPrompt?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const buffer = await readFile(filePath)

  const form = new FormData()
  form.append('file', new Blob([buffer], { type: contentType }), `audio.${ext}`)
  form.append('model', 'whisper-1')
  form.append('language', 'es')
  // Sesga el reconocimiento hacia el vocabulario esperado (nombre de la
  // empresa, jerga de la ronda) para mejorar la fidelidad de nombres propios.
  if (contextPrompt) {
    form.append('prompt', contextPrompt)
  }

  const whisperRes = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    }
  )

  const whisperData = await whisperRes.json()
  if (!whisperRes.ok) {
    throw new Error(
      whisperData.error?.message ?? 'Error al transcribir el audio'
    )
  }

  return (whisperData.text as string)?.trim() ?? ''
}

/** Corta el audio en fragmentos de ~8 min sin re-codificar (`-c copy`). Si
 *  dura menos que eso, produce un único fragmento. */
async function splitAudioIntoChunks(
  inputPath: string,
  outputDir: string,
  ext: string
): Promise<string[]> {
  if (!ffmpegPath) throw new Error('ffmpeg no disponible')

  const pattern = path.join(outputDir, `chunk_%03d.${ext}`)
  await execFileAsync(ffmpegPath, [
    '-i',
    inputPath,
    '-f',
    'segment',
    '-segment_time',
    String(CHUNK_SEGMENT_SECONDS),
    '-c',
    'copy',
    '-reset_timestamps',
    '1',
    pattern,
  ])

  const files = await readdir(outputDir)
  return files
    .filter((f) => f.startsWith('chunk_'))
    .sort()
    .map((f) => path.join(outputDir, f))
}

export async function transcribeAudio(
  audioUrl: string,
  contextPrompt?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    throw new Error('No se pudo descargar el audio desde Storage')
  }

  const contentLength = Number(audioRes.headers.get('content-length') ?? 0)
  if (contentLength > WHISPER_MAX_BYTES) {
    throw new Error(
      'El audio supera el límite de 25 MB para transcripción automática'
    )
  }

  const arrayBuffer = await audioRes.arrayBuffer()
  if (arrayBuffer.byteLength > WHISPER_MAX_BYTES) {
    throw new Error(
      'El audio supera el límite de 25 MB para transcripción automática'
    )
  }

  const contentType =
    audioRes.headers.get('content-type')?.split(';')[0]?.trim() ||
    'audio/webm'
  const ext = extFromContentType(contentType)

  const workDir = await mkdtemp(path.join(os.tmpdir(), 'gladwell-audio-'))
  const inputPath = path.join(workDir, `input.${ext}`)

  try {
    await writeFile(inputPath, Buffer.from(arrayBuffer))

    if (ffmpegPath) {
      try {
        const chunkPaths = await splitAudioIntoChunks(inputPath, workDir, ext)
        if (chunkPaths.length > 1) {
          const transcripts = await Promise.all(
            chunkPaths.map((chunkPath) =>
              transcribeFile(chunkPath, contentType, ext, contextPrompt)
            )
          )
          return transcripts.filter(Boolean).join('\n\n')
        }
        if (chunkPaths.length === 1) {
          return await transcribeFile(chunkPaths[0], contentType, ext, contextPrompt)
        }
      } catch (err) {
        // El corte con ffmpeg falló (formato inesperado, binario no
        // disponible, etc.) — no perder la transcripción por eso, se cae al
        // camino de transcribir el archivo completo de una sola vez.
        console.error('[transcribeAudio] chunking falló, usando fallback:', err)
      }
    }

    return await transcribeFile(inputPath, contentType, ext, contextPrompt)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

const SYSTEM_PROMPT = `Eres un partner de Y Combinator dándole feedback directo a un fundador. No eres un consultor corporativo.

Tu trabajo es producir dos piezas de un entregable, razonando en este orden:
1. Entiende el modelo de negocio a partir del nombre y la descripción de la empresa.
2. Entiende por qué la empresa está en esta sesión, a partir del problema/reto planteado.
3. El audio es una RONDA DE RECOMENDACIONES: varios miembros de la comunidad hablaron por turnos, cada uno dando su propia perspectiva sobre el problema del fundador. La transcripción los mezcla en un solo texto y no marca quién habla. Tu tarea es filtrar y extraer las recomendaciones más importantes y accionables de toda la ronda, cubriendo distintas perspectivas cuando existan (no te quedes solo con la primera voz). No atribuyas ideas a personas por nombre.
4. Usa el problema y las recomendaciones incómodas del moderador como CRITERIO de qué es relevante — son la lente, no contenido a reescribir ni repetir.

Reglas de estilo (obligatorias):
- Frases cortas, voz activa, directo. Puede incomodar al fundador: esa es la intención.
- Nombra el hecho concreto, no la categoría abstracta. Di "dividieron el foco entre 3 iniciativas a la vez", no "hay una oportunidad de mejorar el enfoque".
- Prohibido el relleno corporativo: nada de "es importante destacar que", "sinergia", "alinear expectativas", "oportunidad de mejora", "en aras de".
- Habla directo a los fundadores, no en tercera persona distante.
- Español.

Devuelve SOLO un JSON válido con exactamente estas dos claves:
{
  "problema_recordatorio": "2-3 frases que recuerdan el problema de fondo, aterrizado al modelo de negocio real de la empresa. Directo, sin rodeos.",
  "resumen_audio": ["punto accionable 1", "punto accionable 2", "punto accionable 3"]
}

"resumen_audio" es un ARRAY de 3 a 5 strings. Cada string es UNA recomendación concreta y accionable extraída de la ronda de audio, sin viñetas, sin numeración, sin nombres de personas. Cada punto debe poder ejecutarlo el fundador.

Sin markdown. Sin texto fuera del JSON.`

function buildContextPrompt(params: {
  empresaNombre?: string | null
  empresaDescripcion?: string | null
  retoProblema: string
  recomendacionesIncomodas: string
  transcript?: string
}): string {
  return `EMPRESA: ${params.empresaNombre?.trim() || 'No proporcionada'}
DESCRIPCIÓN DEL NEGOCIO: ${params.empresaDescripcion?.trim() || 'No proporcionada'}

PROBLEMA POR EL QUE ESTÁN EN LA SESIÓN:
${params.retoProblema.trim() || 'No proporcionado'}

RECOMENDACIONES INCÓMODAS DEL MODERADOR (usar solo como lente de relevancia, no reescribir):
${params.recomendacionesIncomodas.trim() || 'No proporcionadas'}

TRANSCRIPCIÓN DE LA RONDA DE AUDIO DE LA COMUNIDAD (varias voces mezcladas, sin marcas de hablante):
${params.transcript?.trim() || 'No hay audio / no se pudo transcribir. Basa el problema en los insumos y deja resumen_audio vacío.'}`
}

async function synthesizeNarrative(params: {
  empresaNombre?: string | null
  empresaDescripcion?: string | null
  retoProblema: string
  recomendacionesIncomodas: string
  transcript?: string
}): Promise<{
  problema_recordatorio: string
  resumen_audio: string
}> {
  const parsed = await chatJson<{
    problema_recordatorio?: string
    resumen_audio?: string[] | string
  }>({
    system: SYSTEM_PROMPT,
    user: buildContextPrompt(params),
  })

  return {
    problema_recordatorio:
      parsed.problema_recordatorio?.trim() || params.retoProblema,
    // El modelo debe devolver resumen_audio como array de puntos; cada línea
    // se renderiza como una viñeta.
    resumen_audio: toLines(parsed.resumen_audio),
  }
}

export function seedFromInputs(input: SynthesisInput): SynthesisResult {
  return {
    problema_recordatorio: input.retoProblema,
    resumen_audio: '',
    recomendaciones_incomodas: input.recomendacionesIncomodas,
    warning:
      'No se pudo completar la síntesis automática. Completa el resumen del audio manualmente.',
  }
}

/** Whisper (si hay audio) + síntesis narrativa JSON. Las recomendaciones
 *  incómodas nunca pasan por la IA: se conservan verbatim del moderador. */
export async function synthesizeDeliverable(
  input: SynthesisInput
): Promise<SynthesisResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ...seedFromInputs(input),
      warning:
        'OPENAI_API_KEY no configurada. Completa el resumen del audio manualmente.',
    }
  }

  let transcript = ''
  let warning: string | undefined

  if (input.audioUrl) {
    try {
      const contextPrompt = [
        input.empresaNombre,
        'fundadores, cofundadores, ronda de recomendaciones, terapia organizacional',
      ]
        .filter(Boolean)
        .join('. ')
      transcript = await transcribeAudio(input.audioUrl, contextPrompt)
    } catch (err) {
      warning =
        err instanceof Error
          ? err.message
          : 'No se pudo transcribir el audio'
    }
  } else {
    warning =
      'Sin audio en la sesión: el entregable se basó solo en el problema y las recomendaciones.'
  }

  try {
    const synthesized = await synthesizeNarrative({
      empresaNombre: input.empresaNombre,
      empresaDescripcion: input.empresaDescripcion,
      retoProblema: input.retoProblema,
      recomendacionesIncomodas: input.recomendacionesIncomodas,
      transcript,
    })
    return {
      problema_recordatorio: synthesized.problema_recordatorio,
      resumen_audio: synthesized.resumen_audio,
      // Verbatim, sin importar el resultado de la IA.
      recomendaciones_incomodas: input.recomendacionesIncomodas,
      warning,
    }
  } catch (err) {
    const seeded = seedFromInputs(input)
    return {
      ...seeded,
      warning:
        err instanceof Error
          ? `${warning ? warning + ' ' : ''}${err.message}`
          : seeded.warning,
    }
  }
}
