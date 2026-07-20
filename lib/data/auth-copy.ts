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
} as const
