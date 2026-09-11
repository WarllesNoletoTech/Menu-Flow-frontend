export function normalizeWhatsAppText(value: string) {
  return value
    .normalize('NFC')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function buildWhatsAppUrl(number: string, message: string) {
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(normalizeWhatsAppText(message))}`;
}
