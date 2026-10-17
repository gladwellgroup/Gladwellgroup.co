// Una sesión archivada solo se archiva desde Supabase: salió del ciclo de vida
// (el dashboard ni la cuenta ni la marca como estancada) y el portal no ofrece
// ningún control para archivarla ni para desarchivarla.
//
// Por eso no puede hacer lo que tiene efectos fuera de la pantalla: mandar el
// correo a los asistentes, regenerar el entregable con IA o reescribir el que
// ya existe. Sin este bloqueo, `approve` mandaba el correo y su cambio de estado
// no escribía nada (la sesión sigue archivada), así que el botón se podía
// repetir y el guard de «ya fue enviado» —que solo mira `entregado`— nunca
// frenaba un segundo envío.
//
// Ver y editar el texto sigue permitido: no manda nada ni cuesta IA.

export const ARCHIVED_SESSION_ERROR =
  'Esta sesión está archivada: no se puede enviar ni regenerar su entregable.'

/** El mensaje de error si la sesión está archivada, o null si puede seguir. Pura:
 *  la usan todas las rutas de Terapia y Education que envían correo, generan con
 *  IA o reescriben el entregable (una prueba comprueba que ninguna se olvide). */
export function archivedSessionError(status: string | null | undefined): string | null {
  return status === 'archivado' ? ARCHIVED_SESSION_ERROR : null
}
