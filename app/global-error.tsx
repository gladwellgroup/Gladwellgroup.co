'use client'

import { ERROR_COPY } from '@/lib/data/error-copy'

/** El último recurso: reemplaza el layout raíz, así que trae su propio <html> y <body> y no puede apoyarse en los
 *  estilos ni en los proveedores de la app (por eso los estilos van en línea). Solo se ve si falla el propio layout
 *  raíz; el resto de los errores los recoge app/error.tsx. */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#0a0a14', color: '#f5f5f7', fontFamily: 'system-ui, sans-serif' }}>
        <main
          role="alert"
          style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 16, textAlign: 'center' }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>{ERROR_COPY.title}</h1>
            <p style={{ color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 20px' }}>{ERROR_COPY.body}</p>
            {/* Recargar y no `reset()`: si el layout raíz falló, repetir su render no arregla nada. */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                minHeight: 44,
                padding: '12px 24px',
                border: 'none',
                borderRadius: 9999,
                background: 'linear-gradient(90deg, #7C3AED, #06B6D4)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {ERROR_COPY.retry}
            </button>
            {error.digest && (
              <p style={{ color: '#a1a1aa', fontSize: 12, margin: '16px 0 0' }}>
                {ERROR_COPY.reference}: {error.digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  )
}
