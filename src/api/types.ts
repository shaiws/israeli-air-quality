export type PollutantReading = {
  pollutant: string
  index: number
  value: number
  color: string
  description: string
  pollutantId?: number
  PollutantTimeBase?: number
  MonitorId?: number
}

export type StationIndex = {
  stationId: number
  datetime: string
  pollutant: string
  index: number
  value: number
  color: string
  description: string
  indexes?: PollutantReading[]
  pollutantId?: number
  PollutantTimeBase?: number
  MonitorId?: number
}

export type MonitorMeta = {
  channelId: number
  name: string
  alias: string
  units: string
  pollutantId: number
  isIndex: boolean
}

export type StationMeta = {
  stationId: number
  name: string
  shortName?: string
  active: boolean
  owner: string | null
  regionId: number
  regionName: string
  latitude: number | null
  longitude: number | null
  monitors: MonitorMeta[]
}

export type ChannelReading = {
  id: number
  name: string
  alias: string
  value: number | null
  status: number
  valid: boolean
  units: string
  pollutantId: number
  datetime?: string
}

export type StationReading = {
  stationId: number
  regionData?: {
    datetime: string
    channels: ChannelReading[]
  }
}

export type ForecastRecord = {
  _id?: number
  type?: string
  name?: string
  title?: string
  air_quality?: string
  fill_color?: string
  date?: string
  day_of_week?: string
  morning?: string
  noon?: string
  evening?: string
  morning_content?: string
  noon_content?: string
  evening_content?: string
  content?: string
  file_link?: string
}

export type AirSnapshot = {
  fetchedAt: string
  sources: Record<string, unknown>
  stations: StationMeta[]
  index: StationIndex[]
  readings: StationReading[]
  forecast: ForecastRecord[]
  stationCatalog?: Record<string, unknown>[]
}

export type StationView = StationMeta & {
  aqi?: StationIndex
  channels?: ChannelReading[]
}

export type HistoryPoint = {
  datetime: string
  value: number | null
  pollutant: string
}
