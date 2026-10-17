import { after, before, describe, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyPostUpdate,
  createPost,
  deletePost,
  describeDbError,
  planPostUpdate,
  storagePathFromUrl,
  type GuardRow,
} from '@/lib/parrilla/mutations'

const ID = '10000000-0000-4000-8000-000000000001'
const USER = '00000000-0000-4000-8000-000000000001'
const FM = '00000000-0000-4000-8000-0000000000aa'
const BUCKET_URL = 'https://abc.supabase.co/storage/v1/object/public/parrilla-media'

function current(overrides: Partial<GuardRow> = {}): GuardRow {
  return {
    status: 'programado',
    format: 'video',
    category: 'crecer',
    production_date: '2026-10-16',
    publish_date: '2026-10-20',
    cover_image_url: null,
    talent: null,
    inspiration_url: null,
    filmmaker_ids: [],
    updated_at: '2026-10-16T12:00:00.123456+00:00',
    ...overrides,
  }
}

// Los errores esperados se loguean con console.error: se silencian para no
// ensuciar la salida de las pruebas.
before(() => {
  mock.method(console, 'error', () => {})
})
after(() => {
  mock.restoreAll()
})

describe('planPostUpdate', () => {
  test('un parche vacío no escribe ni da conflicto, aunque el token esté viejo', () => {
    const plan = planPostUpdate(current(), {}, 'token-viejo')
    assert.deepEqual(plan, { ok: true, update: {} })
  })

  test('con cambios, un token distinto al guardado es conflicto (409)', () => {
    const plan = planPostUpdate(current(), { title: 'Nuevo' }, 'token-viejo')
    assert.equal(plan.ok, false)
    if (!plan.ok) assert.equal(plan.status, 409)
  })

  test('con el token vigente (o sin token) aplica el parche tal cual', () => {
    const c = current()
    assert.deepEqual(planPostUpdate(c, { title: 'Nuevo' }, c.updated_at), { ok: true, update: { title: 'Nuevo' } })
    assert.deepEqual(planPostUpdate(c, { title: 'Nuevo' }), { ok: true, update: { title: 'Nuevo' } })
  })

  test('mover la publicación antes de la producción guardada se rechaza (400)', () => {
    const plan = planPostUpdate(current(), { publish_date: '2026-10-10' })
    assert.equal(plan.ok, false)
    if (!plan.ok) {
      assert.equal(plan.status, 400)
      assert.equal(plan.error, 'La publicación no puede ser anterior a la producción')
    }
  })

  test('mover la producción después de la publicación guardada se rechaza (400)', () => {
    assert.equal(planPostUpdate(current(), { production_date: '2026-10-25' }).ok, false)
  })

  test('cambiar las dos fechas a la vez usa los valores nuevos', () => {
    const plan = planPostUpdate(current(), { production_date: '2026-11-01', publish_date: '2026-11-05' })
    assert.equal(plan.ok, true)
  })

  test('una pieza vieja con fechas al revés se puede seguir renombrando', () => {
    const legacy = current({ production_date: '2026-10-20', publish_date: '2026-10-10' })
    assert.equal(planPostUpdate(legacy, { title: 'Solo el título' }).ok, true)
  })

  test('archivar borra la fecha de publicación guardada', () => {
    const plan = planPostUpdate(current(), { status: 'archivado' })
    assert.equal(plan.ok && plan.update.status, 'archivado')
    assert.equal(plan.ok && plan.update.publish_date, null)
  })

  test('archivar con una fecha en el parche tampoco la conserva', () => {
    const plan = planPostUpdate(current(), { status: 'archivado', publish_date: '2026-11-01' })
    assert.equal(plan.ok && plan.update.publish_date, null)
  })

  test('una pieza ya archivada no escribe la fecha de nuevo al renombrarla', () => {
    const archivada = current({ status: 'archivado', publish_date: null })
    assert.deepEqual(planPostUpdate(archivada, { title: 'Otro título' }), {
      ok: true,
      update: { title: 'Otro título' },
    })
  })

  test('mover la producción de una pieza archivada no choca con una fecha que no existe', () => {
    const archivada = current({ status: 'archivado', publish_date: null })
    assert.equal(planPostUpdate(archivada, { production_date: '2027-01-01' }).ok, true)
  })

  test('sacar una pieza del archivo sin fecha de publicación se rechaza (400)', () => {
    const archivada = current({ status: 'archivado', publish_date: null })
    const plan = planPostUpdate(archivada, { status: 'agendado' })
    assert.equal(plan.ok, false)
    if (!plan.ok) {
      assert.equal(plan.status, 400)
      assert.equal(plan.error, 'Pon una fecha de publicación para sacarla del archivo')
    }
  })

  test('sacarla del archivo con fecha de publicación en el mismo parche funciona', () => {
    const archivada = current({ status: 'archivado', publish_date: null })
    const plan = planPostUpdate(archivada, { status: 'programado', publish_date: '2026-10-30' })
    assert.deepEqual(plan.ok && plan.update, { status: 'programado', publish_date: '2026-10-30' })
  })

  test('cambiar de estado entre los del calendario conserva su fecha de publicación', () => {
    const plan = planPostUpdate(current(), { status: 'publicado' })
    assert.deepEqual(plan.ok && plan.update, { status: 'publicado' })
  })

  test('ocultar secciones pasa tal cual en el parche', () => {
    assert.deepEqual(planPostUpdate(current(), { hidden_sections: ['guion', 'portada'] }), {
      ok: true,
      update: { hidden_sections: ['guion', 'portada'] },
    })
    // Volver a mostrarlo todo también es un cambio que se escribe.
    assert.deepEqual(planPostUpdate(current({}), { hidden_sections: [] }), {
      ok: true,
      update: { hidden_sections: [] },
    })
  })

  test('ocultar la Inspiración solo esconde el campo: no vacía el enlace guardado', () => {
    const c = current({ inspiration_url: 'https://www.instagram.com/reel/abc123/' })
    const plan = planPostUpdate(c, { hidden_sections: ['inspiracion'] })
    assert.deepEqual(plan, { ok: true, update: { hidden_sections: ['inspiracion'] } })
    assert.equal(plan.ok && 'inspiration_url' in plan.update, false)
  })

  test('cambiar de video a imagen vacía la Inspiración guardada', () => {
    const c = current({ inspiration_url: 'https://www.instagram.com/reel/abc123/' })
    const plan = planPostUpdate(c, { format: 'imagen' })
    assert.equal(plan.ok && plan.update.inspiration_url, null)
    assert.equal(plan.ok && plan.update.format, 'imagen')
  })

  test('un parche con Inspiración en un formato que no es video se vacía (usa el formato guardado)', () => {
    const plan = planPostUpdate(current({ format: 'carrusel' }), {
      inspiration_url: 'https://www.instagram.com/reel/abc123/',
    })
    assert.equal(plan.ok && plan.update.inspiration_url, null)
  })

  test('en video la Inspiración se guarda tal cual', () => {
    const link = 'https://www.youtube.com/watch?v=abc123'
    assert.deepEqual(planPostUpdate(current(), { inspiration_url: link }), {
      ok: true,
      update: { inspiration_url: link },
    })
  })

  test('cambiar entre formatos sin Inspiración no escribe la columna de más', () => {
    const imagen = current({ format: 'imagen' })
    const aVideo = planPostUpdate(imagen, { format: 'video' })
    assert.equal(aVideo.ok && 'inspiration_url' in aVideo.update, false)
    const aCarrusel = planPostUpdate(imagen, { format: 'carrusel' })
    assert.equal(aCarrusel.ok && 'inspiration_url' in aCarrusel.update, false)
  })

  test('cambiar a imagen vacía el Responsable en cámara guardado', () => {
    const plan = planPostUpdate(current({ talent: 'Ana' }), { format: 'imagen' })
    assert.equal(plan.ok && plan.update.talent, null)
    assert.equal(plan.ok && plan.update.format, 'imagen')
  })

  test('cambiar de categoría vacía los Filmmaker si la pieza deja de necesitarlos', () => {
    const c = current({ format: 'imagen', category: 'roots', filmmaker_ids: [FM] })
    const plan = planPostUpdate(c, { category: 'crecer' })
    assert.deepEqual(plan.ok && plan.update.filmmaker_ids, [])
  })

  test('usa el formato guardado cuando el parche solo trae la categoría', () => {
    const c = current({ format: 'imagen', category: 'crecer', filmmaker_ids: [FM] })
    const plan = planPostUpdate(c, { category: 'roots' })
    assert.equal(plan.ok && 'filmmaker_ids' in plan.update, false)
  })

  test('forzar un talent nuevo en un formato que lo oculta lo deja en null', () => {
    const plan = planPostUpdate(current({ format: 'imagen' }), { talent: 'Ana' })
    assert.equal(plan.ok && plan.update.talent, null)
  })

  test('pasar a video conserva el talent que llega en el parche', () => {
    const plan = planPostUpdate(current({ format: 'imagen' }), { format: 'video', talent: 'Ana' })
    assert.equal(plan.ok && plan.update.talent, 'Ana')
  })

  test('no escribe de más: sin nada que vaciar no agrega talent ni filmmaker_ids', () => {
    const plan = planPostUpdate(current({ format: 'imagen' }), { format: 'carrusel' })
    assert.equal(plan.ok && 'talent' in plan.update, false)
    assert.equal(plan.ok && 'filmmaker_ids' in plan.update, false)
  })

  test('un parche que no toca la visibilidad no repara asignaciones viejas', () => {
    const c = current({ format: 'imagen', talent: 'Ana', filmmaker_ids: [FM] })
    assert.deepEqual(planPostUpdate(c, { title: 'Solo título' }), { ok: true, update: { title: 'Solo título' } })
  })
})

describe('describeDbError', () => {
  test('conoce los CHECK de la parrilla por nombre', () => {
    const message = describeDbError(
      { code: '23514', message: 'new row for relation "parrilla_posts" violates check constraint "parrilla_posts_category_check"' },
      'No se pudo guardar'
    )
    assert.match(message, /^La categoría no es válida\. Recarga la página/)
  })

  test('conoce los CHECK de la fecha de publicación y de la Inspiración', () => {
    const msg = (name: string) =>
      describeDbError(
        { code: '23514', message: `new row for relation "parrilla_posts" violates check constraint "${name}"` },
        'No se pudo guardar'
      )
    assert.match(msg('parrilla_posts_publish_date_check'), /^Falta la fecha de publicación\. Recarga/)
    assert.match(msg('parrilla_posts_inspiration_url_check'), /^El enlace de inspiración no es válido\. Recarga/)
    assert.match(msg('parrilla_posts_hidden_sections_check'), /^Alguna sección oculta no es válida\. Recarga/)
  })

  test('un CHECK desconocido da un mensaje genérico pero útil', () => {
    const message = describeDbError({ code: '23514', message: 'violates check constraint "otro"' }, 'No se pudo guardar')
    assert.match(message, /^Alguno de los valores no está permitido\. Recarga/)
  })

  test('columna inexistente = migración sin aplicar', () => {
    for (const code of ['42703', 'PGRST204']) {
      assert.match(describeDbError({ code }, 'x'), /migración/)
    }
  })

  test('cualquier otro error usa el mensaje de la ruta', () => {
    assert.equal(describeDbError({ code: '57014' }, 'No se pudo guardar'), 'No se pudo guardar')
    assert.equal(describeDbError({}, 'No se pudo guardar'), 'No se pudo guardar')
  })
})

describe('storagePathFromUrl', () => {
  test('extrae la ruta de una URL pública del bucket', () => {
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/abc.jpg`), 'abc.jpg')
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/carpeta/abc.jpg`), 'carpeta/abc.jpg')
  })

  test('ignora la query y decodifica el nombre', () => {
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/abc.jpg?t=123`), 'abc.jpg')
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/a%20b.jpg`), 'a b.jpg')
  })

  test('no toca nada que no sea de este bucket', () => {
    assert.equal(storagePathFromUrl('https://abc.supabase.co/storage/v1/object/public/avatars/x.jpg'), null)
    assert.equal(storagePathFromUrl('https://abc.supabase.co/storage/v1/object/sign/parrilla-media/x.jpg'), null)
    assert.equal(storagePathFromUrl('https://ejemplo.com/parrilla-media/x.jpg'), null)
  })

  test('rechaza lo que no es una URL, una ruta vacía o con ..', () => {
    assert.equal(storagePathFromUrl('no es una url'), null)
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/`), null)
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/../avatars/x.jpg`), null)
    assert.equal(storagePathFromUrl(`${BUCKET_URL}/%E0%A4%A.jpg`), null)
  })
})

// ───────────── Flujo con un cliente de Supabase simulado ─────────────
// No prueba PostgREST (eso se cubre a mano en el navegador): prueba el orden
// de las llamadas, los argumentos y cómo se traduce cada respuesta.

type Reply = { data: unknown; error?: { code?: string; message?: string } }

function fakeSupabase(replies: Reply[]) {
  const calls: { method: string; args: unknown[] }[] = []
  const removed: string[][] = []

  const chain: object = new Proxy(
    {},
    {
      get:
        (_target, method: string) =>
        (...args: unknown[]) => {
          calls.push({ method, args })
          if (method === 'maybeSingle' || method === 'single') {
            const reply = replies.shift() ?? { data: null }
            return Promise.resolve({ data: reply.data, error: reply.error ?? null })
          }
          return chain
        },
    }
  )

  const client = {
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return chain
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths)
          return { error: null }
        },
      }),
    },
  } as unknown as SupabaseClient

  const callsTo = (method: string) => calls.filter((c) => c.method === method)
  return { client, calls, callsTo, removed }
}

describe('applyPostUpdate', () => {
  test('un id que no es uuid es 404 y no toca la base', async () => {
    const fake = fakeSupabase([])
    const out = await applyPostUpdate(fake.client, 'no-es-uuid', { title: 'x' })
    assert.deepEqual(out, { ok: false, status: 404, error: 'La publicación ya no existe' })
    assert.equal(fake.calls.length, 0)
  })

  test('una publicación borrada es 404 y no intenta escribir', async () => {
    const fake = fakeSupabase([{ data: null }])
    const out = await applyPostUpdate(fake.client, ID, { title: 'x' })
    assert.equal(out.ok === false && out.status, 404)
    assert.equal(fake.callsTo('update').length, 0)
  })

  test('un token desactualizado es 409 y no escribe', async () => {
    const fake = fakeSupabase([{ data: current() }])
    const out = await applyPostUpdate(fake.client, ID, { title: 'x' }, { expected: 'viejo' })
    assert.equal(out.ok === false && out.status, 409)
    assert.equal(fake.callsTo('update').length, 0)
  })

  test('el camino feliz escribe el parche con el token que acaba de leer', async () => {
    const c = current()
    const fake = fakeSupabase([{ data: c }, { data: { id: ID } }])
    const out = await applyPostUpdate(fake.client, ID, { title: 'Nuevo' }, { expected: c.updated_at })
    assert.deepEqual(out, { ok: true })
    assert.deepEqual(fake.callsTo('update')[0].args[0], { title: 'Nuevo' })
    const guards = fake.callsTo('eq').map((call) => call.args.join('='))
    assert.ok(guards.includes(`id=${ID}`))
    assert.ok(guards.includes(`updated_at=${c.updated_at}`), 'el UPDATE debe llevar el token leído')
  })

  test('si entre la lectura y la escritura alguien guardó (0 filas) es 409', async () => {
    const fake = fakeSupabase([{ data: current() }, { data: null }])
    const out = await applyPostUpdate(fake.client, ID, { title: 'x' })
    assert.equal(out.ok === false && out.status, 409)
  })

  test('un parche vacío lee pero no escribe', async () => {
    const fake = fakeSupabase([{ data: current() }])
    assert.deepEqual(await applyPostUpdate(fake.client, ID, {}), { ok: true })
    assert.equal(fake.callsTo('update').length, 0)
  })

  test('una fecha fuera de orden se rechaza antes de escribir', async () => {
    const fake = fakeSupabase([{ data: current() }])
    const out = await applyPostUpdate(fake.client, ID, { publish_date: '2026-01-01' })
    assert.equal(out.ok === false && out.status, 400)
    assert.equal(fake.callsTo('update').length, 0)
  })

  test('un error de la base se traduce a un mensaje claro y se loguea', async () => {
    const fake = fakeSupabase([
      { data: current() },
      { data: null, error: { code: '23514', message: 'violates check constraint "parrilla_posts_category_check"' } },
    ])
    const out = await applyPostUpdate(fake.client, ID, { title: 'x' })
    assert.equal(out.ok === false && out.status, 400)
    assert.match(out.ok === false ? out.error : '', /categoría/)
  })

  test('un error de lectura usa el mensaje de la ruta', async () => {
    const fake = fakeSupabase([{ data: null, error: { code: '57014' } }])
    const out = await applyPostUpdate(fake.client, ID, { title: 'x' }, { fallback: 'No se pudo mover la publicación' })
    assert.deepEqual(out, { ok: false, status: 500, error: 'No se pudo mover la publicación' })
  })

  test('reemplazar la portada borra el archivo anterior', async () => {
    const c = current({ cover_image_url: `${BUCKET_URL}/vieja.jpg` })
    const fake = fakeSupabase([{ data: c }, { data: { id: ID } }])
    await applyPostUpdate(fake.client, ID, { cover_image_url: `${BUCKET_URL}/nueva.jpg` })
    assert.deepEqual(fake.removed, [['vieja.jpg']])
  })

  test('quitar la portada también borra el archivo anterior', async () => {
    const c = current({ cover_image_url: `${BUCKET_URL}/vieja.jpg` })
    const fake = fakeSupabase([{ data: c }, { data: { id: ID } }])
    await applyPostUpdate(fake.client, ID, { cover_image_url: null })
    assert.deepEqual(fake.removed, [['vieja.jpg']])
  })

  test('no borra nada si la portada no cambió o no había', async () => {
    const same = current({ cover_image_url: `${BUCKET_URL}/misma.jpg` })
    const a = fakeSupabase([{ data: same }, { data: { id: ID } }])
    await applyPostUpdate(a.client, ID, { cover_image_url: `${BUCKET_URL}/misma.jpg`, title: 'x' })
    assert.deepEqual(a.removed, [])

    const b = fakeSupabase([{ data: current() }, { data: { id: ID } }])
    await applyPostUpdate(b.client, ID, { cover_image_url: `${BUCKET_URL}/primera.jpg` })
    assert.deepEqual(b.removed, [])
  })

  test('no borra el archivo viejo si el UPDATE no se aplicó', async () => {
    const c = current({ cover_image_url: `${BUCKET_URL}/vieja.jpg` })
    const fake = fakeSupabase([{ data: c }, { data: null }])
    await applyPostUpdate(fake.client, ID, { cover_image_url: `${BUCKET_URL}/nueva.jpg` })
    assert.deepEqual(fake.removed, [])
  })
})

describe('deletePost', () => {
  test('un id que no es uuid es 404', async () => {
    const out = await deletePost(fakeSupabase([]).client, 'x')
    assert.equal(out.ok === false && out.status, 404)
  })

  test('borrar algo que no existe es 404, no éxito', async () => {
    const out = await deletePost(fakeSupabase([{ data: null }]).client, ID)
    assert.equal(out.ok === false && out.status, 404)
  })

  test('borra la fila y su portada en una sola llamada', async () => {
    const fake = fakeSupabase([{ data: { cover_image_url: `${BUCKET_URL}/portada.jpg` } }])
    assert.deepEqual(await deletePost(fake.client, ID), { ok: true })
    assert.deepEqual(fake.removed, [['portada.jpg']])
    assert.equal(fake.callsTo('delete').length, 1)
  })

  test('sin portada no toca Storage', async () => {
    const fake = fakeSupabase([{ data: { cover_image_url: null } }])
    assert.deepEqual(await deletePost(fake.client, ID), { ok: true })
    assert.deepEqual(fake.removed, [])
  })
})

describe('createPost', () => {
  const input = {
    title: 'Pieza nueva',
    platforms: ['instagram' as const],
    production_date: '2026-10-16',
    publish_date: '2026-10-20',
    hidden_sections: [],
    filmmaker_ids: [FM],
    editor_ids: [],
  }

  test('guarda todas las columnas normalizadas y con el autor', async () => {
    const fake = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    const out = await createPost(
      fake.client,
      { ...input, format: 'imagen', category: 'crecer', talent: 'Ana', copy_text: '   ', caption: ' Hola ' },
      USER
    )
    assert.deepEqual(out, { ok: true, id: 'nuevo-id' })

    const row = fake.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(row.created_by, USER)
    assert.equal(row.status, 'idea')
    assert.equal(row.talent, null, 'imagen oculta el Responsable en cámara')
    assert.deepEqual(row.filmmaker_ids, [], 'imagen + crecer oculta Filmmaker')
    assert.equal(row.copy_text, null)
    assert.equal(row.caption, 'Hola')
    assert.equal(row.category, 'crecer')
  })

  test('la Inspiración se guarda (recortada) en video y se descarta en otros formatos', async () => {
    const link = 'https://www.instagram.com/reel/abc123/'

    const video = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(video.client, { ...input, format: 'video', inspiration_url: ` ${link} ` }, USER)
    const rowVideo = video.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(rowVideo.inspiration_url, link)

    const imagen = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(imagen.client, { ...input, format: 'imagen', inspiration_url: link }, USER)
    const rowImagen = imagen.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(rowImagen.inspiration_url, null)

    const sinFormato = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(sinFormato.client, { ...input, inspiration_url: link }, USER)
    const rowSinFormato = sinFormato.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(rowSinFormato.inspiration_url, null)
  })

  test('guarda las secciones ocultas que llegan y no inventa ninguna por defecto', async () => {
    const conOcultas = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(conOcultas.client, { ...input, hidden_sections: ['guion', 'copy'] }, USER)
    const row = conOcultas.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.deepEqual(row.hidden_sections, ['guion', 'copy'])

    const sinOcultas = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(sinOcultas.client, input, USER)
    const row2 = sinOcultas.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.deepEqual(row2.hidden_sections, [])
  })

  test('ocultar no borra: una sección oculta conserva su contenido al crear', async () => {
    const fake = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(
      fake.client,
      { ...input, hidden_sections: ['guion'], copy_text: 'Guion que se conserva' },
      USER
    )
    const row = fake.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(row.copy_text, 'Guion que se conserva')
    assert.deepEqual(row.hidden_sections, ['guion'])
  })

  test('un video conserva Responsable en cámara y Filmmaker', async () => {
    const fake = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(fake.client, { ...input, format: 'video', talent: 'Ana' }, USER)
    const row = fake.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(row.talent, 'Ana')
    assert.deepEqual(row.filmmaker_ids, [FM])
  })

  test('crear una pieza archivada guarda la fecha de publicación vacía', async () => {
    const fake = fakeSupabase([{ data: { id: 'nuevo-id' } }])
    await createPost(fake.client, { ...input, status: 'archivado' }, USER)
    const row = fake.callsTo('insert')[0].args[0] as Record<string, unknown>
    assert.equal(row.status, 'archivado')
    assert.equal(row.publish_date, null)
  })

  test('un error de la base devuelve el fallo, no el id', async () => {
    const fake = fakeSupabase([{ data: null, error: { code: '23514', message: 'violates check constraint "parrilla_posts_category_check"' } }])
    const out = await createPost(fake.client, input, USER)
    assert.equal(out.ok, false)
  })
})
