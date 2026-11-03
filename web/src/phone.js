// Phone numbers in the international format WhatsApp needs: + country code + number, like +15125550101.
// Plain rules, no guessing beyond one: a 10-digit number with no country code is taken as a US number.

/** The number as +digits, '' when empty, or null when it can't be a full international number. */
export function phoneNumber(raw) {
  let typed = String(raw ?? '').trim()
  if (!typed) return ''
  if (/[^\d+\s().\-/]/.test(typed)) return null // letters or other characters
  typed = typed.replace(/^00/, '+')
  const digits = typed.replace(/\D/g, '')
  if (typed.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** Easier to read: +1 512 555 0101 for US numbers, otherwise + country code and the rest. */
export function showPhone(number) {
  const us = number?.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  return us ? `+1 ${us[1]} ${us[2]} ${us[3]}` : number ?? ''
}
