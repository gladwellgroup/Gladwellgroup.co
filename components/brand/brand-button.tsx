import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const brandButtonVariants = cva(
  'inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-wide transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100',
  {
    variants: {
      variant: {
        primary:
          'gladwell-gradient text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]',
        secondary:
          'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'px-6 py-3',
        sm: 'px-4 py-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

export interface BrandButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof brandButtonVariants> {
  asChild?: boolean
}

export function BrandButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: BrandButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(brandButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
