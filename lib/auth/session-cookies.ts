/** ¿Es una cookie donde @supabase/ssr guarda la sesión? `sb-<proyecto>-auth-token`, partida en `.0`, `.1`… cuando
 *  es larga, y la del verificador de PKCE (`-code-verifier`) mientras se entra con Google o con enlace. */
export function isSessionCookie(name: string): boolean {
  return /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name)
}
