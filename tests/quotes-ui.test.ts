import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { CategoryFilter, ParrillaBoard } from '@/components/portal/parrilla-board'
import { initialFields } from '@/components/portal/parrilla-post-form'
import { ParrillaQuoteForm } from '@/components/portal/parrilla-quote-form'
import { ParrillaQuotes } from '@/components/portal/parrilla-quotes'
import type { ParrillaPostSummary } from '@/lib/parrilla/posts'
import { quoteToPostDraft, type ParrillaQuote } from '@/lib/parrilla/quotes'

// La pestaña «Frases» de la parrilla, vista desde el HTML que escribe el servidor
// (el mismo que hidrata el navegador). Lo que mide de verdad —WebKit con perfil de
// iPad— se corre a mano; aquí se fija lo que no depende de un navegador.

const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }
const inRouter = (node: React.ReactNode) =>
  React.createElement(AppRouterContext.Provider, { value: router as never }, node)

/** Solo el texto que ve la persona. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** React separa los nodos de texto adyacentes (`“{frase}”`, `Usada ×{n}`) con un
 *  `<!-- -->` en el HTML del servidor; el navegador no lo muestra, así que las
 *  aserciones de texto lo ignoran. */
const ssr = (node: React.ReactNode) => renderToString(node).replace(/<!-- -->/g, '')

function quote(overrides: Partial<ParrillaQuote> = {}): ParrillaQuote {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    quote_text: 'La felicidad de tu vida depende de la calidad de tus pensamientos.',
    author: 'Marco Aurelio',
    author_context: 'Emperador y filósofo estoico',
    source: 'Meditaciones',
    used_count: 0,
    ...overrides,
  }
}

function post(overrides: Partial<ParrillaPostSummary> = {}): ParrillaPostSummary {
  return {
    id: 'p1',
    title: 'Pieza de prueba',
    platforms: ['instagram'],
    production_date: '2026-10-16',
    publish_date: '2026-10-20',
    status: 'programado',
    format: 'imagen',
    category: 'crecer',
    talent: null,
    inspiration_url: null,
    hidden_sections: [],
    filmmaker_ids: [],
    editor_ids: [],
    updated_at: '2026-10-16T12:00:00+00:00',
    ...overrides,
  }
}

const render = (props: Partial<React.ComponentProps<typeof ParrillaQuotes>> = {}) =>
  ssr(
    inRouter(
      React.createElement(ParrillaQuotes, {
        quotes: [],
        anyUsed: false,
        authors: [],
        editors: [],
        view: 'tarjetas',
        onViewChange() {},
        ...props,
      })
    )
  )

describe('las tres pestañas de la parrilla', () => {
  const html = ssr(
    inRouter(
      React.createElement(ParrillaBoard, {
        posts: [
          post({ id: 'a' }),
          post({ id: 'b', status: 'idea' }),
          post({ id: 'c', status: 'archivado', publish_date: null }),
        ],
        editors: [],
        quotes: [quote(), quote({ id: 'q2' }), quote({ id: 'q3' })],
      })
    )
  )

  // El grupo de pestañas: no tiene `<div>` anidados, así que su cierre es el primer `</div>`.
  const group = /aria-label="Parrilla"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? ''
  const tabs = [...group.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((match) => ({
    attrs: match[1],
    html: match[2],
    text: textOf(match[2]),
  }))

  test('hay un grupo «Parrilla» con tres botones, en este orden', () => {
    assert.equal(tabs.length, 3)
    assert.match(tabs[0].text, /^Calendario/)
    assert.match(tabs[1].text, /^Banco/)
    assert.match(tabs[2].text, /^Frases/)
  })

  test('solo «Calendario» está activa al abrir la página', () => {
    assert.deepEqual(
      tabs.map((tab) => /aria-pressed="true"/.test(tab.attrs)),
      [true, false, false]
    )
  })

  test('cada pestaña muestra su contador: piezas del calendario, del Banco y frases', () => {
    assert.match(tabs[0].text, /Calendario 2$/)
    assert.match(tabs[1].text, /Banco de contenido 1$/)
    assert.match(tabs[2].text, /Frases 3$/)
  })

  test('el Banco trae etiqueta corta y larga como dos spans hermanos (en un teléfono no caben las tres)', () => {
    assert.match(tabs[1].html, /<span class="sm:hidden">Banco<\/span>/)
    assert.match(tabs[1].html, /<span class="hidden sm:inline">Banco de contenido<\/span>/)
    // Las otras dos no se parten en dos etiquetas.
    assert.doesNotMatch(tabs[0].html, /sm:hidden/)
    assert.doesNotMatch(tabs[2].html, /sm:hidden/)
  })

  test('ninguna pestaña pisa su nombre accesible con un aria-label (label in name)', () => {
    for (const tab of tabs) assert.doesNotMatch(tab.attrs, /aria-label=/)
  })

  test('al tacto cada pestaña mide 44 px, y el relleno solo crece desde `sm`', () => {
    for (const tab of tabs) {
      assert.match(tab.attrs, /pointer-coarse:min-h-11/)
      assert.match(tab.attrs, /\bpx-3\b/)
      assert.match(tab.attrs, /sm:px-5/)
      assert.match(tab.attrs, /sm:pointer-coarse:px-6/)
      assert.doesNotMatch(tab.attrs, /(^|\s)pointer-coarse:px-6/, 'volvió el relleno táctil sin ancho: no caben en un teléfono')
      assert.match(tab.attrs, /whitespace-nowrap/)
    }
  })
})

describe('la biblioteca de frases', () => {
  test('sin frases: lo explica, no pinta buscador y sí «Nueva frase»', () => {
    const html = render()
    assert.match(textOf(html), /Aún no hay frases\. Guarda una con «Nueva frase»/)
    assert.doesNotMatch(html, /aria-label="Buscar una frase"/)
    assert.match(textOf(html), /Nueva frase/)
    assert.doesNotMatch(html, /<ul\b/)
  })

  test('con frases: una tarjeta por frase, cada una con su «Crear contenido»', () => {
    const quotes = [
      quote(),
      quote({ id: 'b', author: 'Séneca', quote_text: 'No es que tengamos poco tiempo, sino que perdemos mucho.' }),
      quote({ id: 'c', author: 'Nietzsche', author_context: null }),
    ]
    const html = render({ quotes, authors: ['Marco Aurelio', 'Nietzsche', 'Séneca'] })

    assert.equal((html.match(/<li\b/g) ?? []).length, 3)
    for (const q of quotes) {
      assert.ok(html.includes(`aria-label="Crear contenido con la frase de ${q.author}"`), q.author)
    }
    assert.match(html, /aria-label="Buscar una frase"/)
  })

  test('la frase va entre comillas y SIN cursiva (Geist solo tiene romana: el navegador la inventaría)', () => {
    const html = render({ quotes: [quote()] })
    assert.ok(html.includes('“La felicidad de tu vida depende de la calidad de tus pensamientos.”'))
    assert.doesNotMatch(html, /\bitalic\b/)
  })

  test('ningún botón contiene a otro: el cuerpo de la tarjeta y «Crear contenido» son hermanos', () => {
    const html = render({ quotes: [quote(), quote({ id: 'b' })] })
    let depth = 0
    for (const match of html.matchAll(/<(\/?)button\b/g)) {
      depth += match[1] ? -1 : 1
      assert.ok(depth <= 1, 'un <button> dentro de otro <button>: HTML inválido y toques perdidos en Safari')
    }
    assert.equal(depth, 0)
    // Por tarjeta: el que abre la edición y «Crear contenido» (más «Nueva frase» arriba y
    // los dos botones del interruptor Tarjetas / Tabla).
    assert.equal((html.match(/<button\b/g) ?? []).length, 2 * 2 + 1 + 2)
  })

  test('todas las tarjetas miden lo mismo: los bloques de alto fijo están aunque falte el dato', () => {
    // Una completa y otra sin «quién fue» y sin usos.
    const html = render({
      quotes: [quote({ used_count: 2 }), quote({ id: 'b', author_context: null, used_count: 0 })],
    })
    assert.equal((html.match(/flex h-24 w-full items-center justify-center/g) ?? []).length, 2, 'bloque de la frase')
    assert.equal((html.match(/h-4 w-full truncate/g) ?? []).length, 2, 'línea de «quién fue»')
    assert.equal((html.match(/flex h-6 items-center justify-center/g) ?? []).length, 2, 'fila de chips')
    assert.equal((html.match(/line-clamp-4/g) ?? []).length, 2, 'la frase se corta a 4 líneas')
  })

  test('la cuadrícula es `minmax(0, 1fr)` a cualquier ancho: un texto largo sin cortar no ensancha la tarjeta', () => {
    // Sin `grid-cols-1` la columna bajo `sm` es implícita (`auto`) y crece hasta el
    // `truncate` (nowrap) más largo: en un iPhone SE un «quién fue» largo llevó la
    // tarjeta a 569 px dentro de un contenedor de 293 y se salía de la pantalla.
    const html = render({ quotes: [quote()] })
    const ul = /<ul\b[^>]*aria-label="Frases"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? ''
    assert.match(ul, /\bgrid-cols-1\b/)
    assert.match(ul, /\bsm:grid-cols-2\b/)
    // …y la cadena de cajas puede encogerse por debajo de su contenido.
    assert.match(html, /<li class="flex min-w-0">/)
    assert.match(html, /class="flex w-full min-w-0 flex-col overflow-hidden/)
  })

  test('el chip «Usada ×N» solo aparece si se usó, y la tarjeta ya no lleva categoría', () => {
    const html = render({ quotes: [quote({ used_count: 2 }), quote({ id: 'b', used_count: 0 })] })
    assert.equal((html.match(/Usada ×2/g) ?? []).length, 1)
    assert.doesNotMatch(html, /Usada ×0/)
    // La categoría se elige al construir la publicación: ninguna de las seis sale en la tarjeta.
    for (const nombre of ['Crecer', 'Conectar', 'Construir', 'Aprender', 'Roots', 'Comunidad']) {
      assert.doesNotMatch(textOf(html), new RegExp(`\\b${nombre}\\b`), nombre)
    }
  })

  test('«Sin usar» solo aparece si alguna frase de la biblioteca ya se usó', () => {
    const quotes = [quote({ used_count: 1 }), quote({ id: 'b' }), quote({ id: 'c' })]
    assert.doesNotMatch(textOf(render({ quotes, anyUsed: false })), /Sin usar/)

    const html = render({ quotes, anyUsed: true })
    assert.match(textOf(html), /Sin usar 2/, 'el contador son las frases sin usar')
    assert.match(html, /aria-pressed="false"/)
  })

  test('la tarjeta no pinta fechas (Node y Safari las formatean distinto)', () => {
    const html = render({ quotes: [quote()] })
    assert.doesNotMatch(textOf(html), /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}:\d{2}\b|\b[ap]\.\s?m\./i)
  })
})

describe('el formulario de frases ya no pide categoría', () => {
  const labels = (html: string) => [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => textOf(m[1]))

  test('crear: frase, referente, quién fue y fuente, y nada más', () => {
    const html = ssr(inRouter(React.createElement(ParrillaQuoteForm, { quote: null, authors: [], onClose() {} })))
    assert.deepEqual(labels(html), ['Frase', 'Referente', 'Quién fue (opcional)', 'Fuente (opcional)'])
    assert.doesNotMatch(html, /<select\b/, 'no queda ningún selector')
    assert.doesNotMatch(textOf(html), /Categoría|Sin categoría/)
    assert.match(textOf(html), /Guardar frase/)
  })

  test('editar: los mismos cuatro campos, con «Eliminar frase»', () => {
    const html = ssr(inRouter(React.createElement(ParrillaQuoteForm, { quote: quote(), authors: ['Marco Aurelio'], onClose() {} })))
    assert.deepEqual(labels(html), ['Frase', 'Referente', 'Quién fue (opcional)', 'Fuente (opcional)'])
    assert.doesNotMatch(html, /<select\b/)
    assert.match(textOf(html), /Eliminar frase/)
  })
})

describe('«Crear contenido» prellena la publicación nueva', () => {
  const draft = quoteToPostDraft(quote())

  test('sin borrador, la pieza nueva arranca como siempre (nada cambia para el resto de la parrilla)', () => {
    assert.deepEqual(initialFields(null, '2026-10-20'), {
      title: '',
      platforms: [],
      production_date: '2026-10-20',
      publish_date: '2026-10-20',
      status: 'idea',
      format: null,
      category: null,
      talent: null,
      inspiration_url: null,
      hidden_sections: [],
      filmmaker_ids: [],
      editor_ids: [],
      copy_text: null,
      caption: null,
      cover_image_url: null,
    })
  })

  test('con borrador: título y copy de la frase; la categoría queda sin elegir; fechas, estado y plataformas siguen siendo los de siempre', () => {
    const fields = initialFields(null, '2026-10-20', undefined, draft)
    assert.equal(fields.title, 'Frase de Marco Aurelio')
    assert.equal(
      fields.caption,
      '“La felicidad de tu vida depende de la calidad de tus pensamientos.”\n\n— Marco Aurelio'
    )
    assert.equal(fields.category, null, 'la categoría se elige al construir la publicación')

    assert.equal(fields.status, 'idea')
    assert.equal(fields.production_date, '2026-10-20')
    assert.equal(fields.publish_date, '2026-10-20')
    assert.deepEqual(fields.platforms, [])
    assert.equal(fields.format, null)
    assert.equal(fields.copy_text, null)
  })

  test('enviada al Banco (archivado) sigue sin fecha de publicación', () => {
    const fields = initialFields(null, '2026-10-20', 'archivado', draft)
    assert.equal(fields.status, 'archivado')
    assert.equal(fields.publish_date, null)
    assert.equal(fields.title, 'Frase de Marco Aurelio')
  })

  test('al editar una pieza existente el borrador no se aplica', () => {
    const existing = post({ title: 'Título guardado', category: 'roots' })
    const fields = initialFields(existing, undefined, undefined, draft)
    assert.equal(fields.title, 'Título guardado')
    assert.equal(fields.category, 'roots')
    assert.equal(fields.caption, null)
  })
})

describe('filtros del tablero según la pestaña', () => {
  // Dos piezas del calendario y dos del Banco, cada par con dos categorías distintas.
  const posts = [
    post({ id: 'a', status: 'archivado', publish_date: null, category: 'crecer', platforms: ['instagram'] }),
    post({ id: 'b', status: 'archivado', publish_date: null, category: 'conectar', platforms: ['linkedin'] }),
    post({ id: 'c', category: 'crecer', platforms: ['instagram'] }),
    post({ id: 'd', category: 'conectar', platforms: ['linkedin'] }),
  ]
  const board = (initialView: 'calendario' | 'banco' | 'frases') =>
    textOf(
      ssr(
        inRouter(
          React.createElement(ParrillaBoard, {
            posts,
            editors: [],
            quotes: [quote(), quote({ id: 'q2', author: 'Séneca' })],
            initialView,
          })
        )
      )
    )

  test('Calendario y Banco traen el filtro de categoría, con su conteo', () => {
    for (const view of ['calendario', 'banco'] as const) {
      const text = board(view)
      assert.match(text, /Crecer 1/, view)
      assert.match(text, /Conectar 1/, view)
    }
  })

  test('Frases NO: las frases no tienen categoría ni plataforma, y las de las publicaciones no se cuelan', () => {
    const text = board('frases')
    assert.doesNotMatch(text, /Crecer|Conectar|Todas|Instagram|LinkedIn/)
    // …pero sí lo suyo: el buscador de la biblioteca y «Nueva frase».
    assert.match(text, /Nueva frase/)
    assert.match(text, /Frases 2/)
  })
})

describe('filtro de categoría', () => {
  const view = (items: { category: ParrillaPostSummary['category'] }[], value: Parameters<typeof CategoryFilter>[0]['value']) => {
    const html = ssr(React.createElement(CategoryFilter, { items, value, onChange() {} }))
    const chips = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({
      pressed: /aria-pressed="true"/.test(m[1]),
      text: textOf(m[2]),
    }))
    return { html, chips }
  }
  const of = (...categories: ParrillaPostSummary['category'][]) => categories.map((category) => ({ category }))

  test('sin filtro y con una sola categoría no se pinta: un chip no filtra nada', () => {
    assert.equal(view(of('crecer', 'crecer'), 'todas').html, '')
    assert.equal(view(of(), 'todas').html, '')
    assert.equal(view(of(null, 'crecer'), 'todas').html, '', 'una pieza sin categoría no cuenta')
  })

  test('sin filtro y con dos categorías: «Todas» y cada una con su conteo', () => {
    const { chips } = view(of('crecer', 'crecer', 'conectar'), 'todas')
    assert.deepEqual(chips, [
      { pressed: true, text: 'Todas 3' },
      { pressed: false, text: 'Crecer 2' },
      { pressed: false, text: 'Conectar 1' },
    ])
  })

  test('con un filtro ACTIVO la fila se queda aunque ya no haya piezas de esa categoría: así se puede quitar', () => {
    // La única pieza de «Aprender» se borró o cambió de categoría: solo queda «Crecer».
    // Antes la fila desaparecía, el filtro seguía puesto y la lista quedaba vacía sin salida.
    const { chips } = view(of('crecer', 'crecer', 'crecer'), 'aprender')
    assert.deepEqual(chips, [
      { pressed: false, text: 'Todas 3' },
      { pressed: false, text: 'Crecer 3' },
      { pressed: true, text: 'Aprender 0' },
    ])
  })

  test('con la lista entera vacía y un filtro activo también queda «Todas» para quitarlo', () => {
    const { chips } = view(of(), 'roots')
    assert.deepEqual(chips, [
      { pressed: false, text: 'Todas 0' },
      { pressed: true, text: 'Roots 0' },
    ])
  })

  test('con un filtro activo que sí tiene piezas no repite el chip', () => {
    const { chips } = view(of('crecer', 'conectar'), 'crecer')
    assert.deepEqual(chips.map((c) => c.text), ['Todas 2', 'Crecer 1', 'Conectar 1'])
    assert.equal(chips.filter((c) => c.pressed).length, 1)
  })
})
