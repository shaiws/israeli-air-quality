import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { fetchStationHistory } from '../api/air'
import type { HistoryPoint, StationView } from '../api/types'
import {
  COMMON_POLLUTANTS,
  formatDateTime,
  isValidIndex,
  isValidValue,
  pollutantLabel,
} from '../lib/aqi'

type Props = {
  station: StationView | null
}

export function StationDetail({ station }: Props) {
  const [pollutant, setPollutant] = useState('PM2.5')
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState<string | null>(null)

  const available = useMemo(() => {
    if (!station) return [] as string[]
    const fromMonitors = station.monitors.map((m) => m.name)
    const fromIndex = (station.aqi?.indexes ?? []).map((i) => i.pollutant)
    const fromChannels = (station.channels ?? []).map((c) => c.name)
    const set = new Set([...fromMonitors, ...fromIndex, ...fromChannels])
    const preferred = COMMON_POLLUTANTS.filter((p) =>
      [...set].some(
        (x) => x === p || x.replace('.', '') === p.replace('.', '') || x === 'PM25',
      ),
    )
    const rest = [...set].filter((x) => !preferred.includes(x as (typeof COMMON_POLLUTANTS)[number]))
    return [...preferred, ...rest]
  }, [station])

  useEffect(() => {
    if (!station) return
    if (available.length && !available.includes(pollutant)) {
      setPollutant(available[0])
    }
  }, [station, available, pollutant])

  useEffect(() => {
    if (!station || !import.meta.env.DEV) {
      setHistory([])
      return
    }
    const ac = new AbortController()
    setHistLoading(true)
    setHistError(null)
    fetchStationHistory(station, pollutant, ac.signal)
      .then(setHistory)
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return
        setHistError(err instanceof Error ? err.message : String(err))
        setHistory([])
      })
      .finally(() => setHistLoading(false))
    return () => ac.abort()
  }, [station, pollutant])

  if (!station) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-slate-500">
        בחרו תחנת ניטור מהרשימה כדי לראות פירוט מזהמים.
      </div>
    )
  }

  const aqi = station.aqi
  const barData = (aqi?.indexes ?? [])
    .filter((p) => isValidIndex(p.index) || isValidValue(p.value))
    .map((p) => ({
      name: pollutantLabel(p.pollutant),
      index: isValidIndex(p.index) ? p.index : null,
      value: isValidValue(p.value) ? p.value : null,
      fill: p.color && p.color.toLowerCase() !== 'gray' ? p.color : '#94a3b8',
    }))

  const channelCards = (station.channels ?? []).filter(
    (c) =>
      isValidValue(c.value) &&
      !['WS', 'WD', 'Temp', 'RH', 'PREC', 'Pressure'].includes(c.name),
  )

  const lineData = history
    .filter((h) => h.value != null)
    .map((h) => ({
      t: formatDateTime(h.datetime),
      value: h.value,
    }))

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{station.name}</h2>
          <p className="text-sm text-slate-500">
            {station.regionName}
            {station.owner ? ` · ${station.owner}` : ''}
            {station.latitude != null && station.longitude != null ? (
              <>
                {' · '}
                <span dir="ltr">
                  {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {aqi && (
          <div
            className="rounded-xl px-3 py-2 text-center font-bold"
            style={{
              backgroundColor:
                aqi.color && aqi.color.toLowerCase() !== 'gray' ? aqi.color : '#e2e8f0',
            }}
          >
            <div className="text-sm">{aqi.description}</div>
            <div className="text-xs font-medium opacity-80">
              מדד {isValidIndex(aqi.index) ? aqi.index : '—'} · {pollutantLabel(aqi.pollutant)}
            </div>
            <div className="text-[11px] font-normal" dir="ltr">
              {formatDateTime(aqi.datetime)}
            </div>
          </div>
        )}
      </div>

      {channelCards.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-700">קריאות אחרונות</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {channelCards.map((c) => (
              <div
                key={`${c.id}-${c.name}`}
                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="text-xs text-slate-500">{c.alias || pollutantLabel(c.name)}</div>
                <div className="text-lg font-bold text-slate-900">
                  {c.value}
                  <span className="mr-1 text-xs font-medium text-slate-500">{c.units}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {barData.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-700">מדדי איכות אוויר לפי מזהם</h3>
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="index" name="מדד (0–100)" radius={[6, 6, 0, 0]}>
                  {barData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500">
            במדד הישראלי ערך גבוה יותר = איכות טובה יותר (עד 100).
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-700">מגמה (48 שעות)</h3>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            value={pollutant}
            onChange={(e) => setPollutant(e.target.value)}
          >
            {available.map((p) => (
              <option key={p} value={p}>
                {pollutantLabel(p)}
              </option>
            ))}
          </select>
        </div>
        {!import.meta.env.DEV && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            גרף היסטוריה חי זמין ב־<code className="font-mono">npm run dev</code> דרך פרוקסי מקומי
            (API של המשרד נעול ל־CORS). ב־GitHub Pages מוצג צילום עדכני של המדדים והקריאות.
          </p>
        )}
        {import.meta.env.DEV && histLoading && (
          <p className="text-sm text-slate-500">טוען היסטוריה…</p>
        )}
        {histError && <p className="text-sm text-red-600">{histError}</p>}
        {import.meta.env.DEV && !histLoading && lineData.length === 0 && !histError && (
          <p className="text-sm text-slate-500">אין נקודות היסטוריה למזהם זה.</p>
        )}
        {lineData.length > 0 && (
          <div className="h-56 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={pollutantLabel(pollutant)}
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
