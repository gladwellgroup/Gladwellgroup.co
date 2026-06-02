export interface Founder {
  name: string
  role: string
  description: string
  image: string
}

export const FOUNDERS: Founder[] = [
  {
    name: "José Daniel González Calvo",
    role: "Co-Fundador",
    description:
      "Estratega especializado en innovación y desarrollo organizacional, como profesional. Docente Universitario y diseñador de soluciones de impacto para organizaciones desde el emprendimiento y la educación liderando iniciativas de cambio estructural.",
    image: "/images/founder-1.jpg",
  },
  {
    name: "Daniel Felipe Tovar Vargas",
    role: "Co-Fundador",
    description:
      "Administrador de Empresas de la Javeriana. Executive Programs Director en 30X con Andrés Bilbao. Especialista en consultoría estratégica, gestión comercial, productos digitales y construcción de marca personal.",
    image: "/images/founder-2.jpg",
  },
  {
    name: "Miguel Angel Martínez Valencia",
    role: "Co-Fundador",
    description:
      "Docente e investigador de la Universidad Externado de Colombia. Fundador de Next Leap, empresa de automatización e IA en el sector jurídico. Especialista en gobernanza de IA, derecho tecnológico y automatización de procesos jurídicos.",
    image: "/images/founder-3.jpg",
  },
]
