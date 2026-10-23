import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import {
  AUDIO_DOWNLOAD_TIMEOUT_MS,
  CHAT_TIMEOUT_MS,
  ExternalTimeoutError,
  FFMPEG_TIMEOUT_MS,
  WHISPER_TIMEOUT_MS,
  withTimeout,
} from '@/lib/ai/timeout'

// La síntesis del entregable llama a OpenAI (chat y Whisper), descarga el audio y corre ffmpeg, todo sin tope: si un
// servicio no contestaba, la ruta se colgaba hasta que la función la mataba (300 s) y el entregable quedaba en
// «procesando» para siempre. Con tope, la síntesis cae al camino de respaldo con un aviso en español.

const ROOT = process.cwd()
const code = (file: string) =>
  fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

let server: http.Server
let base = ''

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/rapido') {
      res.end('{"ok":true}')
    } else if (req.url === '/cuerpo-colgado') {
      // Manda las cabeceras y deja el cuerpo a medias: el tope debe cubrir también la lectura.
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.write('{"ok":')
    }
    // «/colgado» no contesta nunca.
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server.closeAllConnections()
  server.close()
})

describe('withTimeout', () => {
  test('devuelve lo que devuelve la llamada si contesta a tiempo', async () => {
    const data = await withTimeout('La IA', 1000, async (signal) => {
      const res = await fetch(`${base}/rapido`, { signal })
      return res.json()
    })
    assert.deepEqual(data, { ok: true })
  })

  test('si no contesta, falla con un texto en español que dice cuánto esperó', async () => {
    const started = Date.now()
    await assert.rejects(
      withTimeout('La síntesis con IA', 1000, async (signal) => (await fetch(`${base}/colgado`, { signal })).json()),
      (error: Error) => {
        assert.ok(error instanceof ExternalTimeoutError)
        assert.equal(error.name, 'ExternalTimeoutError')
        assert.equal(error.message, 'La síntesis con IA tardó más de 1 s.')
        return true
      }
    )
    assert.ok(Date.now() - started < 3000)
  })

  test('el tope cubre también la lectura del cuerpo, no solo las cabeceras', async () => {
    await assert.rejects(
      withTimeout('La descarga del audio', 1000, async (signal) => {
        const res = await fetch(`${base}/cuerpo-colgado`, { signal })
        return res.json()
      }),
      ExternalTimeoutError
    )
  })

  test('un fallo que no es de tiempo pasa tal cual (no se disfraza de «tardó más de»)', async () => {
    const boom = new Error('boom')
    await assert.rejects(withTimeout('La IA', 1000, async () => Promise.reject(boom)), (error: Error) => error === boom)
  })

  test('la llamada recibe una señal que se aborta al vencer', async () => {
    let received: AbortSignal | undefined
    await assert.rejects(
      withTimeout('La IA', 50, (signal) => {
        received = signal
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
      }),
      ExternalTimeoutError
    )
    assert.equal(received?.aborted, true)
  })
})

describe('los topes de la síntesis', () => {
  test('juntos caben en los 300 s de las rutas que sintetizan', () => {
    const total = AUDIO_DOWNLOAD_TIMEOUT_MS + FFMPEG_TIMEOUT_MS + WHISPER_TIMEOUT_MS + CHAT_TIMEOUT_MS
    assert.ok(total < 300_000, `${total} ms`)
    for (const route of ['app/api/therapy/deliverables/process/route.ts', 'app/api/education/deliverables/process/route.ts']) {
      assert.match(code(route), /maxDuration = 300/, route)
    }
  })

  test('cada llamada externa de la síntesis lleva su tope', () => {
    const chat = code('lib/ai/openai-json.ts')
    assert.match(chat, /withTimeout\('La síntesis con IA', CHAT_TIMEOUT_MS/)
    assert.match(chat, /signal,\n\s*\}\)/, 'el fetch recibe la señal')

    const synth = code('lib/therapy/synthesize.ts')
    assert.match(synth, /withTimeout\('La transcripción del audio', WHISPER_TIMEOUT_MS/)
    assert.match(synth, /withTimeout\(\s*'La descarga del audio',\s*AUDIO_DOWNLOAD_TIMEOUT_MS/)
    assert.match(synth, /\{ timeout: FFMPEG_TIMEOUT_MS \}/)
    assert.equal((synth.match(/signal/g) ?? []).length >= 4, true, 'Whisper y la descarga pasan la señal a su fetch')
  })

  test('si Whisper no contesta a tiempo no se repite con el archivo completo (gastaría el tiempo que no queda)', () => {
    assert.match(code('lib/therapy/synthesize.ts'), /if \(err instanceof ExternalTimeoutError\) throw err/)
  })
})
