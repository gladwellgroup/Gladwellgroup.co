import { CHAT_TIMEOUT_MS, withTimeout } from '@/lib/ai/timeout'

/** Llamada a chat/completions con respuesta JSON forzada. Compartida por los
 *  dos programas de entregables (terapia y education), que solo difieren en el
 *  prompt y en la forma del JSON que esperan de vuelta. */
export async function chatJson<T>(params: {
  system: string
  user: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  // Con tope: sin él, un OpenAI que no contesta dejaba la síntesis colgada hasta que la función la mataba.
  const data = await withTimeout('La síntesis con IA', CHAT_TIMEOUT_MS, async (signal) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model ?? 'gpt-4o',
        temperature: params.temperature ?? 0.5,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        response_format: { type: 'json_object' },
        max_tokens: params.maxTokens ?? 2000,
      }),
      signal,
    })

    const body = await res.json()
    if (!res.ok) {
      throw new Error(body.error?.message ?? 'Error al sintetizar con IA')
    }
    return body
  })

  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as T
}

/** Normaliza a líneas un campo que el modelo debe devolver como array de
 *  strings. Cada línea se renderiza luego como una viñeta. Tolera que llegue
 *  como string suelto. */
export function toLines(value: string[] | string | undefined | null): string {
  const lines = Array.isArray(value)
    ? value.map((item) => String(item).trim())
    : String(value ?? '')
        .split(/\n+/)
        .map((line) => line.trim())

  return lines.filter(Boolean).join('\n')
}
