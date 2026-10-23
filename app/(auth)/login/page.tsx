'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppRouter } from '@/hooks/use-app-router'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import { AUTH_FIELDS, AUTH_LOGIN_COPY, authQueryError } from '@/lib/data/auth-copy'
import { BrandCard } from '@/components/brand/brand-card'
import { BrandField } from '@/components/brand/brand-field'
import { BrandButton } from '@/components/brand/brand-button'

export default function LoginPage() {
  return (
    <Suspense fallback={<BrandCard className="max-w-md w-full space-y-6" />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useAppRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  // El aviso que dejó otra parte del sitio en la URL (`?error=auth` tras un enlace o Google que falló, `?error=perfil`
  // tras cerrar una cuenta sin perfil): antes la página lo ignoraba y la persona no veía por qué volvía al login.
  const [error, setError] = useState<string | null>(authQueryError(searchParams.get('error')))

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // El `try`: sin él, un fallo inesperado dejaba el botón en «Ingresando...» para siempre.
    let failure: string | null = null
    try {
      const { error: authError } = await getSupabaseBrowser().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        failure = authError.message.toLowerCase().includes('invalid login credentials')
          ? AUTH_LOGIN_COPY.errorInvalid
          : AUTH_LOGIN_COPY.errorGeneric
      }
    } catch {
      failure = AUTH_LOGIN_COPY.errorGeneric
    }

    if (failure) {
      setError(failure)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setError(AUTH_LOGIN_COPY.errorInvalid)
      return
    }

    setLoading(true)
    setError(null)

    let failed = false
    try {
      const { error: authError } = await getSupabaseBrowser().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      failed = Boolean(authError)
    } catch {
      failed = true
    }

    if (failed) {
      setError(AUTH_LOGIN_COPY.errorMagic)
      setLoading(false)
      return
    }

    setMagicSent(true)
    setLoading(false)
  }

  async function handleGoogleLogin() {
    // Ocupado mientras se manda a Google (el navegador sale de la página): evita un segundo toque. Si el resultado
    // es un error —proveedor mal configurado—, antes no pasaba nada y no se avisaba.
    setLoading(true)
    setError(null)

    let failed = false
    try {
      const { error: authError } = await getSupabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      failed = Boolean(authError)
    } catch {
      failed = true
    }

    if (failed) {
      setError(AUTH_LOGIN_COPY.errorGoogle)
      setLoading(false)
    }
  }

  if (magicSent) {
    return (
      <BrandCard className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold gladwell-gradient-text">
          {AUTH_LOGIN_COPY.magicSentTitle}
        </h1>
        <p className="text-muted-foreground">
          {AUTH_LOGIN_COPY.magicSentBody}{' '}
          <strong className="text-foreground">{email}</strong>.
        </p>
      </BrandCard>
    )
  }

  return (
    <BrandCard className="max-w-md w-full space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {AUTH_LOGIN_COPY.eyebrow}
        </p>
        <h1 className="text-2xl font-bold gladwell-gradient-text">
          {AUTH_LOGIN_COPY.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {AUTH_LOGIN_COPY.subtitle}
        </p>
      </div>

      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <BrandField
          id={AUTH_FIELDS.email.id}
          label={AUTH_FIELDS.email.label}
          type="email"
          required
          autoComplete="email"
          placeholder={AUTH_FIELDS.email.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <BrandField
          id={AUTH_FIELDS.password.id}
          label={AUTH_FIELDS.password.label}
          type="password"
          required
          autoComplete="current-password"
          placeholder={AUTH_FIELDS.password.placeholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <BrandButton type="submit" disabled={loading}>
          {loading ? AUTH_LOGIN_COPY.submitting : AUTH_LOGIN_COPY.submit}
        </BrandButton>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">o</span>
        </div>
      </div>

      <BrandButton
        type="button"
        variant="secondary"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        {AUTH_LOGIN_COPY.google}
      </BrandButton>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {AUTH_LOGIN_COPY.magicLink}
      </button>
    </BrandCard>
  )
}
