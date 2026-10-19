'use client'

import { X } from 'lucide-react'
import { ParrillaPostForm } from '@/components/portal/parrilla-post-form'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRestoreFocus } from '@/hooks/use-restore-focus'
import type { ParrillaEditor, ParrillaPostSummary, ParrillaStatus } from '@/lib/parrilla/posts'
import type { PostDraft } from '@/lib/parrilla/rules'

interface ParrillaPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = crear. En edición llega el resumen del calendario; el formulario
   *  pide el detalle (Guion, Copy, portada) al abrirse. */
  post: ParrillaPostSummary | null
  defaultDate?: string
  /** Estado con el que arranca una pieza nueva. 'archivado' = una idea para el
   *  Banco de contenido: cambia el título del modal y el botón de guardar. */
  defaultStatus?: ParrillaStatus
  /** Título, copy y categoría con los que arranca una pieza NUEVA (p. ej. desde
   *  una frase de la pestaña «Frases»). En edición se ignora. */
  draft?: PostDraft
  /** La frase de la que nace la pieza nueva: se guarda como vínculo para poder
   *  marcarla «Usada». */
  sourceQuoteId?: string
  editors: ParrillaEditor[]
}

/** Solo el contenedor. El formulario va DENTRO del contenido del diálogo, que
 *  Radix desmonta al cerrar: así el formulario nace de cero en cada apertura,
 *  con el estado inicial correcto, sin un efecto que tenga que "resetearlo".
 *
 *  Misma estructura que components/modals/pillar-modal.tsx: el cierre y el
 *  encabezado quedan fijos y quien hace scroll es el cuerpo del formulario, así
 *  la X no se va al desplazar y "Guardar" siempre está a la vista (clave en
 *  iPad, donde el formulario es más largo que la pantalla). `dvh` y no `vh`:
 *  `vh` ignora las barras del navegador en iPad. */
export function ParrillaPostDialog({
  open,
  onOpenChange,
  post,
  defaultDate,
  defaultStatus,
  draft,
  sourceQuoteId,
  editors,
}: ParrillaPostDialogProps) {
  const newIdea = !post && defaultStatus === 'archivado'
  // Diálogo controlado, sin trigger: se devuelve el foco a quien lo abrió (el día del
  // calendario, la fila del Banco o «Crear contenido»).
  const { remember, restore } = useRestoreFocus()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="portal-header flex max-h-[85dvh] flex-col gap-0 overflow-hidden overscroll-y-contain p-0 sm:max-w-lg"
        // Un toque fuera (p. ej. para bajar el teclado en iPad) no debe descartar
        // lo escrito: se cierra con la X, con Esc o al guardar.
        onInteractOutside={(event) => event.preventDefault()}
        // Al consultar una pieza existente no se enfoca el Título: en iPad subiría
        // el teclado solo por abrirla. Con un borrador (una frase ya prellenada)
        // tampoco: lo que sigue es elegir plataformas y fechas, no escribir. El
        // foco queda en el diálogo (sigue atrapado).
        onOpenAutoFocus={(event) => {
          remember()
          if (!post && !draft) return
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus()
        }}
        onCloseAutoFocus={restore}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pb-3 pt-6 text-center sm:text-center">
          <DialogTitle>
            {post ? 'Editar publicación' : newIdea ? 'Nueva idea' : 'Nueva publicación'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {post
              ? 'Edita los datos de la publicación y guarda los cambios.'
              : newIdea
                ? 'Completa los datos de la nueva idea para guardarla en el Banco de contenido.'
                : 'Completa los datos de la nueva publicación.'}
          </DialogDescription>
        </DialogHeader>

        <ParrillaPostForm
          key={post?.id ?? `new-${defaultDate ?? ''}-${sourceQuoteId ?? ''}`}
          post={post}
          defaultDate={defaultDate}
          defaultStatus={defaultStatus}
          draft={draft}
          sourceQuoteId={sourceQuoteId}
          editors={editors}
          onClose={() => onOpenChange(false)}
        />

        {/* Va después del formulario en el DOM (posición absoluta: no cambia lo
            que se ve) para que el primer elemento enfocable al crear sea el
            Título y no la X. */}
        <DialogClose className="modal-close-button-panel" aria-label="Cerrar">
          <X className="h-5 w-5" aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
