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
import { useRestoreFocus } from '@/hooks/use-restore-focus'

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
 *  pantalla, cierra con Esc, atrapa el foco y bloquea el scroll del fondo.
 *
 *  Al cerrarse devuelve el foco a quien lo tenía al abrirse (`useRestoreFocus`).
 *  Radix solo lo devuelve a un `DialogTrigger`, y este diálogo es controlado (lo
 *  abre un estado, no un trigger), así que sin esto el foco caía en <body>: quien
 *  navega con teclado perdía su lugar —en una lista de asistentes, al principio de
 *  la página— cada vez que cancelaba. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { remember, restore } = useRestoreFocus()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="portal-header rounded-xl border-border/50 sm:max-w-md"
        // Se dispara ANTES de que Radix mueva el foco al diálogo: ahí todavía lo tiene el botón que lo abrió.
        onOpenAutoFocus={remember}
        // Si ya no existe (la fila se borró al confirmar) se deja el comportamiento de Radix.
        onCloseAutoFocus={restore}
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
