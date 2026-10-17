'use client'

import { BrandTextarea } from '@/components/brand/brand-field'

/** Campo de texto largo que arranca colapsado: un guion o un copy extenso no
 *  deben dominar el modal. `expanded` lo controla quien lo usa — el padre carga
 *  el valor en un efecto DESPUÉS de montar, así que un estado interno
 *  arrancaría con el valor anterior. */
export function CollapsibleTextarea({
  id,
  label,
  hideLabel,
  value,
  onChange,
  expanded,
  onExpandedChange,
  placeholder,
  emptyLabel,
}: {
  id: string
  label: string
  /** El título lo pone quien envuelve el campo (la cabecera de una sección con
   *  ojo): aquí no se dibuja, pero sigue siendo el nombre accesible del campo. */
  hideLabel?: boolean
  value: string
  onChange: (value: string) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** Texto de guía del textarea ya expandido. */
  placeholder: string
  /** Texto del botón colapsado mientras no hay contenido. */
  emptyLabel: string
}) {
  return (
    <div className="space-y-1.5 text-center">
      {expanded ? (
        <>
          <BrandTextarea
            id={id}
            label={label}
            hideLabel={hideLabel}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            wrapperClassName="text-center"
            className="text-left"
          />
          {/* aria-label con el nombre del campo: con dos de estos en el modal,
              dos botones "Colapsar" sueltos no se distinguen con lector de
              pantalla. */}
          <button
            type="button"
            onClick={() => onExpandedChange(false)}
            aria-expanded
            aria-controls={id}
            aria-label={`Colapsar ${label}`}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center pointer-coarse:px-4 pointer-coarse:text-sm"
          >
            Colapsar
          </button>
        </>
      ) : (
        <>
          {!hideLabel && <span className="modal-label">{label}</span>}
          <button
            type="button"
            onClick={() => onExpandedChange(true)}
            aria-expanded={false}
            aria-label={`${label}: ${value || emptyLabel}`}
            className="w-full truncate rounded-lg border border-dashed border-border bg-muted/20 px-4 py-2.5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 pointer-coarse:min-h-11"
          >
            {value || emptyLabel}
          </button>
        </>
      )}
    </div>
  )
}
