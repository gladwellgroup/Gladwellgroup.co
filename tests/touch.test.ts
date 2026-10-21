import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// AGENTS.md («Tablet y pantallas táctiles»): el ancho no decide si algo es táctil —un iPad
// horizontal pasa de 1024 px y sigue siendo un dedo— y los modales van sobre el Dialog de
// Radix, nunca sobre un `fixed inset-0` propio. No hay forma de comprobarlo sin un navegador
// táctil, pero sí de que nadie lo deshaga sin darse cuenta: estas pruebas leen el código.
// (Lo que mide de verdad —WebKit con perfil de iPad— se corre a mano, ver AGENTS.md.)

const ROOT = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
  }
  walk(path.join(ROOT, dir))
  return out
}

describe('calendario de Encuentros', () => {
  const source = read('components/portal/sessions-calendar.tsx')

  test('la cuadrícula compacta solo aparece con ancho Y ratón (lg:pointer-fine:)', () => {
    // Sus chips miden 21 px y «+N más» 17: imposibles de acertar con el dedo.
    assert.match(source, /hidden[^"]*lg:pointer-fine:block/)
    assert.doesNotMatch(source, /["'\s]lg:block["'\s]/, 'la cuadrícula volvió a decidirse solo por ancho')
  })

  test('al tacto manda la agenda, a cualquier ancho', () => {
    assert.match(source, /lg:pointer-fine:hidden/)
    assert.doesNotMatch(source, /["'\s]lg:hidden["'\s]/, 'la agenda volvió a ocultarse solo por ancho')
  })

  test('los controles del mes y las filas de la agenda miden 44 px al tacto', () => {
    assert.ok((source.match(/pointer-coarse:size-11/g) ?? []).length >= 2, 'faltan los botones de mes anterior/siguiente')
    assert.match(source, /pointer-coarse:min-h-11/, 'falta «Hoy»')
    assert.match(source, /flex min-h-11 items-center gap-2 rounded-lg border/, 'faltan las filas de la agenda')
  })
})

describe('layout de login, invitación y asistencia', () => {
  const source = read('app/(auth)/layout.tsx')

  test('reserva el alto de la barra fija: ninguna tarjeta alta queda por debajo de ella', () => {
    // La barra (components/layout/auth-navbar.tsx) es `fixed` y no ocupa espacio: sin este
    // padding, la tarjeta del login en un iPhone SE o la de asistencia con foto se metían bajo ella.
    assert.match(source, /\bpt-20\b/)
    assert.match(source, /md:pt-28\b/)
    assert.doesNotMatch(source, /min-h-\[calc\(/, 'volvió el min-h que restaba la barra sin reservar su espacio')
    assert.match(read('components/layout/auth-navbar.tsx'), /\bfixed\b[^"]*\btop-0\b/, 'la barra ya no es fija: este padding sobra')
  })
})

describe('modales del portal', () => {
  test('ninguno dibuja su propio overlay `fixed inset-0`: Safari lo ata al ancestro con backdrop-filter', () => {
    // Un overlay propio dentro de una BrandCard (`.glass`) se dibuja del tamaño de la tarjeta y,
    // con la página desplazada, medio fuera de pantalla. Los componentes de components/ui
    // (Dialog, Sheet) sí lo llevan: salen a <body> con un portal.
    const offenders = [...tsxFiles('components/portal'), ...tsxFiles('app')]
      .filter((file) => /className=(["'`])[^"'`]*\bfixed\b[^"'`]*\binset-0\b/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file))
    assert.deepEqual(offenders, [], `usa un Dialog de Radix en vez de un overlay propio: ${offenders.join(', ')}`)
  })
})

describe('pestaña «Frases» de la parrilla', () => {
  const list = read('components/portal/parrilla-quotes.tsx')
  const dialog = read('components/portal/parrilla-quote-dialog.tsx')
  const form = read('components/portal/parrilla-quote-form.tsx')

  test('la lista: el chip «Sin usar» mide 44 px al tacto y «Crear contenido» es un BrandButton sm (que ya los mide)', () => {
    assert.match(list, /pointer-coarse:min-h-11/)
    assert.match(list, /<BrandButton[\s\S]*?size="sm"[\s\S]*?Crear contenido/)
  })

  test('la lista no usa vh ni formatea fechas (Node y Safari no las escriben igual)', () => {
    assert.doesNotMatch(list, /\b\d+vh\b/)
    assert.doesNotMatch(list, /toLocale|Intl\.DateTimeFormat/)
  })

  test('el diálogo usa `dvh` (la barra del navegador del iPad no cuenta en `vh`) y no dibuja su propio overlay', () => {
    assert.match(dialog, /max-h-\[85dvh\]/)
    assert.doesNotMatch(dialog, /max-h-\[\d+vh\]/)
    assert.doesNotMatch(dialog, /\bfixed\b[^"'`]*\binset-0\b/)
  })

  test('el formulario: «Eliminar frase» mide 44 px al tacto y pide confirmación en un ConfirmDialog', () => {
    assert.match(form, /pointer-coarse:min-h-11[^"]*[\s\S]{0,200}Eliminar frase/)
    assert.match(form, /<ConfirmDialog/)
  })

  test('los rojos del formulario pasan AA en tema claro: `red-500` sobre el fondo del modal da 3,5:1 (mínimo 4,5:1)', () => {
    assert.doesNotMatch(form, /text-red-500/, 'usa red-700 en claro y red-400 en oscuro (`dark:`)')
    assert.match(form, /text-red-700[^"]*dark:text-red-400/)
  })

  test('los campos del formulario son los del branding (modal-field: 16 px al tacto, sin zoom en Safari)', () => {
    assert.match(form, /<select[\s\S]*?className="modal-field"/)
    assert.doesNotMatch(form, /maxLength=/, 'un maxLength truncaría en silencio una frase pegada')
  })
})

describe('vista «Tabla» del Banco de contenido y de las Frases', () => {
  const table = read('components/portal/parrilla-table.tsx')
  const shared = read('components/portal/parrilla-shared.tsx')

  test('el encabezado y la celda principal miden 44 px al tacto, y el interruptor de vista también', () => {
    assert.ok((table.match(/pointer-coarse:min-h-11/g) ?? []).length >= 2, 'faltan el botón del encabezado y el de la celda principal')
    assert.match(shared, /pointer-coarse:size-11/, 'falta el interruptor Tarjetas / Tabla')
  })

  test('`hover:` no existe al tacto: la fila, el encabezado y el interruptor dan feedback con `active:`', () => {
    assert.match(table, /active:bg-muted\/60/, 'falta el feedback al pulsar la fila')
    assert.match(table, /hover:text-foreground active:text-foreground/, 'falta en el encabezado')
    assert.match(shared, /hover:text-foreground active:text-foreground/, 'falta en el interruptor')
  })

  test('no usa vh, ni dibuja su propio overlay, ni columna fija (sticky dentro de una tarjeta .glass)', () => {
    assert.doesNotMatch(table, /\b\d+vh\b/)
    assert.doesNotMatch(table, /\bfixed\b[^"'`]*\binset-0\b/)
    assert.doesNotMatch(table, /\bsticky\b/)
  })

  test('si no cabe, se desplaza DENTRO de su contenedor: la página no se ensancha', () => {
    assert.match(table, /min-w-0 overflow-x-auto/)
  })

  test('no formatea fechas: Node y Safari no las escriben igual', () => {
    assert.doesNotMatch(table, /toLocale|Intl\.DateTimeFormat/)
    assert.doesNotMatch(read('components/portal/parrilla-quotes.tsx'), /toLocale|Intl\.DateTimeFormat/)
  })

  test('el orden de las filas se hace con `Intl.Collator` en español, no con `<` (sin tildes ni mayúsculas)', () => {
    assert.match(read('lib/parrilla/table.ts'), /new Intl\.Collator\('es'/)
  })
})
