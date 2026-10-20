import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// La landing se mide (WebKit y Chromium con perfil móvil; ver AGENTS.md, «Imágenes y efectos pesados»).
// Lo que más pesaba al hacer scroll era, en Safari, un desenfoque de ~768 px (dos `blur-3xl` de la
// Galería) que se rehacía cada vez que entraba en pantalla —fotogramas de 100–130 ms—, y en todos los
// navegadores las fotos pedidas a 1 920–3 840 px por falta de `sizes`. Los fotogramas no se pueden
// contar sin un navegador, pero sí se puede evitar que alguien lo deshaga sin darse cuenta: estas
// pruebas leen el código.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

/** Sin comentarios: los de este código mencionan a propósito lo que se prohíbe. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name)) out.push(full)
    }
  }
  walk(path.join(ROOT, dir))
  return out
}
const appSources = () => [...sourceFiles('components'), ...sourceFiles('app')]

describe('landing: nada de desenfoques grandes', () => {
  test('no reaparecen blur-2xl, blur-3xl ni un blur-[…px] de 24 px o más', () => {
    const offenders = appSources()
      .filter((file) => /\bblur-(2xl|3xl)\b|\bblur-\[(?:2[4-9]|[3-9]\d|\d{3,})px\]/.test(code(fs.readFileSync(file, 'utf8'))))
      .map((file) => path.relative(ROOT, file))
    assert.deepEqual(
      offenders,
      [],
      'un `filter: blur()` grande se rehace al entrar en pantalla y traba Safari (100–130 ms por fotograma): usar `.glow-violet` / `.glow-cyan`'
    )
  })

  test('los brillos de fondo son degradados radiales, sin filter', () => {
    const css = read('app/globals.css')
    for (const name of ['glow-violet', 'glow-cyan']) {
      const rule = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css)
      assert.ok(rule, `falta .${name} en globals.css`)
      assert.match(rule[1], /radial-gradient\(/)
      assert.doesNotMatch(rule[1], /filter|blur\(/, `.${name} no puede llevar filter`)
    }
  })

  test('la Galería usa esos brillos y ya no los blur-3xl', () => {
    const gallery = code(read('components/sections/gallery-section.tsx'))
    assert.match(gallery, /glow-violet/)
    assert.match(gallery, /glow-cyan/)
    assert.doesNotMatch(gallery, /blur-3xl/)
  })
})

describe('landing: toda imagen declara su `sizes`', () => {
  // Sin `sizes`, next/image asume 100vw: una tarjeta de ~390 px pedía la foto a 1 920–3 840 px
  // (1,4 MB de más en escritorio, 2,2 MB en Retina) y decodificarla traba el scroll.
  const images = appSources().flatMap((file) =>
    [...code(fs.readFileSync(file, 'utf8')).matchAll(/<Image\b[\s\S]*?\/>/g)].map((m) => ({
      file: path.relative(ROOT, file),
      tag: m[0],
    }))
  )

  test('hay imágenes que revisar (si no, la prueba no vigila nada)', () => {
    assert.ok(images.length >= 4, `solo encontré ${images.length} <Image>`)
  })

  test('cada <Image> lleva `sizes` y no es el 100vw por defecto', () => {
    for (const { file, tag } of images) {
      const sizes = /\bsizes=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/.exec(tag)
      assert.ok(sizes, `${file}: <Image> sin \`sizes\``)
      const value = (sizes[1] ?? sizes[2] ?? sizes[3]).trim()
      assert.notEqual(value, '100vw', `${file}: \`sizes="100vw"\` es el valor por defecto, no el ancho real`)
    }
  })

  test('el móvil usa calc(100vw - 48px) y no un 100vw pelado (Next descartaría las variantes chicas)', () => {
    for (const file of ['components/sections/pillars-section.tsx', 'components/sections/gallery-section.tsx']) {
      assert.match(code(read(file)), /sizes="[^"]*calc\(100vw - 48px\)"/, file)
    }
  })
})

describe('landing: el hero pide una sola foto', () => {
  // Antes: 8 capas con `background-image` en línea; las fotos oscura y clara de cada breakpoint se
  // descargaban a la vez (1,5 MB en escritorio, 1,7 MB en móvil) aunque solo se viera una.
  const background = code(read('components/sections/hero-background.tsx'))
  const section = code(read('components/sections/hero-section.tsx'))

  test('usa getImageProps con fotos importadas, no un background-image en línea', () => {
    assert.match(background, /getImageProps\(/)
    for (const name of ['hero-bg-desktop', 'hero-bg-desktop-light', 'hero-bg-mobile', 'hero-bg-mobile-light']) {
      assert.match(background, new RegExp(`from "@/public/images/${name}\\.jpg"`), name)
    }
    for (const source of [background, section]) {
      assert.doesNotMatch(source, /backgroundImage|url\(['"]\/images\/hero/, 'volvió el background-image en línea')
    }
  })

  test('sin priority ni preload (precargarían los dos breakpoints) y una sola foto eager', () => {
    assert.doesNotMatch(background, /\bpriority\b|\bpreload\b/)
    // `layer(móvil, escritorio, eager)`: solo la del tema por defecto (oscuro) se pide con prisa; la clara es lazy
    const calls = [...background.matchAll(/\blayer\((\w+), (\w+), (true|false)\)/g)].map((m) => ({ mobile: m[1], eager: m[3] === 'true' }))
    assert.equal(calls.length, 2, 'una capa por tema')
    assert.deepEqual(calls.filter((call) => call.eager).map((call) => call.mobile), ['mobileDark'], 'solo la foto oscura es eager')
    assert.match(background, /loading: eager \? "eager" : "lazy"/)
  })

  test('la foto clara va oculta por defecto: no se pide hasta que alguien activa el tema claro', () => {
    assert.match(background, /<picture className="absolute inset-0 light:hidden">/)
    assert.match(background, /<picture className="absolute inset-0 hidden light:block">/)
    assert.match(read('app/globals.css'), /@custom-variant light \(&:is\(\.light \*\)\);/)
  })

  test('el fondo llega a HeroSection como children: las fotos no entran al JS del cliente', () => {
    assert.match(section, /\{children\}/)
    assert.doesNotMatch(section, /hero-background|getImageProps/)
    assert.match(code(read('app/page.tsx')), /<HeroSection>\s*<HeroBackground \/>\s*<\/HeroSection>/)
  })
})
