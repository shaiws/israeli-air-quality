/** Israeli MoEP AQI-ish bands (description colors from API). */
export const AQI_LABELS: Record<string, string> = {
  טובה: 'טובה',
  בינונית: 'בינונית',
  'גבוהה מדרגה א': 'גבוהה (א)',
  'גבוהה מדרגה ב': 'גבוהה (ב)',
  'גבוהה מאוד': 'גבוהה מאוד',
}

export const POLLUTANT_HE: Record<string, string> = {
  'PM2.5': 'PM2.5',
  PM25: 'PM2.5',
  PM10: 'PM10',
  NO2: 'NO₂',
  NO: 'NO',
  NOX: 'NOx',
  O3: 'O₃',
  SO2: 'SO₂',
  CO: 'CO',
  Benzene: 'בנזן',
  Toluen: 'טולואן',
  H2S: 'H₂S',
}

export const COMMON_POLLUTANTS = ['PM2.5', 'PM10', 'NO2', 'O3', 'SO2', 'CO'] as const

export function pollutantLabel(name: string): string {
  return POLLUTANT_HE[name] ?? name
}

export function isValidIndex(n: number | null | undefined): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > -9000
}

export function isValidValue(n: number | null | undefined): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > -9000
}

export function aqiTextColor(hex: string | undefined): string {
  if (!hex || hex.toLowerCase() === 'gray') return '#334155'
  return '#0f172a'
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Jerusalem',
    }).format(d)
  } catch {
    return iso
  }
}
