'use client'

import { BrandButton } from '@/components/brand/brand-button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="portal-header max-w-md w-full rounded-xl border border-border/50 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <BrandButton
            type="button"
            variant="secondary"
            size="sm"
            className="w-auto"
            onClick={onCancel}
          >
            Cancelar
          </BrandButton>
          <BrandButton
            type="button"
            size="sm"
            className="w-auto"
            onClick={onConfirm}
          >
            {confirmLabel}
          </BrandButton>
        </div>
      </div>
    </div>
  )
}
