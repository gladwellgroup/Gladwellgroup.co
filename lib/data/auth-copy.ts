export const AUTH_FIELDS = {
  email: {
    id: 'email',
    label: 'Correo electrónico',
    placeholder: 'tu@correo.com',
  },
  password: {
    id: 'password',
    label: 'Contraseña',
    placeholder: 'Tu contraseña',
  },
} as const

export const AUTH_LOGIN_COPY = {
  eyebrow: 'Portal',
  title: 'Iniciar sesión',
  subtitle: 'Ingresa con tu correo de invitación',
  submit: 'Iniciar sesión',
  submitting: 'Ingresando...',
  google: 'Continuar con Google',
  magicLink: 'Usar enlace por correo',
  magicSentTitle: 'Revisa tu correo',
  magicSentBody: 'Enviamos un enlace de acceso a',
  errorInvalid: 'Correo o contraseña incorrectos.',
  errorGeneric: 'No pudimos iniciar sesión. Intenta de nuevo.',
  errorMagic: 'No pudimos enviar el enlace. Intenta de nuevo.',
  errorGoogle: 'No pudimos conectar con Google. Intenta de nuevo.',
} as const

/** Los avisos que otras partes del sitio dejan en la URL del login (`/login?error=…`): `auth` lo pone el retorno de
 *  Google / del enlace por correo (app/api/auth/callback) y `perfil` el cierre de una cuenta sin perfil
 *  (app/api/auth/signout). */
const AUTH_QUERY_ERRORS = {
  auth: 'No pudimos validar tu acceso. Pide un enlace nuevo o ingresa con tu contraseña.',
  perfil:
    'Tu cuenta no tiene un perfil en el portal. Pide a un administrador de Gladwell que te envíe una invitación.',
} as const

/** El texto para el `?error=` de la URL, o null si no es uno de los conocidos (cualquier otro valor se ignora). */
export function authQueryError(code: string | null): string | null {
  return code === 'auth' || code === 'perfil' ? AUTH_QUERY_ERRORS[code] : null
}
