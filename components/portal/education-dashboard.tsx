'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { useAppRouter } from '@/hooks/use-app-router'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandField } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'
import {
  EDUCATION_STATUS_COLORS,
  EDUCATION_STATUS_LABELS,
} from '@/lib/education/status'
import { parseDateOnly } from '@/lib/date'

interface Session {
  id: string
  title: string
  session_date: string
  status: string
  created_at: string
  education_session_inputs?: { ponente_nombre: string | null } | null
}

interface Admin {
  id: string
  nombre: string
  correo: string
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        EDUCATION_STATUS_COLORS[status] ?? 'bg-muted'
      }`}
    >
      {EDUCATION_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function EducationDashboard({
  sessions,
  admins,
  currentUserId,
  canAssignAdmin,
  basePath,
  hubPath,
}: {
  sessions: Session[]
  admins: Admin[]
  currentUserId: string
  /** Solo el super admin delega la sesión a otro administrador. */
  canAssignAdmin: boolean
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
  const [adminId, setAdminId] = useState(currentUserId)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter((session) =>
      `${session.title} ${session.education_session_inputs?.ponente_nombre ?? ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [sessions, searchQuery])

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/education/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          session_date: sessionDate,
          admin_id: adminId,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la sesión')
        setCreating(false)
        return
      }

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
            Gladwell Education
          </h1>
          <p className="text-muted-foreground">
            Sesiones formativas y entregables para los asistentes.
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
            <BrandField
              id="title"
              label="Título de la sesión"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Cómo validar tu idea antes de construirla"
            />
            <BrandField
              id="sessionDate"
              label="Fecha de sesión"
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
            {canAssignAdmin && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="adminId" className="modal-label">
                  Administrador responsable
                </label>
                <select
                  id="adminId"
                  required
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  className="modal-field"
                >
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
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
            placeholder="Buscar por título o ponente..."
            className="modal-field w-full pl-9"
          />
        </div>
      )}

      {sessions.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            No hay sesiones de Gladwell Education aún.
          </p>
        </BrandCard>
      ) : filteredSessions.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">
            Ninguna sesión coincide con &quot;{searchQuery}&quot;.
          </p>
        </BrandCard>
      ) : (
        <BrandCard padding="sm" border="solid" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">
                  Sesión
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">
                  Ponente
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">
                  Fecha
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">
                  Estado Entregable
                </th>
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
                    {session.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {session.education_session_inputs?.ponente_nombre || '—'}
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
