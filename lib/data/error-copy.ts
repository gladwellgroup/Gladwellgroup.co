/** Textos de las pantallas de error y de «no encontrado» (app/error.tsx, app/(portal)/error.tsx, app/not-found.tsx…). */
export const ERROR_COPY = {
  title: 'No pudimos cargar esta página',
  body: 'Puede ser un problema de conexión o que el servicio esté lento un momento. Lo que ya habías guardado no se perdió: intenta de nuevo.',
  retry: 'Reintentar',
  retrying: 'Reintentando...',
  home: 'Ir al inicio',
  reference: 'Referencia',
} as const

export const NOT_FOUND_COPY = {
  title: 'No encontramos esta página',
  body: 'El enlace puede estar mal escrito o el contenido ya no existe.',
  home: 'Ir al inicio',
} as const
