import * as React from 'react'
import { cn } from '@/lib/utils'

interface BrandCardProps extends React.ComponentProps<'div'> {
  padding?: 'sm' | 'lg'
  /** 'gradient' (default) para tarjetas estáticas. 'solid' para tarjetas que
   *  envuelven contenido con scroll horizontal — un marco decorativo fijo
   *  alrededor de contenido que se desliza se lee como una línea ajena
   *  cortando el contenido, no como el borde de la tarjeta. */
  border?: 'gradient' | 'solid'
}

export function BrandCard({
  className,
  padding = 'lg',
  border = 'gradient',
  children,
  ...props
}: BrandCardProps) {
  return (
    <div
      className={cn(
        'glass rounded-2xl',
        border === 'gradient' ? 'gladwell-border-gradient' : 'border border-border/50',
        padding === 'lg' ? 'p-8' : 'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
