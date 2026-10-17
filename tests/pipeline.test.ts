import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LIFECYCLE_BUCKETS,
  PIPELINE_BUCKETS,
  PIPELINE_LABELS,
  bucketSession,
  isPipelineBucket,
} from '@/lib/deliverables/pipeline'

const PASADA = '2020-01-01'
const FUTURA = '2999-01-01'

describe('bucketSession', () => {
  test('archivado gana sobre cualquier fecha o estado', () => {
    assert.equal(bucketSession({ status: 'archivado', session_date: PASADA }), 'archivado')
    assert.equal(bucketSession({ status: 'archivado', session_date: FUTURA }), 'archivado')
  })

  test('el resto del ciclo de vida se clasifica como antes', () => {
    assert.equal(bucketSession({ status: 'entregado', session_date: FUTURA }), 'entregado')
    assert.equal(bucketSession({ status: 'borrador', session_date: FUTURA }), 'programada')
    assert.equal(bucketSession({ status: 'generado', session_date: PASADA }), 'generado')
    assert.equal(bucketSession({ status: 'borrador', session_date: PASADA }), 'borrador')
    assert.equal(bucketSession({ status: null, session_date: PASADA }), 'borrador')
  })
})

describe('casillas del pipeline', () => {
  test('archivado es una casilla de los listados pero no del ciclo de vida', () => {
    assert.ok(isPipelineBucket('archivado'))
    assert.ok(PIPELINE_BUCKETS.includes('archivado'))
    assert.ok(!(LIFECYCLE_BUCKETS as readonly string[]).includes('archivado'))
  })

  test('cada casilla tiene etiqueta', () => {
    assert.equal(PIPELINE_LABELS.archivado, 'Archivado')
    for (const b of PIPELINE_BUCKETS) assert.ok(PIPELINE_LABELS[b])
  })
})
