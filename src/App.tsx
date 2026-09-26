import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDashboard } from './api/air'
import type { AirSnapshot, StationView } from './api/types'
import { ForecastPanel } from './components/ForecastPanel'
import { StationCard } from './components/StationCard'
import { StationDetail } from './components/StationDetail'
import { StatusBanner } from './components/StatusBanner'
import { formatDateTime } from './lib/aqi'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AirSnapshot | null>(null)
  const [stations, setStations] = useState<StationView[]>([])
  const [source, setSource] = useState<'live' | 'snapshot' | null>(null)
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('הכל')
  const [onlyWithAqi, setOnlyWithAqi] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function refresh() {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError(null)
    try {
      const data = await loadDashboard(ac.signal)
      setSnapshot(data.snapshot)
      setStations(data.stations)
      setSource(data.source)
      if (data.stations.length && selectedId == null) {
        const preferred =
          data.stations.find((s) => s.name.includes('כיכר ספרא')) ??
          data.stations.find((s) => s.aqi) ??
          data.stations[0]
        setSelectedId(preferred.stationId)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const regions = useMemo(() => {
    const set = new Set(stations.map((s) => s.regionName).filter(Boolean))
    return ['הכל', ...[...set].sort((a, b) => a.localeCompare(b, 'he'))]
  }, [stations])

  const filtered = useMemo(() => {
    const q = query.trim()
    return stations.filter((s) => {
      if (region !== 'הכל' && s.regionName !== region) return false
      if (onlyWithAqi && !s.aqi) return false
      if (!q) return true
      return (
        s.name.includes(q) ||
        s.regionName.includes(q) ||
        (s.owner ?? '').includes(q) ||
        String(s.stationId).includes(q)
      )
    })
  }, [stations, query, region, onlyWithAqi])

  const selected = stations.find((s) => s.stationId === selectedId) ?? null

  const withAqi = stations.filter((s) => s.aqi).length

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="text-center">
        <p className="text-sm font-medium text-emerald-700">
          המשרד להגנת הסביבה · data.gov.il · air.sviva.gov.il
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900 sm:text-4xl">
          איכות האוויר בישראל
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-600">
          לוח בקרה בעברית (RTL) עם מדדי איכות אוויר עדכניים לפי תחנות ניטור, קריאות מזהמים
          (PM2.5, PM10, NO₂, O₃, SO₂, CO ועוד) ותחזית אזורית רשמית.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          disabled={loading}
        >
          רענון
        </button>
        <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm border border-slate-200">
          {withAqi} תחנות עם מדד · {stations.length} סה״כ
        </span>
        {source && (
          <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm border border-slate-200">
            מקור: {source === 'live' ? 'חי (פרוקסי מקומי)' : 'צילום סטטי'}
          </span>
        )}
        {snapshot?.fetchedAt && (
          <span className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm border border-slate-200" dir="ltr">
            {formatDateTime(snapshot.fetchedAt)}
          </span>
        )}
      </div>

      <StatusBanner loading={loading} error={error} empty={!loading && !error && filtered.length === 0} />

      {snapshot && <ForecastPanel forecast={snapshot.forecast ?? []} />}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="block text-xs font-bold text-slate-500">חיפוש תחנה / אזור</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="לדוגמה: כיכר ספרא, תל אביב…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="mt-2 block text-xs font-bold text-slate-500">אזור</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyWithAqi}
                onChange={(e) => setOnlyWithAqi(e.target.checked)}
              />
              רק תחנות עם מדד עדכני
            </label>
          </div>

          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pe-1">
            {filtered.map((s) => (
              <StationCard
                key={s.stationId}
                station={s}
                selected={s.stationId === selectedId}
                onSelect={() => setSelectedId(s.stationId)}
              />
            ))}
          </div>
        </aside>

        <StationDetail station={selected} />
      </div>

      <footer className="mt-auto border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>
          מקורות רשמיים:{' '}
          <a className="text-emerald-700 underline" href="https://air.sviva.gov.il/" target="_blank" rel="noreferrer">
            air.sviva.gov.il
          </a>{' '}
          (Envista API) ·{' '}
          <a className="text-emerald-700 underline" href="https://data.gov.il/dataset/air-stations" target="_blank" rel="noreferrer">
            תחנות ניטור
          </a>{' '}
          ·{' '}
          <a className="text-emerald-700 underline" href="https://data.gov.il/dataset/cf-output" target="_blank" rel="noreferrer">
            תחזית מזהמים
          </a>{' '}
          ב־data.gov.il
        </p>
        <p className="mt-1" dir="ltr">
          Envista CORS is locked to air.sviva.gov.il — Pages serves a CI snapshot; local dev uses
          Vite /api/moep middleware. data.gov.il CKAN allows Access-Control-Allow-Origin: *.
        </p>
      </footer>
    </div>
  )
}
