'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { useAppRouter } from '@/hooks/use-app-router'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandField } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'
import { THERAPY_STATUS_COLORS, THERAPY_STATUS_LABELS } from '@/lib/therapy/status'
import { parseDateOnly } from '@/lib/date'

interface Session {
  id: string
  title: string
  session_date: string
  status: string
  created_at: string
  invitado: { nombre: string } | null
  therapy_session_cofounders?: { nombre: string; orden: number }[] | null
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        THERAPY_STATUS_COLORS[status] ?? 'bg-muted'
      }`}
    >
      {THERAPY_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function fundadoresNombres(session: Session): string {
  const firstNames = (session.therapy_session_cofounders ?? [])
    .map((f) => f.nombre?.trim().split(/\s+/)[0])
    .filter((n): n is string => Boolean(n))
  return firstNames.length > 0 ? firstNames.join(', ') : '—'
}

interface Moderator {
  id: string
  nombre: string
  correo: string
}

interface Invitado {
  id: string
  nombre: string
}

export function TherapyDashboard({
  sessions,
  moderators,
  invitados,
  currentUserId,
  basePath,
  hubPath,
}: {
  sessions: Session[]
  moderators: Moderator[]
  invitados: Invitado[]
  currentUserId: string
  basePath: string
  hubPath: string
}) {
  const router = useAppRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [moderatorId, setModeratorId] = useState(currentUserId)

  const [invitadoQuery, setInvitadoQuery] = useState('')
  const [selectedInvitado, setSelectedInvitado] = useState<Invitado | null>(null)
  const [invitadoFocused, setInvitadoFocused] = useState(false)
  const [creatingInvitado, setCreatingInvitado] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((session) =>
      (session.invitado?.nombre ?? session.title).toLowerCase().includes(q)
    )
  }, [sessions, searchQuery])

  const filteredInvitados = useMemo(() => {
    const q = invitadoQuery.trim().toLowerCase()
    if (!q) return invitados
    return invitados.filter((i) => i.nombre.toLowerCase().includes(q))
  }, [invitados, invitadoQuery])

  const exactMatch = invitados.some(
    (i) => i.nombre.toLowerCase() === invitadoQuery.trim().toLowerCase()
  )

  function selectInvitado(invitado: Invitado) {
    setSelectedInvitado(invitado)
    setInvitadoQuery(invitado.nombre)
    setInvitadoFocused(false)
  }

  async function handleCreateInvitado() {
    const nombre = invitadoQuery.trim()
    if (!nombre) return
    setCreatingInvitado(true)
    setError(null)

    try {
      const res = await fetch('/api/therapy/invitados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear el invitado')
        setCreatingInvitado(false)
        return
      }

      selectInvitado({ id: data.id, nombre: data.nombre })
    } catch {
      setError('Error de red al crear el invitado')
    }

    setCreatingInvitado(false)
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedInvitado) {
      setError('Selecciona o crea un invitado')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/therapy/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          session_date: sessionDate,
          moderator_id: moderatorId,
          invitado_id: selectedInvitado.id,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la sesión')
        setCreating(false)
        return
      }

      setShowCreate(false)
      router.push(`${basePath}/${data.id}`)
    } catch {
      setError('Error de red al crear la sesión')
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={hubPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Entregables
      </Link>
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
            Terapia Organizacional
          </h1>
          <p className="text-muted-foreground">
            Sesiones de terapia organizacional y entregables para invitados.
          </p>
        </div>
        <BrandButton
          size="sm"
          className="w-auto"
          onClick={() => setShowCreate(!showCreate)}
        >
          Nueva sesión
        </BrandButton>
      </div>

      {showCreate && (
        <BrandCard>
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div className="relative flex flex-col gap-1.5">
              <label htmlFor="invitado" className="modal-label">
                Invitado (empresa)
              </label>
              <input
                id="invitado"
                type="text"
                required
                autoComplete="off"
                value={invitadoQuery}
                onChange={(e) => {
                  setInvitadoQuery(e.target.value)
                  setSelectedInvitado(null)
                }}
                onFocus={() => setInvitadoFocused(true)}
                onBlur={() => setTimeout(() => setInvitadoFocused(false), 150)}
                placeholder="Buscar o crear un invitado..."
                className="modal-field"
              />
              {invitadoFocused && invitadoQuery.trim() && !selectedInvitado && (
                <div className="absolute top-full z-10 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                  {filteredInvitados.map((invitado) => (
                    <button
                      key={invitado.id}
                      type="button"
                      onClick={() => selectInvitado(invitado)}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                    >
                      {invitado.nombre}
                    </button>
                  ))}
                  {!exactMatch && (
                    <button
                      type="button"
                      onClick={handleCreateInvitado}
                      disabled={creatingInvitado}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-left text-[#A78BFA] hover:bg-muted transition-colors border-t border-border"
                    >
                      {creatingInvitado
                        ? 'Creando...'
                        : `Crear invitado: "${invitadoQuery.trim()}"`}
                    </button>
                  )}
                </div>
              )}
            </div>
            <BrandField
              id="title"
              label="Título de la sesión"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Sesión inicial"
            />
            <BrandField
              id="sessionDate"
              label="Fecha de sesión"
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="moderatorId" className="modal-label">
                Moderador de la sesión
              </label>
              <select
                id="moderatorId"
                required
                value={moderatorId}
                onChange={(e) => setModeratorId(e.target.value)}
                className="modal-field"
              >
                {moderators.map((moderator) => (
                  <option key={moderator.id} value={moderator.id}>
                    {moderator.nombre}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-500">{error}</p>
            )}
            <BrandButton type="submit" disabled={creating} className="w-auto">
              {creating ? 'Creando...' : 'Crear sesión'}
            </BrandButton>
          </form>
        </BrandCard>
      )}

      {sessions.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre de empresa..."
            className="modal-field w-full pl-9"
          />
        </div>
      )}

      {sessions.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            No hay entregables ni sesiones aún.
          </p>
        </BrandCard>
      ) : filteredSessions.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            Ninguna empresa coincide con &quot;{searchQuery}&quot;.
          </p>
        </BrandCard>
      ) : (
        <BrandCard padding="sm" border="solid" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Empresa</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Fundadores</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Fecha de sesión</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">Estado Entregable</th>
                <th className="w-8 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr
                  key={session.id}
                  onClick={() => router.push(`${basePath}/${session.id}`)}
                  className="border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    {session.invitado?.nombre ?? session.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {fundadoresNombres(session)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {parseDateOnly(session.session_date).toLocaleDateString('es-CO')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={session.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="inline h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </BrandCard>
      )}
    </div>
  )
}
