import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Arreglos de la limpieza de lint y de la revisión de detalles del portal que solo se ven con un navegador
// (un portapapeles que se niega, un diálogo que se reabre, un efecto que copia estado). No hay cómo
// ejercerlos sin DOM, así que estas pruebas leen el código para que nadie los deshaga sin darse cuenta.

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')
/** El código sin comentarios: una palabra que solo aparece en un comentario no cuenta. */
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('código de asistencia (QR)', () => {
  const source = code(read('components/portal/attendance-qr-section.tsx'))

  test('si el portapapeles se niega (permiso, sin HTTPS, Safari fuera de un toque) se avisa en vez de callar', () => {
    const copy = /async function handleCopy\(\) {[\s\S]*?\n  }\n/.exec(source)?.[0]
    assert.ok(copy, 'no encuentro handleCopy')
    assert.match(copy, /try\s*{\s*await navigator\.clipboard\.writeText\(url\)\s*}\s*catch\s*{[^}]*setError\(/)
    // y «Copiado» solo después de que haya funcionado
    assert.ok(copy.indexOf('setCopied(true)') > copy.indexOf('catch'), '«Copiado» salía aunque no se hubiera copiado')
  })

  test('el QR que termina tarde se descarta: el efecto lo cancela y la imagen solo vale para su token', () => {
    assert.match(source, /let cancelled = false/)
    assert.match(source, /return \(\) => {\s*cancelled = true\s*}/)
    assert.match(source, /if \(!cancelled\) setQr\(\{ token, dataUrl \}\)/)
    // La imagen que se pinta es la de ESTE token: si cambió, no queda el QR del enlace anterior.
    assert.match(source, /qr && qr\.token === token \? qr\.dataUrl : null/)
  })

  test('el efecto depende del token sin apagar la regla de dependencias', () => {
    const raw = read('components/portal/attendance-qr-section.tsx')
    assert.doesNotMatch(raw, /eslint-disable[^\n]*exhaustive-deps/)
    assert.match(source, /\[token\]\)/)
  })

  test('no copia estado desde un efecto: la URL se deriva y el QR solo se guarda cuando llega', () => {
    assert.doesNotMatch(source, /setUrl\(/)
    assert.doesNotMatch(source, /setQr\(null\)/)
  })
})

describe('diálogos de usuarios', () => {
  const source = code(read('components/portal/usuarios-table.tsx'))

  test('se reinician durante el render al abrirse o cambiar de persona, no desde un efecto', () => {
    assert.doesNotMatch(source, /useEffect/)
    assert.match(source, /const \[wasOpen, setWasOpen\] = useState\(open\)/)
    assert.equal((source.match(/const \[shownUser, setShownUser\] = useState\(user\)/g) ?? []).length, 2, 'editar y restablecer')
  })

  test('el de crear arranca en blanco al abrirse, y los otros dos cargan a la persona elegida', () => {
    assert.match(source, /if \(open !== wasOpen\) {\s*setWasOpen\(open\)\s*if \(open\) {[\s\S]*?setNombre\(''\)[\s\S]*?setGrantedModules\(\[\]\)/)
    assert.match(source, /setCargo\(user\.cargo \?\? ''\)/)
    assert.match(source, /setPassword\(''\)[\s\S]{0,80}setSuccess\(false\)/)
  })

  test('al cerrarse (user pasa a null) se conservan los datos: el diálogo no se vacía mientras se desvanece', () => {
    // El reinicio va dentro de `if (user)`: con `user` en null no se toca nada.
    assert.equal((source.match(/if \(user !== shownUser\) {\s*setShownUser\(user\)\s*if \(user\) {/g) ?? []).length, 2)
  })
})

describe('«ya estamos en el navegador» sin un efecto que lo copie', () => {
  for (const file of ['components/brand/theme-toggle.tsx', 'components/brand/brand-page-background.tsx', 'components/layout/navbar.tsx']) {
    test(`${path.basename(file)} usa useIsClient`, () => {
      const source = code(read(file))
      assert.match(source, /useIsClient\(\)/)
      assert.doesNotMatch(source, /setMounted/, 'volvió el useState + useEffect de «mounted»')
    })
  }

  test('useIsMobile lee el ancho de la ventana con useSyncExternalStore y avisa del cambio con matchMedia', () => {
    const source = code(read('hooks/use-mobile.ts'))
    assert.match(source, /useSyncExternalStore\(subscribe, getSnapshot, getServerSnapshot\)/)
    assert.match(source, /mql\.addEventListener\("change", onChange\)/)
    assert.doesNotMatch(source, /useEffect|useState/)
    // El servidor no conoce la pantalla: escritorio.
    assert.match(source, /getServerSnapshot = \(\) => false/)
  })

  test('el oyente de scroll de la barra de la landing es pasivo', () => {
    assert.match(code(read('components/layout/navbar.tsx')), /addEventListener\("scroll", handleScroll, \{ passive: true \}\)/)
  })
})

describe('efectos que sincronizan con el servidor, justificados', () => {
  for (const file of ['components/portal/deliverable-editor.tsx', 'components/portal/education-deliverable-editor.tsx']) {
    test(`${path.basename(file)}: el efecto que trae lo nuevo del servidor no pisa lo que se está escribiendo`, () => {
      const raw = read(file)
      // La excepción de lint está pegada a la línea y explicada: no es un `eslint-disable` suelto de archivo.
      assert.match(raw, /\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect -- ver arriba\n\s+setContentHtml\(initial\.content_html/)
      assert.doesNotMatch(raw, /\/\*\s*eslint-disable(?!-next-line)/, 'un `eslint-disable` de bloque apagaría la regla en todo el archivo')
      // Y conserva su guarda: con cambios sin guardar no se sobrescribe.
      assert.match(code(raw), /saveStatusRef\.current === 'dirty' \|\| saveStatusRef\.current === 'saving'\) return/)
    })
  }
})
