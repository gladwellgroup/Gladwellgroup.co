export interface AmericasPhoneCode {
  iso: string
  name: string
  dialCode: string
}

export const DEFAULT_PHONE_COUNTRY = "CO"

const REST_OF_AMERICAS: AmericasPhoneCode[] = [
  { iso: "AG", name: "Antigua y Barbuda", dialCode: "+1" },
  { iso: "AR", name: "Argentina", dialCode: "+54" },
  { iso: "BS", name: "Bahamas", dialCode: "+1" },
  { iso: "BB", name: "Barbados", dialCode: "+1" },
  { iso: "BZ", name: "Belice", dialCode: "+501" },
  { iso: "BO", name: "Bolivia", dialCode: "+591" },
  { iso: "BR", name: "Brasil", dialCode: "+55" },
  { iso: "CA", name: "Canadá", dialCode: "+1" },
  { iso: "CL", name: "Chile", dialCode: "+56" },
  { iso: "CR", name: "Costa Rica", dialCode: "+506" },
  { iso: "CU", name: "Cuba", dialCode: "+53" },
  { iso: "DM", name: "Dominica", dialCode: "+1" },
  { iso: "EC", name: "Ecuador", dialCode: "+593" },
  { iso: "SV", name: "El Salvador", dialCode: "+503" },
  { iso: "GD", name: "Granada", dialCode: "+1" },
  { iso: "GT", name: "Guatemala", dialCode: "+502" },
  { iso: "GY", name: "Guyana", dialCode: "+592" },
  { iso: "HT", name: "Haití", dialCode: "+509" },
  { iso: "HN", name: "Honduras", dialCode: "+504" },
  { iso: "JM", name: "Jamaica", dialCode: "+1" },
  { iso: "MX", name: "México", dialCode: "+52" },
  { iso: "NI", name: "Nicaragua", dialCode: "+505" },
  { iso: "PA", name: "Panamá", dialCode: "+507" },
  { iso: "PY", name: "Paraguay", dialCode: "+595" },
  { iso: "PE", name: "Perú", dialCode: "+51" },
  { iso: "DO", name: "República Dominicana", dialCode: "+1" },
  { iso: "KN", name: "San Cristóbal y Nieves", dialCode: "+1" },
  { iso: "VC", name: "San Vicente y las Granadinas", dialCode: "+1" },
  { iso: "LC", name: "Santa Lucía", dialCode: "+1" },
  { iso: "SR", name: "Surinam", dialCode: "+597" },
  { iso: "TT", name: "Trinidad y Tobago", dialCode: "+1" },
  { iso: "UY", name: "Uruguay", dialCode: "+598" },
  { iso: "VE", name: "Venezuela", dialCode: "+58" },
]

/** Colombia primero, EE.UU. segundo, resto A–Z por nombre en español. */
export const AMERICAS_PHONE_CODES: AmericasPhoneCode[] = [
  { iso: "CO", name: "Colombia", dialCode: "+57" },
  { iso: "US", name: "Estados Unidos", dialCode: "+1" },
  ...REST_OF_AMERICAS,
]

const byIso = new Map(AMERICAS_PHONE_CODES.map((entry) => [entry.iso, entry]))

export function getPhoneCodeByIso(iso: string): AmericasPhoneCode | undefined {
  return byIso.get(iso)
}

export function isValidAmericasPhoneIso(iso: string): boolean {
  return byIso.has(iso)
}
