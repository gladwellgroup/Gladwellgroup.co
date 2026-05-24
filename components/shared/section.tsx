import { SectionDivider } from "./section-divider"

interface SectionProps {
  id: string
  children: React.ReactNode
  className?: string
  withDivider?: boolean
  noPadding?: boolean
}

export function Section({
  id,
  children,
  className = "",
  withDivider = true,
  noPadding = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-24 ${noPadding ? "" : "py-24"} ${className}`}
    >
      {withDivider && <SectionDivider />}
      <div className="container mx-auto px-6 relative z-10">{children}</div>
    </section>
  )
}
