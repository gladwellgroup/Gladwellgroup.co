import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  href?: string
  className?: string
}

export function BrandLogo({ href = '/', className }: BrandLogoProps) {
  return (
    <Link href={href} className="flex items-center pointer-coarse:min-h-11">
      <span
        className={cn(
          'text-xl md:text-2xl font-bold tracking-tight gladwell-gradient-text no-underline decoration-transparent',
          className
        )}
      >
        GLADWELL
      </span>
    </Link>
  )
}
