'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandButton } from '@/components/brand/brand-button'
import { PasswordGeneratorField } from '@/components/portal/password-generator-field'

export function ChangePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    // Cambio directo contra Supabase Auth con la sesión ya activa — mismo
    // patrón que login/page.tsx, sin pasar por una API route: es la propia
    // cuenta, no la de alguien más.
    const supabase = getSupabaseBrowser()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      setError('No se pudo actualizar la contraseña')
      return
    }

    setSuccess(true)
    setPassword('')
    setConfirm('')
  }

  return (
    <BrandCard className="max-w-md space-y-4">
      <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordGeneratorField
          id="perfil-password"
          label="Nueva contraseña"
          value={password}
          onChange={setPassword}
          required
        />
        <PasswordGeneratorField
          id="perfil-password-confirm"
          label="Confirmar contraseña"
          value={confirm}
          onChange={setConfirm}
          showGenerate={false}
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-500">Contraseña actualizada.</p>}
        <BrandButton type="submit" size="sm" className="w-auto" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Actualizar contraseña'}
        </BrandButton>
      </form>
    </BrandCard>
  )
}
