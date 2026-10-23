// Los topes de las llamadas externas de la síntesis del entregable. Suman menos que el `maxDuration` de las rutas que
// las usan (300 s): si un servicio no contesta, la síntesis cae al camino de respaldo con un aviso en vez de colgarse
// hasta que la función la mata y deja el entregable en «procesando» para siempre.
export const AUDIO_DOWNLOAD_TIMEOUT_MS = 45_000
export const FFMPEG_TIMEOUT_MS = 60_000
export const WHISPER_TIMEOUT_MS = 120_000
export const CHAT_TIMEOUT_MS = 60_000

/** Una llamada externa que no contestó a tiempo. Se distingue de otros fallos porque repetirla (como hace la
 *  transcripción, que ante un fallo prueba con el archivo completo) solo gastaría el tiempo que ya no queda. */
export class ExternalTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExternalTimeoutError'
  }
}

/** Corre `run` con una señal que se aborta a los `ms`. El tope cubre también la lectura del cuerpo (por eso la lectura
 *  va dentro de `run`). Si vence, el error es un texto en español —el aviso que verá la persona en el entregable—
 *  y no el «The operation was aborted due to timeout» de Node. */
export async function withTimeout<T>(what: string, ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  try {
    return await run(AbortSignal.timeout(ms))
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ExternalTimeoutError(`${what} tardó más de ${Math.round(ms / 1000)} s.`)
    }
    throw error
  }
}
