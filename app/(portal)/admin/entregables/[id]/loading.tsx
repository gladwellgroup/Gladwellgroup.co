import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col items-center text-center gap-2 pt-6 sm:pt-8">
        <Skeleton className="mb-4 h-4 w-16 self-start" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
