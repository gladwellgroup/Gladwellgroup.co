export interface Founder {
  name: string
  role: string
  description: string
  image: string
}

export const FOUNDERS: Founder[] = [
  {
    name: "José Daniel Gonzáles Calvo",
    role: "Co-Fundador",
    description:
      "Estratega especializado en transformación digital y desarrollo organizacional con más de 20 años de experiencia liderando iniciativas de cambio estructural.",
    image: "/images/founder-1.jpg",
  },
  {
    name: "Daniel Felipe Tovar Vargas",
    role: "Co-Fundador",
    description:
      "Experto en innovación estratégica y diseño de modelos de negocio. Referente en consultoría estratégica en Latinoamérica con participación en más de 200 transformaciones.",
    image: "/images/founder-2.jpg",
  },
  {
    name: "Miguel Angel Martínez Valencia",
    role: "Co-Fundador",
    description:
      "Mentor de emprendedores y pensador estratégico con profunda experiencia en asesoría empresarial y desarrollo de liderazgo ejecutivo.",
    image: "/images/founder-3.jpg",
  },
]
