"use client"

import { useState } from "react"
import { Instagram, Linkedin, Send, CheckCircle, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface WalkingListModalProps {
  isOpen: boolean
  onClose: () => void
}

const INITIAL_FORM = {
  nombre: "",
  apellidos: "",
  correo: "",
  red: "" as "linkedin" | "instagram" | "",
  perfil: "",
}

const inputClass =
  "rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/50 border border-white/15 focus:border-[#7C3AED]/60 focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/40 transition-all bg-white/5 w-full"
const labelClass = "text-xs font-medium text-white uppercase tracking-wider"

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
      <DialogContent className="w-full max-w-md rounded-2xl p-8 border border-white/10 shadow-[0_0_60px_rgba(124,58,237,0.2)] bg-[#0d0d1a]/95 backdrop-blur-xl">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-6 gap-5">
            <div className="w-16 h-16 rounded-full gladwell-gradient flex items-center justify-center">
              <CheckCircle size={32} className="text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold gladwell-gradient-text mb-2">
                ¡Ya estás en la lista!
              </DialogTitle>
              <DialogDescription className="text-white/90 text-sm leading-relaxed">
                Hola <span className="text-white font-semibold">{form.nombre}</span>, te avisaremos
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
            <DialogHeader className="mb-7">
              <p className="text-xs uppercase tracking-[0.25em] text-white/80 mb-1">Comunidad Gladwell</p>
              <DialogTitle className="text-2xl font-bold gladwell-gradient-text">
                Únete a la Walking List
              </DialogTitle>
              <DialogDescription className="text-sm text-white/90 mt-1">
                Apasionados por la estrategia te espera.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nombre" className={labelClass}>Nombre</label>
                  <input id="nombre" name="nombre" type="text" required placeholder="José Daniel"
                    value={form.nombre} onChange={handleChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="apellidos" className={labelClass}>Apellidos</label>
                  <input id="apellidos" name="apellidos" type="text" required placeholder="González"
                    value={form.apellidos} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="correo" className={labelClass}>Correo electrónico</label>
                <input id="correo" name="correo" type="email" required placeholder="tu@correo.com"
                  value={form.correo} onChange={handleChange} className={inputClass} />
              </div>

              <div className="flex flex-col gap-2">
                <span className={labelClass}>Red social preferida</span>
                <div className="grid grid-cols-2 gap-3">
                  {(["linkedin", "instagram"] as const).map((red) => (
                    <button
                      key={red}
                      type="button"
                      onClick={() => handleRed(red)}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 ${
                        form.red === red
                          ? "gladwell-gradient text-white border-transparent shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                          : "bg-white/5 border-white/15 text-white/80 hover:border-white/30 hover:text-white"
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
                  <label htmlFor="perfil" className={labelClass}>
                    {form.red === "linkedin" ? "URL de LinkedIn" : "Usuario de Instagram"}
                  </label>
                  <input
                    id="perfil" name="perfil" type="text"
                    placeholder={form.red === "linkedin" ? "linkedin.com/in/tuperfil" : "@tuperfil"}
                    value={form.perfil} onChange={handleChange} className={inputClass}
                  />
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
