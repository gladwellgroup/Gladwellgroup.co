import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PERMISSIONS, getPermissions } from '@/lib/permissions/matrix'
import { MODULES, MODULE_LABELS, MODULE_PERMISSIONS } from '@/lib/permissions/modules'

// La matriz de permisos del documento de producto (§5 de docs/plataforma-historia-y-usuarios.md) se
// escribió a mano y se quedó atrás: hablaba de «v1» cuando los módulos, Encuentros, la Parrilla o el
// calendario aún no existían. Aquí el código manda: si cambia lo que alguien recibe, o se añade un
// permiso o un módulo, el documento tiene que decir lo mismo o esta prueba falla.

const ROOT = process.cwd()
const doc = fs.readFileSync(path.join(ROOT, 'docs/plataforma-historia-y-usuarios.md'), 'utf8')

/** El texto de una sección: desde su encabezado hasta el siguiente de su mismo nivel o superior. */
function section(heading: string): string {
  const start = doc.indexOf(heading)
  assert.notEqual(start, -1, `falta «${heading}» en el documento`)
  const level = /^#+/.exec(heading)![0].length
  const rest = doc.slice(start + heading.length)
  const next = new RegExp(`\\n#{1,${level}} `).exec(rest)
  return next ? rest.slice(0, next.index) : rest
}

/** Las filas de una tabla cuyo primer dato va entre comillas invertidas, ya partidas en celdas. */
const rowsOf = (markdown: string) =>
  markdown
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))

const permissions = section('### 5.1 ')
const modules = section('### 5.2 ')
const permissionRows = rowsOf(permissions)
const code = (value: string) => `\`${value}\``

describe('documento de producto: matriz de permisos (§5.1)', () => {
  const all = Object.values(PERMISSIONS)
  const granted = new Set(Object.values(MODULE_PERMISSIONS).flat())

  test('cada permiso del código tiene una fila, y solo una', () => {
    for (const permission of all) {
      const rows = permissionRows.filter((row) => row[0] === code(permission))
      assert.equal(rows.length, 1, `${permission}: ${rows.length} filas en §5.1 (debe haber una)`)
    }
  })

  test('no queda ningún permiso que el código ya no tenga', () => {
    const known = new Set<string>(all.map(code))
    for (const row of permissionRows) {
      assert.ok(known.has(row[0]), `${row[0]} está en §5.1 pero ya no existe en lib/permissions/matrix.ts`)
    }
  })

  test('lo que cada rol recibe coincide con el código: base fija «sí», por módulo «módulo», si no «no»', () => {
    const adminBase = new Set(getPermissions('community_admin'))
    const memberBase = new Set(getPermissions('community_member'))
    for (const permission of all) {
      const [, , superAdmin, admin, member] = permissionRows.find((row) => row[0] === code(permission))!
      assert.equal(superAdmin, 'sí', `${permission}: el super_admin los tiene todos`)
      const expectedAdmin = adminBase.has(permission) ? 'sí' : granted.has(permission) ? 'módulo' : 'no'
      assert.equal(admin, expectedAdmin, `${permission}: community_admin`)
      assert.equal(member, memberBase.has(permission) ? 'sí' : 'no', `${permission}: community_member`)
    }
  })

  test('los marcados «Reservado» son exactamente los que ninguna pantalla, ruta ni menú comprueba', () => {
    // Los literales de permiso que aparecen fuera de lib/permissions: lo que el código realmente exige.
    const used = new Set<string>()
    const roots = ['app', 'components', 'lib', 'hooks']
    const files = [
      ...roots.flatMap((dir) =>
        (fs.readdirSync(path.join(ROOT, dir), { recursive: true }) as string[])
          .map((file) => path.join(dir, file))
          .filter((file) => /\.(ts|tsx)$/.test(file) && !file.startsWith(path.join('lib', 'permissions') + path.sep))
      ),
      'proxy.ts',
    ]
    for (const file of files) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
      for (const permission of all) {
        if (text.includes(`'${permission}'`) || text.includes(`"${permission}"`)) used.add(permission)
      }
    }
    const unchecked = all.filter((permission) => !used.has(permission)).sort()
    const reserved = permissionRows
      .filter((row) => row[1].includes('**Reservado**'))
      .map((row) => row[0].replaceAll('`', ''))
      .sort()
    assert.deepEqual(
      reserved,
      unchecked,
      'Los permisos que el código no comprueba en ningún sitio deben llevar «**Reservado**» en su fila de §5.1, y solo ellos: ' +
        'si empezó a usarse uno, quite la marca; si dejó de usarse, póngala.'
    )
  })
})

describe('documento de producto: módulos (§5.2)', () => {
  const moduleRows = rowsOf(modules)

  test('cada módulo aparece con su clave, su etiqueta del panel y los permisos que concede', () => {
    for (const key of Object.values(MODULES)) {
      const rows = moduleRows.filter((row) => row[0] === code(key))
      assert.equal(rows.length, 1, `${key}: ${rows.length} filas en §5.2 (debe haber una)`)
      const [, label, granted] = rows[0]
      assert.equal(label, MODULE_LABELS[key], `${key}: la etiqueta es la del panel`)
      const listed = [...granted.matchAll(/`([^`]+)`/g)].map((match) => match[1]).sort()
      assert.deepEqual(listed, [...MODULE_PERMISSIONS[key]].sort(), `${key}: permisos que concede`)
    }
  })

  test('no queda ningún módulo que el código ya no tenga', () => {
    const known = new Set<string>(Object.values(MODULES).map(code))
    for (const row of moduleRows) assert.ok(known.has(row[0]), `${row[0]} está en §5.2 pero ya no existe en modules.ts`)
  })
})
