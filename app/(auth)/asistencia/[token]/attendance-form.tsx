'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { BrandField } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'

const INSTAGRAM_URL = 'https://www.instagram.com/gladwellgroup.co/'

export function AttendanceForm({
  token,
  sessionTitle,
}: {
  token: string
  sessionTitle: string
}) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/attendance/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo registrar la asistencia')
        setSubmitting(false)
        return
      }

      setDone(true)
    } catch {
      setError('Error de red al registrar la asistencia')
      setSubmitting(false)
    }
  }

  // Pantalla final: un solo mensaje (no dos párrafos separados) + los dos
  // enlaces de salida. Nada del formulario ni del banner de "por qué
  // registrarte" — ese ya cumplió su propósito.
  if (done) {
    // El título de la sesión a veces ya termina en punto — no lo dupliquemos.
    const closesSentence = /[.!?]$/.test(sessionTitle.trim())

    return (
      <div className="text-center space-y-8 py-2">
        <h1 className="text-2xl font-bold gladwell-gradient-text">
          ¡Gracias por participar!
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
          Quedó registrada tu asistencia a {sessionTitle}
          {closesSentence ? '' : '.'} Ahora toca lo importante: aplica lo
          aprendido en tu estudio o proyecto en las próximas 48 horas.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <BrandButton asChild variant="secondary" size="sm" className="w-auto">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              Síguenos en Instagram
            </a>
          </BrandButton>
          <BrandButton asChild size="sm" className="w-auto">
            <Link href="/">Ir al home de Gladwell</Link>
          </BrandButton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Registro de asistencia
        </p>
        <h1 className="text-2xl font-bold gladwell-gradient-text">
          {sessionTitle}
        </h1>
        <p className="text-muted-foreground text-sm">
          Confirma tu presencia con tu nombre y correo.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#7C3AED]/20 bg-[#7C3AED]/5 px-4 py-3">
        <Info className="size-4 shrink-0 mt-0.5 text-[#A78BFA]" />
        <p className="text-xs text-muted-foreground text-left">
          Al registrar tu asistencia recibirás el entregable de esta sesión en
          tu correo y sumas puntos de asistencia en la comunidad Gladwell.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <BrandField
          id="nombre"
          label="Nombre completo"
          type="text"
          required
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <BrandField
          id="correo"
          label="Correo"
          type="email"
          required
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <BrandButton type="submit" disabled={submitting}>
          {submitting ? 'Registrando…' : 'Registrar asistencia'}
        </BrandButton>
      </form>
    </div>
  )
}
