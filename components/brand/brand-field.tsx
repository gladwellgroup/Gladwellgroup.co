import * as React from 'react'
import { cn } from '@/lib/utils'

interface BrandFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  wrapperClassName?: string
}

export const BrandField = React.forwardRef<HTMLInputElement, BrandFieldProps>(
  ({ label, id, className, wrapperClassName, ...props }, ref) => (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      <label htmlFor={id} className="modal-label">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        className={cn('modal-field', className)}
        {...props}
      />
    </div>
  )
)
BrandField.displayName = 'BrandField'

interface BrandTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  wrapperClassName?: string
}

export const BrandTextarea = React.forwardRef<
  HTMLTextAreaElement,
  BrandTextareaProps
>(({ label, id, className, wrapperClassName, ...props }, ref) => (
  <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
    <label htmlFor={id} className="modal-label">
      {label}
    </label>
    <textarea
      id={id}
      ref={ref}
      className={cn('modal-field min-h-[80px]', className)}
      {...props}
    />
  </div>
))
BrandTextarea.displayName = 'BrandTextarea'
