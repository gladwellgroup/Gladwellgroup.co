import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { WalkingListProvider } from '@/components/providers/walking-list-provider'
import { TeamSection } from '@/components/sections/team-section'
import { FOUNDERS, type Founder } from '@/lib/data/founders'

// «Equipo base» de la landing, vista desde el HTML que escribe el servidor. Es un carrusel que avanza
// solo cada 5 s; quien no tiene foto reserva el espacio con sus iniciales, y una ruta de foto mal
// escrita se vería como una imagen rota en la página pública. Lo que mide de verdad —cuántas tarjetas
// se ven por pantalla, el orden de las vistas, los 5 s, las pausas, filas, anchos, saltos de línea y
// tema claro/oscuro en WebKit y Chromium— se corre a mano.

const ROOT = process.cwd()
const NBSP = '\u00a0'
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

/** El HTML completo de la sección (por defecto con la lista real). React separa los nodos de texto
 *  adyacentes con un `<!-- -->` que el navegador no muestra. */
function render(members?: Founder[]): string {
  return renderToString(
    React.createElement(WalkingListProvider, null, React.createElement(TeamSection, { members }))
  ).replace(/<!-- -->/g, '')
}

/** El HTML de cada tarjeta, en el orden de la lista. */
function cards(members?: Founder[]): string[] {
  return render(members)
    .split('<article')
    .slice(1)
    .map((chunk) => chunk.split('</article>')[0])
    .map((chunk) => chunk.slice(chunk.indexOf('>') + 1)) // sin el resto de la etiqueta de apertura
}

/** `&amp;` y compañía: el HTML escapa lo que el texto de los datos trae tal cual («CTO & Filmmaker»). */
const decode = (html: string) =>
  html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")

/** Solo el texto que ve la persona. `\s` también recoge los espacios de no separación: se igualan
 *  a un espacio normal, y `plain` hace lo mismo con un texto de los datos para poder compararlos. */
const textOf = (html: string) => plain(decode(html.replace(/<[^>]+>/g, ' ')))
const plain = (text: string) => text.replace(/\s+/g, ' ').trim()

/** La primera letra de las dos primeras palabras. */
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()

// Un caso de cada combinación, aparte de los datos reales: así el espacio reservado y el cargo sin
// rol se prueban aunque hoy a alguien le falte —o no— la foto.
const SIN_FOTO_SIN_ROL: Founder = { name: 'Mariana Nova Martínez', title: 'Marketing Director', description: 'Sin foto ni rol.' }
const UN_SOLO_NOMBRE: Founder = { name: 'Madonna', title: 'Artista', description: 'Un solo nombre.' }
const CON_FOTO_Y_ROL: Founder = { name: 'Ana Prueba', role: 'Cofounder', title: 'CTO', description: 'Con foto y rol.', image: '/images/founder-2.jpg' }
const SIN_DESCRIPCION: Founder = { name: 'Persona Sin Texto', title: 'Operations Lead' }

describe('landing: equipo base', () => {
  test('hay una tarjeta por persona, en el orden de la lista, con su nombre, su cargo y su descripción', () => {
    const html = cards()
    assert.equal(html.length, FOUNDERS.length)
    FOUNDERS.forEach((person, i) => {
      const text = textOf(html[i])
      assert.ok(text.includes(person.name), `falta el nombre de ${person.name}`)
      assert.ok(text.includes(person.title), `falta el cargo de ${person.name}`)
      if (person.description) assert.ok(text.includes(plain(person.description)), `falta la descripción de ${person.name}`)
    })
  })

  test('los dos roles nuevos van tras los co-fundadores, «Operations Lead» antes que «CTO & Filmmaker»', () => {
    const titles = FOUNDERS.map((p) => p.title)
    const ops = titles.indexOf('Operations Lead')
    const cto = titles.indexOf('CTO & Filmmaker')
    assert.notEqual(ops, -1, 'falta Operations Lead')
    assert.notEqual(cto, -1, 'falta CTO & Filmmaker')
    assert.ok(ops < cto, 'Operations Lead va antes que CTO & Filmmaker')
    const lastCofounder = Math.max(...FOUNDERS.map((p, i) => (p.role ? i : -1)))
    assert.ok(ops > lastCofounder, 'los roles nuevos van después de los co-fundadores')
    // El cargo llega al HTML con el «&» ya escapado.
    assert.ok(textOf(cards()[cto]).includes('CTO & Filmmaker'))
  })

  test('quien tiene foto en los datos la muestra con su nombre como alt; quien no, reserva el espacio con sus iniciales', () => {
    const html = cards()
    FOUNDERS.forEach((person, i) => {
      const imgs = (html[i].match(/<img\b/g) ?? []).length
      assert.equal(imgs, person.image ? 1 : 0, person.name)
      if (person.image) assert.ok(html[i].includes(`alt="${person.name}"`), `${person.name}: el alt lleva su nombre`)
      else assert.ok(textOf(html[i]).startsWith(initials(person.name)), `${person.name}: faltan sus iniciales`)
    })
  })

  test('el cargo lleva el rol delante solo si lo tiene: sin rol no queda un « ·» suelto', () => {
    const [sinRol, conRol] = cards([SIN_FOTO_SIN_ROL, CON_FOTO_Y_ROL]).map(textOf)
    assert.ok(!sinRol.includes('·'), 'sin rol, la tarjeta no debe traer un «·»')
    assert.ok(conRol.includes('Cofounder · CTO'), 'con rol, va «rol · cargo»')
    // Y en los datos reales, los dos co-fundadores siguen con su rol.
    cards().forEach((card, i) => {
      const { role, title } = FOUNDERS[i]
      if (role) assert.ok(textOf(card).includes(`${role} · ${title}`), FOUNDERS[i].name)
    })
  })

  test('quien no tiene foto reserva el espacio con las iniciales de sus dos primeras palabras, sin pedir ninguna imagen', () => {
    const [sinFoto, unNombre, conFoto] = cards([SIN_FOTO_SIN_ROL, UN_SOLO_NOMBRE, CON_FOTO_Y_ROL])
    for (const card of [sinFoto, unNombre]) {
      assert.equal((card.match(/<img\b/g) ?? []).length, 0, 'sin foto no hay <img>')
      // Decorativo: el nombre ya está en el título de la tarjeta.
      assert.match(card, /aria-hidden="true"[^>]*>\s*<span[^>]*>[^<]*<\/span>/)
    }
    assert.ok(textOf(sinFoto).startsWith('MN '), `«Mariana Nova Martínez» → MN, y salió «${textOf(sinFoto).slice(0, 12)}»`)
    assert.ok(textOf(unNombre).startsWith('M '), `«Madonna» → M, y salió «${textOf(unNombre).slice(0, 12)}»`)
    // Con foto: su imagen con el nombre como alt y ningún espacio reservado.
    assert.equal((conFoto.match(/<img\b/g) ?? []).length, 1)
    assert.ok(conFoto.includes('alt="Ana Prueba"'))
    assert.ok(!conFoto.includes('aria-hidden="true"'), 'con foto no hay espacio reservado')
  })

  test('sin descripción la tarjeta no dibuja un párrafo vacío', () => {
    const [vacia, conTexto] = cards([SIN_DESCRIPCION, UN_SOLO_NOMBRE])
    assert.ok(!/<p[\s>]/.test(vacia), 'sin descripción no hay <p>')
    assert.ok(/<p[\s>]/.test(conTexto), 'con descripción sí')
    // Lo mismo en los datos reales.
    cards().forEach((card, i) => {
      if (!FOUNDERS[i].description) assert.ok(!/<p[\s>]/.test(card), `${FOUNDERS[i].name} no tiene descripción`)
    })
  })

  test('la foto se ancla al círculo interior y no al contenedor del aro: si no, lo tapa', () => {
    // `<Image fill>` es `position: absolute; inset: 0`, y se ancla al ancestro posicionado más cercano. Con el círculo
    // interior sin `relative` ese era el contenedor del degradado (con `p-1`): la foto cubría los 4 px del aro.
    const [conFoto] = cards([CON_FOTO_Y_ROL])
    const parent = /<div class="([^"]*)"[^>]*><img\b/.exec(conFoto)
    assert.ok(parent, 'la foto va dentro de un contenedor propio')
    assert.match(parent[1], /(^|\s)relative(\s|$)/, 'el contenedor directo de la foto debe ser `relative`')
    assert.match(parent[1], /(^|\s)overflow-hidden(\s|$)/, 'y recortar la foto al círculo')
    // El aro es el contenedor de fuera: el degradado con el relleno que deja ver su borde.
    assert.match(conFoto, /class="[^"]*\bp-1\b[^"]*bg-gradient-to-br/, 'el aro (degradado con `p-1`) sigue rodeando a la foto')
  })

  test('cada foto declarada existe en public/ (una ruta mal escrita sería una imagen rota)', () => {
    for (const person of FOUNDERS) {
      if (!person.image) continue
      assert.ok(person.image.startsWith('/images/'), `${person.name}: la foto va en public/images/`)
      assert.ok(
        fs.existsSync(path.join(ROOT, 'public', person.image)),
        `${person.name}: no existe public${person.image}`
      )
    }
  })

  test('los nombres son únicos: son la `key` de cada tarjeta', () => {
    assert.equal(new Set(FOUNDERS.map((p) => p.name)).size, FOUNDERS.length)
  })

  test('el cierre de las descripciones que lo llevan no se parte: sus palabras van con espacios de no separación', () => {
    // Sin esos espacios, al saltar de línea quedaba «y reír.» (Mariana) o «tech.» (Jhonattan, con 320 px de
    // ancho: escritorio y celulares desde 390 px) sola en la última. Un editor o un formateador que los
    // cambie por espacios normales lo deshace sin que se note.
    const closings: [string, string][] = [
      ['Mariana Nova', 'para crear, crecer y reír.'],
      ['Jhonattan', 'ecosistema tech.'],
    ]
    for (const [who, phrase] of closings) {
      const index = FOUNDERS.findIndex((p) => p.name.startsWith(who))
      assert.notEqual(index, -1, `${who} ya no está en la lista`)
      const closing = phrase.replace(/ /g, NBSP)
      assert.ok((FOUNDERS[index].description ?? '').endsWith(` ${closing}`), `${who}: el cierre debe ir unido con U+00A0`)
      // …y llegan tal cual al HTML (React no los convierte en espacios normales).
      assert.ok(cards()[index].includes(closing), `${who}: el HTML pierde los espacios de no separación`)
    }
  })

  test('ninguna descripción pasa de 220 caracteres: una más larga hace más alta a su tarjeta y, con ella, a todo el carrusel', () => {
    // Las tarjetas del carrusel miden todas lo mismo (manda la más alta). Con 201–217 caracteres el párrafo cabe en
    // 6 líneas a 304–320 px de ancho; el de Ana Sofia, con 267, ocupaba 7–8 y subía 26–52 px la altura de todo el carrusel.
    const MAX_DESCRIPTION = 220
    for (const person of FOUNDERS) {
      const length = (person.description ?? '').length
      assert.ok(length <= MAX_DESCRIPTION, `${person.name}: ${length} caracteres (máximo ${MAX_DESCRIPTION})`)
    }
  })
})

describe('landing: equipo base como carrusel', () => {
  test('es una región con nombre y cada persona es un slide «N de M»', () => {
    const html = render()
    assert.equal((html.match(/aria-roledescription="carousel"/g) ?? []).length, 1)
    assert.ok(/role="region"[^>]*aria-label="Equipo base"|aria-label="Equipo base"[^>]*role="region"/.test(html), 'la región lleva su nombre')
    const slides = [...html.matchAll(/aria-roledescription="slide"[^>]*aria-label="(\d+) de (\d+)"|aria-label="(\d+) de (\d+)"[^>]*aria-roledescription="slide"/g)]
    assert.equal(slides.length, FOUNDERS.length, 'un slide por persona')
    slides.forEach((m, i) => {
      assert.equal(Number(m[1] ?? m[3]), i + 1)
      assert.equal(Number(m[2] ?? m[4]), FOUNDERS.length)
    })
  })

  test('los controles traen flechas, un punto por tarjeta y pausa, con etiquetas en español, ya en el HTML del servidor', () => {
    const html = render()
    for (const label of ['Ver anterior', 'Ver siguiente', 'Pausar el avance automático']) {
      assert.equal((html.match(new RegExp(`aria-label="${label}"`, 'g')) ?? []).length, 1, label)
    }
    for (let n = 1; n <= FOUNDERS.length; n++) {
      assert.ok(html.includes(`aria-label="Ir a la vista ${n} de ${FOUNDERS.length}"`), `falta el punto ${n}`)
    }
    assert.ok(!html.includes(`Ir a la vista ${FOUNDERS.length + 1} de`), 'ni un punto de más')
  })

  test('la pausa va en una fila propia, centrada bajo el selector, y se oculta por CSS si el sistema pide menos movimiento', () => {
    // El ancho lo decide el navegador (se mide a mano); esto fija lo que no depende de él: la fila del selector
    // se cierra antes de abrir la pausa, y el contenedor apila y centra.
    const html = render()
    const controls = html.slice(html.indexOf('data-slot="team-carousel-controls"'))
    const next = controls.indexOf('aria-label="Ver siguiente"')
    const pause = controls.indexOf('aria-label="Pausar el avance automático"')
    assert.ok(next !== -1 && pause > next, 'la pausa va después de las flechas')
    assert.match(controls.slice(next, pause), /<\/button><\/div><button type="button" $/, 'la pausa no comparte fila con las flechas')
    const container = controls.slice(0, controls.indexOf('>'))
    assert.ok(/\bflex-col\b/.test(container) && /\bitems-center\b/.test(container), 'las filas se apilan y se centran')
    // El servidor no conoce `prefers-reduced-motion` y manda el botón: sin esta clase la sección encogería
    // cuando React lo quita al hidratar.
    const button = controls.slice(controls.lastIndexOf('<button', pause), controls.indexOf('>', pause))
    assert.match(button, /\bmotion-reduce:hidden\b/)
  })

  test('los puntos y los slides siguen a la lista que se le pasa', () => {
    const html = render([SIN_FOTO_SIN_ROL, UN_SOLO_NOMBRE, CON_FOTO_Y_ROL])
    assert.ok(html.includes('aria-label="Ir a la vista 3 de 3"'))
    assert.ok(!html.includes('de 5"'), 'no deben sobrar etiquetas de la lista real')
    assert.equal((html.match(/aria-roledescription="slide"/g) ?? []).length, 3)
  })

  test('el avance automático es de 5 s y se aparta si el sistema pide menos movimiento', () => {
    // El tiempo y las pausas solo se ven en un navegador; esto fija lo que alguien podría cambiar
    // sin querer: la cadencia que se pidió y el respeto a prefers-reduced-motion.
    assert.match(read('components/sections/team-carousel-controls.tsx'), /const AUTOPLAY_MS = 5000\b/)
    const hook = read('hooks/use-carousel-autoplay.ts')
    assert.match(hook, /prefers-reduced-motion: reduce/)
    assert.match(hook, /document\.hidden/, 'pausa con la pestaña oculta')
    assert.match(hook, /IntersectionObserver/, 'solo avanza con la sección a la vista')
  })

  test('dos arreglos que solo se ven en un navegador: el paso se mide del diseño y el ratón se suelta sin `pointerleave`', () => {
    // 1) Cuántas posiciones avanza cada paso sale del ancho real de las tarjetas, no de un corte de pantalla copiado:
    //    los `basis-*` de la sección cortan en `rem` y, con otra letra base en el navegador, caen en otro ancho
    //    (con el corte copiado, el paso de dos se saltaba tarjetas cuando solo se veía una).
    const controls = read('components/sections/team-carousel-controls.tsx')
    assert.doesNotMatch(controls, /matchMedia/, 'el paso no copia un ancho de pantalla')
    assert.match(controls, /offsetWidth/, 'el paso se mide del ancho de una tarjeta')
    // 2) WebKit no emite `pointerleave` si cambia el elemento bajo el puntero (el icono de «Pausar» → «Reanudar»):
    //    `hovered` se quedaba pegado y el avance no volvía. El movimiento fuera de la región lo suelta.
    assert.match(read('hooks/use-carousel-autoplay.ts'), /addEventListener\('pointermove'/)
  })
})
