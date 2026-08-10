import Link from 'next/link'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'

export interface AttentionItem {
  /** Ruta a la sesión concreta, no a un listado: si algo exige acción, el
   *  clic tiene que dejarte donde se resuelve. */
  href: string
  titulo: string
  detalle: string
}

/** Lo que está roto y nadie ha visto. Devuelve null cuando no hay nada — un
 *  bloque de "0 errores" ocupando pantalla es ruido, no información. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <AlertCircle className="h-5 w-5 text-amber-500" />
        Requiere atención
      </h2>

      <BrandCard padding="sm" border="solid" className="divide-y divide-border">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.titulo}`}
            href={item.href}
            className="group flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.titulo}</p>
              <p className="text-xs text-amber-500">{item.detalle}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </BrandCard>
    </div>
  )
}
