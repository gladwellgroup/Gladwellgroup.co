import { BrandCard } from '@/components/brand/brand-card'
import { Skeleton } from '@/components/ui/skeleton'

/** El esqueleto genérico de una página del portal: título, subtítulo y tres tarjetas. Lo muestra `app/(portal)/loading.tsx`
 *  para toda página que no tenga uno propio (los de Encuentros sí lo tienen), así que al pulsar un enlace del menú se ve
 *  respuesta de inmediato —el menú ya está pintado— en vez de esperar con la página anterior quieta. */
export function PortalPageLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Cargando">
      <div className="flex flex-col items-center gap-2 text-center">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <BrandCard key={i} padding="sm" border="solid" className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </BrandCard>
        ))}
      </div>
    </div>
  )
}
