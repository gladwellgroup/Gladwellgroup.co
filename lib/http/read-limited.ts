/** Lee el cuerpo de una respuesta SIN pasar de `maxBytes`: corta la descarga en cuanto se supera. `arrayBuffer()` baja
 *  todo antes de que nadie pueda mirar el tamaño (y `content-length` puede faltar o mentir), así que un archivo enorme
 *  llenaba la memoria de la función. */
export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`El cuerpo supera el límite de ${maxBytes} bytes`)
    this.name = 'BodyTooLargeError'
  }
}

export async function readLimited(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const reader = response.body?.getReader()
  // Sin cuerpo en flujo (respuesta vacía): no hay nada que acotar.
  if (!reader) return new ArrayBuffer(0)

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new BodyTooLargeError(maxBytes)
    }
    chunks.push(value)
  }

  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out.buffer
}
