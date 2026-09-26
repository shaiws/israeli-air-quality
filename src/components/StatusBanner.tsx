type Props = {
  loading: boolean
  error: string | null
  empty: boolean
}

export function StatusBanner({ loading, error, empty }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        טוען נתוני איכות אוויר…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        שגיאה: {error}
      </div>
    )
  }
  if (empty) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        לא נמצאו תחנות התואמות לסינון.
      </div>
    )
  }
  return null
}
