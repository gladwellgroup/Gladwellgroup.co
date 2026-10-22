import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { WalkingListProvider } from '@/components/providers/walking-list-provider'
import { TeamSection } from '@/components/sections/team-section'
import { FOUNDERS, type Founder } from '@/lib/data/founders'

// «Equipo base» de la landing, vista desde el HTML que escribe el servidor. Quien no tiene foto
// reserva el espacio con sus iniciales, y una ruta de foto mal escrita se vería como una imagen
// rota en la página pública. Lo que mide de verdad —filas, anchos, saltos de línea y tema
// claro/oscuro en WebKit— se corre a mano.

const ROOT = process.cwd()
const NBSP = ' '

/** El HTML de cada tarjeta, en el orden de la lista (por defecto, la real). React separa los
 *  nodos de texto adyacentes con un `<!-- -->` que el navegador no muestra. */
function cards(members?: Founder[]): string[] {
  const html = renderToString(
    React.createElement(WalkingListProvider, null, React.createElement(TeamSection, { members }))
  ).replace(/<!-- -->/g, '')
  return html
    .split('<article')
    .slice(1)
    .map((chunk) => chunk.split('</article>')[0])
    .map((chunk) => chunk.slice(chunk.indexOf('>') + 1)) // sin el resto de la etiqueta de apertura
}

/** Solo el texto que ve la persona. `\s` también recoge los espacios de no separación: se igualan
 *  a un espacio normal, y `plain` hace lo mismo con un texto de los datos para poder compararlos. */
const textOf = (html: string) => plain(html.replace(/<[^>]+>/g, ' '))
const plain = (text: string) => text.replace(/\s+/g, ' ').trim()

// Un caso de cada combinación, aparte de los datos reales: hoy todos tienen foto, así que el
// espacio reservado ya no se vería en la lista de verdad.
const SIN_FOTO_SIN_ROL: Founder = { name: 'Mariana Nova Martínez', title: 'Marketing Director', description: 'Sin foto ni rol.' }
const UN_SOLO_NOMBRE: Founder = { name: 'Madonna', title: 'Artista', description: 'Un solo nombre.' }
const CON_FOTO_Y_ROL: Founder = { name: 'Ana Prueba', role: 'Co-Fundadora', title: 'CTO', description: 'Con foto y rol.', image: '/images/founder-2.jpg' }

describe('landing: equipo base', () => {
  test('hay una tarjeta por persona, en el orden de la lista, con su nombre, su cargo y su descripción', () => {
    const html = cards()
    assert.equal(html.length, FOUNDERS.length)
    FOUNDERS.forEach((person, i) => {
      const text = textOf(html[i])
      assert.ok(text.includes(person.name), `falta el nombre de ${person.name}`)
      assert.ok(text.includes(person.title), `falta el cargo de ${person.name}`)
      assert.ok(text.includes(plain(person.description)), `falta la descripción de ${person.name}`)
    })
  })

  test('quien tiene foto en los datos la muestra con su nombre como alt; quien no, no pide ninguna imagen', () => {
    const html = cards()
    FOUNDERS.forEach((person, i) => {
      const imgs = (html[i].match(/<img\b/g) ?? []).length
      assert.equal(imgs, person.image ? 1 : 0, person.name)
      if (person.image) assert.ok(html[i].includes(`alt="${person.name}"`), `${person.name}: el alt lleva su nombre`)
    })
  })

  test('el cargo lleva el rol delante solo si lo tiene: sin rol no queda un « ·» suelto', () => {
    const [sinRol, conRol] = cards([SIN_FOTO_SIN_ROL, CON_FOTO_Y_ROL]).map(textOf)
    assert.ok(!sinRol.includes('·'), 'sin rol, la tarjeta no debe traer un «·»')
    assert.ok(conRol.includes('Co-Fundadora · CTO'), 'con rol, va «rol · cargo»')
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

  test('el cierre de la descripción de Mariana no se parte: sus palabras van con espacios de no separación', () => {
    const index = FOUNDERS.findIndex((p) => p.name.startsWith('Mariana Nova'))
    assert.notEqual(index, -1, 'Mariana ya no está en la lista')
    // Sin esos espacios, al saltar de línea quedaba «y reír.» sola en la última. Un editor o un
    // formateador que los cambie por espacios normales lo deshace sin que se note.
    const closing = `para${NBSP}crear,${NBSP}crecer${NBSP}y${NBSP}reír.`
    assert.ok(FOUNDERS[index].description.endsWith(` ${closing}`), 'el cierre debe ir unido con U+00A0')
    // …y llegan tal cual al HTML (React no los convierte en espacios normales).
    assert.ok(cards()[index].includes(closing))
  })
})
