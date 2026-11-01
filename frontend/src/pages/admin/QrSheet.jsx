import { ArrowLeft, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, PageLoader } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { locationApi } from '../../services/api'

/** Flattens a building into sticker entries: the building itself plus every room/floor. */
function stickersFor(building) {
  const out = [{ ...building, label: building.name, sub: 'Building' }]
  for (const floor of building.children) {
    if (!floor.children.length) out.push({ ...floor, label: floor.name, sub: building.name })
    for (const room of floor.children) out.push({ ...room, label: room.name, sub: `${building.name} · ${floor.name}` })
  }
  return out.filter((s) => s.isActive !== false)
}

/** Printable A4 sheet of QR stickers for one building. Opens outside the app layout. */
export default function QrSheet() {
  const { id } = useParams()
  const { data, loading, error } = useApi(() => locationApi.tree(), [])
  const [images, setImages] = useState({})
  const building = data?.tree.find((b) => b._id === id)
  const stickers = building ? stickersFor(building) : []

  useEffect(() => {
    if (!building) return
    let cancelled = false
    Promise.all(
      stickersFor(building).map(async (s) => [
        s.code,
        await QRCode.toDataURL(`${window.location.origin}/student/new?loc=${encodeURIComponent(s.code)}`, { margin: 1, width: 240, color: { dark: '#0a4029' } }),
      ])
    ).then((pairs) => !cancelled && setImages(Object.fromEntries(pairs)))
    return () => {
      cancelled = true
    }
  }, [building])

  if (loading) return <PageLoader />
  if (error || !building) return <ErrorState message={error || 'Building not found'} />

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center justify-between border-b border-line px-6 py-3 print:hidden">
        <Link to="/admin/locations" className="btn-ghost btn-sm">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <p className="text-sm text-ink-soft">
          {stickers.length} stickers for <strong>{building.name}</strong>
        </p>
        <button className="btn-primary btn-sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </button>
      </div>
      <div className="mx-auto grid max-w-[210mm] grid-cols-3 gap-4 p-6 print:gap-3 print:p-0">
        {stickers.map((s) => (
          <div key={s.code} className="flex break-inside-avoid flex-col items-center rounded-xl border-2 border-dashed border-line p-3 text-center">
            <div className="flex items-center gap-1.5">
              <img src="/brand/iubat-logo.png" alt="" className="h-5 w-auto" />
              <span className="text-[10px] font-bold tracking-wide text-navy-900 uppercase">Smart Campus</span>
            </div>
            {images[s.code] ? <img src={images[s.code]} alt={`QR code for ${s.label}`} className="my-2 size-32" /> : <div className="my-2 size-32 animate-pulse rounded bg-slate-100" />}
            <p className="text-sm leading-tight font-semibold text-ink">{s.label}</p>
            <p className="text-[10px] text-ink-muted">{s.sub}</p>
            <p className="mt-1 rounded bg-brand-50 px-2 py-0.5 font-mono text-[10px] text-brand-700">{s.code}</p>
            <p className="mt-1.5 text-[10px] text-ink-soft">Something broken here? Scan to report it.</p>
          </div>
        ))}
      </div>
    </div>
  )
}
