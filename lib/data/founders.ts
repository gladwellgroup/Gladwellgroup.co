export interface Founder {
  name: string
  /** «Co-Fundador». Opcional: el equipo base no se compone solo de fundadores. */
  role?: string
  /** Cargo en Gladwell; se muestra tras el rol, en la misma línea cuando cabe. */
  title: string
  description: string
  /** Ruta en `public/images/`. Sin ella el círculo reserva el espacio y muestra las iniciales. */
  image?: string
}

/** Une con espacios de no separación (U+00A0) las palabras de una frase: al saltar de línea baja
 *  entera, en vez de dejar sus últimas palabras solas en la última. */
const unbroken = (phrase: string) => phrase.replace(/ /g, "\u00a0")

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
    name: "Mariana Nova Martínez",
    title: "Marketing Director",
    description:
      "Estudiante de Negocios Internacionales, apasionada por el marketing, la moda y el emprendimiento. Español, inglés, francés y aprendiendo más!! Buscando nuevas ideas, proyectos y experiencias " +
      unbroken("para crear, crecer y reír."),
    image: "/images/mariana-nova.jpg",
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
