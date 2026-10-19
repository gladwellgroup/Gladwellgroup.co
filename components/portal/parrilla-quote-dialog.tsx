'use client'

import { X } from 'lucide-react'
import { ParrillaQuoteForm } from '@/components/portal/parrilla-quote-form'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRestoreFocus } from '@/hooks/use-restore-focus'
import type { ParrillaQuote } from '@/lib/parrilla/quotes'

interface ParrillaQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = crear. En edición llega la frase de la lista: trae todos sus campos,
   *  así que el formulario abre al instante, sin pedir un detalle aparte. */
  quote: ParrillaQuote | null
  /** Los referentes que ya existen: sugerencias para no escribirlos de tres
   *  maneras. */
  authors: string[]
}

/** Solo el contenedor, igual que parrilla-post-dialog.tsx: el formulario va
 *  DENTRO del contenido del diálogo, que Radix desmonta al cerrar, así que nace
 *  de cero en cada apertura. El cierre y el encabezado quedan fijos y quien hace
 *  scroll es el cuerpo, para que la X no se vaya y «Guardar» siempre esté a la
 *  vista (en iPad el teclado se come media pantalla). `dvh` y no `vh`: `vh`
 *  ignora las barras del navegador en iPad. */
export function ParrillaQuoteDialog({ open, onOpenChange, quote, authors }: ParrillaQuoteDialogProps) {
  // Diálogo controlado, sin trigger: se devuelve el foco a la tarjeta o al botón que lo abrió.
  const { remember, restore } = useRestoreFocus()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="portal-header flex max-h-[85dvh] flex-col gap-0 overflow-hidden overscroll-y-contain p-0 sm:max-w-lg"
        // Un toque fuera (p. ej. para bajar el teclado en iPad) no debe descartar
        // lo escrito: se cierra con la X, con Esc o al guardar.
        onInteractOutside={(event) => event.preventDefault()}
        // Al consultar una frase existente no se enfoca el primer campo: en iPad
        // subiría el teclado solo por abrirla. Al crear sí: escribir es el punto.
        onOpenAutoFocus={(event) => {
          remember()
          if (!quote) return
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus()
        }}
        onCloseAutoFocus={restore}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 pb-3 pt-6 text-center sm:text-center">
          <DialogTitle>{quote ? 'Editar frase' : 'Nueva frase'}</DialogTitle>
          <DialogDescription className="sr-only">
            {quote
              ? 'Edita los datos de la frase y guarda los cambios.'
              : 'Escribe la frase y su referente para guardarla en la biblioteca.'}
          </DialogDescription>
        </DialogHeader>

        <ParrillaQuoteForm
          key={quote?.id ?? 'new'}
          quote={quote}
          authors={authors}
          onClose={() => onOpenChange(false)}
        />

        {/* Va después del formulario en el DOM (posición absoluta: no cambia lo
            que se ve) para que el primer elemento enfocable al crear sea la
            Frase y no la X. */}
        <DialogClose className="modal-close-button-panel" aria-label="Cerrar">
          <X className="h-5 w-5" aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
