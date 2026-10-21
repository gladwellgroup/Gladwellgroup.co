'use client'

import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import {
  ariaSort,
  nextSort,
  sortRows,
  type SortState,
  type SortValue,
} from '@/lib/parrilla/table'

export interface ParrillaTableColumn<T> {
  key: string
  label: string
  /** Sin texto visible en el encabezado (la columna de acciones): el nombre queda
   *  solo para los lectores de pantalla. */
  hideLabel?: boolean
  /** Por qué valor ordena la columna. Sin él, el encabezado no es un botón. */
  sortValue?: (row: T) => SortValue
  /** Lo que se dibuja en la celda. */
  cell: (row: T) => ReactNode
  /** La celda que abre la fila: se envuelve en un botón real (teclado y lectores de
   *  pantalla). Una por tabla. */
  primary?: boolean
  /** Clases del encabezado Y de la celda de la columna (ancho, alineación, visibilidad…). La
   *  tabla es un contenedor de consultas (`@container`): una columna secundaria se oculta
   *  con `hidden @min-[…px]:table-cell` según el ancho de la TABLA y no el de la pantalla,
   *  que cambia con el menú lateral y los márgenes. */
  className?: string
}

interface ParrillaTableProps<T> {
  columns: ParrillaTableColumn<T>[]
  /** Las filas ya filtradas, en su orden original (el que la tabla recupera al quitar
   *  el orden). */
  rows: T[]
  getRowId: (row: T) => string
  /** Abre la fila: el mismo modal de edición que la vista de tarjetas. */
  onOpen: (row: T) => void
  /** Qué es la tabla, para quien la oye con un lector de pantalla. */
  caption: string
  /** El orden con el que arranca. Sin él, el original de `rows`. Hoy ninguna vista lo pasa:
   *  existe para poder probar con `renderToString` que la tabla APLICA el orden (un clic no se
   *  puede simular sin navegador), y una mutación real —ordenar con `null`— lo demostró. */
  defaultSort?: SortState | null
}

/** Marca del botón de la celda principal. */
const OPEN_ATTR = 'data-row-open'
const INTERACTIVE = 'a, button, input, select, textarea, [role="button"]'

/** Si un clic dentro de una fila abre la fila: sí en cualquier parte de ella, salvo en un
 *  control PROPIO de una celda (el botón «Crear contenido», un enlace), que hace lo suyo
 *  y no debe abrir además el modal. El botón de la celda principal sí la abre: es el que
 *  usa el teclado. Decidirlo aquí, por el elemento tocado, evita que cada columna tenga
 *  que acordarse de un `stopPropagation`. Exportada para probarla sin un navegador. */
export function opensRow(
  target: { closest: (selector: string) => { hasAttribute: (name: string) => boolean } | null } | null
): boolean {
  const control = target?.closest(INTERACTIVE)
  return !control || control.hasAttribute(OPEN_ATTR)
}

function SortIcon({ direction }: { direction: 'ascending' | 'descending' | undefined }) {
  if (direction === 'ascending') return <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
  if (direction === 'descending') return <ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
  return <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
}

/** Tabla estilo Notion para una base de datos de la parrilla: una columna por propiedad,
 *  un clic en el encabezado ordena y un clic en la fila abre el elemento. Es la segunda
 *  vista del Banco de contenido y de las Frases (la primera son las tarjetas).
 *
 *  Es «tonta» como el resto de la parrilla: dibuja las filas que le pasen, ya filtradas
 *  por el buscador y los filtros del tablero; lo único que guarda es el orden.
 *
 *  Una tabla real (`<table>`, `<th scope="col">`, `aria-sort` solo en la columna
 *  ordenada). Si no cabe, se desplaza en horizontal DENTRO de su contenedor: la página no
 *  se ensancha. Al tacto los botones del encabezado y de la celda principal miden 44 px, y
 *  como `hover:` no existe en una pantalla táctil, el feedback al pulsar va en `active:`. */
export function ParrillaTable<T>({
  columns,
  rows,
  getRowId,
  onOpen,
  caption,
  defaultSort = null,
}: ParrillaTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(defaultSort)

  const sorted = sortRows(rows, sort, (row, key) =>
    columns.find((column) => column.key === key)?.sortValue?.(row)
  )

  return (
    <div className="@container min-w-0 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSort(sort, column.key)}
                className={`whitespace-nowrap p-0 font-medium ${column.className ?? ''}`}
              >
                {column.sortValue ? (
                  <button
                    type="button"
                    onClick={() => setSort((current) => nextSort(current, column.key))}
                    className="flex w-full items-center gap-1 px-3 py-2 text-left transition-colors hover:text-foreground active:text-foreground pointer-coarse:min-h-11"
                  >
                    {column.label}
                    <SortIcon direction={ariaSort(sort, column.key)} />
                  </button>
                ) : (
                  <span className={column.hideLabel ? 'sr-only' : 'block px-3 py-2'}>{column.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={(event) => {
                if (opensRow(event.target instanceof Element ? event.target : null)) onOpen(row)
              }}
              className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40 active:bg-muted/60"
            >
              {columns.map((column) =>
                column.primary ? (
                  <td key={column.key} className={`p-0 ${column.className ?? ''}`}>
                    <button
                      type="button"
                      data-row-open=""
                      aria-haspopup="dialog"
                      className="flex min-h-9 w-full items-center px-3 py-2 text-left pointer-coarse:min-h-11"
                    >
                      {column.cell(row)}
                    </button>
                  </td>
                ) : (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-2 text-muted-foreground ${column.className ?? ''}`}
                  >
                    {column.cell(row)}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
