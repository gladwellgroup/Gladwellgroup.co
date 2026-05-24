export interface Pillar {
  id: string
  title: string
  subtitle: string
  description: string
  fullDescription: string
  modalCta: string
  image: string
  number: string
  highlights: string[]
  gallery: string[]
}

export const PILLARS: Pillar[] = [
  {
    id: "experience",
    title: "Experience",
    subtitle: "Vivencias transformadoras",
    description: "Eventos exclusivos diseñados para crear conexiones significativas entre estrategas.",
    fullDescription:
      "Nuestras experiencias son encuentros diseñados para estrategas de alto nivel: conexiones profundas, perspectivas nuevas y vínculos que trascienden lo profesional.",
    modalCta: "Forma parte de nuestra comunidad y accede a experiencias exclusivas.",
    image: "/images/experience/experience-01.jpg",
    number: "01",
    highlights: [
      "Cenas ejecutivas mensuales con líderes de la industria",
      "Retiros de inmersión estratégica trimestrales",
      "Encuentros exclusivos con ponentes internacionales",
      "Networking con la comunidad Gladwell global",
      "Acceso prioritario a eventos limitados",
      "Experiencias personalizadas según intereses",
    ],
    gallery: [
      "/images/experience/experience-01.jpg",
      "/images/experience/experience-02.jpg",
      "/images/experience/experience-03.jpg",
      "/images/experience/experience-04.jpg",
      "/images/experience/experience-05.jpg",
      "/images/experience/experience-06.jpg",
      "/images/experience/experience-07.jpg",
      "/images/experience/experience-08.jpg",
    ],
  },
  {
    id: "consulting",
    title: "Consulting",
    subtitle: "Estrategia aplicada",
    description: "Acompañamiento estratégico para organizaciones que buscan transformarse.",
    fullDescription:
      "Combinamos experiencia, metodologías probadas y visión innovadora para diseñar e implementar estrategias con impacto real. Somos socios estratégicos comprometidos con la transformación de tu organización.",
    modalCta: "Conecta con consultores estrategas y lleva la transformación a tu organización.",
    image: "/images/consulting/consulting-01.jpg",
    number: "02",
    highlights: [
      "Diagnóstico estratégico integral",
      "Diseño de estrategia corporativa",
      "Transformación organizacional",
      "Coaching ejecutivo personalizado",
      "Facilitación de sesiones estratégicas",
      "Acompañamiento en implementación",
    ],
    gallery: [
      "/images/consulting/consulting-01.jpg",
      "/images/consulting/consulting-02.jpg",
      "/images/consulting/consulting-03.jpg",
      "/images/consulting/consulting-04.jpg",
      "/images/consulting/consulting-05.jpg",
      "/images/consulting/consulting-06.jpg",
      "/images/consulting/consulting-07.jpg",
      "/images/consulting/consulting-08.jpg",
    ],
  },
  {
    id: "education",
    title: "Education",
    subtitle: "Conocimiento que transforma",
    description: "Programas de formación diseñados para líderes que quieren dominar el arte de la estrategia.",
    fullDescription:
      "Programas diseñados por y para estrategas: teoría de vanguardia y aplicación práctica inmediata, desde workshops intensivos hasta desarrollo ejecutivo de largo plazo.",
    modalCta: "Únete a programas de formación diseñados para líderes que piensan en estrategia.",
    image: "/images/education/education-01.jpg",
    number: "03",
    highlights: [
      "Masterclasses con expertos reconocidos",
      "Workshops intensivos de estrategia",
      "Programa de desarrollo ejecutivo",
      "Certificaciones en metodologías estratégicas",
      "Biblioteca de recursos exclusivos",
      "Mentoría grupal e individual",
    ],
    gallery: [
      "/images/education/education-01.jpg",
      "/images/education/education-02.jpg",
      "/images/education/education-03.jpg",
      "/images/education/education-04.jpg",
      "/images/education/education-05.jpg",
      "/images/education/education-06.jpg",
      "/images/education/education-07.jpg",
      "/images/education/education-08.jpg",
    ],
  },
]
