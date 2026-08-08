/** Primer token del nombre: "Shaun Murphy" → "Shaun". Un saludo con nombre y
 *  apellido se lee como correo masivo; el nombre de pila, como una nota
 *  escrita para esa persona. */
export function firstName(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? ''
}
