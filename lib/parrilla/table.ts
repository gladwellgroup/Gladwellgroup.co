// Vista «Tabla» de la parrilla (Banco de contenido y Frases): el orden por columna y
// la preferencia de vista, como reglas puras. Sin imports de la app: el cliente
// incluye este módulo en su bundle y las pruebas lo cargan sin resolver nada del
// resto.

// ───────────────────────────── Orden ─────────────────────────────

export type SortDirection = 'asc' | 'desc'

/** Qué columna ordena la tabla y en qué sentido. `null` = el orden original de la
 *  lista (el que ya traía: lo más reciente primero). */
export interface SortState {
  key: string
  direction: SortDirection
}

/** Lo que una celda aporta al orden. `null`/`undefined`/texto en blanco = «vacío». */
export type SortValue = string | number | null | undefined

/** Clic en un encabezado: otra columna empieza ascendente; la misma pasa de
 *  ascendente a descendente y de ahí vuelve al orden original (así siempre hay una
 *  forma de quitar el orden sin recargar). */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  return current.direction === 'asc' ? { key, direction: 'desc' } : null
}

/** El `aria-sort` de un encabezado: solo la columna ordenada lo lleva (el resto no
 *  dice nada, que es lo que recomienda WAI-ARIA). */
export function ariaSort(
  sort: SortState | null,
  key: string
): 'ascending' | 'descending' | undefined {
  if (!sort || sort.key !== key) return undefined
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

const isEmpty = (value: SortValue): value is null | undefined | '' =>
  value == null || (typeof value === 'string' && value.trim() === '')

// Sin tildes ni mayúsculas («Álvaro» junto a «alvaro») y con los números por su valor
// («Idea 2» antes de «Idea 10»).
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/** Una copia de `rows` ordenada por la columna de `sort` (o en su orden original si
 *  no hay orden). El desempate conserva el orden original (`Array.prototype.sort` es
 *  estable) y los vacíos van SIEMPRE al final, también al invertir: al ordenar de la Z
 *  a la A nadie quiere ver primero las filas sin dato. `getValue` recibe la fila y la
 *  clave de la columna. */
export function sortRows<T>(
  rows: readonly T[],
  sort: SortState | null,
  getValue: (row: T, key: string) => SortValue
): T[] {
  if (!sort) return [...rows]
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((rowA, rowB) => {
    const a = getValue(rowA, sort.key)
    const b = getValue(rowB, sort.key)
    if (isEmpty(a) || isEmpty(b)) return Number(isEmpty(a)) - Number(isEmpty(b))
    return sign * compare(a, b)
  })
}

// ─────────────────────── Vista elegida (tarjetas / tabla) ───────────────────────

export const PARRILLA_LIST_VIEWS = ['tarjetas', 'tabla'] as const
export type ParrillaListView = (typeof PARRILLA_LIST_VIEWS)[number]

/** Las bases de datos que tienen las dos vistas: cada una recuerda la suya. */
export type ListViewKey = 'banco' | 'frases'

export const DEFAULT_LIST_VIEW: ParrillaListView = 'tarjetas'

/** Cualquier cosa que no sea una vista conocida (nada guardado, un valor viejo o
 *  manipulado) es la vista de siempre. */
export function parseListView(raw: unknown): ParrillaListView {
  return PARRILLA_LIST_VIEWS.find((view) => view === raw) ?? DEFAULT_LIST_VIEW
}

export const listViewStorageKey = (key: ListViewKey): string => `parrilla:vista:${key}`

/** Lo único que se usa de `localStorage`: así las pruebas lo sustituyen por uno que
 *  lanza, como hace el navegador en modo privado o con el almacenamiento bloqueado. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** La vista guardada, o la de siempre si no hay nada o el almacenamiento falla. */
export function readStoredView(storage: StorageLike | null, key: ListViewKey): ParrillaListView {
  try {
    return parseListView(storage?.getItem(listViewStorageKey(key)))
  } catch {
    return DEFAULT_LIST_VIEW
  }
}

/** Guarda la vista. Si el almacenamiento falla no pasa nada: la elección sigue
 *  valiendo mientras la página esté abierta, solo no se recuerda después. */
export function writeStoredView(
  storage: StorageLike | null,
  key: ListViewKey,
  view: ParrillaListView
): void {
  try {
    storage?.setItem(listViewStorageKey(key), view)
  } catch {
    // Ver arriba.
  }
}
