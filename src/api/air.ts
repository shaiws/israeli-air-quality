import type {
  AirSnapshot,
  HistoryPoint,
  StationIndex,
  StationMeta,
  StationReading,
  StationView,
} from './types'
import { isValidValue } from '../lib/aqi'

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/latest.json`
const useLiveProxy = import.meta.env.DEV

function mergeStationViews(
  stations: StationMeta[],
  index: StationIndex[],
  readings: StationReading[],
): StationView[] {
  const byIndex = new Map(index.map((i) => [i.stationId, i]))
  const byReading = new Map(readings.map((r) => [r.stationId, r]))
  return stations
    .map((s) => {
      const aqi = byIndex.get(s.stationId)
      const channels = byReading.get(s.stationId)?.regionData?.channels?.map((c) => ({
        ...c,
        value: isValidValue(c.value) ? c.value : null,
      }))
      return { ...s, aqi, channels }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
}

async function loadSnapshot(signal?: AbortSignal) {
  const res = await fetch(SNAPSHOT_URL, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`טעינת צילום נתונים נכשלה (${res.status})`)
  const snapshot = (await res.json()) as AirSnapshot
  return {
    snapshot,
    stations: mergeStationViews(
      snapshot.stations ?? [],
      snapshot.index ?? [],
      snapshot.readings ?? [],
    ),
    source: 'snapshot' as const,
  }
}

async function loadLive(signal?: AbortSignal) {
  const [regionsRes, indexRes] = await Promise.all([
    fetch('/api/moep/v1/envista/regions', { signal }),
    fetch('/api/moep/v1/envista/stations/index/latest?hoursBack=24', { signal }),
  ])
  if (!regionsRes.ok) throw new Error(`regions ${regionsRes.status}`)
  if (!indexRes.ok) throw new Error(`index ${indexRes.status}`)

  const regions = (await regionsRes.json()) as Array<{
    regionId: number
    name: string
    stations: Array<{
      stationId: number
      name: string
      shortName?: string
      active: boolean
      owner?: string
      location?: { latitude: number; longitude: number }
      monitors?: Array<{
        channelId: number
        name: string
        alias: string
        units: string
        pollutantId: number
        isIndex?: boolean
        active?: boolean
      }>
    }>
  }>
  const indexPayload = await indexRes.json()
  const index = (indexPayload?.data ?? []) as StationIndex[]

  const regionIds = [
    ...new Set(regions.map((r) => r.regionId).filter((id) => id > 0)),
  ]
  const latestRes = await fetch(
    `/api/moep/v1/envista/regions/data/latest?unitConversion=true&regionsIds=${regionIds.join(',')}&hoursBack=6`,
    { signal },
  )
  const readingsRaw = latestRes.ok ? await latestRes.json() : []
  const readings = (Array.isArray(readingsRaw) ? readingsRaw : []) as StationReading[]

  const stations: StationMeta[] = []
  for (const region of regions) {
    for (const s of region.stations ?? []) {
      stations.push({
        stationId: s.stationId,
        name: s.name,
        shortName: s.shortName,
        active: !!s.active,
        owner: s.owner ?? null,
        regionId: region.regionId,
        regionName: region.name,
        latitude: s.location?.latitude ?? null,
        longitude: s.location?.longitude ?? null,
        monitors: (s.monitors ?? [])
          .filter((m) => m.active !== false)
          .map((m) => ({
            channelId: m.channelId,
            name: m.name,
            alias: m.alias,
            units: m.units,
            pollutantId: m.pollutantId,
            isIndex: !!m.isIndex,
          })),
      })
    }
  }

  let forecast: AirSnapshot['forecast'] = []
  try {
    forecast = await fetchCkanForecast(signal)
  } catch {
    try {
      forecast = (await loadSnapshot(signal)).snapshot.forecast ?? []
    } catch {
      /* empty */
    }
  }

  const snapshot: AirSnapshot = {
    fetchedAt: new Date().toISOString(),
    sources: { note: 'live via Vite /api/moep middleware' },
    stations,
    index,
    readings,
    forecast,
  }

  return {
    snapshot,
    stations: mergeStationViews(stations, index, readings),
    source: 'live' as const,
  }
}

export async function loadDashboard(signal?: AbortSignal) {
  if (useLiveProxy) {
    try {
      return await loadLive(signal)
    } catch (err) {
      console.warn('Live MoEP proxy failed, falling back to snapshot', err)
    }
  }
  return loadSnapshot(signal)
}

export async function fetchStationHistory(
  station: StationView,
  pollutant: string,
  signal?: AbortSignal,
): Promise<HistoryPoint[]> {
  if (!useLiveProxy) return []

  const monitor = station.monitors.find(
    (m) =>
      m.name === pollutant ||
      m.name.replace('.', '') === pollutant.replace('.', '') ||
      m.name.replace('.', '') === pollutant.replace('.5', '25'),
  )
  if (!monitor) return []

  const to = new Date()
  const from = new Date(to.getTime() - 48 * 3600 * 1000)
  const fromStr = from.toISOString().slice(0, 19)
  const toStr = to.toISOString().slice(0, 19)
  const url =
    `/api/moep/v1/envista/stations/${station.stationId}/Average/${monitor.channelId}` +
    `?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}` +
    `&fromTimebase=60&toTimebase=60&timeBeginning=false&useBackWard=true` +
    `&includeSummary=false&roundType=1&unitid=-1&unitConversion=true`

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`history ${res.status}`)
  const json = (await res.json()) as {
    data?: Array<{ datetime: string; channels?: Array<{ value: number; name: string }> }>
  }
  return (json.data ?? []).map((row) => ({
    datetime: row.datetime,
    value: isValidValue(row.channels?.[0]?.value) ? row.channels![0].value : null,
    pollutant,
  }))
}

export async function fetchCkanForecast(signal?: AbortSignal) {
  const url =
    'https://data.gov.il/api/3/action/datastore_search?resource_id=a976089d-e8e5-4013-8f3d-777b8551c684&limit=50'
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`CKAN forecast ${res.status}`)
  const json = await res.json()
  return (json.result?.records ?? []) as AirSnapshot['forecast']
}
