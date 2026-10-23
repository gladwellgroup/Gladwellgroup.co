/** El prefijo de la ruta pública de Storage de Supabase. */
const PUBLIC_STORAGE_PATH = '/storage/v1/object/public/'

/** ¿Es una URL pública de Storage de ESTE proyecto de Supabase?
 *
 *  Las URL de audio y de fotos de las sesiones las sube el propio portal a Storage. Pero el servidor las DESCARGA (el
 *  audio para transcribirlo, las fotos para medirlas y meterlas en el PDF), y los esquemas las aceptaban de cualquier
 *  host: quien llamara a la API podía hacer que el servidor pidiera una dirección interna o un archivo enorme. Se compara
 *  el origen (esquema + host + puerto) y la ruta; sin `NEXT_PUBLIC_SUPABASE_URL` no se acepta ninguna. */
export function isProjectStorageUrl(
  value: string | null | undefined,
  projectUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): boolean {
  if (!value || !projectUrl) return false
  try {
    const url = new URL(value)
    return url.origin === new URL(projectUrl).origin && url.pathname.startsWith(PUBLIC_STORAGE_PATH)
  } catch {
    return false
  }
}
