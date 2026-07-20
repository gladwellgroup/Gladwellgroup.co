'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { BrandField } from '@/components/brand/brand-field'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'
import { CountryPhoneSelect } from '@/components/shared/country-phone-select'
import { DEFAULT_PHONE_COUNTRY, getPhoneCodeByIso } from '@/lib/data/americas-phone-codes'
import { WHATSAPP_MAX_DIGITS, buildWhatsappE164, normalizePhoneDigits } from '@/lib/phone'
import type { CofounderData } from '@/components/portal/session-detail-form'

interface CofounderFieldsProps {
  cofounders: CofounderData[]
  onChange: (cofounders: CofounderData[]) => void
  disabled?: boolean
}

function digitsFromStored(whatsapp: string | null, pais: string): string {
  const dialDigits = (getPhoneCodeByIso(pais)?.dialCode ?? '').replace(/\D/g, '')
  const rawDigits = normalizePhoneDigits(whatsapp ?? '')
  return rawDigits.startsWith(dialDigits) && rawDigits.length > dialDigits.length
    ? rawDigits.slice(dialDigits.length)
    : rawDigits
}

export function CofounderFields({
  cofounders,
  onChange,
  disabled,
}: CofounderFieldsProps) {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)
  const [paisPorIndice, setPaisPorIndice] = useState<Record<number, string>>({})

  function addCofounder() {
    onChange([
      ...cofounders,
      { nombre: '', whatsapp: null, correo: null, orden: cofounders.length },
    ])
  }

  function removeCofounder(index: number) {
    setConfirmIndex(null)
    if (cofounders.length <= 1) return
    const next = cofounders.filter((_, i) => i !== index).map((c, i) => ({ ...c, orden: i }))
    onChange(next)
    setPaisPorIndice({})
  }

  function updateField(index: number, field: keyof CofounderData, value: string) {
    const next = cofounders.map((c, i) =>
      i === index ? { ...c, [field]: value } : c
    )
    onChange(next)
  }

  function updateWhatsappPais(index: number, pais: string) {
    setPaisPorIndice((prev) => ({ ...prev, [index]: pais }))
    const numero = digitsFromStored(cofounders[index].whatsapp, paisPorIndice[index] ?? DEFAULT_PHONE_COUNTRY)
    const dialCode = getPhoneCodeByIso(pais)?.dialCode ?? ''
    updateField(index, 'whatsapp', numero ? buildWhatsappE164(dialCode, numero) : '')
  }

  function updateWhatsappNumero(index: number, pais: string, rawValue: string) {
    const numero = normalizePhoneDigits(rawValue).slice(0, WHATSAPP_MAX_DIGITS)
    const dialCode = getPhoneCodeByIso(pais)?.dialCode ?? ''
    updateField(index, 'whatsapp', numero ? buildWhatsappE164(dialCode, numero) : '')
  }

  return (
    <div className="space-y-4">
      {cofounders.map((cofounder, index) => (
        <div
          key={index}
          className="relative rounded-xl border border-border bg-muted/30 p-4 space-y-3 transition-colors"
        >
          {!disabled && cofounders.length > 1 && (
            <button
              type="button"
              onClick={() => setConfirmIndex(index)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Eliminar fundador ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Fundador {index + 1}
          </p>

          <div className="space-y-3 pr-8 sm:pr-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandField
                id={`cofounder-nombre-${index}`}
                label="Nombre"
                placeholder="Nombre completo"
                value={cofounder.nombre}
                onChange={(e) => updateField(index, 'nombre', e.target.value)}
                disabled={disabled}
              />
              <BrandField
                id={`cofounder-correo-${index}`}
                label="Correo"
                type="email"
                placeholder="correo@empresa.com"
                value={cofounder.correo ?? ''}
                onChange={(e) => updateField(index, 'correo', e.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`cofounder-whatsapp-${index}`} className="modal-label">
                WhatsApp
              </label>
              <div className="grid grid-cols-[8rem_1fr] gap-2">
                <CountryPhoneSelect
                  id={`cofounder-whatsapp-pais-${index}`}
                  value={paisPorIndice[index] ?? DEFAULT_PHONE_COUNTRY}
                  onChange={(iso) => updateWhatsappPais(index, iso)}
                  disabled={disabled}
                />
                <input
                  id={`cofounder-whatsapp-${index}`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="300 123 4567"
                  value={digitsFromStored(cofounder.whatsapp, paisPorIndice[index] ?? DEFAULT_PHONE_COUNTRY)}
                  onChange={(e) =>
                    updateWhatsappNumero(index, paisPorIndice[index] ?? DEFAULT_PHONE_COUNTRY, e.target.value)
                  }
                  disabled={disabled}
                  className="modal-field"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={addCofounder}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Agregar fundador
        </button>
      )}

      <ConfirmDialog
        open={confirmIndex !== null}
        title="¿Quitar a este fundador?"
        message="Se eliminará de la lista de esta sesión."
        confirmLabel="Quitar"
        onConfirm={() => confirmIndex !== null && removeCofounder(confirmIndex)}
        onCancel={() => setConfirmIndex(null)}
      />
    </div>
  )
}
