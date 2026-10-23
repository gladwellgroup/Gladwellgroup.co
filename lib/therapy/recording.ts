/** Segundos transcurridos desde `startedAt`, redondeados y sin pasar de `max`. Se calcula con el reloj y no contando
 *  ticks de un intervalo: un navegador que frena los temporizadores de una pestaña en segundo plano (iPad, ahorro de
 *  batería) no hace que la grabación «dure» menos de lo que duró. */
export function recordedSeconds(startedAt: number, now: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round((now - startedAt) / 1000)))
}

/** El reloj, aparte para que el componente lo llame desde sus manejadores de eventos (la regla de pureza de React no
 *  distingue un manejador de un render cuando ve `Date.now()` escrito dentro del componente). */
export const nowMs = (): number => Date.now()
