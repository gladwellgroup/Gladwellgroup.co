'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { BrandField } from '@/components/brand/brand-field'
import { ConfirmDialog } from '@/components/portal/confirm-dialog'

export interface ToolData {
  nombre: string
  descripcion: string | null
  url: string | null
  orden: number
}

interface EducationToolFieldsProps {
  tools: ToolData[]
  onChange: (tools: ToolData[]) => void
  disabled?: boolean
}

export function EducationToolFields({
  tools,
  onChange,
  disabled,
}: EducationToolFieldsProps) {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null)

  function addTool() {
    onChange([
      ...tools,
      { nombre: '', descripcion: null, url: null, orden: tools.length },
    ])
  }

  function removeTool(index: number) {
    setConfirmIndex(null)
    if (tools.length <= 1) return
    onChange(
      tools.filter((_, i) => i !== index).map((tool, i) => ({ ...tool, orden: i }))
    )
  }

  function updateField(index: number, field: keyof ToolData, value: string) {
    onChange(tools.map((tool, i) => (i === index ? { ...tool, [field]: value } : tool)))
  }

  return (
    <div className="space-y-4">
      {tools.map((tool, index) => (
        <div
          key={index}
          className="relative rounded-xl border border-border bg-muted/30 p-4 space-y-3 transition-colors"
        >
          {!disabled && tools.length > 1 && (
            <button
              type="button"
              onClick={() => setConfirmIndex(index)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Eliminar herramienta ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Herramienta {index + 1}
          </p>

          <div className="space-y-3 pr-8 sm:pr-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <BrandField
                id={`tool-nombre-${index}`}
                label="Nombre"
                placeholder="Ej: Notion"
                value={tool.nombre}
                onChange={(e) => updateField(index, 'nombre', e.target.value)}
                disabled={disabled}
              />
              <BrandField
                id={`tool-url-${index}`}
                label="Enlace"
                type="url"
                placeholder="https://..."
                value={tool.url ?? ''}
                onChange={(e) => updateField(index, 'url', e.target.value)}
                disabled={disabled}
              />
            </div>
            <BrandField
              id={`tool-descripcion-${index}`}
              label="Para qué sirve"
              placeholder="En una frase, qué resuelve"
              value={tool.descripcion ?? ''}
              onChange={(e) => updateField(index, 'descripcion', e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={addTool}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Agregar herramienta
        </button>
      )}

      <ConfirmDialog
        open={confirmIndex !== null}
        title="¿Quitar esta herramienta?"
        message="Se eliminará de la lista de esta sesión."
        confirmLabel="Quitar"
        onConfirm={() => confirmIndex !== null && removeTool(confirmIndex)}
        onCancel={() => setConfirmIndex(null)}
      />
    </div>
  )
}
