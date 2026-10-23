import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAttendanceToken, randomSuffix, slugify } from '@/lib/deliverables/slugify'
import { walkingListSchema } from '@/lib/validations/walking-list'

// El token del enlace de asistencia (que cualquiera con el QR puede usar para inscribir correos) tenía un sufijo de 6
// caracteres (~31 bits). Y el registro público de la Walking List no tenía tope de longitud en ningún campo.

describe('token de asistencia', () => {
  test('el sufijo aleatorio tiene 10 caracteres del alfabeto (~52 bits)', () => {
    const suffix = randomSuffix()
    assert.equal(suffix.length, 10)
    assert.match(suffix, /^[a-z0-9]{10}$/)
  })

  test('el token es «slug-sufijo» y cambia en cada generación', () => {
    const a = buildAttendanceToken('Terapia 4: conectar ventas')
    const b = buildAttendanceToken('Terapia 4: conectar ventas')
    assert.match(a, /^terapia-4-conectar-ventas-[a-z0-9]{10}$/)
    assert.notEqual(a, b)
  })

  test('sin título usa «sesion», y el slug mantiene su tope de 60 caracteres', () => {
    assert.match(buildAttendanceToken('   '), /^sesion-[a-z0-9]{10}$/)
    assert.ok(slugify('a'.repeat(200)).length <= 60)
  })

  test('el sufijo se puede pedir más corto (los enlaces viejos de 6 siguen siendo válidos para quien los tenga)', () => {
    assert.equal(randomSuffix(6).length, 6)
  })
})

describe('Walking List: topes de longitud', () => {
  const valid = {
    nombre: 'Ana',
    apellidos: 'Gómez',
    correo: 'ana@example.com',
    whatsapp_pais: 'CO',
    whatsapp_numero: '3001234567',
    red_social: 'instagram' as const,
    perfil: '@ana',
  }

  test('un registro normal pasa', () => {
    assert.equal(walkingListSchema.safeParse(valid).success, true)
  })

  test('cada campo de texto tiene tope', () => {
    const cases: Array<[Partial<typeof valid>, string]> = [
      [{ nombre: 'a'.repeat(81) }, 'El nombre es demasiado largo'],
      [{ apellidos: 'a'.repeat(81) }, 'Los apellidos son demasiado largos'],
      [{ correo: `${'a'.repeat(250)}@example.com` }, 'El correo es demasiado largo'],
      [{ perfil: `@${'a'.repeat(200)}` }, 'El usuario o enlace es demasiado largo'],
    ]
    for (const [override, message] of cases) {
      const result = walkingListSchema.safeParse({ ...valid, ...override })
      assert.equal(result.success, false, message)
      if (!result.success) assert.ok(result.error.errors.some((e) => e.message === message), `${message} ← ${result.error.errors.map((e) => e.message).join(' | ')}`)
    }
  })

  test('justo en el tope sigue valiendo', () => {
    assert.equal(walkingListSchema.safeParse({ ...valid, nombre: 'a'.repeat(80), apellidos: 'b'.repeat(80) }).success, true)
    assert.equal(walkingListSchema.safeParse({ ...valid, perfil: `@${'a'.repeat(199)}` }).success, true)
  })
})
