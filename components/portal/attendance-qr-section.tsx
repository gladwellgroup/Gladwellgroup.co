'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { BrandButton } from '@/components/brand/brand-button'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'

export interface AttendanceLinkData {
  token: string
  expires_at: string
}

interface AttendanceQrSectionProps {
  sessionId: string
  program: 'therapy' | 'education'
  /** Controlado por el formulario padre, no por este componente: el
   *  acordeón que lo contiene desmonta su contenido al cerrarse, así que un
   *  useState local aquí perdería el link recién generado al reabrirlo. */
  link: AttendanceLinkData | null
  onLinkChange: (link: AttendanceLinkData) => void
  disabled?: boolean
}

/** El QR no se persiste — se regenera en el navegador a partir del token
 *  (que sí es estable) cada vez que se monta o cambia. Evita subir la imagen
 *  a Storage o exponer un endpoint aparte solo para servirla. */
export function AttendanceQrSection({
  sessionId,
  program,
  link,
  onLinkChange,
  disabled,
}: AttendanceQrSectionProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  useEffect(() => {
    if (!link) {
      setUrl(null)
      setQrDataUrl(null)
      return
    }

    const fullUrl = `${window.location.origin}/asistencia/${link.token}`
    setUrl(fullUrl)
    QRCode.toDataURL(fullUrl)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
    // Basta con el token: expires_at cambia en cada regeneración pero no
    // hace falta recalcular el QR por eso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.token])

  async function generate() {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/attendance-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, program }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo generar el enlace')
        setGenerating(false)
        return
      }

      onLinkChange({ token: data.token, expires_at: data.expires_at })
    } catch {
      setError('Error de red al generar el enlace')
    }

    setGenerating(false)
  }

  async function handleCopy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const expired = link ? new Date(link.expires_at) <= new Date() : false

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      {!link ? (
        !disabled && (
          <BrandButton
            type="button"
            size="sm"
            className="w-auto"
            disabled={generating}
            onClick={generate}
          >
            {generating ? 'Generando…' : 'Generar código de asistencia'}
          </BrandButton>
        )
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Código QR de asistencia"
                className="h-32 w-32 shrink-0 rounded-lg border border-border bg-white p-1.5"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="break-all text-sm text-foreground">{url}</p>
              <p className={`text-xs ${expired ? 'text-red-500' : 'text-muted-foreground'}`}>
                {expired ? 'Venció el ' : 'Vence el '}
                {new Date(link.expires_at).toLocaleString('es-CO', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <BrandButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-auto"
                  onClick={handleCopy}
                  disabled={!url}
                >
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </BrandButton>
                {qrDataUrl && (
                  <BrandButton asChild variant="secondary" size="sm" className="w-auto">
                    <a href={qrDataUrl} download={`asistencia-${link.token}.png`}>
                      Descargar QR
                    </a>
                  </BrandButton>
                )}
                {!disabled && (
                  <BrandButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-auto"
                    disabled={generating}
                    onClick={() => setConfirmRegenerate(true)}
                  >
                    {generating ? 'Regenerando…' : 'Regenerar código'}
                  </BrandButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRegenerate}
        title="¿Regenerar el código de asistencia?"
        message="El enlace y QR actuales dejarán de funcionar de inmediato. Quien lo tenga guardado ya no podrá registrarse con él."
        confirmLabel="Regenerar"
        onConfirm={() => {
          setConfirmRegenerate(false)
          generate()
        }}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  )
}
