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
