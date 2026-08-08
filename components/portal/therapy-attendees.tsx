'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Upload, X } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { parseAttendeesCsv, type ParsedAttendees } from '@/lib/deliverables/csv'
import {
  ATTENDEE_STATUS_COLORS,
  ATTENDEE_STATUS_LABELS,
} from '@/lib/deliverables/status'

export interface TherapyAttendeeData {
  id: string
  nombre: string
  correo: string
  email_status: string
  email_error: string | null
  source: string
  created_at: string
}

interface TherapyAttendeesProps {
  sessionId: string
  attendees: TherapyAttendeeData[]
  /** El botón de reenvío solo tiene sentido una vez el entregable ya se
   *  envió — antes de eso el envío a estos asistentes ocurre junto con el
   *  correo grupal a cofundadores, con el botón "Dar visto bueno". */
  deliverySent: boolean
  disabled?: boolean
}

export function TherapyAttendees({
  sessionId,
  attendees,
  deliverySent,
  disabled,
}: TherapyAttendeesProps) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedAttendees | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<TherapyAttendeeData | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pending = attendees.filter((a) => a.email_status !== 'enviado')

  async function handleFile(file: File) {
    setError(null)
    setNotice(null)
    try {
      setPreview(parseAttendeesCsv(await file.text()))
    } catch {
      setError('No se pudo leer el archivo')
    }
  }

  async function handleImport() {
    if (!preview || preview.rows.length === 0) return
    setImporting(true)
    setError(null)

    try {
      const res = await fetch('/api/therapy/attendees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, attendees: preview.rows }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudieron importar los asistentes')
        setImporting(false)
        return
      }

      setNotice(
        `${data.imported} asistente(s) importado(s)` +
          (data.skipped > 0 ? `, ${data.skipped} ya estaban en la lista` : '')
      )
      setPreview(null)
      router.refresh()
    } catch {
      setError('Error de red al importar')
    }

    setImporting(false)
  }

  async function handleDelete(attendee: TherapyAttendeeData) {
    setConfirmDelete(null)
    setError(null)

    try {
      const res = await fetch(`/api/therapy/attendees/${attendee.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo eliminar el asistente')
        return
      }
      router.refresh()
    } catch {
      setError('Error de red al eliminar')
    }
  }

  async function handleResend() {
    setResending(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch('/api/therapy/deliverables/resend-attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo reenviar')
        setResending(false)
        return
      }

      setNotice(
        `${data.sent} correo(s) reenviado(s)` +
          (data.failed > 0 ? `, ${data.failed} con error` : '')
      )
      router.refresh()
    } catch {
      setError('Error de red al reenviar')
    }

    setResending(false)
  }

  return (
    <div className="space-y-4">
      {!disabled && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <Upload className="h-7 w-7" />
            <div className="text-center">
              <p className="text-sm font-medium">Importar lista de registrados (CSV)</p>
              <p className="mt-1 text-xs">
                Úsalo si no alcanzaste a tomar la asistencia con el QR en vivo.
              </p>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </>
      )}

      {preview && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm font-medium">
            {preview.rows.length} asistente(s) listos para importar
          </p>

          {preview.rows.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {preview.rows.slice(0, 20).map((row) => (
                <li key={row.correo}>
                  {row.nombre} — {row.correo}
                </li>
              ))}
              {preview.rows.length > 20 && (
                <li>y {preview.rows.length - 20} más…</li>
              )}
            </ul>
          )}

          {preview.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-500">
                {preview.errors.length} fila(s) descartada(s)
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {preview.errors.map((rowError, i) => (
                  <li key={i}>
                    {rowError.line > 0 ? `Línea ${rowError.line}: ` : ''}
                    {rowError.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <BrandButton
              type="button"
              size="sm"
              className="w-auto"
              disabled={importing || preview.rows.length === 0}
              onClick={handleImport}
            >
              {importing ? 'Importando…' : 'Confirmar importación'}
            </BrandButton>
            <BrandButton
              type="button"
              variant="secondary"
              size="sm"
              className="w-auto"
              onClick={() => setPreview(null)}
            >
              Cancelar
            </BrandButton>
          </div>
        </div>
      )}

      {notice && <p className="text-sm text-green-500">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Actualizando…' : 'Actualizar lista'}
        </button>
      </div>

      {attendees.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay registros de asistencia en esta sesión.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  Nombre
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  Correo
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  Hora
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  Envío
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  Origen
                </th>
                {!disabled && <th className="w-10 px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <tr key={attendee.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{attendee.nombre}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {attendee.correo}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {new Date(attendee.created_at).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      title={attendee.email_error ?? undefined}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        ATTENDEE_STATUS_COLORS[attendee.email_status] ?? 'bg-muted'
                      }`}
                    >
                      {ATTENDEE_STATUS_LABELS[attendee.email_status] ??
                        attendee.email_status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        attendee.source === 'qr'
                          ? 'bg-[#7C3AED]/15 text-[#A78BFA]'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {attendee.source === 'qr' ? 'QR' : 'CSV'}
                    </span>
                  </td>
                  {!disabled && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(attendee)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Eliminar a ${attendee.nombre}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deliverySent && pending.length > 0 && (
        <BrandButton
          type="button"
          variant="secondary"
          size="sm"
          className="w-auto"
          disabled={resending}
          onClick={handleResend}
        >
          {resending ? 'Reenviando…' : `Reenviar pendientes (${pending.length})`}
        </BrandButton>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="¿Quitar a este asistente?"
        message={`${confirmDelete?.nombre ?? ''} dejará de recibir el entregable de esta sesión.`}
        confirmLabel="Quitar"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
