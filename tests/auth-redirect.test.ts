import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { safeNextPath } from '@/lib/auth/redirect'

// `/api/auth/callback?next=…` redirigía a `${origin}${next}`: con `next=@otro.com` el navegador lee
// `https://www.gladwellgroup.co@otro.com` como el host `otro.com`. `safeNextPath` deja pasar solo rutas del
// propio sitio. Los caracteres de control y la barra invertida se arman con `String.fromCharCode` para que
// ningún editor los convierta sin que se note.

const TAB = String.fromCharCode(9)
const NEWLINE = String.fromCharCode(10)
const BACKSLASH = String.fromCharCode(92)

const HOSTILES = [
  '@otro.com',
  '.otro.com',
  'otro.com',
  'https://otro.com',
  'http://otro.com/x',
  '//otro.com',
  '///otro.com',
  `/${BACKSLASH}otro.com`,
  `${BACKSLASH}${BACKSLASH}otro.com`,
  '/..//otro.com',
  'javascript:alert(1)',
  `/${TAB}/otro.com`,
  ` /dashboard`,
  `${NEWLINE}/dashboard`,
]

describe('safeNextPath', () => {
  test('sin valor, o vacío, usa el destino por defecto', () => {
    assert.equal(safeNextPath(null), '/dashboard')
    assert.equal(safeNextPath(undefined), '/dashboard')
    assert.equal(safeNextPath(''), '/dashboard')
  })

  test('deja pasar las rutas del sitio y conserva la consulta y el ancla', () => {
    assert.equal(safeNextPath('/dashboard'), '/dashboard')
    assert.equal(safeNextPath('/super/parrilla'), '/super/parrilla')
    assert.equal(safeNextPath('/super/parrilla?vista=tabla#hoy'), '/super/parrilla?vista=tabla#hoy')
    assert.equal(safeNextPath('/perfil'), '/perfil')
  })

  test('rechaza todo lo que el navegador leería como otro origen', () => {
    for (const next of HOSTILES) assert.equal(safeNextPath(next), '/dashboard', JSON.stringify(next))
  })

  test('el destino por defecto se puede cambiar', () => {
    assert.equal(safeNextPath('@otro.com', '/perfil'), '/perfil')
    assert.equal(safeNextPath(null, '/perfil'), '/perfil')
  })

  test('compuesta con el origen real, la redirección nunca sale del sitio', () => {
    const origin = 'https://www.gladwellgroup.co'
    for (const next of [...HOSTILES, '/dashboard', '/a/b?c=d#e', '/%2F/otro.com', '/%5Cotro.com']) {
      assert.equal(new URL(`${origin}${safeNextPath(next)}`).origin, origin, JSON.stringify(next))
    }
  })
})
