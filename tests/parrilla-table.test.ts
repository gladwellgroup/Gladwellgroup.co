import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LIST_VIEW,
  PARRILLA_LIST_VIEWS,
  ariaSort,
  listViewStorageKey,
  nextSort,
  parseListView,
  readStoredView,
  resolveListView,
  sortRows,
  writeStoredView,
  type SortState,
  type StorageLike,
} from '@/lib/parrilla/table'

// La lógica pura de la vista «Tabla» de la parrilla (Banco de contenido y Frases): el orden
// por columna y la vista elegida. Lo que dibuja la tabla se prueba en parrilla-views.test.ts.

interface Row {
  id: string
  name: string | null
  n: number | null
}

const rows: Row[] = [
  { id: 'a', name: 'Beto', n: 3 },
  { id: 'b', name: null, n: 0 },
  { id: 'c', name: 'álvaro', n: 10 },
  { id: 'd', name: '   ', n: null },
  { id: 'e', name: 'Ana', n: 2 },
]
const value = (row: Row, key: string) => (key === 'n' ? row.n : row.name)
const ids = (list: Row[]) => list.map((row) => row.id).join('')

describe('nextSort: el ciclo de un encabezado', () => {
  test('otra columna (o ninguna) empieza ascendente', () => {
    assert.deepEqual(nextSort(null, 'name'), { key: 'name', direction: 'asc' })
    assert.deepEqual(nextSort({ key: 'n', direction: 'desc' }, 'name'), { key: 'name', direction: 'asc' })
  })

  test('la misma columna pasa a descendente y de ahí vuelve al orden original', () => {
    const asc = nextSort(null, 'name')
    const desc = nextSort(asc, 'name')
    assert.deepEqual(desc, { key: 'name', direction: 'desc' })
    assert.equal(nextSort(desc, 'name'), null)
  })
})

describe('ariaSort', () => {
  test('solo la columna ordenada lo lleva', () => {
    const sort: SortState = { key: 'name', direction: 'asc' }
    assert.equal(ariaSort(sort, 'name'), 'ascending')
    assert.equal(ariaSort({ key: 'name', direction: 'desc' }, 'name'), 'descending')
    assert.equal(ariaSort(sort, 'n'), undefined)
    assert.equal(ariaSort(null, 'name'), undefined)
  })
})

describe('sortRows', () => {
  test('sin orden devuelve una COPIA en el orden original', () => {
    const out = sortRows(rows, null, value)
    assert.deepEqual(out, rows)
    assert.notEqual(out, rows)
  })

  test('no modifica la lista de entrada', () => {
    const before = ids(rows)
    sortRows(rows, { key: 'name', direction: 'desc' }, value)
    assert.equal(ids(rows), before)
  })

  test('texto ascendente y descendente, sin distinguir tildes ni mayúsculas', () => {
    // «álvaro» ≈ «alvaro»: va con la A, antes de «Ana» (alvaro < ana) y de «Beto».
    assert.equal(ids(sortRows(rows, { key: 'name', direction: 'asc' }, value)).slice(0, 3), 'cea')
    assert.equal(ids(sortRows(rows, { key: 'name', direction: 'desc' }, value)).slice(0, 3), 'aec')
  })

  test('los vacíos (null y texto en blanco) van SIEMPRE al final, también al invertir', () => {
    assert.deepEqual(
      sortRows(rows, { key: 'name', direction: 'asc' }, value).slice(3).map((r) => r.id).sort(),
      ['b', 'd']
    )
    assert.deepEqual(
      sortRows(rows, { key: 'name', direction: 'desc' }, value).slice(3).map((r) => r.id).sort(),
      ['b', 'd']
    )
  })

  test('los números se ordenan por su valor y el 0 NO es un vacío', () => {
    assert.equal(ids(sortRows(rows, { key: 'n', direction: 'asc' }, value)), 'beacd')
    assert.equal(ids(sortRows(rows, { key: 'n', direction: 'desc' }, value)), 'caebd')
  })

  test('en texto, «2» va antes que «10» (orden natural)', () => {
    const list = [
      { id: 'x', name: 'Idea 10', n: null },
      { id: 'y', name: 'Idea 2', n: null },
    ]
    assert.equal(ids(sortRows(list, { key: 'name', direction: 'asc' }, value)), 'yx')
  })

  test('el desempate conserva el orden original, en los dos sentidos', () => {
    const tied = [
      { id: '1', name: 'Igual', n: 1 },
      { id: '2', name: 'igual', n: 1 },
      { id: '3', name: 'IGUAL', n: 1 },
    ]
    assert.equal(ids(sortRows(tied, { key: 'name', direction: 'asc' }, value)), '123')
    assert.equal(ids(sortRows(tied, { key: 'name', direction: 'desc' }, value)), '123')
  })
})

describe('la vista elegida', () => {
  test('la principal es la tabla y va primero; las tarjetas son la secundaria', () => {
    assert.equal(DEFAULT_LIST_VIEW, 'tabla')
    assert.deepEqual([...PARRILLA_LIST_VIEWS], ['tabla', 'tarjetas'])
  })

  test('parseListView: lo desconocido es la vista principal (la tabla)', () => {
    assert.equal(parseListView('tabla'), 'tabla')
    assert.equal(parseListView('tarjetas'), 'tarjetas')
    for (const raw of [null, undefined, '', 'Tabla', 'kanban', 1, {}]) {
      assert.equal(parseListView(raw), 'tabla', String(raw))
    }
  })

  test('cada base de datos recuerda la suya, con su propia clave', () => {
    assert.equal(listViewStorageKey('banco'), 'parrilla:vista:banco')
    assert.equal(listViewStorageKey('frases'), 'parrilla:vista:frases')
  })

  test('se guarda y se lee por base de datos', () => {
    const data = new Map<string, string>()
    const storage: StorageLike = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    }
    assert.equal(readStoredView(storage, 'banco'), 'tabla', 'sin nada guardado, la principal')
    writeStoredView(storage, 'banco', 'tarjetas')
    assert.equal(readStoredView(storage, 'banco'), 'tarjetas')
    assert.equal(readStoredView(storage, 'frases'), 'tabla', 'cada base tiene la suya')
  })

  test('un valor guardado que ya no existe cae a «tabla»', () => {
    const storage: StorageLike = { getItem: () => 'galeria', setItem() {} }
    assert.equal(readStoredView(storage, 'banco'), 'tabla')
  })

  test('con el almacenamiento bloqueado (lanza) ni leer ni escribir rompen nada', () => {
    const blocked: StorageLike = {
      getItem() {
        throw new DOMException('bloqueado', 'SecurityError')
      },
      setItem() {
        throw new DOMException('lleno', 'QuotaExceededError')
      },
    }
    assert.equal(readStoredView(blocked, 'banco'), 'tabla')
    assert.doesNotThrow(() => writeStoredView(blocked, 'banco', 'tarjetas'))
  })

  test('resolveListView: lo elegido en la sesión manda sobre lo guardado; sin nada, la principal', () => {
    const storage = (value: string | null): StorageLike => ({ getItem: () => value, setItem() {} })
    // Solo lo guardado.
    assert.equal(resolveListView({}, storage('tarjetas'), 'banco'), 'tarjetas')
    assert.equal(resolveListView({}, storage('tabla'), 'banco'), 'tabla')
    // Lo elegido en la sesión gana (p. ej. el almacenamiento falló al guardarlo y sigue con el valor viejo).
    assert.equal(resolveListView({ banco: 'tabla' }, storage('tarjetas'), 'banco'), 'tabla')
    assert.equal(resolveListView({ banco: 'tarjetas' }, storage('tabla'), 'banco'), 'tarjetas')
    // …y solo en SU base de datos.
    assert.equal(resolveListView({ banco: 'tarjetas' }, storage(null), 'frases'), 'tabla')
    // Sin nada, o con el almacenamiento bloqueado, la principal; bloqueado + elegido, lo elegido.
    assert.equal(resolveListView({}, storage(null), 'banco'), 'tabla')
    assert.equal(resolveListView({}, null, 'banco'), 'tabla')
    assert.equal(resolveListView({ frases: 'tarjetas' }, null, 'frases'), 'tarjetas')
  })

  test('sin almacenamiento (null) tampoco', () => {
    assert.equal(readStoredView(null, 'banco'), 'tabla')
    assert.doesNotThrow(() => writeStoredView(null, 'banco', 'tarjetas'))
  })
})
