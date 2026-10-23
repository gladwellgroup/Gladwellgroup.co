export interface Founder {
  name: string
  /** «Cofounder». Opcional: el equipo base no se compone solo de fundadores. */
  role?: string
  /** Cargo en Gladwell; se muestra tras el rol, en la misma línea cuando cabe. */
  title: string
  /** Opcional: sin ella la tarjeta no dibuja el párrafo. */
  description?: string
  /** Ruta en `public/images/`. Sin ella el círculo reserva el espacio y muestra las iniciales. */
  image?: string
}

/** Une con espacios de no separación (U+00A0) las palabras de una frase: al saltar de línea baja
 *  entera, en vez de dejar sus últimas palabras solas en la última. */
const unbroken = (phrase: string) => phrase.replace(/ /g, "\u00a0")

export const FOUNDERS: Founder[] = [
  {
    name: "José Daniel González Calvo",
    role: "Cofounder",
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
    role: "Cofounder",
    title: "Advisor",
    description:
      "Administrador de Empresas de la Javeriana. Executive Programs Director en 30X con Andrés Bilbao. Especialista en consultoría estratégica, gestión comercial, productos digitales y construcción de marca personal.",
    image: "/images/founder-2.jpg",
  },
  {
    name: "Ana Sofia Moscoso",
    title: "Operations Lead",
    description:
      "Estudiante de Administración de Empresas, con estudios en Negocios Internacionales en Canadá. Interesada en el liderazgo, en iniciativas sociales y educativas y en proyectos de impacto positivo en personas y comunidades.",
    image: "/images/ana-sofia-moscoso.jpg",
  },
  {
    name: "Jhonattan Rodríguez",
    title: "CTO & Filmmaker",
    description:
      "Rol tripartito autodidacta como Growth Hacker con énfasis en el sector inmobiliario, filmmaker y desarrollador de software, emprendedor desde los 18 años e involucrado desde 2019 en el " +
      unbroken("ecosistema tech."),
    image: "/images/jhonattan-rodriguez-2.jpg",
  },
]
