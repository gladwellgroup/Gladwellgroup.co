import Link from 'next/link'
import { ChevronRight, GraduationCap, Users } from 'lucide-react'
import { BrandCard } from '@/components/brand/brand-card'

interface Program {
  href: string
  title: string
  description: string
  icon: typeof Users
}

export function EntregablesHub({ basePath }: { basePath: string }) {
  const programs: Program[] = [
    {
      href: `${basePath}/terapia`,
      title: 'Terapia Organizacional',
      description:
        'Sesiones de feedback a fundadores. Genera el entregable con las recomendaciones de la comunidad y lo envía a la empresa invitada.',
      icon: Users,
    },
    {
      href: `${basePath}/education`,
      title: 'Gladwell Education',
      description:
        'Sesiones formativas con ponente. Captura herramientas y cápsulas, y envía el entregable a los asistentes registrados.',
      icon: GraduationCap,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-xl sm:text-2xl font-bold gladwell-gradient-text">
          Entregables
        </h1>
        <p className="text-muted-foreground">
          Elige el programa con el que vas a trabajar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {programs.map((program) => (
          <Link key={program.href} href={program.href} className="group block">
            <BrandCard className="flex h-full flex-col gap-3 transition-colors hover:bg-muted/30">
              <program.icon className="h-7 w-7 text-[#A78BFA]" />
              <h2 className="flex items-center gap-1.5 text-base font-semibold">
                {program.title}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </h2>
              <p className="text-sm text-muted-foreground">
                {program.description}
              </p>
            </BrandCard>
          </Link>
        ))}
      </div>
    </div>
  )
}
