'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { useIsClient } from '@/hooks/use-is-client'
import type { CharlaAttendee } from '@/lib/charlas/types'

/** «3 nov, 7:42 p. m.»: la hora importa, porque es lo que permite ver quién
 *  llegó durante la charla y quién se registró después. */
function formatRegistered(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** La hora la escribe el navegador, no el servidor: Node y Safari no formatean igual
 *  «2:42 p. m.» y la página se hidrataba con el error #418 (ver `useIsClient`). El
 *  ancho mínimo evita que la fila salte cuando el texto aparece. */
function RegisteredAt({ iso }: { iso: string }) {
  const isClient = useIsClient()

  return (
    <time
      dateTime={iso}
      className="min-w-[6.75rem] shrink-0 text-right text-xs tabular-nums text-muted-foreground"
    >
      {isClient ? formatRegistered(iso) : ''}
    </time>
  )
}

/** Lista de quienes registraron su asistencia con el QR. Es lo único que se
 *  puede editar de ella: el formulario público no tiene login, así que alguien
 *  tiene que poder quitar un correo mal escrito o un registro de relleno.
 *
 *  Una lista de filas y no una tabla: en un celular o un iPad vertical cuatro
 *  columnas obligaban a desplazarse de lado, y quien la mira durante la charla
 *  suele hacerlo desde ahí. */
export function CharlaAttendees({ attendees }: { attendees: CharlaAttendee[] }) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState<CharlaAttendee | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(attendee: CharlaAttendee) {
    setConfirmDelete(null)
    setError(null)

    try {
      const res = await fetch(`/api/charlas/attendees/${attendee.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo quitar al asistente')
        // Otra persona ya lo quitó (dos organizadores con la lista abierta): sin esto
        // la fila seguiría a la vista hasta que alguien pulse «Actualizar lista».
        if (res.status === 404) router.refresh()
        return
      }
      router.refresh()
    } catch {
      setError('Error de red al quitar al asistente')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {attendees.length === 1 ? '1 asistente' : `${attendees.length} asistentes`}
        </p>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground active:text-foreground disabled:opacity-50 pointer-coarse:min-h-11"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Actualizando…' : 'Actualizar lista'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {attendees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún nadie ha registrado su asistencia. Genera el código y compártelo
          durante la charla.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border px-3">
          {attendees.map((attendee) => (
            <li key={attendee.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attendee.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{attendee.correo}</p>
              </div>
              <RegisteredAt iso={attendee.created_at} />
              <button
                type="button"
                onClick={() => setConfirmDelete(attendee)}
                aria-label={`Quitar a ${attendee.nombre}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive pointer-coarse:size-11"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="¿Quitar a este asistente?"
        message={`${confirmDelete?.nombre ?? ''} dejará de aparecer en la lista de asistencia de esta charla.`}
        confirmLabel="Quitar"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
