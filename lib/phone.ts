export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "")
}

export function buildWhatsappE164(dialCode: string, localDigits: string): string {
  const countryDigits = dialCode.replace(/\D/g, "")
  const local = normalizePhoneDigits(localDigits)
  return `+${countryDigits}${local}`
}
