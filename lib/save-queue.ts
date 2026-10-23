/** Cola de guardado de UN solo vuelo con «lo último gana», para los formularios de autoguardado.
 *
 *  - Si no hay un guardado en marcha, lo lanza.
 *  - Si ya hay uno, NO lanza otro en paralelo: marca que hay algo nuevo y devuelve la promesa del que está en vuelo, que
 *    al terminar repite una vez más con lo último.
 *
 *  Lo importante es la promesa que devuelve: espera de verdad hasta que lo último escrito quedó guardado. Antes, cada
 *  formulario tenía su copia de este código y `await saveNow()` volvía al instante si ya había un guardado en marcha:
 *  aprobar o crear el entregable podía correr con el texto anterior. */
export function createSaveQueue(saveOnce: () => Promise<void>): () => Promise<void> {
  let inFlight: Promise<void> | null = null
  let pending = false

  return function saveNow(): Promise<void> {
    if (inFlight) {
      pending = true
      return inFlight
    }
    inFlight = (async () => {
      try {
        do {
          pending = false
          await saveOnce()
        } while (pending)
      } finally {
        inFlight = null
      }
    })()
    return inFlight
  }
}
