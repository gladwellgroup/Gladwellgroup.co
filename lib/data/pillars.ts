export interface Pillar {
  id: string
  title: string
  subtitle: string
  description: string
  fullDescription: string
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
      "Nuestras experiencias son mucho más que eventos. Son encuentros cuidadosamente diseñados para crear conexiones profundas entre estrategas de alto nivel. Desde cenas íntimas en locaciones exclusivas hasta retiros de inmersión en la naturaleza, cada experiencia está pensada para expandir tu red, desafiar tu perspectiva y generar vínculos que trascienden lo profesional.",
    image: "/images/experience/experience-01.jpg",
    number: "01",
    highlights: [
      "Cenas ejecutivas mensuales con líderes de industria",
      "Retiros de inmersión estratégica trimestrales",
      "Encuentros exclusivos con speakers internacionales",
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
      "Nuestro equipo de consultores combina décadas de experiencia con metodologías probadas y perspectivas innovadoras. Trabajamos junto a tu organización para diseñar e implementar estrategias que generan impacto real y sostenible. No somos consultores tradicionales: somos socios estratégicos comprometidos con tu éxito.",
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
      "Creemos que el conocimiento estratégico debe ser accesible, práctico y transformador. Nuestros programas de formación están diseñados por y para estrategas, combinando teoría de vanguardia con aplicación práctica inmediata. Desde workshops intensivos de un día hasta programas de desarrollo ejecutivo de largo plazo.",
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
