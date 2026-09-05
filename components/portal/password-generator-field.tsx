'use client'

import { useState } from 'react'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generatePassword } from '@/lib/password'

interface PasswordGeneratorFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  /** false en el campo de "confirmar contraseña" — generar ahí produciría
   *  un valor que nunca coincide con el de arriba. */
  showGenerate?: boolean
  autoComplete?: string
}

export function PasswordGeneratorField({
  id,
  label,
  value,
  onChange,
  required,
  showGenerate = true,
  autoComplete = 'new-password',
}: PasswordGeneratorFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="modal-label">
          {label}
        </label>
        {showGenerate && (
          <button
            type="button"
            onClick={() => {
              onChange(generatePassword())
              setVisible(true)
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#A78BFA] transition-colors hover:text-[#7C3AED]"
          >
            <RefreshCw className="size-3" />
            Generar
          </button>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          required={required}
          autoComplete={autoComplete}
          className={cn('modal-field pr-9')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}
