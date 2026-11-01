import { ArrowLeft, Pencil, QrCode, TriangleAlert } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, PageLoader, StatCard, StatusBadge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { opsApi } from '../../services/api'
import { formatDate, taka } from '../../utils/format'
import { ASSET_STATUS } from '../../utils/constants'
import { AssetModal } from './Assets'

export default function AssetDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: a, loading, error, reload } = useApi(() => opsApi.asset(id), [id])
  const [editing, setEditing] = useState(false)
  const [qr, setQr] = useState(null)
  const code = a?.code

  useEffect(() => {
    if (!code) return
    QRCode.toDataURL(`${window.location.origin}/student/new?asset=${encodeURIComponent(code)}`, { margin: 1, width: 200, color: { dark: '#0a4029' } }).then(setQr)
  }, [code])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate(-1)} className="btn-ghost btn-sm -ml-2">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-navy-800">{a.code}</p>
          <h1 className="text-2xl font-bold text-navy-900">{a.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {a.type} · {a.location?.name || 'No location'} {a.department && `· ${a.department}`}
          </p>
          <span className={`chip mt-2 ${ASSET_STATUS[a.status].className}`}>{ASSET_STATUS[a.status].label}</span>
        </div>
        {user.role === 'admin' && (
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </button>
        )}
      </div>

      {a.advice && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <TriangleAlert className="size-5 shrink-0 text-red-600" aria-hidden="true" /> {a.advice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total repairs" value={a.stats.totalRepairs} tone="sky" />
        <StatCard label="Failures (90 days)" value={a.stats.recentFailures} tone={a.replaceSuggested ? 'red' : 'green'} />
        <StatCard label="Parts spent" value={taka(a.stats.partsCost)} tone="amber" />
        <StatCard label="Warranty" value={a.stats.underWarranty ? 'Active' : a.warrantyUntil ? 'Expired' : '—'} tone={a.stats.underWarranty ? 'green' : 'violet'} hint={a.warrantyUntil ? `Until ${formatDate(a.warrantyUntil)}` : 'No warranty recorded'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 font-semibold text-navy-900">Repair history</h2>
          {a.history.length ? (
            <ul className="divide-y divide-line">
              {a.history.map((c) => (
                <li key={c._id}>
                  <Link to={`/complaints/${c._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className="font-mono text-xs text-navy-800">{c.trackingCode}</span>
                    <span className="flex-1 truncate text-sm text-ink">{c.title}</span>
                    <span className="hidden text-xs text-ink-muted sm:inline">{c.assignedStaff?.name}</span>
                    <span className="text-xs text-ink-soft tabular-nums">{taka(c.cost?.parts)}</span>
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-ink-muted">{formatDate(c.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-ink-muted">No repairs recorded.</p>
          )}
        </div>
        <div className="card p-5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-navy-900">
            <QrCode className="size-4" aria-hidden="true" /> Asset QR sticker
          </p>
          {qr && <img src={qr} alt={`QR code for ${a.code}`} className="mx-auto my-3 size-40" />}
          <p className="text-xs text-ink-muted">Stick this on the equipment. Scanning it opens a complaint form for this exact asset.</p>
          <button className="btn-secondary btn-sm mt-3" onClick={() => window.print()}>
            Print
          </button>
          <dl className="mt-4 space-y-1 border-t border-line pt-3 text-left text-xs">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Serial</dt>
              <dd className="font-mono">{a.serialNo || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Purchased</dt>
              <dd>{formatDate(a.purchaseDate)}</dd>
            </div>
          </dl>
        </div>
      </div>
      {editing && <AssetModal asset={a} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  )
}
