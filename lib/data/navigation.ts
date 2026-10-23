export interface NavLink {
  label: string
  href: string
}

/** Links in the top navbar */
export const NAV_LINKS: NavLink[] = [
  { label: "Xperience", href: "#experience" },
  { label: "Consulting", href: "#consulting" },
  { label: "Education", href: "#education" },
  { label: "Comunidad", href: "#comunidad" },
  { label: "Galería", href: "#galeria" },
  { label: "Equipo", href: "#equipo" },
]

/** Links shown in the footer navigation */
export const FOOTER_NAV_LINKS: NavLink[] = [
  { label: "Xperience", href: "#experience" },
  { label: "Consulting", href: "#consulting" },
  { label: "Education", href: "#education" },
  { label: "Comunidad", href: "#comunidad" },
]

/** Numeric scroll indicators in the hero (right side) */
export const HERO_INDICATORS = [
  { num: "01", href: "#inicio" },
  { num: "02", href: "#presentacion" },
  { num: "03", href: "#pilares" },
  { num: "04", href: "#comunidad" },
  { num: "05", href: "#galeria" },
  { num: "06", href: "#equipo" },
]
