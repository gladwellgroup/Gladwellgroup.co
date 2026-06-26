"use client"

import { useState } from "react"
import { Instagram, Linkedin, Send, CheckCircle, AlertCircle, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AMERICAS_PHONE_CODES,
  DEFAULT_PHONE_COUNTRY,
} from "@/lib/data/americas-phone-codes"
import { normalizePhoneDigits } from "@/lib/phone"

interface WalkingListModalProps {
  isOpen: boolean
  onClose: () => void
}

const INITIAL_FORM = {
  nombre: "",
  apellidos: "",
  correo: "",
  whatsapp_pais: DEFAULT_PHONE_COUNTRY,
  whatsapp_numero: "",
  red: "" as "linkedin" | "instagram" | "",
  perfil: "",
}

export function WalkingListModal({ isOpen, onClose }: WalkingListModalProps) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleRed = (red: "linkedin" | "instagram") => {
    setForm((prev) => ({ ...prev, red, perfil: "" }))
    setError(null)
  }

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, whatsapp_pais: e.target.value }))
    setError(null)
  }

  const handleWhatsappNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, whatsapp_numero: normalizePhoneDigits(e.target.value) }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/walking-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          apellidos: form.apellidos,
          correo: form.correo,
          whatsapp_pais: form.whatsapp_pais,
          whatsapp_numero: form.whatsapp_numero,
          red_social: form.red,
          perfil: form.perfil || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "No pudimos registrar tu solicitud. Intenta de nuevo.")
        return
      }

      setSubmitted(true)
    } catch {
      setError("No pudimos registrar tu solicitud. Verifica tu conexión e intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      setTimeout(() => {
        setSubmitted(false)
        setError(null)
        setForm(INITIAL_FORM)
      }, 300)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="modal-panel w-full max-w-md rounded-2xl p-8">
        <button onClick={() => handleOpenChange(false)} className="modal-close-button-panel" aria-label="Cerrar modal">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {submitted ? (
          <div className="flex flex-col items-center text-center py-6 gap-5">
            <div className="w-16 h-16 rounded-full gladwell-gradient flex items-center justify-center">
              <CheckCircle size={32} className="text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold gladwell-gradient-text mb-2">
                ¡Ya estás en la lista!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
                Hola <span className="text-foreground font-semibold">{form.nombre}</span>, te avisaremos
                cuando abramos las puertas. Estamos apasionados por verte crecer.
              </DialogDescription>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="mt-2 px-8 py-3 rounded-full gladwell-gradient text-white font-semibold text-sm tracking-wide hover:scale-105 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <DialogHeader className="mb-7 text-center sm:text-left">
              <p className="mb-1 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Comunidad Gladwell
              </p>
              <DialogTitle className="text-2xl font-bold gladwell-gradient-text">
                Únete a la Walking List
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Apasionados por la estrategia te espera.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 max-sm:text-center sm:text-left"
              noValidate
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nombre" className="modal-label max-sm:text-center">
                    Nombre
                  </label>
                  <input id="nombre" name="nombre" type="text" required placeholder="José Daniel"
                    value={form.nombre} onChange={handleChange} className="modal-field" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="apellidos" className="modal-label max-sm:text-center">
                    Apellidos
                  </label>
                  <input id="apellidos" name="apellidos" type="text" required placeholder="González"
                    value={form.apellidos} onChange={handleChange} className="modal-field" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="correo" className="modal-label max-sm:text-center">
                  Correo electrónico
                </label>
                <input id="correo" name="correo" type="email" required placeholder="tu@correo.com"
                  value={form.correo} onChange={handleChange} className="modal-field" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="whatsapp_numero" className="modal-label max-sm:text-center">
                  WhatsApp
                </label>
                <div className="grid grid-cols-[minmax(8.5rem,40%)_1fr] gap-3">
                  <select
                    id="whatsapp_pais"
                    name="whatsapp_pais"
                    value={form.whatsapp_pais}
                    onChange={handleCountryChange}
                    className="modal-field"
                    aria-label="Indicativo de país"
                  >
                    {AMERICAS_PHONE_CODES.map(({ iso, name, dialCode }) => (
                      <option key={iso} value={iso}>
                        {name} ({dialCode})
                      </option>
                    ))}
                  </select>
                  <input
                    id="whatsapp_numero"
                    name="whatsapp_numero"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    placeholder="300 123 4567"
                    value={form.whatsapp_numero}
                    onChange={handleWhatsappNumberChange}
                    className="modal-field"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="modal-label max-sm:text-center">Red social preferida</span>
                <div className="grid grid-cols-2 gap-3">
                  {(["linkedin", "instagram"] as const).map((red) => (
                    <button
                      key={red}
                      type="button"
                      onClick={() => handleRed(red)}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                        form.red === red
                          ? "gladwell-gradient text-white border-transparent shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                          : "bg-muted/50 border-border text-muted-foreground hover:border-[#7C3AED]/40 hover:text-foreground"
                      }`}
                    >
                      {red === "linkedin" ? <Linkedin size={16} /> : <Instagram size={16} />}
                      {red === "linkedin" ? "LinkedIn" : "Instagram"}
                    </button>
                  ))}
                </div>
              </div>

              {form.red && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="perfil" className="modal-label max-sm:text-center">
                    {form.red === "linkedin" ? "URL de LinkedIn" : "Usuario de Instagram"}
                  </label>
                  <input
                    id="perfil" name="perfil" type="text"
                    placeholder={form.red === "linkedin" ? "linkedin.com/in/tuperfil" : "@tuperfil"}
                    value={form.perfil} onChange={handleChange} className="modal-field"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400 max-sm:flex-col max-sm:items-center sm:justify-start sm:text-left">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !form.red}
                className="mt-2 flex items-center justify-center gap-2 px-8 py-3.5 rounded-full gladwell-gradient text-white font-semibold text-sm tracking-wide hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  <>
                    <Send size={16} />
                    Unirme a la Walking List
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
