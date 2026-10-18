'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandButton } from '@/components/brand/brand-button'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandField } from '@/components/brand/brand-field'
import {
  AttendanceQrSection,
  type AttendanceLinkData,
} from '@/components/portal/attendance-qr-section'
import { CharlaAttendees } from '@/components/portal/charla-attendees'
import { PhotoUpload } from '@/components/portal/photo-upload'
import { CharlaBadge } from '@/components/portal/session-badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  CHARLA_TITLE_MAX,
  CHARLA_TITLE_MIN,
  type CharlaAttendee,
  type CharlaFields,
} from '@/lib/charlas/types'
import { parseDateOnly } from '@/lib/date'
import { uploadImage } from '@/lib/storage/upload-image'

interface CharlaDetailProps {
  charla: CharlaFields
  /** Cuántas personas registraron su asistencia (lo único que ve quien solo
   *  tiene el calendario). */
  asistentes: number
  /** `null` si quien mira no gestiona charlas: el servidor ni siquiera los
   *  envía, así que esta pantalla nunca tiene un nombre o correo que ocultar. */
  attendees: CharlaAttendee[] | null
  attendanceLink: AttendanceLinkData | null
  /** Con el módulo `charlas`. Sin él la ficha es de solo lectura. */
  canManage: boolean
  /** Listado de charlas, al que lleva «Volver». */
  listPath: string
}

type PatchResult = { ok: true; charla: CharlaFields } | { ok: false; error: string }

function CharlaHeader({
  title,
  sessionDate,
  listPath,
}: {
  title: string
  sessionDate: string
  listPath: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 pt-6 text-center sm:pt-8">
      <Link
        href={listPath}
        className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground active:text-foreground pointer-coarse:min-h-11"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>
      <h1 className="text-balance text-xl font-bold gladwell-gradient-text sm:text-2xl">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">
        {parseDateOnly(sessionDate).toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>
      <div className="mt-1">
        <CharlaBadge sessionDate={sessionDate} />
      </div>
    </div>
  )
}

/** Quien solo tiene el calendario ve la charla —nombre, fecha, foto— y cuántas
 *  personas asistieron, nunca quiénes. Ni campos, ni QR, ni lista. */
function CharlaReadOnly({
  charla,
  asistentes,
  listPath,
}: Pick<CharlaDetailProps, 'charla' | 'asistentes' | 'listPath'>) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CharlaHeader title={charla.title} sessionDate={charla.session_date} listPath={listPath} />
      <BrandCard className="space-y-4 text-center">
        {charla.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={charla.photo_url}
            alt={`Foto de ${charla.title}`}
            className="mx-auto aspect-[4/3] w-full max-w-sm rounded-xl border border-border object-cover"
          />
        )}
        <p className="text-sm text-muted-foreground">
          {asistentes === 0
            ? 'Aún nadie ha registrado su asistencia.'
            : asistentes === 1
              ? '1 persona registró su asistencia.'
              : `${asistentes} personas registraron su asistencia.`}
        </p>
      </BrandCard>
    </div>
  )
}

export function CharlaDetail(props: CharlaDetailProps) {
  if (!props.canManage || !props.attendees) {
    return (
      <CharlaReadOnly
        charla={props.charla}
        asistentes={props.asistentes}
        listPath={props.listPath}
      />
    )
  }

  return <CharlaManage {...props} attendees={props.attendees} />
}

function CharlaManage({
  charla,
  attendees,
  attendanceLink: initialLink,
  listPath,
}: CharlaDetailProps & { attendees: CharlaAttendee[] }) {
  // Lo último que el servidor confirmó: el encabezado lo muestra, y el botón
  // «Guardar cambios» se habilita solo cuando el formulario se aparta de esto.
  const [saved, setSaved] = useState({ title: charla.title, session_date: charla.session_date })
  const [title, setTitle] = useState(charla.title)
  const [sessionDate, setSessionDate] = useState(charla.session_date)
  const [savingData, setSavingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dataSaved, setDataSaved] = useState(false)

  // La foto que sigue guardada. `photoKey` remonta el selector cuando quitarla
  // falla, para que vuelva a mostrar la que sigue ahí.
  const [photoUrl, setPhotoUrl] = useState(charla.photo_url ?? '')
  const [photoKey, setPhotoKey] = useState(0)
  const [photoError, setPhotoError] = useState<string | null>(null)

  // El acordeón desmonta su contenido al cerrarse: el enlace vive aquí para no
  // perder el código recién generado al reabrir la sección.
  const [attendanceLink, setAttendanceLink] = useState<AttendanceLinkData | null>(initialLink)

  const dirty = title.trim() !== saved.title || sessionDate !== saved.session_date

  async function patchCharla(body: Record<string, string | null>): Promise<PatchResult> {
    try {
      const res = await fetch(`/api/charlas/${charla.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: data.error ?? 'No se pudo guardar la charla' }
      return { ok: true, charla: data.charla as CharlaFields }
    } catch {
      return { ok: false, error: 'Error de red al guardar la charla' }
    }
  }

  async function handleSaveData(e: React.FormEvent) {
    e.preventDefault()

    // Solo lo que cambió: el nombre no se vuelve a escribir si solo se movió la fecha.
    const patch: Record<string, string> = {}
    if (title.trim() !== saved.title) patch.title = title.trim()
    if (sessionDate !== saved.session_date) patch.session_date = sessionDate
    if (Object.keys(patch).length === 0) return

    setSavingData(true)
    setDataError(null)
    setDataSaved(false)

    const result = await patchCharla(patch)
    setSavingData(false)

    if (!result.ok) {
      setDataError(result.error)
      return
    }

    setSaved({ title: result.charla.title, session_date: result.charla.session_date })
    setTitle(result.charla.title)
    setSessionDate(result.charla.session_date)
    setDataSaved(true)
  }

  // Subir y guardar son un solo paso: si guardar falla, `PhotoUpload` vuelve a la
  // foto anterior y muestra el mensaje, en vez de dejar una foto en pantalla que
  // la charla no tiene.
  async function uploadPhoto(file: File): Promise<{ url: string }> {
    const { url } = await uploadImage({ bucket: 'charlas-media', file })
    const result = await patchCharla({ photo_url: url })
    if (!result.ok) throw new Error(result.error)
    return { url }
  }

  async function handlePhotoChange(url: string) {
    setPhotoError(null)

    // Subida: `uploadPhoto` ya la guardó.
    if (url) {
      setPhotoUrl(url)
      return
    }

    // Quitarla.
    const result = await patchCharla({ photo_url: null })
    if (!result.ok) {
      setPhotoError(result.error)
      setPhotoKey((key) => key + 1)
      return
    }
    setPhotoUrl('')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <CharlaHeader title={saved.title} sessionDate={saved.session_date} listPath={listPath} />

      <Accordion type="multiple" defaultValue={['datos', 'foto', 'asistencia']}>
        <AccordionItem value="datos">
          <AccordionTrigger className="text-base font-semibold">
            Datos de la charla
          </AccordionTrigger>
          <AccordionContent>
            <form onSubmit={handleSaveData} className="space-y-4">
              <BrandField
                id="charla-title"
                label="Nombre de la charla"
                type="text"
                required
                minLength={CHARLA_TITLE_MIN}
                maxLength={CHARLA_TITLE_MAX}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDataSaved(false)
                }}
              />
              <BrandField
                id="charla-date"
                label="Fecha"
                type="date"
                required
                value={sessionDate}
                onChange={(e) => {
                  setSessionDate(e.target.value)
                  setDataSaved(false)
                }}
              />
              {dataError && (
                <p role="alert" className="text-sm text-red-500">
                  {dataError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <BrandButton
                  type="submit"
                  size="sm"
                  className="w-auto"
                  disabled={!dirty || savingData}
                >
                  {savingData ? 'Guardando…' : 'Guardar cambios'}
                </BrandButton>
                {dataSaved && (
                  <p role="status" className="text-xs text-green-500">
                    Cambios guardados
                  </p>
                )}
              </div>
            </form>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="foto">
          <AccordionTrigger className="text-base font-semibold">Foto</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {/* Acotada: a todo lo ancho la foto ocupaba casi una pantalla de iPad y
                empujaba el QR —lo que se usa durante la charla— fuera de vista. */}
            <div className="mx-auto w-full max-w-sm">
              <PhotoUpload
                key={photoKey}
                currentUrl={photoUrl}
                label="Subir foto de la charla"
                confirmTitle="¿Quitar la foto de la charla?"
                confirmMessage="Podrás subir otra cuando quieras."
                onUpload={uploadPhoto}
                onUploaded={(url) => {
                  void handlePhotoChange(url)
                }}
              />
            </div>
            {photoError && (
              <p role="alert" className="text-sm text-red-500">
                {photoError}
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Se muestra en la página donde las personas registran su asistencia.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="asistencia">
          <AccordionTrigger className="text-base font-semibold">
            <span className="flex items-center gap-2">
              Asistencia
              {attendees.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({attendees.length})
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Comparte el código durante la charla: quien lo escanee registra su
              nombre y correo. Vence a las 24 horas; si hace falta, se regenera.
            </p>
            <AttendanceQrSection
              sessionId={charla.id}
              program="charla"
              link={attendanceLink}
              onLinkChange={setAttendanceLink}
            />
            <CharlaAttendees attendees={attendees} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
