import {
  PIPELINE_COLORS,
  PIPELINE_LABELS,
  bucketSession,
  type PipelineSession,
} from '@/lib/deliverables/pipeline'

/** El estado de una sesión, con el mismo criterio en toda la plataforma.
 *
 *  Clasifica con `bucketSession` en vez de leer `status` directo: una sesión
 *  con fecha futura dice "Sesión programada" igual que en el dashboard y en
 *  los chips de filtro. Leer la columna a secas la mostraría como "Borrador"
 *  y las tres pantallas se contradirían. */
export function PipelineBadge({ session }: { session: PipelineSession }) {
  const bucket = bucketSession(session)

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${PIPELINE_COLORS[bucket]}`}
    >
      {PIPELINE_LABELS[bucket]}
    </span>
  )
}
