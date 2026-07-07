export const WHATSAPP_MIN_DIGITS = 9
export const WHATSAPP_MAX_DIGITS = 15

export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "")
}

export function isoToFlagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export function isWhatsappDigitsValid(digits: string): boolean {
  const len = digits.length
  return len >= WHATSAPP_MIN_DIGITS && len <= WHATSAPP_MAX_DIGITS
}

export function buildWhatsappE164(dialCode: string, localDigits: string): string {
  const countryDigits = dialCode.replace(/\D/g, "")
  const local = normalizePhoneDigits(localDigits)
  return `+${countryDigits}${local}`
}
