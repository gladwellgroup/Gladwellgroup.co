import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ARCHIVED_SESSION_ERROR, archivedSessionError } from '@/lib/deliverables/archived'

describe('archivedSessionError', () => {
  test('una sesión archivada no puede enviar ni regenerar: devuelve el mensaje', () => {
    assert.equal(archivedSessionError('archivado'), ARCHIVED_SESSION_ERROR)
    assert.match(ARCHIVED_SESSION_ERROR, /archivada/)
  })

  test('cualquier otro estado sigue su curso', () => {
    for (const status of ['borrador', 'generado', 'entregado', '', 'Archivado', 'archivada', null, undefined]) {
      assert.equal(archivedSessionError(status), null, String(status))
    }
  })
})

// Qué rutas de Terapia y Education tienen efectos fuera de la pantalla: mandan correo,
// llaman a la IA o reescriben el entregable ya guardado. Se detectan por lo que HACEN,
// no por una lista a mano, para que una ruta nueva no se escape del bloqueo.
const API_DIRS = ['app/api/therapy', 'app/api/education']
const EFECTOS = /emails\.send\(|sendPersonalizedBatch\(|new Resend\(|synthesizeDeliverable\(|synthesizeEducation\(/

function rutas(dir: string): string[] {
  const root = path.join(process.cwd(), dir)
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'route.ts') out.push(full)
    }
  }
  walk(root)
  return out
}

describe('toda ruta con efectos externos bloquea las sesiones archivadas', () => {
  const todas = API_DIRS.flatMap(rutas)
  // `generate` no manda nada, pero hace un upsert que vacía el PDF y el contenido del entregable.
  const riesgosas = todas.filter((file) => {
    const source = fs.readFileSync(file, 'utf8')
    return EFECTOS.test(source) || file.endsWith(`${path.sep}generate${path.sep}route.ts`)
  })

  test('la detección encuentra las rutas de envío, IA y generación (no se queda vacía)', () => {
    assert.ok(todas.length > 20, `solo se encontraron ${todas.length} rutas: ¿cambió la carpeta?`)
    // approve, process, generate y resend-attendees, de Terapia y de Education.
    assert.ok(riesgosas.length >= 8, `solo se detectaron ${riesgosas.length} rutas riesgosas`)
  })

  for (const file of riesgosas) {
    const nombre = path.relative(process.cwd(), file)
    test(`${nombre} llama a archivedSessionError`, () => {
      const source = fs.readFileSync(file, 'utf8')
      assert.ok(
        source.includes('archivedSessionError('),
        `${nombre} manda correo, genera con IA o reescribe el entregable pero no bloquea las sesiones archivadas`
      )
      assert.ok(
        source.includes("from '@/lib/deliverables/archived'"),
        `${nombre} llama a archivedSessionError sin importarlo de lib/deliverables/archived`
      )
    })
  }
})
