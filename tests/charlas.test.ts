import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  CHARLA_ATTENDEE_COLUMNS,
  CHARLA_CALENDAR_COLUMNS,
  CHARLA_COLUMNS,
  CHARLA_LINK_COLUMNS,
} from '@/lib/charlas/queries'
import { CHARLA_LABELS, bucketCharla } from '@/lib/charlas/status'
import { CHARLA_TITLE_MAX, CHARLA_TITLE_MIN } from '@/lib/charlas/types'
import { toDateKey } from '@/lib/date'
import { isUpcoming } from '@/lib/deliverables/sessions'
import {
  CALENDAR_PROGRAMAS,
  PROGRAMA_LABEL,
  PROGRAMA_ROUTE,
  sessionHref,
} from '@/lib/encuentros/programas'
import {
  MODULES,
  MODULE_LABELS,
  MODULE_PERMISSIONS,
  getEffectivePermissions,
} from '@/lib/permissions'
import { attendanceFormSchema } from '@/lib/validations/attendees'
import {
  charlaCreateSchema,
  charlaUpdateSchema,
  isRealDate,
} from '@/lib/validations/charlas'
import { createUserSchema, updateUserSchema } from '@/lib/validations/usuarios'

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

/** Hoy +/- `offsetDays`, como "YYYY-MM-DD" local (el mismo criterio de la app). */
function dayFromToday(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return toDateKey(date)
}

describe('isRealDate', () => {
  test('acepta fechas que existen, incluido el 29 de febrero bisiesto', () => {
    for (const value of ['2026-10-17', '2028-02-29', '2026-12-31', '2026-01-01']) {
      assert.equal(isRealDate(value), true, value)
    }
  })

  test('rechaza lo que cumple el patrón pero no existe, y lo que no es un día', () => {
    for (const value of [
      '2026-02-29', // 2026 no es bisiesto
      '2026-02-31',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-10-00',
      '0001-01-01', // Date trata los años 0–99 como 19xx
      '2026-1-1',
      '17/10/2026',
      '2026-10-17T00:00:00Z',
      '',
    ]) {
      assert.equal(isRealDate(value), false, JSON.stringify(value))
    }
  })
})

describe('charlaCreateSchema', () => {
  test('recorta el nombre y acepta una charla completa', () => {
    const parsed = charlaCreateSchema.parse({ title: '  Hablemos de emprender  ', session_date: '2026-11-03' })
    assert.deepEqual(parsed, { title: 'Hablemos de emprender', session_date: '2026-11-03' })
  })

  test('el nombre tiene límites, medidos ya recortado', () => {
    assert.equal(charlaCreateSchema.safeParse({ title: 'ab', session_date: '2026-11-03' }).success, false)
    // Tres caracteres, pero dos son espacios: recortado queda en uno.
    assert.equal(charlaCreateSchema.safeParse({ title: '  a  ', session_date: '2026-11-03' }).success, false)
    assert.equal(
      charlaCreateSchema.safeParse({ title: 'a'.repeat(CHARLA_TITLE_MIN), session_date: '2026-11-03' }).success,
      true
    )
    assert.equal(
      charlaCreateSchema.safeParse({ title: 'a'.repeat(CHARLA_TITLE_MAX), session_date: '2026-11-03' }).success,
      true
    )
    const tooLong = charlaCreateSchema.safeParse({
      title: 'a'.repeat(CHARLA_TITLE_MAX + 1),
      session_date: '2026-11-03',
    })
    assert.equal(tooLong.success, false)
    if (!tooLong.success) assert.match(tooLong.error.errors[0].message, /120/)
  })

  test('la fecha es obligatoria y tiene que existir', () => {
    assert.equal(charlaCreateSchema.safeParse({ title: 'Una charla' }).success, false)
    const impossible = charlaCreateSchema.safeParse({ title: 'Una charla', session_date: '2026-02-31' })
    assert.equal(impossible.success, false)
    if (!impossible.success) assert.equal(impossible.error.errors[0].message, 'Fecha inválida')
  })

  test('descarta lo que no le toca poner a quien llama (id, created_by, foto)', () => {
    const parsed = charlaCreateSchema.parse({
      title: 'Una charla',
      session_date: '2026-11-03',
      id: '00000000-0000-0000-0000-000000000000',
      created_by: 'otra-persona',
      photo_url: 'https://example.com/foto.jpg',
    })
    assert.deepEqual(Object.keys(parsed).sort(), ['session_date', 'title'])
  })
})

describe('charlaUpdateSchema', () => {
  test('es parcial: cada campo se guarda por separado', () => {
    assert.deepEqual(charlaUpdateSchema.parse({ title: ' Nuevo nombre ' }), { title: 'Nuevo nombre' })
    assert.deepEqual(charlaUpdateSchema.parse({ session_date: '2026-12-01' }), { session_date: '2026-12-01' })
    assert.deepEqual(
      charlaUpdateSchema.parse({ photo_url: 'https://x.supabase.co/storage/v1/object/public/charlas-media/a.jpg' }),
      { photo_url: 'https://x.supabase.co/storage/v1/object/public/charlas-media/a.jpg' }
    )
  })

  test('photo_url: null quita la foto, y cuenta como un cambio', () => {
    assert.deepEqual(charlaUpdateSchema.parse({ photo_url: null }), { photo_url: null })
  })

  test('un cuerpo vacío (o solo con claves ajenas) no guarda nada', () => {
    for (const body of [{}, { id: 'x' }, { created_by: 'x' }]) {
      const result = charlaUpdateSchema.safeParse(body)
      assert.equal(result.success, false, JSON.stringify(body))
      if (!result.success) assert.equal(result.error.errors[0].message, 'No hay nada que guardar')
    }
  })

  test('la foto solo admite http(s): termina en un <img src> de la página pública', () => {
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x.com/a.jpg', 'no es una url', '']) {
      assert.equal(charlaUpdateSchema.safeParse({ photo_url: url }).success, false, url)
    }
  })

  test('aplica los mismos límites del nombre y la fecha que al crear', () => {
    assert.equal(charlaUpdateSchema.safeParse({ title: 'ab' }).success, false)
    assert.equal(charlaUpdateSchema.safeParse({ session_date: '2026-02-30' }).success, false)
  })
})

describe('formulario público de asistencia (QR)', () => {
  test('recorta nombre y correo, y acepta datos normales', () => {
    assert.deepEqual(
      attendanceFormSchema.parse({ nombre: '  Ana Gómez  ', correo: '  ana@example.com ' }),
      { nombre: 'Ana Gómez', correo: 'ana@example.com' }
    )
  })

  test('el nombre es obligatorio y tiene tope: lo ve cualquiera con el enlace', () => {
    assert.equal(attendanceFormSchema.safeParse({ nombre: '   ', correo: 'a@b.co' }).success, false)
    assert.equal(attendanceFormSchema.safeParse({ nombre: 'a'.repeat(120), correo: 'a@b.co' }).success, true)
    const long = attendanceFormSchema.safeParse({ nombre: 'a'.repeat(121), correo: 'a@b.co' })
    assert.equal(long.success, false)
    if (!long.success) assert.equal(long.error.errors[0].message, 'El nombre es demasiado largo')
  })

  test('el correo tiene que serlo y no pasar de 254 caracteres', () => {
    for (const correo of ['no-es-correo', 'a@', '@b.co', '', '   ']) {
      assert.equal(attendanceFormSchema.safeParse({ nombre: 'Ana', correo }).success, false, JSON.stringify(correo))
    }
    const largo = `${'a'.repeat(250)}@b.co` // 256 caracteres
    const r = attendanceFormSchema.safeParse({ nombre: 'Ana', correo: largo })
    assert.equal(r.success, false)
    if (!r.success) assert.equal(r.error.errors[0].message, 'Correo inválido')
  })

  test('descarta lo que no es del formulario (empresa, id, source)', () => {
    const parsed = attendanceFormSchema.parse({ nombre: 'Ana', correo: 'a@b.co', empresa: 'X', source: 'csv', id: 'z' })
    assert.deepEqual(Object.keys(parsed).sort(), ['correo', 'nombre'])
  })

  test('la ruta pública valida con ese esquema, no con uno propio sin tope', () => {
    const source = read('app/api/attendance/[token]/route.ts')
    assert.ok(source.includes("from '@/lib/validations/attendees'"))
    assert.ok(source.includes('attendanceFormSchema.safeParse('))
    assert.doesNotMatch(source, /z\.string\(\)\.trim\(\)\.min\(1/, 'volvió un esquema local sin tope de largo')
  })
})

describe('módulo «charlas» en la administración de usuarios', () => {
  const admin = { role: 'community_admin', nombre: 'Carla', correo: 'carla@example.com', password: 'una-clave-larga' } as const

  /** Los módulos de un community_admin recién parseado (el rol `community_member` no los lleva). */
  function modulesOf(input: unknown): readonly string[] {
    const parsed = createUserSchema.parse(input)
    assert.equal(parsed.role, 'community_admin')
    return parsed.role === 'community_admin' ? parsed.granted_modules : []
  }

  test('se puede otorgar al crear una cuenta y al editarla', () => {
    assert.deepEqual(modulesOf({ ...admin, granted_modules: ['charlas'] }), ['charlas'])
    assert.deepEqual(updateUserSchema.parse({ cargo: null, granted_modules: ['charlas', 'parrilla'] }).granted_modules, ['charlas', 'parrilla'])
  })

  test('un módulo inventado se rechaza (la API no deja guardar basura en profile_module_grants)', () => {
    assert.equal(createUserSchema.safeParse({ ...admin, granted_modules: ['charlas_cataticas'] }).success, false)
    assert.equal(updateUserSchema.safeParse({ cargo: null, granted_modules: ['x'] }).success, false)
  })

  test('los módulos viejos siguen aceptándose con su clave de siempre', () => {
    const keys = ['crm', 'entregables_terapia', 'entregables_educacion', 'parrilla', 'calendario_sesiones']
    assert.deepEqual(modulesOf({ ...admin, granted_modules: keys }), keys)
  })
})

describe('estado de una charla', () => {
  test('está programada hasta que termina su día; desde el siguiente, realizada', () => {
    assert.equal(bucketCharla(dayFromToday(1)), 'programada')
    assert.equal(bucketCharla(dayFromToday(30)), 'programada')
    // `session_date` no tiene hora: la charla de HOY todavía no ha ocurrido (o está ocurriendo).
    assert.equal(bucketCharla(dayFromToday(0)), 'programada')
    assert.equal(bucketCharla(dayFromToday(-1)), 'realizada')
    assert.equal(bucketCharla(dayFromToday(-400)), 'realizada')
  })

  test('«próxima» tiene una sola definición, y la de una charla incluye hoy', () => {
    const base = { id: 'x', title: 't', status: null, subtitulo: null, responsable: null }
    const charla = (offset: number) => ({ ...base, programa: 'charla' as const, session_date: dayFromToday(offset) })
    const terapia = (offset: number) => ({ ...base, programa: 'terapia' as const, status: 'borrador', session_date: dayFromToday(offset) })

    assert.equal(isUpcoming(charla(0)), true)
    assert.equal(isUpcoming(charla(3)), true)
    assert.equal(isUpcoming(charla(-1)), false)
    // Una sesión con entregable de hoy ya no es «próxima»: pasa a borrador ese mismo día.
    assert.equal(isUpcoming(terapia(0)), false)
    assert.equal(isUpcoming(terapia(3)), true)
    assert.equal(isUpcoming(terapia(-3)), false)
  })

  test('nunca se llama «Borrador»: eso es del pipeline de entregables', () => {
    assert.deepEqual(Object.values(CHARLA_LABELS).sort(), ['Programada', 'Realizada'])
  })
})

describe('programas de Encuentros', () => {
  test('cada programa tiene ruta y etiqueta, y las rutas no se repiten', () => {
    assert.deepEqual([...CALENDAR_PROGRAMAS].sort(), ['charla', 'education', 'terapia'])

    for (const programa of CALENDAR_PROGRAMAS) {
      assert.ok(PROGRAMA_ROUTE[programa], `${programa} sin ruta`)
      assert.ok(PROGRAMA_LABEL[programa], `${programa} sin etiqueta`)
    }
    const routes = CALENDAR_PROGRAMAS.map((programa) => PROGRAMA_ROUTE[programa])
    assert.equal(new Set(routes).size, routes.length)
  })

  test('sessionHref lleva cada programa a su carpeta (la charla no cae en Education)', () => {
    const base = '/super/encuentros'
    assert.equal(sessionHref(base, { programa: 'terapia', id: 'abc' }), '/super/encuentros/terapia/abc')
    assert.equal(sessionHref(base, { programa: 'education', id: 'abc' }), '/super/encuentros/education/abc')
    assert.equal(sessionHref(base, { programa: 'charla', id: 'abc' }), '/super/encuentros/charlas/abc')
  })

  test('cada carpeta de programa existe de verdad en los dos árboles del portal', () => {
    for (const tree of ['super', 'admin']) {
      for (const programa of CALENDAR_PROGRAMAS) {
        const dir = path.join(ROOT, 'app', '(portal)', tree, 'encuentros', PROGRAMA_ROUTE[programa])
        assert.ok(fs.existsSync(dir), `falta ${path.relative(ROOT, dir)}`)
      }
    }
  })

  test('la ruta vieja /entregables ya no existe como carpeta y sí redirige', () => {
    for (const tree of ['super', 'admin']) {
      assert.equal(fs.existsSync(path.join(ROOT, 'app', '(portal)', tree, 'entregables')), false)
    }
    const config = read('next.config.mjs')
    assert.match(config, /source: '\/super\/entregables\/:path\*'[\s\S]*?destination: '\/super\/encuentros\/:path\*'/)
    assert.match(config, /source: '\/admin\/entregables\/:path\*'[\s\S]*?destination: '\/admin\/encuentros\/:path\*'/)
  })
})

// El renombre /entregables → /encuentros fue mecánico: cada `basePath`, `hubPath`, `listPath` y
// `redirect()` escrito a mano tiene que apuntar a una página que EXISTE. Un literal que quedó con
// la ruta vieja (o con una errata) sería un enlace roto que nada más detecta hasta que alguien lo toca.
describe('las rutas escritas a mano en las páginas del portal existen', () => {
  function pages(dir: string): string[] {
    const out: string[] = []
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name === 'page.tsx') out.push(full)
      }
    }
    walk(path.join(ROOT, dir))
    return out
  }

  const files = [
    ...pages('app/(portal)/super/encuentros'),
    ...pages('app/(portal)/admin/encuentros'),
    path.join(ROOT, 'app/(portal)/dashboard/page.tsx'),
    path.join(ROOT, 'lib/data/portal-navigation.ts'),
  ]

  const literals = files.flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8')
    const found = [
      ...source.matchAll(/(?:basePath|hubPath|listPath)=["'`](\/[^"'`$]+)["'`]/g),
      ...source.matchAll(/redirect\(\s*['"`](\/[^'"`$]+)['"`]\s*\)/g),
      ...source.matchAll(/\?\s*['"](\/(?:super|admin)\/[a-z-]+)['"]/g),
    ]
    return found.map((m) => ({ file: path.relative(ROOT, file), route: m[1] }))
  })

  test('se encontraron rutas que comprobar (la detección no se queda vacía)', () => {
    assert.ok(literals.length >= 25, `solo se encontraron ${literals.length} rutas: ¿cambió la forma de escribirlas?`)
  })

  test('ninguna apunta ya a /entregables', () => {
    const viejas = literals.filter((l) => l.route.includes('/entregables'))
    assert.deepEqual(viejas, [])
  })

  test('cada una resuelve a una carpeta con su page.tsx', () => {
    const rotas = literals
      .filter((l) => !fs.existsSync(path.join(ROOT, 'app', '(portal)', l.route, 'page.tsx')))
      .map((l) => `${l.file} → ${l.route}`)
    assert.deepEqual(rotas, [], `rutas que no existen: ${rotas.join(' | ')}`)
  })
})

describe('módulo «charlas»', () => {
  test('da charlas:manage y el calendario, y nada de Terapia ni Education', () => {
    const permissions = getEffectivePermissions('community_admin', [MODULES.charlas])
    assert.ok(permissions.includes('charlas:manage'))
    assert.ok(permissions.includes('sessions:read_community'))
    for (const other of ['therapy:create', 'therapy:deliver', 'education:create', 'education:deliver'] as const) {
      assert.equal(permissions.includes(other), false, other)
    }
  })

  test('los módulos de Terapia y Education no dan acceso a las charlas', () => {
    for (const key of [MODULES.entregables_terapia, MODULES.entregables_educacion, MODULES.calendario_sesiones]) {
      assert.equal(getEffectivePermissions('community_admin', [key]).includes('charlas:manage'), false, key)
    }
  })

  test('sin el módulo no hay permiso, ni siquiera para un community_admin; el super admin lo tiene siempre', () => {
    assert.equal(getEffectivePermissions('community_admin', []).includes('charlas:manage'), false)
    assert.equal(getEffectivePermissions('community_member', []).includes('charlas:manage'), false)
    assert.equal(getEffectivePermissions('super_admin', []).includes('charlas:manage'), true)
  })

  test('las claves de los módulos viejos no cambiaron (están guardadas en profile_module_grants)', () => {
    assert.equal(MODULES.entregables_terapia, 'entregables_terapia')
    assert.equal(MODULES.entregables_educacion, 'entregables_educacion')
  })

  test('las etiquetas dicen «Encuentros», y el módulo nuevo tiene la suya', () => {
    assert.equal(MODULE_LABELS.entregables_terapia, 'Encuentros · Terapia')
    assert.equal(MODULE_LABELS.entregables_educacion, 'Encuentros · Educación')
    assert.equal(MODULE_LABELS.charlas, 'Encuentros · Charlas Catárticas')
    assert.ok(MODULE_PERMISSIONS.charlas.includes('charlas:manage'))
  })
})

// Quién puede qué no puede depender de que alguien se acuerde: se detecta por lo
// que el código HACE, igual que archived.test.ts hace con las rutas de envío.
describe('las rutas y páginas de charlas verifican quién llama', () => {
  function files(dir: string, name: string): string[] {
    const out: string[] = []
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name === name) out.push(full)
      }
    }
    walk(path.join(ROOT, dir))
    return out
  }

  const routes = files('app/api/charlas', 'route.ts')

  test('la detección encuentra las tres rutas (no se queda vacía)', () => {
    assert.equal(routes.length, 3, `se esperaban 3 rutas y hay ${routes.length}: ¿cambió la carpeta?`)
  })

  for (const file of routes) {
    const name = path.relative(ROOT, file)
    test(`${name} exige el permiso charlas:manage`, () => {
      const source = fs.readFileSync(file, 'utf8')
      const checksPermission =
        source.includes("requireApiPermission('charlas:manage')") || source.includes('resolveCharlaAccess(')
      assert.ok(checksPermission, `${name} no verifica charlas:manage (ni con requireApiPermission ni con resolveCharlaAccess)`)
      // Quien no ha iniciado sesión recibe 401 antes de tocar nada.
      assert.ok(
        source.includes("requireApiPermission('charlas:manage')") || source.includes('getAuthUser()'),
        `${name} no comprueba la sesión`
      )
    })
  }

  const pages = [
    ...files('app/(portal)/super/encuentros/charlas', 'page.tsx'),
    ...files('app/(portal)/admin/encuentros/charlas', 'page.tsx'),
  ]

  test('hay cuatro páginas de charlas (lista y detalle, en /super y /admin)', () => {
    assert.equal(pages.length, 4)
  })

  for (const file of pages) {
    const name = path.relative(ROOT, file)
    test(`${name} pide sessions:read_community`, () => {
      assert.ok(read(path.relative(ROOT, file)).includes("requirePermission('sessions:read_community')"), name)
    })
  }

  // La barrera de privacidad: sin el módulo, nombres y correos ni se piden a la base.
  for (const file of pages.filter((page) => page.includes(`${path.sep}[id]${path.sep}`))) {
    const name = path.relative(ROOT, file)
    test(`${name} solo pide los asistentes a quien gestiona charlas`, () => {
      const source = fs.readFileSync(file, 'utf8')
      assert.match(source, /getCharla\(\s*id,\s*\{\s*includeAttendees:\s*canManage\s*\}\s*\)/, name)
      assert.match(source, /canManage\s*=\s*user\.permissions\.includes\('charlas:manage'\)/, name)
    })
  }

  test('el enlace de asistencia acepta el programa «charla» y exige el módulo', () => {
    const source = read('app/api/attendance-link/route.ts')
    assert.match(source, /z\.enum\(\[[^\]]*'charla'[^\]]*\]\)/)
    assert.ok(source.includes('resolveCharlaAccess('))
    assert.match(source, /charla:\s*'charla_id'/)
  })
})

// Las listas del código y las del esquema se mantienen a mano en dos lugares:
// estas pruebas leen la migración y las comparan (mismo método que drift.test.ts).
describe('las charlas del código coinciden con el esquema de SQL', () => {
  // Sin los comentarios: el bloque «REVERTIR» de la migración repite el CHECK viejo
  // (de dos términos) y una regex lo encontraría antes que el vigente.
  const SQL = read('supabase/migrations/20260919_charlas_cataticas.sql')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

  /** Nombres de columna de un `create table if not exists public.<tabla> (…)`. */
  function columnsOf(table: string): string[] {
    const start = SQL.indexOf(`create table if not exists public.${table} (`)
    assert.ok(start >= 0, `No encontré public.${table} en la migración`)
    const end = SQL.indexOf('\n);', start)
    const body = SQL.slice(start, end)
    return [...body.matchAll(/^ {2}([a-z_]+)\s+(?:uuid|text|date|timestamptz)\b/gm)].map((m) => m[1])
  }

  test('las lecturas de charlas piden columnas que existen', () => {
    const charlas = columnsOf('charlas')
    for (const column of [...CHARLA_COLUMNS, ...CHARLA_CALENDAR_COLUMNS, 'created_by', 'created_at', 'updated_at']) {
      assert.ok(charlas.includes(column), `public.charlas no tiene la columna ${column}`)
    }
  })

  test('las lecturas de asistentes piden columnas que existen', () => {
    const attendees = columnsOf('charla_attendees')
    for (const column of [...CHARLA_ATTENDEE_COLUMNS, 'charla_id']) {
      assert.ok(attendees.includes(column), `public.charla_attendees no tiene la columna ${column}`)
    }
  })

  test('el enlace de asistencia que se lee existe desde 20260807', () => {
    const links = read('supabase/migrations/20260807_attendance_links.sql')
    for (const column of CHARLA_LINK_COLUMNS) {
      assert.ok(links.includes(` ${column} `), `session_attendance_links no tiene ${column}`)
    }
  })

  test('lo que las rutas escriben en charlas existe', () => {
    const charlas = columnsOf('charlas')
    // Create y update de lib/validations/charlas.ts, más created_by y updated_at de las rutas.
    for (const column of ['title', 'session_date', 'photo_url', 'created_by', 'updated_at']) {
      assert.ok(charlas.includes(column), column)
    }
    const attendees = columnsOf('charla_attendees')
    for (const column of ['charla_id', 'nombre', 'correo']) assert.ok(attendees.includes(column), column)
  })

  test('el límite del nombre en SQL es el mismo que valida el servidor', () => {
    const match = SQL.match(/char_length\(btrim\(title\)\)\s+between\s+(\d+)\s+and\s+(\d+)/)
    assert.ok(match, 'No encontré el CHECK del nombre en la migración')
    assert.deepEqual([Number(match[1]), Number(match[2])], [CHARLA_TITLE_MIN, CHARLA_TITLE_MAX])
  })

  test('el CHECK del enlace de asistencia cuenta los tres programas', () => {
    const block = SQL.match(/add constraint session_attendance_links_one_program check \(([\s\S]*?)\);/)
    assert.ok(block, 'No encontré el CHECK de tres términos')
    for (const column of ['therapy_session_id', 'education_session_id', 'charla_id']) {
      assert.ok(block[1].includes(`(${column} is not null)::int`), `el CHECK no cuenta ${column}`)
    }
    assert.match(block[1], /=\s*1\s*$/)
  })

  test('un correo por charla, sin importar mayúsculas (reenviar el formulario es idempotente)', () => {
    assert.match(
      SQL,
      /create unique index if not exists charla_attendees_charla_correo_idx\s+on public\.charla_attendees \(charla_id, lower\(correo\)\)/
    )
  })

  test('el enlace tiene un solo registro por charla', () => {
    assert.match(
      SQL,
      /create unique index if not exists session_attendance_links_charla_idx\s+on public\.session_attendance_links \(charla_id\)\s+where charla_id is not null/
    )
  })

  test('el bucket de fotos existe y es el que sube la pantalla', () => {
    assert.ok(SQL.includes("values ('charlas-media', 'charlas-media', true)"))
    assert.ok(read('components/portal/charla-detail.tsx').includes("bucket: 'charlas-media'"))
  })
})
