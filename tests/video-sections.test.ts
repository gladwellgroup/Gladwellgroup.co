import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { PresentationSection } from '@/components/sections/presentation-section'
import { VideoSection } from '@/components/sections/video-section'
import { youtubeEmbed, youtubePoster } from '@/lib/youtube'

// Los dos videos de la landing: «¿Para quién es Gladwell?» (el de presentación, entre el hero y los pilares) y el de la
// comunidad. Los dos pasan por la misma fachada: antes de reproducir solo cargan su miniatura; el reproductor de YouTube
// (un iframe con ~1 MB de JavaScript de terceros) se monta con el clic. El clic mismo necesita un navegador y se prueba a mano;
// aquí se comprueba lo que el servidor escribe y que el código del clic siga como se espera.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
/** El HTML del servidor; React separa los nodos de texto adyacentes con un `<!-- -->` que el navegador no muestra. */
const html = (node: React.ReactElement) => renderToString(node).replace(/<!-- -->/g, '')
const heading = (page: string) => /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(page)?.[1].replace(/<[^>]+>/g, '')
/** El párrafo bajo el video: su etiqueta, sus clases y su texto. */
const caption = (page: string) => {
  const match = /(<p class="([^"]*)"[^>]*>)([\s\S]*?)<\/p>/.exec(page)
  return match && { tag: match[1], classes: match[2], text: match[3].replace(/<[^>]+>/g, '') }
}

describe('la presentación «¿Para quién es Gladwell?»', () => {
  const page = html(React.createElement(PresentationSection))

  test('es la sección #presentacion, con su eyebrow y el título exacto (tilde y los dos signos)', () => {
    assert.match(page, /<section id="presentacion"/)
    assert.match(page, />Presentación<\/span>/)
    assert.equal(heading(page), '¿Para quién es Gladwell?')
  })

  test('el botón de reproducir dice qué video es', () => {
    assert.match(page, /<button[^>]*aria-label="Reproducir el video de presentación de Gladwell"/)
  })

  test('muestra la miniatura que SÍ existe: sddefault (para este video maxresdefault responde 404)', () => {
    assert.match(page, /<img[^>]*src="https:\/\/img\.youtube\.com\/vi\/bkl3q80ErNQ\/sddefault\.jpg"/)
    assert.doesNotMatch(page, /maxresdefault/)
  })

  test('la miniatura es decorativa y espera a estar cerca de la pantalla', () => {
    const img = /<img[^>]*>/.exec(page)?.[0]
    assert.ok(img, 'no hay miniatura')
    assert.match(img, /alt=""/)
    assert.match(img, /loading="lazy"/)
  })

  test('antes del clic no hay iframe ni nada del reproductor de YouTube en el HTML', () => {
    assert.doesNotMatch(page, /<iframe/)
    assert.doesNotMatch(page, /youtube-nocookie|youtube\.com\/embed/)
  })

  test('el texto va bajo el video y escrito bien: «las brechas», «Latinoamérica» y el punto final', () => {
    assert.equal(
      caption(page)?.text,
      'Unimos emprendedores, academia y universitarios con el objetivo de cerrar las brechas en Latinoamérica.'
    )
    assert.ok(page.indexOf('<button') < page.indexOf(caption(page)!.tag), 'el texto debe ir después de la tarjeta del video')
  })
})

describe('el video de la comunidad (la misma fachada)', () => {
  const page = html(React.createElement(VideoSection))

  test('conserva su título, su texto y su etiqueta', () => {
    assert.match(page, /<section id="comunidad"/)
    assert.match(page, />Nuestra Comunidad<\/span>/)
    assert.equal(heading(page), 'Inspirados en Malcolm Gladwell')
    assert.match(page, /Se necesitan aproximadamente 10,000 horas de práctica deliberada de una actividad para alcanzar el nivel global\./)
    assert.match(page, /<button[^>]*aria-label="Reproducir video de la comunidad Gladwell"/)
  })

  test('sigue con su miniatura HD, ahora como imagen perezosa y no como fondo CSS (que se pide siempre)', () => {
    assert.match(page, /<img[^>]*src="https:\/\/img\.youtube\.com\/vi\/eckoiS-sRNQ\/maxresdefault\.jpg"[^>]*loading="lazy"/)
    assert.doesNotMatch(page, /background-image/)
  })

  test('tampoco trae el iframe antes del clic', () => {
    assert.doesNotMatch(page, /<iframe/)
  })
})

describe('el texto bajo cada video', () => {
  const pages = {
    presentación: html(React.createElement(PresentationSection)),
    comunidad: html(React.createElement(VideoSection)),
  }

  for (const [name, page] of Object.entries(pages)) {
    test(`${name}: 16 px en el celular, 20 desde md y 24 desde lg (a 16 px, bajo una tarjeta de 1 024 px, casi no se leía en escritorio)`, () => {
      const classes = (caption(page)?.classes ?? '').split(' ')
      for (const expected of ['text-base', 'md:text-xl', 'lg:text-2xl']) {
        assert.ok(classes.includes(expected), `${name}: falta ${expected} en «${classes.join(' ')}»`)
      }
      // Sigue gris y centrado, con aire entre líneas.
      for (const expected of ['text-center', 'text-muted-foreground', 'leading-relaxed']) assert.ok(classes.includes(expected), `${name}: falta ${expected}`)
    })
  }

  test('las dos secciones usan el mismo componente: no pueden separarse en tamaño ni en color', () => {
    for (const file of ['components/sections/presentation-section.tsx', 'components/sections/video-section.tsx']) {
      const source = read(file)
      assert.match(source, /<SectionCaption>/, `${file} debe usar SectionCaption`)
      assert.doesNotMatch(source, /<p[\s>]/, `${file} escribe su propio <p> en vez de SectionCaption`)
    }
  })
})

describe('lib/youtube', () => {
  test('el reproductor usa el dominio sin cookies y empieza a reproducir al montarse', () => {
    assert.equal(
      youtubeEmbed('bkl3q80ErNQ'),
      'https://www.youtube-nocookie.com/embed/bkl3q80ErNQ?autoplay=1&rel=0&modestbranding=1'
    )
  })

  test('la miniatura sale de img.youtube.com con la calidad que se pide', () => {
    assert.equal(youtubePoster('bkl3q80ErNQ', 'sddefault'), 'https://img.youtube.com/vi/bkl3q80ErNQ/sddefault.jpg')
    assert.equal(youtubePoster('eckoiS-sRNQ', 'maxresdefault'), 'https://img.youtube.com/vi/eckoiS-sRNQ/maxresdefault.jpg')
  })

  test('un id mal escrito falla en vez de armar una dirección rota (o una que escape de /vi/)', () => {
    for (const id of ['', 'bkl3q80ErN', 'bkl3q80ErNQQ', 'bkl3q80 ErNQ', 'bkl3q80ErN/', '../../etc/p', 'bkl3q80ErN?']) {
      assert.throws(() => youtubeEmbed(id), /no es un id de video de YouTube/, `embed «${id}»`)
      assert.throws(() => youtubePoster(id, 'sddefault'), /no es un id de video de YouTube/, `miniatura «${id}»`)
    }
  })
})

describe('VideoFacade: lo que solo hace el clic (se lee el código)', () => {
  const source = read('components/shared/video-facade.tsx')
  // Sin los comentarios: una palabra que solo aparece en uno no cuenta.
  const code = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  test('el iframe vive solo en la rama de «reproduciendo» y arranca apagado', () => {
    assert.match(code, /useState\(false\)/)
    assert.match(code, /!isPlaying \? \([\s\S]*?\) : \(\s*<iframe/)
    assert.equal((code.match(/<iframe/g) ?? []).length, 1)
  })

  test('manda el origen a YouTube (sin él el reproductor puede negarse) y lleva el título para los lectores de pantalla', () => {
    assert.match(code, /referrerPolicy="strict-origin-when-cross-origin"/)
    assert.match(code, /title=\{title\}/)
  })

  test('al reproducir el foco pasa al iframe: el botón desaparece y el foco se perdía en <body>', () => {
    assert.match(code, /useEffect\(\(\) => {\s*if \(isPlaying\) frame\.current\?\.focus\(\)\s*}, \[isPlaying\]\)/)
    assert.match(code, /<iframe\s+ref=\{frame\}/)
  })
})
