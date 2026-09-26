import type { ForecastRecord } from '../api/types'

const QUALITY_STYLE: Record<string, string> = {
  טובה: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  בינונית: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  'גבוהה מדרגה א': 'bg-orange-100 text-orange-900 border-orange-200',
  'גבוהה מדרגה ב': 'bg-red-100 text-red-900 border-red-200',
  'גבוהה מאוד': 'bg-purple-100 text-purple-900 border-purple-200',
}

type Props = {
  forecast: ForecastRecord[]
}

export function ForecastPanel({ forecast }: Props) {
  const maps = forecast.filter((f) => f.type === 'Map')
  const content = forecast.filter((f) => f.type === 'Content')
  const oneDay = content.find((c) => c.name === 'OneDay')
  const twoDay = content.find((c) => c.name === 'TwoDay')
  const warning = content.find((c) => c.name === 'Warning')

  if (!maps.length && !content.length) return null

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-slate-900">תחזית אזורית לאיכות האוויר</h2>
        <p className="text-xs text-slate-500">
          מקור: data.gov.il · חבילת <span dir="ltr">cf-output</span> (המשרד להגנת הסביבה)
        </p>
      </div>

      {(oneDay || twoDay || warning) && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {oneDay && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <div className="font-bold text-slate-800">
                {oneDay.day_of_week} · {oneDay.date}
              </div>
              <div className="text-slate-600">
                בוקר: {oneDay.morning || '—'} · צהריים: {oneDay.noon || '—'} · ערב:{' '}
                {oneDay.evening || '—'}
              </div>
            </div>
          )}
          {twoDay && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <div className="font-bold text-slate-800">
                {twoDay.day_of_week} · {twoDay.date}
              </div>
              <div className="text-slate-600">
                בוקר: {twoDay.morning || '—'} · צהריים: {twoDay.noon || '—'} · ערב:{' '}
                {twoDay.evening || '—'}
              </div>
            </div>
          )}
          {warning?.date && warning.date !== 'null' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:col-span-2">
              התרעה / תוכן מיוחד לתאריך {warning.date}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {maps.map((m) => {
          const q = m.air_quality ?? '—'
          const style = QUALITY_STYLE[q] ?? 'bg-slate-100 text-slate-800 border-slate-200'
          return (
            <div key={m.name ?? m._id} className={`rounded-xl border px-3 py-2 ${style}`}>
              <div className="text-sm font-bold">{m.title ?? m.name}</div>
              <div className="text-xs opacity-90">{q}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
