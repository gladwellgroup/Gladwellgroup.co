import { chatJson, toLines } from '@/lib/ai/openai-json'
import { transcribeAudio } from '@/lib/therapy/synthesize'

export type EducationSynthesisInput = {
  sessionTitle: string
  objetivo: string
  notasModerador: string
  ponenteNombre?: string | null
  ponenteRol?: string | null
  /** Transcripción ya pegada o subida como archivo. Tiene precedencia. */
  transcripcionTexto?: string | null
  /** Solo se transcribe si no hay texto. */
  audioUrl?: string | null
  /** Si el admin ya las escribió, se respetan verbatim y la IA no las toca. */
  capsulas: string
}

export type EducationSynthesisResult = {
  conclusiones_clave: string
  capsulas: string
  warning?: string
}

const SYSTEM_PROMPT = `Eres el relator de una sesión formativa de Gladwell Education. Escribes para los asistentes, que quieren llevarse algo aplicable el lunes por la mañana.

Tu insumo es la transcripción de la videollamada, más el objetivo declarado de la sesión y las notas del moderador. Razona en este orden:
1. Lee el OBJETIVO: es la vara con la que se mide todo lo demás. Lo que no sirva al objetivo, se descarta por interesante que suene.
2. Usa las NOTAS DEL MODERADOR como lente de relevancia — señalan qué importó de verdad. No las reescribas ni las repitas literalmente.
3. Recorre la TRANSCRIPCIÓN y extrae lo que efectivamente mueve al asistente hacia el objetivo.

Reglas de estilo (obligatorias):
- Frases cortas, voz activa, concretas.
- Nombra el hecho, no la categoría abstracta. Di "cobrar antes de construir el producto", no "explorar estrategias de monetización".
- Prohibido el relleno corporativo: nada de "es importante destacar", "sinergia", "alinear expectativas", "oportunidad de mejora".
- Habla a los asistentes en segunda persona.
- No atribuyas ideas a personas por nombre.
- Español.

Devuelve SOLO un JSON válido. Sin markdown, sin texto fuera del JSON.`

function buildUserPrompt(
  input: EducationSynthesisInput,
  transcript: string,
  pedirCapsulas: boolean
): string {
  const claves = ['"conclusiones_clave": array de 3 a 5 strings. Cada uno es una conclusión de la sesión, medida contra el objetivo. Sin viñetas ni numeración.']

  if (pedirCapsulas) {
    claves.push(
      '"capsulas": array de 2 a 4 strings. Cápsulas de emprendimiento: ideas breves y memorables, cada una accionable por sí sola.'
    )
  }

  return `SESIÓN: ${input.sessionTitle}
PONENTE: ${[input.ponenteNombre, input.ponenteRol].filter(Boolean).join(' — ') || 'No proporcionado'}

OBJETIVO A LOGRAR EN LOS ASISTENTES:
${input.objetivo.trim() || 'No proporcionado'}

NOTAS DEL MODERADOR (lente de relevancia, no reescribir):
${input.notasModerador.trim() || 'No proporcionadas'}

TRANSCRIPCIÓN DE LA VIDEOLLAMADA:
${transcript.trim() || 'No hay transcripción. Basa las conclusiones en el objetivo y las notas del moderador.'}

Devuelve un JSON con exactamente estas claves:
{
  ${claves.join(',\n  ')}
}`
}

/** Siembra el resultado desde lo capturado a mano, sin IA. */
export function seedFromInputs(
  input: EducationSynthesisInput
): EducationSynthesisResult {
  return {
    conclusiones_clave: '',
    capsulas: input.capsulas,
    warning:
      'No se pudo completar la síntesis automática. Escribe las conclusiones manualmente.',
  }
}

export async function synthesizeEducation(
  input: EducationSynthesisInput
): Promise<EducationSynthesisResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ...seedFromInputs(input),
      warning:
        'OPENAI_API_KEY no configurada. Escribe las conclusiones manualmente.',
    }
  }

  let transcript = input.transcripcionTexto?.trim() ?? ''
  let warning: string | undefined

  // El texto pegado o subido gana: si ya lo hay, no se gasta Whisper.
  if (!transcript && input.audioUrl) {
    try {
      const contextPrompt = [
        input.ponenteNombre,
        input.sessionTitle,
        'sesión formativa, emprendimiento, herramientas',
      ]
        .filter(Boolean)
        .join('. ')
      transcript = await transcribeAudio(input.audioUrl, contextPrompt)
    } catch (err) {
      warning =
        err instanceof Error ? err.message : 'No se pudo transcribir el audio'
    }
  } else if (!transcript) {
    warning =
      'Sin transcripción ni audio: el entregable se basó solo en el objetivo y las notas del moderador.'
  }

  const capsulasManual = input.capsulas.trim()

  try {
    const parsed = await chatJson<{
      conclusiones_clave?: string[] | string
      capsulas?: string[] | string
    }>({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input, transcript, !capsulasManual),
    })

    return {
      conclusiones_clave: toLines(parsed.conclusiones_clave),
      // Lo que escribió el admin manda; la IA solo rellena huecos.
      capsulas: capsulasManual || toLines(parsed.capsulas),
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
