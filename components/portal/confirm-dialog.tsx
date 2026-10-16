'use client'

import { BrandButton } from '@/components/brand/brand-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** Sobre el Dialog de Radix y no sobre un `fixed inset-0` propio: un overlay
 *  `fixed` queda atrapado dentro de cualquier ancestro con `transform`,
 *  `translate` o `backdrop-filter` (el DialogContent de un modal, una
 *  BrandCard…), así que se dibujaba del tamaño de ese ancestro y, con el modal
 *  desplazado, quedaba fuera de pantalla. El Dialog sale a `body`, cubre toda la
 *  pantalla, cierra con Esc, atrapa el foco y bloquea el scroll del fondo. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="portal-header rounded-xl border-border/50 sm:max-w-md"
      >
        <DialogHeader className="text-left sm:text-left">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 sm:flex-row">
          <BrandButton
            type="button"
            variant="secondary"
            size="sm"
            className="w-auto"
            onClick={onCancel}
          >
            Cancelar
          </BrandButton>
          <BrandButton type="button" size="sm" className="w-auto" onClick={onConfirm}>
            {confirmLabel}
          </BrandButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
