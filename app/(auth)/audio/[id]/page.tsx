import type { Metadata } from 'next'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase/server'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { parseDateOnly } from '@/lib/date'

/** El enlace vive dentro del entregable que reciben cofundadores y
 *  asistentes; no debe aparecer en buscadores. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

function AudioMessage({ title, message }: { title: string; message: string }) {
  return (
    <BrandCard className="max-w-md w-full text-center space-y-4">
      <h1 className="text-2xl font-bold gladwell-gradient-text">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
      <BrandButton asChild>
        <Link href="/">Ir al home de Gladwell</Link>
      </BrandButton>
    </BrandCard>
  )
}

export default async function SessionAudioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = getSupabaseServer()

  const { data } = await supabase
    .from('therapy_sessions')
    .select(
      `
      title, session_date,
      therapy_session_inputs ( foto_sesion_url ),
      therapy_session_audios ( audio_url, created_at )
    `
    )
    .eq('id', id)
    .order('created_at', { referencedTable: 'therapy_session_audios' })
    .maybeSingle()

  if (!data) {
    return (
      <AudioMessage
        title="Audio no disponible"
        message="Este enlace no corresponde a ninguna sesión. Pide el entregable actualizado a tu contacto en Gladwell."
      />
    )
  }

  // supabase-js tipa las relaciones embebidas como arrays; inputs es
  // objeto|null en runtime (session_id UNIQUE) y audios sí es lista.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = data
  const fotoUrl: string | null = row.therapy_session_inputs?.foto_sesion_url ?? null
  const audioUrl: string | null = row.therapy_session_audios?.[0]?.audio_url ?? null

  if (!audioUrl) {
    return (
      <AudioMessage
        title="Audio no disponible"
        message="Esta sesión todavía no tiene un audio publicado."
      />
    )
  }

  return (
    <BrandCard className="max-w-lg w-full space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Audio de la comunidad
        </p>
        <h1 className="text-balance text-2xl font-bold gladwell-gradient-text">
          {row.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {parseDateOnly(row.session_date).toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {fotoUrl && (
        <div className="overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoUrl}
            alt={`Integrantes de la sesión ${row.title}`}
            className="block aspect-[4/3] w-full object-cover"
          />
        </div>
      )}

      {/* Reproductor nativo: no necesita JS y hereda los controles del
          sistema, que en móvil son los que la gente ya sabe usar. */}
      <audio controls preload="metadata" src={audioUrl} className="w-full">
        Tu navegador no puede reproducir este audio.{' '}
        <a href={audioUrl}>Descárgalo aquí</a>.
      </audio>

      <p className="text-center text-xs text-muted-foreground">
        Gladwell — Terapia Organizacional
      </p>
    </BrandCard>
  )
}
