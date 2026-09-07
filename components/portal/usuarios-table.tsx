'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, KeyRound, Mail, Pencil, UserPlus } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandField } from '@/components/brand/brand-field'
import { PasswordGeneratorField } from '@/components/portal/password-generator-field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ROLE_LABELS, type Role } from '@/lib/permissions'
import { MODULE_LABELS, type ModuleKey } from '@/lib/permissions/modules'

export interface UsuarioRow {
  id: string
  nombre: string
  correo: string
  role: Role
  cargo: string | null
  granted_modules: ModuleKey[]
  created_at: string
}

interface UsuariosTableProps {
  users: UsuarioRow[]
  canManage: boolean
}

const MODULE_KEYS = Object.keys(MODULE_LABELS) as ModuleKey[]

/** Rol elegible para el alta directa desde este formulario — super_admin no
 *  se crea desde acá. */
type CreatableRole = Extract<Role, 'community_admin' | 'community_member'>

export function ModuleChips({
  modules,
  align = 'start',
}: {
  modules: ModuleKey[]
  /** 'start' (default) para donde conviven con columnas/contenido alineado
   *  a la izquierda (la tabla y la tarjeta mobile de /super/usuarios).
   *  'center' solo donde toda la tarjeta ya está centrada (Mi perfil) —
   *  centrar acá y dejar el resto a la izquierda desalinea el encabezado
   *  de la columna con su propio contenido. */
  align?: 'start' | 'center'
}) {
  if (modules.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin módulos</span>
  }
  return (
    <div className={`flex flex-wrap gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
      {modules.map((key) => (
        <span
          key={key}
          className="inline-flex items-center rounded-full bg-gradient-to-r from-[#7C3AED]/15 to-[#06B6D4]/15 px-2 py-0.5 text-[11px] font-medium text-foreground"
        >
          {MODULE_LABELS[key]}
        </span>
      ))}
    </div>
  )
}

function ModuleCheckboxList({
  selected,
  onToggle,
}: {
  selected: ModuleKey[]
  onToggle: (key: ModuleKey) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
      {MODULE_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(key)}
            onChange={() => onToggle(key)}
            className="size-4 rounded border-border accent-[#7C3AED]"
          />
          {MODULE_LABELS[key]}
        </label>
      ))}
    </div>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [role, setRole] = useState<CreatableRole>('community_admin')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [cargo, setCargo] = useState('')
  const [grantedModules, setGrantedModules] = useState<ModuleKey[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRole('community_admin')
    setNombre('')
    setCorreo('')
    setPassword('')
    setCargo('')
    setGrantedModules([])
    setError(null)
  }, [open])

  function toggleModule(key: ModuleKey) {
    setGrantedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const cargoTrimmed = cargo.trim()
      const payload =
        role === 'community_admin'
          ? {
              role,
              nombre,
              correo,
              password,
              cargo: cargoTrimmed || undefined,
              granted_modules: grantedModules,
            }
          : { role, nombre, correo, password, cargo: cargoTrimmed || undefined }

      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la cuenta')
        return
      }
      onOpenChange(false)
      router.refresh()
    } catch {
      setError('Error de red al crear la cuenta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="portal-header sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear cuenta</DialogTitle>
          <DialogDescription>
            La cuenta queda activa de inmediato con el correo y la contraseña que definas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="modal-label">Tipo de cuenta</span>
            <div className="grid grid-cols-2 gap-2">
              {(['community_admin', 'community_member'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  aria-pressed={role === value}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    role === value
                      ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]'
                      : 'border-border text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {ROLE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <BrandField
            id="usuario-nombre"
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <BrandField
            id="usuario-correo"
            label="Correo"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
          <PasswordGeneratorField
            id="usuario-password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            required
          />
          <BrandField
            id="usuario-cargo"
            label="Cargo (opcional)"
            placeholder="Ej. COO, CTO, Operation Lead, Strategy & Marketing Lead"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />

          {role === 'community_admin' && (
            <div className="space-y-1.5">
              <span className="modal-label">Módulos habilitados</span>
              <ModuleCheckboxList selected={grantedModules} onToggle={toggleModule} />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <BrandButton type="submit" size="sm" className="w-auto" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear cuenta'}
            </BrandButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  onOpenChange,
}: {
  user: UsuarioRow | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [cargo, setCargo] = useState('')
  const [grantedModules, setGrantedModules] = useState<ModuleKey[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setCargo(user.cargo ?? '')
      setGrantedModules(user.granted_modules)
      setError(null)
    }
  }, [user])

  function toggleModule(key: ModuleKey) {
    setGrantedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: { cargo: string | null; granted_modules?: ModuleKey[] } = {
        cargo: cargo.trim() || null,
      }
      if (user.role === 'community_admin') {
        payload.granted_modules = grantedModules
      }
      const res = await fetch(`/api/admin/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo actualizar')
        return
      }
      onOpenChange(false)
      router.refresh()
    } catch {
      setError('Error de red al guardar los cambios')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="portal-header sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar a {user?.nombre}</DialogTitle>
          <DialogDescription>
            Los cambios aplican la próxima vez que esta persona cargue el portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <BrandField
            id="editar-cargo"
            label="Cargo (opcional)"
            placeholder="Ej. COO, CTO, Operation Lead, Strategy & Marketing Lead"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
          {user?.role === 'community_admin' && (
            <div className="space-y-1.5">
              <span className="modal-label">Módulos habilitados</span>
              <ModuleCheckboxList selected={grantedModules} onToggle={toggleModule} />
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <BrandButton type="submit" size="sm" className="w-auto" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </BrandButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  user,
  onOpenChange,
}: {
  user: UsuarioRow | null
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user) {
      setPassword('')
      setError(null)
      setSuccess(false)
    }
  }, [user])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/usuarios/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No se pudo restablecer la contraseña')
        return
      }
      setSuccess(true)
    } catch {
      setError('Error de red al restablecer la contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="portal-header sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña de {user?.nombre}</DialogTitle>
          <DialogDescription>
            Comparte la nueva contraseña directamente con la persona.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <p className="text-sm text-green-500">Contraseña actualizada.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordGeneratorField
              id="reset-password"
              label="Nueva contraseña"
              value={password}
              onChange={setPassword}
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <DialogFooter>
              <BrandButton type="submit" size="sm" className="w-auto" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Restablecer'}
              </BrandButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function UsuariosTable({ users, canManage }: UsuariosTableProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UsuarioRow | null>(null)
  const [resettingUser, setResettingUser] = useState<UsuarioRow | null>(null)

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <BrandButton
            type="button"
            size="sm"
            className="w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus className="size-4" />
            Crear cuenta
          </BrandButton>
        </div>
      )}

      {users.length === 0 ? (
        <BrandCard className="text-center">
          <p className="text-muted-foreground">Todavía no hay usuarios registrados.</p>
        </BrandCard>
      ) : (
        <>
          {/* Tabla desktop/tablet */}
          <BrandCard border="solid" padding="sm" className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Correo</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cargo</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Módulos</th>
                  {canManage && (
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{u.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.correo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.cargo ?? '—'}</td>
                    <td className="px-4 py-3">
                      {u.role === 'community_admin' ? (
                        <ModuleChips modules={u.granted_modules} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {u.role !== 'super_admin' && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              aria-label="Editar usuario"
                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResettingUser(u)}
                              aria-label="Restablecer contraseña"
                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <KeyRound className="size-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </BrandCard>

          {/* Cards móvil */}
          <div className="flex flex-col gap-3 md:hidden">
            {users.map((u) => (
              <BrandCard key={u.id} border="solid" padding="sm" className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{u.nombre}</p>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{u.correo}</span>
                  </p>
                  {u.cargo && (
                    <p className="flex items-center gap-1.5">
                      <Briefcase className="size-3.5 shrink-0" aria-hidden="true" />
                      {u.cargo}
                    </p>
                  )}
                </div>
                {u.role === 'community_admin' && <ModuleChips modules={u.granted_modules} />}
                {canManage && u.role !== 'super_admin' && (
                  <div className="flex items-center gap-2 border-t border-border/40 pt-2.5">
                    <BrandButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-auto"
                      onClick={() => setEditingUser(u)}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </BrandButton>
                    <BrandButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-auto"
                      onClick={() => setResettingUser(u)}
                    >
                      <KeyRound className="size-3.5" />
                      Contraseña
                    </BrandButton>
                  </div>
                )}
              </BrandCard>
            ))}
          </div>
        </>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDialog
        user={editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />
      <ResetPasswordDialog
        user={resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
      />
    </div>
  )
}
