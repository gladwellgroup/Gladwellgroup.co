import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import {
  CRITICAL_AFTER_DAYS,
  PIPELINE_BUCKETS,
  PIPELINE_LABELS,
  type PipelineBucket,
} from '@/lib/deliverables/pipeline'

export interface BucketCount {
  terapia: number
  education: number
  /** Días de la sesión más antigua sin entregar en esta casilla; null si
   *  ninguna pasó el umbral. Solo aplica a borrador y generado. */
  staleDays: number | null
}

export type PipelineCounts = Record<PipelineBucket, BucketCount>

/** Enlaces al listado de cada programa, ya filtrado por la casilla. */
interface PipelineLinks {
  terapia: string
  education: string
}

function Card({
  bucket,
  count,
  links,
}: {
  bucket: PipelineBucket
  count: BucketCount
  links: PipelineLinks
}) {
  const total = count.terapia + count.education

  return (
    <BrandCard
      padding="sm"
      className="flex aspect-square flex-col items-center justify-center gap-1.5 text-center sm:aspect-auto sm:min-h-[168px]"
    >
      <p className="text-4xl font-bold leading-none tabular-nums">{total}</p>
      <p className="text-sm text-muted-foreground">{PIPELINE_LABELS[bucket]}</p>

      {total > 0 && (
        <div className="flex flex-col items-center gap-0.5 text-xs">
          {count.terapia > 0 && (
            <Link
              href={`${links.terapia}?estado=${bucket}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {count.terapia} Terapia
            </Link>
          )}
          {count.education > 0 && (
            <Link
              href={`${links.education}?estado=${bucket}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {count.education} Education
            </Link>
          )}
        </div>
      )}

      {/* Solo aparece cuando algo se estancó: si todo está al día, la tarjeta
          queda limpia en vez de mostrar un "0 días" sin sentido. Ámbar y rojo
          no son el mismo aviso: 15 días es "revísalo pronto", 353 es
          abandono — el color tiene que decir la diferencia sin que haya que
          leer el número. */}
      {count.staleDays !== null && (
        <p
          className={`flex items-center gap-1 text-xs ${
            count.staleDays >= CRITICAL_AFTER_DAYS
              ? 'text-red-500'
              : 'text-amber-500'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {count.staleDays} días
        </p>
      )}
    </BrandCard>
  )
}

/** El ciclo de vida completo en una línea, de lo que viene a lo que se cerró.
 *  Reemplaza las cuatro tarjetas de recuento que no respondían nada. */
export function DeliverablesPipeline({
  counts,
  links,
}: {
  counts: PipelineCounts
  links: PipelineLinks
}) {
  return (
    // Cuadrícula 2×2 en móvil: cuatro cuadrados caben en una pantalla, cuatro
    // rectángulos apilados obligaban a desplazarse para ver el ciclo completo
    // — y el pipeline solo cuenta su historia si se ve de una sola mirada.
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {PIPELINE_BUCKETS.map((bucket) => (
        <Card
          key={bucket}
          bucket={bucket}
          count={counts[bucket]}
          links={links}
        />
      ))}
    </div>
  )
}
