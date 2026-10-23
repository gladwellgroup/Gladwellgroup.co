import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { HERO_INDICATORS } from '@/lib/data/navigation'

// Los números del hero (01, 02…) llevan a las secciones de la landing EN ORDEN. El orden real lo fija
// app/page.tsx: si se mueve una sección y no estos datos, «02» salta a la tercera de la página y nada avisa.
// Se lee el código (como landing-perf.test.ts): renderizar la página entera exigiría `next/font`.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

/** El `id` de cada sección de la landing, en el orden en que app/page.tsx las pone. */
function sectionIds(): string[] {
  const page = read('app/page.tsx')
  const files = new Map(
    [...page.matchAll(/import \{ (\w+) \} from "@\/(components\/sections\/[\w-]+)"/g)].map(([, name, file]) => [name, `${file}.tsx`])
  )
  return [...page.matchAll(/<(\w+Section)\b/g)].map(([, name]) => {
    const file = files.get(name)
    assert.ok(file, `${name} no se importa desde components/sections en app/page.tsx`)
    const id = /<section\s+id="([^"]+)"/.exec(read(file))?.[1]
    assert.ok(id, `${file}: falta su <section id="…">`)
    return id
  })
}

describe('landing: los números del hero siguen el orden de las secciones', () => {
  test('cada número lleva a la sección que ocupa ese lugar en app/page.tsx', () => {
    assert.deepEqual(
      HERO_INDICATORS.map((indicator) => indicator.href),
      sectionIds().map((id) => `#${id}`),
      'HERO_INDICATORS (lib/data/navigation.ts) debe listar las secciones en el orden de app/page.tsx'
    )
  })

  test('los números son 01, 02… sin saltos', () => {
    assert.deepEqual(
      HERO_INDICATORS.map((indicator) => indicator.num),
      HERO_INDICATORS.map((_, index) => String(index + 1).padStart(2, '0'))
    )
  })
})

describe('landing: la presentación («¿Para quién es Gladwell?»)', () => {
  test('va entre el hero y los pilares', () => {
    assert.deepEqual(sectionIds().slice(0, 3), ['inicio', 'presentacion', 'pilares'])
  })
})
