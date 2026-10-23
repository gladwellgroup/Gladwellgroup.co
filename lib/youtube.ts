/** Un id de video de YouTube: 11 caracteres entre letras, números, «-» y «_». */
const YOUTUBE_ID = /^[\w-]{11}$/

/** Falla al renderizar, en el servidor, con un id mal escrito (una letra de más o de menos, un espacio): si no, la miniatura
 *  salía rota y el reproductor decía «video no disponible» recién en el navegador, y solo al reproducir. */
function checked(id: string): string {
  if (!YOUTUBE_ID.test(id)) throw new Error(`«${id}» no es un id de video de YouTube (11 caracteres)`)
  return id
}

/** Las miniaturas que genera YouTube. `maxresdefault` (1280×720) solo existe si el video se subió en HD: sin ella responde
 *  404 con una imagen de relleno de 1 KB. `sddefault` (640×480) y `hqdefault` (480×360) existen siempre, pero son 4:3 con franjas
 *  negras arriba y abajo (el video va en 16:9): en una caja 16:9 con `object-cover` esas franjas quedan fuera. */
export type YoutubePoster = "maxresdefault" | "sddefault" | "hqdefault"

export function youtubePoster(id: string, quality: YoutubePoster): string {
  return `https://img.youtube.com/vi/${checked(id)}/${quality}.jpg`
}

/** La dirección del reproductor, con reproducción automática (solo se monta tras un clic). El dominio `-nocookie` no deja
 *  cookies de YouTube hasta que la persona reproduce. */
export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${checked(id)}?autoplay=1&rel=0&modestbranding=1`
}
