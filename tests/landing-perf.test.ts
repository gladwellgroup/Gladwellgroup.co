import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

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

describe('landing: cabecera, footer y caché de imágenes', () => {
  test('la cabecera fija solo transiciona color, borde y sombra', () => {
    const header = /<header[\s\S]*?>/.exec(code(read('components/layout/navbar.tsx')))?.[0]
    assert.ok(header, 'no encontré el <header> de la barra')
    assert.doesNotMatch(header, /transition-all/, '`transition-all` animaba también el backdrop-filter al primer scroll')
    assert.match(header, /transition-\[background-color,border-color,box-shadow\]/)
  })

  test('el enlace «Iniciar sesión» del footer no precarga el login (~295 KB de JS)', () => {
    assert.match(code(read('components/layout/footer.tsx')), /<Link href="\/login" prefetch=\{false\}/)
  })

  test('las imágenes se cachean al menos un día en el CDN (minimumCacheTTL)', () => {
    const ttl = /minimumCacheTTL:\s*(\d+)/.exec(code(read('next.config.mjs')))
    assert.ok(ttl, 'falta images.minimumCacheTTL en next.config.mjs')
    assert.ok(Number(ttl[1]) >= 86_400, `minimumCacheTTL=${ttl[1]} es menos de un día`)
  })
})

describe('service worker (public/sw.js)', () => {
  const ORIGIN = 'https://sitio.test'
  const CACHED = { cached: true }
  const NETWORK = { network: true, ok: false, clone() { return this } }

  /** Carga el worker en un contexto aislado y devuelve cómo se comporta. */
  function load(cacheKeys: string[] = []) {
    const listeners: Record<string, (event: unknown) => void> = {}
    const deleted: string[] = []
    let fetches = 0
    vm.runInNewContext(read('public/sw.js'), {
      URL,
      self: { location: { origin: ORIGIN }, addEventListener: (type: string, fn: (event: unknown) => void) => { listeners[type] = fn } },
      caches: {
        keys: async () => cacheKeys,
        delete: async (key: string) => { deleted.push(key); return true },
        match: async () => undefined,
        // Todo lo que se pide a la caché ya está guardado: así se ve quién la usa primero.
        open: async () => ({ match: async () => CACHED, put: async () => undefined }),
      },
      fetch: async () => { fetches += 1; return NETWORK },
      Response: { error: () => ({}) },
    })
    return {
      /** Pide `pathname` al worker: ¿lo toma?, ¿con qué responde? y ¿fue a la red? */
      async request(pathname: string, method = 'GET') {
        let answer: Promise<unknown> | undefined
        const before = fetches
        listeners.fetch({ request: { method, url: `${ORIGIN}${pathname}` }, respondWith: (promise: Promise<unknown>) => { answer = promise } })
        const body = answer ? await answer : undefined
        return { handled: answer !== undefined, body, network: fetches > before }
      },
      async activate() {
        let work: Promise<unknown> = Promise.resolve()
        listeners.activate({ waitUntil: (promise: Promise<unknown>) => { work = promise } })
        await work
        return deleted
      },
    }
  }

  test('no intercepta las imágenes: ni /_next/image ni /images/', async () => {
    const sw = load()
    for (const route of ['/_next/image?url=%2Fimages%2Fa.jpg&w=640&q=75', '/images/hero-bg-desktop.jpg', '/_next/image']) {
      assert.equal((await sw.request(route)).handled, false, route)
    }
  })

  test('los estáticos de build y de marca van primero a la caché, sin tocar la red', async () => {
    const sw = load()
    for (const route of ['/_next/static/chunks/a.js', '/brand/logo.png', '/icon-192.png']) {
      const answer = await sw.request(route)
      assert.equal(answer.handled, true, route)
      assert.equal(answer.body, CACHED, `${route}: debía salir de la caché`)
      assert.equal(answer.network, false, `${route}: no debía ir a la red`)
    }
  })

  test('las páginas públicas van primero a la red (con la caché solo de respaldo sin conexión)', async () => {
    const answer = await load().request('/')
    assert.equal(answer.handled, true)
    assert.equal(answer.network, true, 'debía pedir a la red')
    assert.equal(answer.body, NETWORK, 'con conexión responde la red, no la copia guardada')
  })

  test('nunca toca rutas autenticadas ni peticiones que no sean GET', async () => {
    const sw = load()
    for (const route of ['/dashboard', '/api/parrilla', '/admin/parrilla', '/super/parrilla', '/comunidad/x', '/perfil']) {
      assert.equal((await sw.request(route)).handled, false, route)
    }
    assert.equal((await sw.request('/', 'POST')).handled, false)
  })

  test('al activarse borra las cachés de versiones anteriores (la v1 guardaba copias de las imágenes)', async () => {
    assert.match(read('public/sw.js'), /const CACHE_NAME = 'gladwell-v2'/)
    const deleted = await load(['gladwell-v1', 'gladwell-v2']).activate()
    assert.deepEqual(deleted, ['gladwell-v1'])
  })
})

describe('landing: el fondo decorativo es un componente de servidor y sin sombras enormes', () => {
  // Antes: `use client` + `useTheme` + `mounted`, 10 capas con fundido de 500 ms justo tras hidratar,
  // `transition-all` en cada círculo, 8 `box-shadow` de 50–150 px de desenfoque y el relleno translúcido
  // de los círculos mayores en el propio elemento (lo que más costaba pintar en Chrome/Android).
  const background = code(read('components/layout/content-background.tsx'))
  const orbs = code(read('lib/data/decor-orbs.ts'))

  test('sin use client, useTheme ni estado: el tema lo resuelven las variantes light:', () => {
    assert.doesNotMatch(background, /["']use client["']|useTheme|useState|useEffect/)
    assert.match(background, /light:bg-\[#f5f7fa\]/)
  })

  test('sin transition-all ni fundido de entrada', () => {
    assert.doesNotMatch(background, /transition-all|transition-opacity|opacity-0/)
    assert.doesNotMatch(orbs, /transition-all|transition-opacity|opacity-0/)
  })

  test('cada círculo es una caja vacía: ni box-shadow, ni relleno, ni borde en el elemento', () => {
    for (const source of [background, orbs]) {
      assert.doesNotMatch(source, /shadow-\[|\bborder-2\b|\brounded-full\b|\bbg-\[#(?:7C3AED|06B6D4)\]/, 'el relleno translúcido en el elemento costaba lo mismo que la sombra')
    }
    assert.match(background, /className=\{`decor-orb pointer-events-none absolute \$\{orb\.place\}`\}/)
  })

  test('el degradado de cada tema se pinta en .decor-orb::before', () => {
    const css = read('app/globals.css')
    assert.match(css, /\.decor-orb::before\s*\{[^}]*background-image:\s*var\(--orb-dark\)/)
    assert.match(css, /\.light \.decor-orb::before\s*\{[^}]*background-image:\s*var\(--orb-light\)/)
    assert.match(background, /"--orb-dark":/)
    assert.match(background, /"--orb-light":/)
  })
})
