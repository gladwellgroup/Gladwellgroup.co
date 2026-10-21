export interface Founder {
  name: string
  role: string
  /** Cargo en Gladwell; se muestra tras el rol, en la misma línea cuando cabe. */
  title: string
  description: string
  image: string
}

export const FOUNDERS: Founder[] = [
  {
    name: "José Daniel González Calvo",
    role: "Co-Fundador",
    title: "Managing Director",
    description:
      "Estratega especializado en innovación y desarrollo organizacional. Docente Universitario en La Javeriana y La Sabana, diseñador de soluciones de impacto para organizaciones desde el emprendimiento y la educación.",
    image: "/images/founder-1.2.jpg",
  },
  {
    name: "Daniel Felipe Tovar Vargas",
    role: "Co-Fundador",
    title: "Advisor",
    description:
      "Administrador de Empresas de la Javeriana. Executive Programs Director en 30X con Andrés Bilbao. Especialista en consultoría estratégica, gestión comercial, productos digitales y construcción de marca personal.",
    image: "/images/founder-2.jpg",
  },
]
