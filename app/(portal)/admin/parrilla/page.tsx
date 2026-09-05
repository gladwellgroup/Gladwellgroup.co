import { requirePermission } from '@/lib/auth/session'
import { getSupabaseServer } from '@/lib/supabase/server'
import { loadParrillaEditors, loadParrillaPosts } from '@/lib/parrilla/posts'
import { ParrillaBoard } from '@/components/portal/parrilla-board'

export default async function AdminParrillaPage() {
  await requirePermission('parrilla:manage')
  const supabase = getSupabaseServer()
  const [posts, editors] = await Promise.all([
    loadParrillaPosts(supabase),
    loadParrillaEditors(supabase),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Parrilla de contenido
        </h1>
        <p className="text-muted-foreground text-sm">
          Planifica y sigue las publicaciones de redes sociales de Gladwell.
        </p>
      </div>
      <ParrillaBoard posts={posts} editors={editors} />
    </div>
  )
}
