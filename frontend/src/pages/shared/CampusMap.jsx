import 'leaflet/dist/leaflet.css'
import { Building2 } from 'lucide-react'
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { ErrorState, PageHeader, PageLoader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { locationApi } from '../../services/api'

// Marker colour by situation: red = critical open issue, amber = open issues, green = all clear.
const colorFor = (b) => (b.critical ? '#d62828' : b.open ? '#f59e0b' : '#16a34a')

export default function CampusMap() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(() => locationApi.stats(), [])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const buildings = data.buildings.filter((b) => b.geo?.lat != null)
  const max = Math.max(1, ...buildings.map((b) => b.open))
  const listUrl = (b) => (user.role === 'admin' ? `/admin/complaints?search=${encodeURIComponent(b.name)}` : `/staff/tasks?search=${encodeURIComponent(b.name)}`)

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Campus map" subtitle="Where problems are happening right now. Bigger circles mean more open complaints." />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="card overflow-hidden">
          <MapContainer center={[data.center.lat, data.center.lng]} zoom={18} scrollWheelZoom className="h-[520px] w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            {buildings.map((b) => (
              <CircleMarker
                key={b._id}
                center={[b.geo.lat, b.geo.lng]}
                radius={12 + (b.open / max) * 18}
                pathOptions={{ color: colorFor(b), fillColor: colorFor(b), fillOpacity: 0.45, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  {b.name}: {b.open} open
                </Tooltip>
                <Popup>
                  <strong>{b.name}</strong>
                  <br />
                  Open: {b.open} · Critical: {b.critical} · All time: {b.total}
                  <br />
                  <Link to={listUrl(b)}>View complaints →</Link>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div className="card divide-y divide-line">
          <p className="px-4 py-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">Buildings</p>
          {[...data.buildings]
            .sort((a, b) => b.open - a.open)
            .map((b) => (
              <Link key={b._id} to={listUrl(b)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorFor(b) }} aria-hidden="true" />
                <Building2 className="size-4 text-ink-muted" aria-hidden="true" />
                <span className="flex-1 text-sm text-ink">{b.name}</span>
                <span className="text-sm font-semibold text-navy-900 tabular-nums">{b.open}</span>
              </Link>
            ))}
          <p className="px-4 py-3 text-[11px] text-ink-muted">Building positions are approximate and can be edited under Locations.</p>
        </div>
      </div>
    </div>
  )
}
