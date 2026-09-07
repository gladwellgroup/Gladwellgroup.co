'use client'

import { useState } from 'react'
import { PhotoUpload } from '@/components/portal/photo-upload'
import { uploadAvatar } from '@/lib/profile/upload-avatar'

export function AvatarCard({ userId, initialUrl }: { userId: string; initialUrl: string }) {
  const [error, setError] = useState<string | null>(null)

  async function handleUploaded(url: string) {
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo guardar la foto')
      }
    } catch {
      setError('Error de red al guardar la foto')
    }
  }

  return (
    <div className="space-y-2">
      <PhotoUpload
        currentUrl={initialUrl}
        onUpload={(file) => uploadAvatar({ userId, file })}
        onUploaded={handleUploaded}
        label="Subir foto de perfil"
        shape="circle"
        confirmTitle="¿Quitar la foto de perfil?"
        confirmMessage="Podrás subir otra en cualquier momento."
      />
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
