interface SectionHeaderProps {
  eyebrow: string
  title: string
  titleAsGradient?: boolean
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  titleAsGradient = true,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`text-center mb-16 ${className}`}>
      <span className="text-sm text-muted-foreground uppercase tracking-widest mb-4 block">
        {eyebrow}
      </span>
      <h2 className="text-4xl md:text-5xl font-bold text-balance">
        {titleAsGradient ? (
          <span className="gladwell-gradient-text">{title}</span>
        ) : (
          title
        )}
      </h2>
    </div>
  )
}
