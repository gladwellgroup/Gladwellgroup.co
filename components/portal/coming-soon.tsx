import { BrandCard } from '@/components/brand/brand-card'

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">{title}</h1>
      <BrandCard className="text-center">
        <p className="text-muted-foreground">
          {description ?? 'Este módulo estará disponible próximamente.'}
        </p>
      </BrandCard>
    </div>
  )
}
