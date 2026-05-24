interface SectionDividerProps {
  position?: "top" | "inline"
  className?: string
}

export function SectionDivider({ position = "top", className = "" }: SectionDividerProps) {
  if (position === "inline") {
    return <div className={`h-px w-full divider-gradient ${className}`} />
  }
  return <div className={`absolute top-0 left-0 right-0 h-px divider-gradient ${className}`} />
}
