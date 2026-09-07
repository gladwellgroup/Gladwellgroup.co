import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import {
  PARRILLA_FORMAT_LABELS,
  PARRILLA_STATUS_COLORS,
  PARRILLA_STATUS_LABELS,
  type ParrillaPost,
} from '@/lib/parrilla/posts'

/** Piezas donde este community_admin es Filmmaker o Editor y siguen sin
 *  terminar — su cola de trabajo puntual en la parrilla, no la parrilla
 *  completa. Null cuando no tiene nada pendiente. */
export function ParrillaCard({
  posts,
  href,
}: {
  posts: ParrillaPost[]
  href: string
}) {
  if (posts.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold gladwell-gradient-text">
        <Calendar className="h-5 w-5" />
        Parrilla — pendiente para ti
      </h2>
      <BrandCard padding="sm" border="solid" className="divide-y divide-border">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={href}
            className="flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{post.title}</p>
              <p className="text-xs text-muted-foreground">
                {post.format ? PARRILLA_FORMAT_LABELS[post.format] : '—'}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PARRILLA_STATUS_COLORS[post.status]}`}
            >
              {PARRILLA_STATUS_LABELS[post.status]}
            </span>
          </Link>
        ))}
      </BrandCard>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Ver parrilla completa
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
