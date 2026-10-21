import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { ParrillaBank } from '@/components/portal/parrilla-bank'
import { ParrillaQuotes } from '@/components/portal/parrilla-quotes'
import { ListViewToggle, PlatformIcons } from '@/components/portal/parrilla-shared'
import { opensRow, ParrillaTable, type ParrillaTableColumn } from '@/components/portal/parrilla-table'
import { useListView } from '@/hooks/use-list-view'
import type { ParrillaPostSummary } from '@/lib/parrilla/posts'
import type { ParrillaQuote } from '@/lib/parrilla/quotes'
import type { ParrillaListView, SortState } from '@/lib/parrilla/table'
import fs from 'node:fs'
import path from 'node:path'

// La vista «Tabla» del Banco de contenido y de las Frases, vista desde el HTML que escribe el
// servidor (el mismo que hidrata el navegador). Lo que mide de verdad —clics, orden con datos
// reales, WebKit con perfil de iPad— se corre a mano; aquí se fija lo que no depende de un
// navegador.

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }
const inRouter = (node: React.ReactNode) =>
  React.createElement(AppRouterContext.Provider, { value: router as never }, node)

/** Solo el texto que ve la persona. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** React separa los nodos de texto adyacentes con un `<!-- -->` en el HTML del servidor; el
 *  navegador no lo muestra, así que las aserciones de texto lo ignoran. */
const ssr = (node: React.ReactNode) => renderToString(node).replace(/<!-- -->/g, '')

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length

function post(overrides: Partial<ParrillaPostSummary> = {}): ParrillaPostSummary {
  return {
    id: 'p1',
    title: 'Una idea archivada',
    platforms: ['instagram'],
    production_date: '2026-10-16',
    publish_date: null,
    status: 'archivado',
    format: 'video',
    category: 'conectar',
    talent: 'Dani',
    inspiration_url: null,
    hidden_sections: [],
    filmmaker_ids: [],
    editor_ids: [],
    updated_at: '2026-10-16T12:00:00+00:00',
    ...overrides,
  }
}

function quote(overrides: Partial<ParrillaQuote> = {}): ParrillaQuote {
  return {
    id: 'q1',
    quote_text: 'La felicidad de tu vida depende de la calidad de tus pensamientos.',
    author: 'Marco Aurelio',
    author_context: 'Emperador y filósofo estoico',
    source: 'Meditaciones',
    used_count: 0,
    ...overrides,
  }
}

const renderBank = (props: Partial<React.ComponentProps<typeof ParrillaBank>> = {}) =>
  ssr(
    inRouter(
      React.createElement(ParrillaBank, {
        posts: [],
        total: 0,
        editors: [],
        view: 'tabla' as ParrillaListView,
        onViewChange() {},
        ...props,
      })
    )
  )

const renderQuotes = (props: Partial<React.ComponentProps<typeof ParrillaQuotes>> = {}) =>
  ssr(
    inRouter(
      React.createElement(ParrillaQuotes, {
        quotes: [],
        anyUsed: false,
        authors: [],
        editors: [],
        view: 'tabla' as ParrillaListView,
        onViewChange() {},
        ...props,
      })
    )
  )

/** Las celdas de encabezado del HTML. */
const headers = (html: string) =>
  [...html.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)].map((m) => ({
    attrs: m[1],
    html: m[2],
    text: textOf(m[2]),
  }))

/** Ningún `<button>` dentro de otro: HTML inválido y, en Safari, toques que se van al equivocado. */
function assertNoNestedButtons(html: string) {
  let depth = 0
  for (const match of html.matchAll(/<(\/?)button\b/g)) {
    depth += match[1] ? -1 : 1
    assert.ok(depth <= 1, 'un <button> dentro de otro <button>')
  }
  assert.equal(depth, 0)
}

describe('el interruptor Tarjetas / Tabla', () => {
  const html = ssr(React.createElement(ListViewToggle, { value: 'tabla', onChange() {} }))
  const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map((m) => m[1])

  test('es un grupo «Vista» con dos botones, por nombre y en este orden', () => {
    assert.match(html, /role="group"/)
    assert.match(html, /aria-label="Vista"/)
    assert.equal(buttons.length, 2)
    assert.match(buttons[0], /aria-label="Tarjetas"/)
    assert.match(buttons[1], /aria-label="Tabla"/)
  })

  test('aria-pressed dice cuál está activa, y solo esa', () => {
    assert.match(buttons[0], /aria-pressed="false"/)
    assert.match(buttons[1], /aria-pressed="true"/)
    const tarjetas = ssr(React.createElement(ListViewToggle, { value: 'tarjetas', onChange() {} }))
    const [first, second] = [...tarjetas.matchAll(/<button\b([^>]*)>/g)].map((m) => m[1])
    assert.match(first, /aria-pressed="true"/)
    assert.match(second, /aria-pressed="false"/)
  })

  test('los botones son de tipo button y miden 44 px al tacto; los íconos no se leen', () => {
    for (const attrs of buttons) {
      assert.match(attrs, /type="button"/)
      assert.match(attrs, /pointer-coarse:size-11/)
    }
    assert.equal(count(html, /<svg\b[^>]*aria-hidden="true"/g), 2)
  })
})

describe('Banco de contenido en vista «Tabla»', () => {
  const posts = [
    post({
      id: 'a',
      title: 'Primera idea',
      platforms: ['instagram', 'linkedin'],
      editor_ids: ['e1', 'e2', 'fuera'],
    }),
    post({ id: 'b', title: 'Segunda idea', platforms: [], category: null, format: null, talent: null }),
    post({ id: 'c', title: 'Tercera idea', inspiration_url: 'https://example.com/ref' }),
  ]
  const editors = [
    { id: 'e1', nombre: 'Ana' },
    { id: 'e2', nombre: 'Luis' },
  ]
  const html = renderBank({ posts, total: 3, editors })

  test('es una tabla real, con su nombre para los lectores de pantalla y SIN las tarjetas', () => {
    assert.equal(count(html, /<table\b/g), 1)
    assert.match(html, /<caption[^>]*sr-only[^>]*>Ideas del Banco de contenido<\/caption>/)
    assert.doesNotMatch(html, /<ul\b/)
  })

  test('un encabezado `scope="col"` por propiedad, en este orden', () => {
    const cols = headers(html)
    assert.deepEqual(
      cols.map((c) => c.text),
      ['Idea', 'Redes', 'Categoría', 'Formato', 'Talento', 'Editor(es)', 'Inspiración', 'Producción']
    )
    for (const col of cols) assert.match(col.attrs, /scope="col"/)
  })

  test('todas las columnas ordenan con un botón, menos «Inspiración» (un enlace no se ordena)', () => {
    for (const col of headers(html)) {
      assert.equal(/<button\b/.test(col.html), col.text !== 'Inspiración', col.text)
    }
  })

  test('al abrir no hay ninguna columna ordenada: ningún `aria-sort`', () => {
    assert.doesNotMatch(html, /aria-sort=/)
  })

  test('una fila por idea y cada una con UN solo botón que la abre', () => {
    const body = html.slice(html.indexOf('<tbody'))
    assert.equal(count(body, /<tr\b/g), 3)
    assert.equal(count(body, /data-row-open/g), 3)
    assert.equal(count(body, /aria-haspopup="dialog"/g), 3)
  })

  test('ningún botón contiene a otro', () => {
    assertNoNestedButtons(html)
  })

  test('los editores se resuelven por id y quien ya no es editor no aparece', () => {
    assert.match(textOf(html), /Ana, Luis/)
    assert.doesNotMatch(html, /fuera/)
  })

  test('lo que falta se ve como «—», no como una celda vacía', () => {
    const row = html.split('<tr').find((r) => r.includes('Segunda idea')) ?? ''
    assert.ok(count(row, /—/g) >= 4, 'redes, categoría, formato, talento, editor(es)… sin dato')
  })

  test('el enlace de inspiración solo existe con una URL http(s), abre aparte y se nombra', () => {
    assert.equal(count(html, /<a\b/g), 1)
    assert.match(html, /<a\b[^>]*href="https:\/\/example\.com\/ref"/)
    assert.match(html, /target="_blank"/)
    assert.match(html, /rel="noopener noreferrer"/)
    // Avisa que sale de la app: quien usa un lector de pantalla no ve que se abre otra pestaña.
    assert.match(html, /aria-label="Abrir la inspiración de Tercera idea \(se abre en una pestaña nueva\)"/)
    const unsafe = renderBank({ posts: [post({ inspiration_url: 'javascript:alert(1)' })], total: 1 })
    assert.doesNotMatch(unsafe, /<a\b/)
  })

  test('al tacto los 8 encabezados (7 con botón) y las 3 celdas principales miden 44 px', () => {
    // 7 botones de orden + 3 botones principales + el enlace de inspiración no cuenta aquí.
    assert.ok(count(html, /pointer-coarse:min-h-11/g) >= 7 + 3)
  })

  test('el interruptor marca «Tabla» y el botón «Nueva idea» sigue ahí', () => {
    assert.match(html, /aria-pressed="true"[^>]*aria-label="Tabla"/)
    assert.match(textOf(html), /Nueva idea/)
  })

  test('sin ideas archivadas: sin interruptor ni tabla, y el mensaje de siempre', () => {
    const empty = renderBank({ posts: [], total: 0 })
    assert.doesNotMatch(empty, /aria-label="Vista"/)
    assert.doesNotMatch(empty, /<table\b/)
    assert.match(textOf(empty), /Aún no hay ideas guardadas/)
    assert.match(textOf(empty), /Nueva idea/)
  })

  test('con ideas pero ninguna pasa los filtros: el mensaje, no una tabla vacía, y el interruptor sigue', () => {
    const filtered = renderBank({ posts: [], total: 3 })
    assert.doesNotMatch(filtered, /<table\b/)
    assert.match(textOf(filtered), /Ninguna idea archivada coincide con los filtros/)
    assert.match(filtered, /aria-label="Vista"/)
  })
})

describe('Banco de contenido en vista «Tarjetas»', () => {
  test('es exactamente la lista de siempre: sin tabla y con el interruptor en «Tarjetas»', () => {
    const html = renderBank({ view: 'tarjetas', posts: [post({ id: 'a' }), post({ id: 'b' })], total: 2 })
    assert.doesNotMatch(html, /<table\b/)
    assert.equal(count(html, /<li\b/g), 2)
    assert.match(html, /aria-pressed="true"[^>]*aria-label="Tarjetas"/)
  })
})

describe('Frases en vista «Tabla»', () => {
  const quotes = [
    quote({ id: 'a' }),
    quote({ id: 'b', author: 'Séneca', author_context: null, source: null, used_count: 2 }),
    quote({ id: 'c', author: 'Nietzsche' }),
  ]
  const html = renderQuotes({
    quotes,
    anyUsed: true,
    authors: ['Marco Aurelio', 'Nietzsche', 'Séneca'],
  })

  test('es una tabla real con una fila por frase y SIN las tarjetas', () => {
    assert.equal(count(html, /<table\b/g), 1)
    assert.match(html, /<caption[^>]*sr-only[^>]*>Frases de referentes<\/caption>/)
    assert.equal(count(html.slice(html.indexOf('<tbody')), /<tr\b/g), 3)
    assert.doesNotMatch(html, /<ul\b/)
  })

  test('un encabezado por propiedad; el de acciones no se ve pero los lectores de pantalla lo leen', () => {
    const cols = headers(html)
    assert.deepEqual(
      cols.map((c) => c.text),
      ['Frase', 'Referente', 'Quién fue', 'Fuente', 'Uso', 'Acciones']
    )
    const actions = cols[5]
    assert.match(actions.html, /sr-only/)
    assert.doesNotMatch(actions.html, /<button\b/, 'una columna de acciones no se ordena')
  })

  test('cada fila trae su «Crear contenido» (paridad con las tarjetas) y su botón que abre la edición', () => {
    for (const q of quotes) {
      assert.ok(html.includes(`aria-label="Crear contenido con la frase de ${q.author}"`), q.author)
    }
    assert.equal(count(html.slice(html.indexOf('<tbody')), /data-row-open/g), 3)
  })

  test('ningún botón contiene a otro', () => {
    assertNoNestedButtons(html)
  })

  test('la frase va entre comillas y sin cursiva, y «Usada ×N» solo si se usó', () => {
    assert.match(textOf(html), /“La felicidad de tu vida/)
    assert.doesNotMatch(html, /\bitalic\b/)
    assert.equal(count(textOf(html), /Usada ×2/g), 1)
    assert.doesNotMatch(textOf(html), /Usada ×0/)
  })

  test('sin «quién fue» o fuente se ve «—»; las frases ya no tienen columna de categoría', () => {
    const row = html.split('<tr').find((r) => r.includes('Séneca')) ?? ''
    assert.ok(count(row, /—/g) >= 2)
    assert.doesNotMatch(textOf(html), /Categoría/)
  })

  test('no pinta fechas (Node y Safari las escriben distinto)', () => {
    assert.doesNotMatch(textOf(html), /\b20\d\d\b|\d{1,2}:\d{2}/)
  })

  test('el interruptor marca «Tabla»; sin frases no hay interruptor ni tabla', () => {
    assert.match(html, /aria-pressed="true"[^>]*aria-label="Tabla"/)
    const empty = renderQuotes({ quotes: [] })
    assert.doesNotMatch(empty, /aria-label="Vista"/)
    assert.doesNotMatch(empty, /<table\b/)
    assert.match(textOf(empty), /Aún no hay frases/)
  })

  test('el buscador y «Sin usar» siguen ahí en esta vista', () => {
    assert.match(html, /aria-label="Buscar una frase"/)
    assert.match(textOf(html), /Sin usar/)
  })
})

describe('un clic en una fila: ¿abre el modal?', () => {
  const control = (isRowButton: boolean) => ({
    closest: () => ({ hasAttribute: (name: string) => isRowButton && name === 'data-row-open' }),
  })

  test('sí, en cualquier parte de la fila que no sea un control', () => {
    assert.equal(opensRow({ closest: () => null }), true)
    assert.equal(opensRow(null), true)
  })

  test('sí, en el botón de la celda principal (el que usa el teclado)', () => {
    assert.equal(opensRow(control(true)), true)
  })

  test('NO en un control propio de otra celda («Crear contenido», el enlace de inspiración)', () => {
    assert.equal(opensRow(control(false)), false)
  })

  test('el atributo que la tabla escribe en el botón principal es el que `opensRow` busca', () => {
    const html = renderBank({ posts: [post()], total: 1 })
    const attr = /<button\b[^>]*\b(data-row-open)=""/.exec(html)?.[1]
    assert.equal(attr, 'data-row-open')
    assert.equal(opensRow({ closest: () => ({ hasAttribute: (name: string) => name === attr }) }), true)
  })
})

describe('la vista recordada, en el servidor', () => {
  test('el servidor y la hidratación pintan «tarjetas»: lo guardado se aplica ya en el navegador', () => {
    function Probe() {
      const [view] = useListView('banco')
      return React.createElement('span', null, view)
    }
    assert.equal(textOf(ssr(React.createElement(Probe))), 'tarjetas')
  })
})

describe('la tabla aplica el orden al dibujar las filas', () => {
  interface Fila {
    id: string
    nombre: string | null
  }
  const filas: Fila[] = [
    { id: '1', nombre: 'Beto' },
    { id: '2', nombre: null },
    { id: '3', nombre: 'Ana' },
  ]
  const columns: ParrillaTableColumn<Fila>[] = [
    { key: 'nombre', label: 'Nombre', primary: true, sortValue: (f) => f.nombre, cell: (f) => f.nombre ?? '—' },
    { key: 'id', label: 'Id', cell: (f) => f.id },
  ]
  const renderTable = (defaultSort?: SortState | null) =>
    ssr(
      React.createElement(ParrillaTable<Fila>, {
        columns,
        rows: filas,
        getRowId: (f) => f.id,
        onOpen() {},
        caption: 'Prueba',
        defaultSort,
      })
    )
  /** Los ids de las filas, en el orden en que se dibujan. */
  const order = (html: string) => [...html.slice(html.indexOf('<tbody')).matchAll(/<td[^>]*>(\d)<\/td>/g)].map((m) => m[1]).join('')

  test('sin orden: el original', () => {
    assert.equal(order(renderTable()), '123')
    assert.doesNotMatch(renderTable(), /aria-sort=/)
  })

  test('ascendente: la A antes que la B y el vacío al final; el encabezado lo dice', () => {
    const html = renderTable({ key: 'nombre', direction: 'asc' })
    assert.equal(order(html), '312')
    assert.match(html, /<th[^>]*aria-sort="ascending"/)
    assert.equal(count(html, /aria-sort=/g), 1)
  })

  test('descendente: al revés, y el vacío SIGUE al final', () => {
    const html = renderTable({ key: 'nombre', direction: 'desc' })
    assert.equal(order(html), '132')
    assert.match(html, /<th[^>]*aria-sort="descending"/)
  })
})

describe('«Crear contenido» en la fila de la tabla de Frases', () => {
  test('el botón de la fila abre «Nueva publicación» igual que el de la tarjeta', () => {
    // Lo que el HTML del servidor no enseña es el clic: la tarjeta y la fila lo llevan.
    const source = fs.readFileSync(path.join(process.cwd(), 'components/portal/parrilla-quotes.tsx'), 'utf8')
    assert.equal(count(source, /onClick=\{\(\) => openCreateContent\(quote\)\}/g), 2)
  })
})

describe('«Redes»: los lectores de pantalla oyen las redes, no una celda vacía', () => {
  const posts = [
    post({ id: 'a', title: 'Primera idea', platforms: ['instagram', 'linkedin'] }),
    post({ id: 'b', title: 'Segunda idea', platforms: [] }),
  ]
  const html = renderBank({ posts, total: 2 })
  const cells = (title: string) => (html.split('<tr').find((r) => r.includes(title)) ?? '').split('<td')

  test('la celda trae los nombres de las redes en texto `sr-only`', () => {
    const redes = cells('Primera idea')[2]
    assert.match(redes, /<span class="sr-only">Instagram, LinkedIn<\/span>/)
    assert.equal(count(redes, /<svg\b/g), 2, 'los íconos siguen ahí, para quien ve')
  })

  test('sin redes no hay texto oculto: solo «—»', () => {
    const redes = cells('Segunda idea')[2]
    assert.doesNotMatch(redes, /sr-only/)
    assert.match(textOf(redes), /—/)
  })

  test('el contenedor es `relative`: el texto `sr-only` es `absolute` y no debe flotar en la página', () => {
    assert.match(cells('Primera idea')[2], /<span class="relative flex shrink-0 items-center gap-0\.5">/)
  })

  test('`PlatformIcons` sin redes (el calendario puede pasarle una lista vacía) no pinta un span oculto vacío', () => {
    const vacio = ssr(React.createElement(PlatformIcons, { platforms: [] }))
    assert.doesNotMatch(vacio, /sr-only/)
    const dos = ssr(React.createElement(PlatformIcons, { platforms: ['youtube'] }))
    assert.match(dos, /<span class="sr-only">YouTube<\/span>/)
  })

  test('es la causa raíz: las tarjetas del Banco (y el calendario) usan el mismo componente y también lo oyen', () => {
    const tarjetas = renderBank({ view: 'tarjetas', posts, total: 2 })
    assert.match(tarjetas, /<span class="sr-only">Instagram, LinkedIn<\/span>/)
  })
})

describe('un valor largo no estira la tabla', () => {
  const largo = (n: number, palabra = 'Larguísimo') => Array.from({ length: n }, () => palabra).join(' ').slice(0, n)
  const editors = ['e1', 'e2', 'e3', 'e4', 'e5'].map((id, i) => ({ id, nombre: `Editora con nombre muy largo número ${i + 1}` }))
  const talento = largo(150)
  const banco = renderBank({
    posts: [post({ id: 'a', title: 'Idea larga', talent: talento, editor_ids: editors.map((e) => e.id) })],
    total: 1,
    editors,
  })
  const referente = largo(120, 'Referente')
  const contexto = largo(160, 'Contexto')
  const fuente = largo(300, 'Fuente')
  const frases = renderQuotes({
    quotes: [quote({ id: 'a', author: referente, author_context: contexto, source: fuente })],
    anyUsed: false,
  })

  /** La celda cuyo texto completo es `texto`: su `<span>` con las clases y el `title`. */
  const span = (html: string, texto: string) => new RegExp(`<span class="([^"]*)" title="${texto}">`).exec(html)

  test('Banco: el talento (sin tope de largo en zod ni en SQL) y los editores van a dos líneas de ancho tope, con su texto completo en `title`', () => {
    const t = span(banco, talento)
    assert.ok(t, 'el talento no está en un span con `title`')
    assert.match(t[1], /\bline-clamp-2\b/)
    assert.match(t[1], /\bmax-w-28\b/)
    assert.match(t[1], /\bwhitespace-normal\b/, 'la celda es nowrap: sin esto el clamp no parte la línea')
    const nombres = editors.map((e) => e.nombre).join(', ')
    const e = span(banco, nombres)
    assert.ok(e, 'los editores no están en un span con `title`')
    assert.match(e[1], /\bline-clamp-2\b/)
    assert.match(e[1], /\bmax-w-28\b/)
  })

  test('Frases: referente (hasta 120), «quién fue» y fuente a dos líneas de ancho tope, con su texto completo en `title`', () => {
    const r = span(frases, referente)
    assert.ok(r, 'el referente no está en un span con `title`')
    assert.match(r[1], /\bline-clamp-2\b/)
    assert.match(r[1], /\bmax-w-32\b/)
    const c = span(frases, contexto)
    assert.ok(c, '«quién fue» no está en un span con `title`')
    assert.match(c[1], /\bline-clamp-2\b[^"]*\bw-32\b|\bw-32\b[^"]*\bline-clamp-2\b/)
    const f = span(frases, fuente)
    assert.ok(f, 'la fuente no está en un span con `title`')
    assert.match(f[1], /\bline-clamp-2\b[^"]*\bw-32\b|\bw-32\b[^"]*\bline-clamp-2\b/)
  })
})

describe('«Fuente» se oculta cuando la tabla es estrecha, para que «Crear contenido» quede a la vista', () => {
  const html = renderQuotes({ quotes: [quote({ id: 'a' })], anyUsed: false })
  const ocultaPorContenedor = /\bhidden\b[^"]*@min-\[1060px\]:table-cell/

  test('la tabla es un contenedor de consultas: la decisión es por SU ancho, no el de la pantalla', () => {
    assert.match(html, /<div class="@container [^"]*overflow-x-auto/)
  })

  test('el encabezado y la celda de «Fuente» llevan `hidden @min-[1060px]:table-cell`', () => {
    const th = headers(html).find((c) => c.text === 'Fuente')
    assert.ok(th)
    assert.match(th.attrs, ocultaPorContenedor)
    const row = html.slice(html.indexOf('<tbody'))
    const fuenteTd = row.split('<td').find((cell) => cell.includes('Meditaciones')) ?? ''
    assert.match(fuenteTd, ocultaPorContenedor)
  })

  test('ninguna otra columna se oculta, y menos la de «Crear contenido»', () => {
    for (const col of headers(html)) {
      if (col.text !== 'Fuente') assert.doesNotMatch(col.attrs, /\bhidden\b|@min-/, col.text)
    }
    const acciones = (html.slice(html.indexOf('<tbody')).split('<td').find((cell) => cell.includes('Crear contenido')) ?? '')
    assert.doesNotMatch(acciones.slice(0, acciones.indexOf('>')), /\bhidden\b|@min-/)
  })

  test('el Banco no oculta ninguna columna (cabe en un iPad Air horizontal con todas)', () => {
    const banco = renderBank({ posts: [post()], total: 1 })
    for (const col of headers(banco)) assert.doesNotMatch(col.attrs, /\bhidden\b/, col.text)
  })
})
