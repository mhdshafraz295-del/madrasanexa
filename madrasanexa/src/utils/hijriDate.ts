/**
 * Formats a given date to the Islamic Umm al-Qura Hijri Calendar.
 * e.g., "13 Jumada al-Akhirah 1448 AH"
 */
export function formatHijriDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formatted = formatter.format(date);
    return formatted.includes('AH') ? formatted : `${formatted} AH`;
  } catch {
    try {
      const fallbackFormatter = new Intl.DateTimeFormat('en-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const fallbackFormatted = fallbackFormatter.format(date);
      return fallbackFormatted.includes('AH') ? fallbackFormatted : `${fallbackFormatted} AH`;
    } catch {
      return '1448 AH';
    }
  }
}
