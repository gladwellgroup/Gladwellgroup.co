'use client'

import { ParrillaPostForm } from '@/components/portal/parrilla-post-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ParrillaEditor, ParrillaPostSummary } from '@/lib/parrilla/posts'

interface ParrillaPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = crear. En edición llega el resumen del calendario; el formulario
   *  pide el detalle (Guion, Copy, portada) al abrirse. */
  post: ParrillaPostSummary | null
  defaultDate?: string
  editors: ParrillaEditor[]
}

/** Solo el contenedor. El formulario va DENTRO del contenido del diálogo, que
 *  Radix desmonta al cerrar: así el formulario nace de cero en cada apertura,
 *  con el estado inicial correcto, sin un efecto que tenga que "resetearlo". */
export function ParrillaPostDialog({
  open,
  onOpenChange,
  post,
  defaultDate,
  editors,
}: ParrillaPostDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="portal-header max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>{post ? 'Editar publicación' : 'Nueva publicación'}</DialogTitle>
        </DialogHeader>

        <ParrillaPostForm
          key={post?.id ?? `new-${defaultDate ?? ''}`}
          post={post}
          defaultDate={defaultDate}
          editors={editors}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
