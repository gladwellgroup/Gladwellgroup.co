import type { SupabaseClient } from '@supabase/supabase-js'
import type { EducationContentSource } from '@/lib/education/deliverable-render'

interface SessionRef {
  id: string
  title: string
  session_date: string
}

/** Reúne inputs + herramientas + entregable en el shape que consumen la
 *  plantilla HTML y el PDF. Lo usan las tres rutas que renderizan el
 *  entregable (process, pdf y approve). */
export async function loadEducationContentSource(
  supabase: SupabaseClient,
  session: SessionRef,
  overrides?: Partial<EducationContentSource>
): Promise<EducationContentSource> {
  const [inputsRes, toolsRes, deliverableRes] = await Promise.all([
    supabase
      .from('education_session_inputs')
      .select(
        'ponente_nombre, ponente_rol, ponente_foto_url, frase_texto, frase_autor, foto_sesion_url'
      )
      .eq('session_id', session.id)
      .single(),
    supabase
      .from('education_tools')
      .select('nombre, descripcion, url, orden')
      .eq('session_id', session.id)
      .order('orden', { ascending: true }),
    supabase
      .from('education_deliverables')
      .select('conclusiones_clave, capsulas, pdf_url')
      .eq('session_id', session.id)
      .single(),
  ])

  const inputs = inputsRes.data
  const deliverable = deliverableRes.data

  return {
    sessionTitle: session.title,
    sessionDate: session.session_date,
    ponenteNombre: inputs?.ponente_nombre ?? null,
    ponenteRol: inputs?.ponente_rol ?? null,
    ponenteFotoUrl: inputs?.ponente_foto_url ?? null,
    conclusionesClave: deliverable?.conclusiones_clave ?? '',
    capsulas: deliverable?.capsulas ?? '',
    tools: toolsRes.data ?? [],
    fotoSesionUrl: inputs?.foto_sesion_url ?? null,
    fraseTexto: inputs?.frase_texto ?? null,
    fraseAutor: inputs?.frase_autor ?? null,
    pdfUrl: deliverable?.pdf_url ?? null,
    ...overrides,
  }
}
