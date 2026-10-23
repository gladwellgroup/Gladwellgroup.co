import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Seguridad de la base de datos, leída de las migraciones (como drift.test.ts hace con la Parrilla). La revisión
// de QA del 2026-10-22 encontró y comprobó en PGlite con roles reales tres huecos que ninguna prueba vigilaba:
//   · `profiles` dejaba a cada persona actualizar su propia fila SIN límite de columnas, `role` incluido: con la
//     consola del navegador, un integrante se ascendía a super_admin;
//   · `set_profile_module_grants` (SECURITY DEFINER) pasaba su guarda con solo la llave anónima: cualquiera que
//     conociera un id de perfil se otorgaba módulos;
//   · el trigger de alta aceptaba `raw_user_meta_data->>'admin_created'`, que escribe el propio cliente: un
//     registro por correo se saltaba la invitación.
// Estas pruebas exigen que las correcciones sigan en las migraciones y que ninguna posterior las deshaga.

const ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations')
const FILES = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort()

/** El SQL de cada migración sin comentarios: las cabeceras citan a propósito lo que se prohíbe. */
const sqlOf = (file: string) =>
  fs
    .readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

const MIGRATIONS = FILES.map((file) => ({ file, sql: sqlOf(file) }))

const REVOKE_PROFILES = /revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+(?:table\s+)?public\.profiles\s+from\s+anon\s*,\s*authenticated\s*;/i
const REVOKE_RPC = /revoke\s+execute\s+on\s+function\s+public\.set_profile_module_grants\s*\(\s*uuid\s*,\s*text\s*\[\s*\]\s*,\s*uuid\s*\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*;/i
const GRANT_RPC_SERVICE = /grant\s+execute\s+on\s+function\s+public\.set_profile_module_grants\s*\(\s*uuid\s*,\s*text\s*\[\s*\]\s*,\s*uuid\s*\)\s+to\s+service_role\s*;/i

/** Índice de la última migración (en orden) que cumple `pattern`, o -1. */
const lastIndexOf = (pattern: RegExp) => MIGRATIONS.map((m) => pattern.test(m.sql)).lastIndexOf(true)

/** El cuerpo de la última definición de `public.<name>` entre todas las migraciones. */
function latestFunction(name: string): { file: string; body: string } {
  const header = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i')
  for (let i = MIGRATIONS.length - 1; i >= 0; i--) {
    const { file, sql } = MIGRATIONS[i]
    const start = sql.search(header)
    if (start === -1) continue
    const rest = sql.slice(start)
    const end = rest.search(/\$\$\s*;/) // el cierre del cuerpo dollar-quoted
    const bodyEnd = rest.indexOf('$$', rest.indexOf('$$') + 2)
    return { file, body: rest.slice(0, end === -1 ? bodyEnd : end) }
  }
  throw new Error(`ninguna migración define public.${name}`)
}

describe('seguridad de la base: profiles y módulos', () => {
  test('hay migraciones que revisar (si no, las pruebas de abajo no vigilan nada)', () => {
    assert.ok(MIGRATIONS.length >= 30, `${MIGRATIONS.length} migraciones`)
  })

  test('a `anon` y `authenticated` se les quita INSERT, UPDATE y DELETE sobre `profiles`', () => {
    assert.ok(lastIndexOf(REVOKE_PROFILES) !== -1, 'falta «revoke insert, update, delete on public.profiles from anon, authenticated»')
  })

  test('`set_profile_module_grants` solo la ejecuta service_role', () => {
    assert.ok(lastIndexOf(REVOKE_RPC) !== -1, 'falta quitar EXECUTE a public, anon y authenticated')
    assert.ok(lastIndexOf(GRANT_RPC_SERVICE) !== -1, 'falta concederlo a service_role (las API lo llaman con la llave de servicio)')
  })

  test('ninguna migración posterior vuelve a conceder lo que se quitó', () => {
    const revokedAt = Math.max(lastIndexOf(REVOKE_PROFILES), lastIndexOf(REVOKE_RPC))
    const regrants = [
      /grant\s+[^;]*\b(?:update|insert|delete|all(?:\s+privileges)?)\b[^;]*\bon\s+(?:table\s+)?public\.profiles\s+to\s+[^;]*\b(?:anon|authenticated|public)\b/i,
      /grant\s+execute\s+on\s+function\s+public\.set_profile_module_grants[^;]*\bto\s+[^;]*\b(?:anon|authenticated|public)\b/i,
      /alter\s+default\s+privileges[^;]*\bprofiles\b/i,
    ]
    for (const { file, sql } of MIGRATIONS.slice(revokedAt + 1)) {
      for (const pattern of regrants) assert.doesNotMatch(sql, pattern, `${file} vuelve a conceder lo que se quitó`)
    }
  })

  test('ningún código del navegador escribe en `profiles` (todas las escrituras son del servidor con la llave de servicio)', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(path.join(ROOT, rel), 'utf8')
          // Un archivo que use el cliente del navegador no puede tocar `profiles`.
          if (/getSupabaseBrowser\s*\(/.test(source) && /from\(\s*['"]profiles['"]\s*\)/.test(source)) offenders.push(rel)
        }
      }
    }
    for (const dir of ['app', 'components', 'hooks', 'lib']) walk(dir)
    assert.deepEqual(offenders, [], 'si el navegador necesita escribir ahí, hay que abrir una vía explícita y no un UPDATE libre')
  })
})

describe('seguridad de la base: alta por invitación', () => {
  for (const name of ['check_invitation_before_signup', 'handle_new_user']) {
    test(`la definición vigente de ${name} decide el bypass con app_metadata, no con user_metadata`, () => {
      const { file, body } = latestFunction(name)
      assert.match(body, /raw_app_meta_data\s*->>\s*'admin_created'/, `${file}: ${name} no lee app_metadata`)
      assert.doesNotMatch(body, /raw_user_meta_data\s*->>\s*'admin_created'/, `${file}: ${name} confía en un dato que escribe el cliente`)
    })
  }

  test('el alta de /super/usuarios manda `admin_created` en app_metadata (solo lo escribe el servidor)', () => {
    const route = fs.readFileSync(path.join(ROOT, 'app/api/admin/usuarios/route.ts'), 'utf8')
    assert.match(route, /app_metadata:\s*\{\s*admin_created:\s*true\s*\}/)
  })
})
