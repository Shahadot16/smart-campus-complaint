import { CheckCircle2, ClipboardList, Clock, FilePlus2, Search, Wrench } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import ComplaintTable from '../../components/ComplaintTable'
import { EmptyState, ErrorState, PageHeader, PageLoader, Spinner, StatCard } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import useApi from '../../hooks/useApi'
import { complaintApi, errorMessage } from '../../services/api'

function TrackBox() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    try {
      const res = await complaintApi.track(code.trim())
      navigate(`/complaints/${res.data.id}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-semibold text-navy-900">{t('Track a complaint')}</p>
        <p className="text-sm text-ink-soft">{t('Enter a tracking ID such as CMP-2026-0001.')}</p>
      </div>
      <div className="flex gap-2">
        <input
          className="input font-mono uppercase sm:w-56"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CMP-2026-0001"
          aria-label="Tracking ID"
        />
        <button className="btn-primary" disabled={busy || !code.trim()}>
          {busy ? <Spinner className="size-4 text-white" /> : <Search className="size-4" />}
          {t('Track')}
        </button>
      </div>
    </form>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const { t } = useLang()
  const { data, loading, error, reload } = useApi(() => complaintApi.myStats(), [])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const c = data.counts
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={t('Hello, {name}', { name: user.name.split(' ')[0] })}
        subtitle={t("Here's an overview of your campus complaints.")}
        actions={
          <Link to="/student/new" className="btn-primary group">
            <FilePlus2 className="size-4 transition-transform group-hover:rotate-90" /> {t('New complaint')}
          </Link>
        }
      />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('Total complaints')} value={c.total} icon={ClipboardList} tone="sky" />
        <StatCard label={t('Pending review')} value={c.pending} icon={Clock} tone="amber" hint="Submitted, under review or needs info" />
        <StatCard label={t('In progress')} value={c.inProgress} icon={Wrench} tone="blue" hint="Assigned or being worked on" />
        <StatCard label={t('Resolved')} value={c.resolved} icon={CheckCircle2} tone="green" hint="Resolved or closed" />
      </div>

      <TrackBox />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy-900">{t('Recent complaints')}</h2>
          {data.recent.length > 0 && (
            <Link to="/student/complaints" className="text-sm font-medium text-brand-600 hover:underline">
              {t('View all')}
            </Link>
          )}
        </div>
        {data.recent.length ? (
          <ComplaintTable items={data.recent} />
        ) : (
          <EmptyState
            title="No complaints yet"
            message="When something on campus needs fixing, report it here and track it to resolution."
            action={
              <Link to="/student/new" className="btn-primary">
                <FilePlus2 className="size-4" /> Submit your first complaint
              </Link>
            }
          />
        )}
      </div>
    </div>
  )
}
