import { BrandCard } from '@/components/brand/brand-card'
import { Skeleton } from '@/components/ui/skeleton'

/** Esqueletos de las dos pantallas de charlas. Compartidos por los `loading.tsx`
 *  de /super y /admin, que de otro modo serían cuatro copias idénticas. */
export function CharlasListLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <BrandCard padding="sm" border="solid" className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-3">
            <Skeleton className="size-12 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </BrandCard>
    </div>
  )
}

export function CharlaDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col items-center gap-2 pt-6 text-center sm:pt-8">
        <Skeleton className="mb-4 h-4 w-16 self-start" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
