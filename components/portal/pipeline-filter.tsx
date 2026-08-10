'use client'

import {
  PIPELINE_BUCKETS,
  PIPELINE_LABELS,
  bucketSession,
  type PipelineBucket,
  type PipelineSession,
} from '@/lib/deliverables/pipeline'

export type BucketFilter = PipelineBucket | 'todas'

/** Orden fijo 2×2 solo en mobile: Entregado y Borrador arriba, Sesión
 *  programada y Todas abajo. En tablet/desktop no aplica — ahí se mantiene el
 *  orden natural (Todas, luego el ciclo de vida) sin ninguna de estas clases. */
const MOBILE_ORDER: Record<BucketFilter, string> = {
  entregado: 'order-1',
  borrador: 'order-2',
  programada: 'order-3',
  todas: 'order-4',
  generado: 'order-5',
}

/** Chips de estado sobre el listado. Usa `bucketSession`, el mismo helper del
 *  dashboard: así "Sesión programada" —que se deriva de la fecha y no existe
 *  como valor de `status`— significa lo mismo en las dos pantallas.
 *
 *  Solo aparecen las casillas con sesiones: un chip en cero no lleva a
 *  ninguna parte. */
export function PipelineFilter({
  sessions,
  value,
  onChange,
}: {
  sessions: PipelineSession[]
  value: BucketFilter
  onChange: (value: BucketFilter) => void
}) {
  const counts = new Map<PipelineBucket, number>()
  for (const session of sessions) {
    const bucket = bucketSession(session)
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }

  const visibles = PIPELINE_BUCKETS.filter((b) => (counts.get(b) ?? 0) > 0)
  // Con una sola casilla ocupada, filtrar no separa nada.
  if (visibles.length < 2) return null

  const opciones: { key: BucketFilter; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: sessions.length },
    ...visibles.map((b) => ({
      key: b as BucketFilter,
      label: PIPELINE_LABELS[b],
      count: counts.get(b) ?? 0,
    })),
  ]

  return (
    // Mobile: grid fijo 2×2 en el orden de MOBILE_ORDER. Desde `sm:` en
    // adelante, sin tocar nada: vuelve al flex-wrap centrado de siempre, en
    // el orden natural de `opciones`.
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
      {opciones.map((opcion) => {
        const activo = opcion.key === value
        return (
          <button
            key={opcion.key}
            type="button"
            onClick={() => onChange(opcion.key)}
            aria-pressed={activo}
            className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:order-none ${MOBILE_ORDER[opcion.key]} ${
              activo
                ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {opcion.label}
            <span className="tabular-nums opacity-70">{opcion.count}</span>
          </button>
        )
      })}
    </div>
  )
}
