import { formatDateTime, pollutantLabel, isValidIndex, isValidValue } from '../lib/aqi'
import type { StationView } from '../api/types'

type Props = {
  station: StationView
  selected: boolean
  onSelect: () => void
}

export function StationCard({ station, selected, onSelect }: Props) {
  const aqi = station.aqi
  const color = aqi?.color && aqi.color.toLowerCase() !== 'gray' ? aqi.color : '#e2e8f0'
  const hasAqi = aqi && isValidIndex(aqi.index)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-right transition shadow-sm ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-200 bg-white'
          : 'border-slate-200 bg-white/90 hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-bold text-slate-900">{station.name}</div>
          <div className="text-xs text-slate-500">
            {station.regionName}
            {!station.active ? ' · לא פעילה' : ''}
          </div>
        </div>
        <div
          className="shrink-0 rounded-lg px-2 py-1 text-center text-xs font-bold"
          style={{ backgroundColor: color }}
        >
          {hasAqi ? aqi!.description : 'אין מדד'}
        </div>
      </div>
      {hasAqi && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span>
            {pollutantLabel(aqi!.pollutant)}
            {isValidValue(aqi!.value) ? `: ${aqi!.value}` : ''}
          </span>
          <span dir="ltr">{formatDateTime(aqi!.datetime)}</span>
        </div>
      )}
    </button>
  )
}
