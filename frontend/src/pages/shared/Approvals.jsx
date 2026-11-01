import { Receipt, Save } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { WorkOrderCard } from '../../components/RepairPanels'
import { EmptyState, ErrorState, Field, PageHeader, PageLoader, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { adminApi, errorMessage, opsApi } from '../../services/api'

const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['completed', 'Completed'],
  ['', 'All'],
]

function LimitsCard() {
  const { data, loading, reload } = useApi(() => opsApi.limits(), [])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const values = form || data

  async function save() {
    setBusy(true)
    try {
      const res = await adminApi.setWorkOrderLimits({ deptHead: Number(values.deptHead), admin: Number(values.admin) })
      toast.success(res.message)
      setForm(null)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading || !values) return null
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-navy-900">Approval limits</h2>
      <p className="mt-0.5 text-sm text-ink-soft">Work orders up to the first limit are approved automatically.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Department head approves above (৳)" htmlFor="lim-head">
          <input id="lim-head" type="number" min="0" className="input" value={values.deptHead} onChange={(e) => setForm({ ...values, deptHead: e.target.value })} />
        </Field>
        <Field label="Administrator also approves above (৳)" htmlFor="lim-admin">
          <input id="lim-admin" type="number" min="0" className="input" value={values.admin} onChange={(e) => setForm({ ...values, admin: e.target.value })} />
        </Field>
        <button className="btn-primary" disabled={!form || busy} onClick={save}>
          {busy ? <Spinner className="size-4 text-white" /> : <Save className="size-4" />} Save
        </button>
      </div>
    </div>
  )
}

export default function Approvals() {
  const { user } = useAuth()
  const [status, setStatus] = useState('pending')
  const { data, loading, error, reload } = useApi(() => opsApi.approvals({ status: status || undefined }), [status])
  const waiting = data?.filter((w) => w.nextApprover === user.role).length || 0

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Work order approvals"
        subtitle={user.role === 'dept_head' ? `Costed repair jobs in ${user.department} that need your sign-off.` : 'Costed repair jobs across campus and their approval chain.'}
      />
      {user.role === 'admin' && <LimitsCard />}
      <div className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-line p-2">
          {TABS.map(([key, label]) => (
            <button key={key || 'all'} className={`btn btn-sm ${status === key ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-50'}`} onClick={() => setStatus(key)}>
              {label}
              {key === 'pending' && waiting > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-navy-950">{waiting}</span>}
            </button>
          ))}
        </div>
        <div className="space-y-3 p-4">
          {loading && !data ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : !data.length ? (
            <EmptyState icon={Receipt} title="Nothing here" message="Work orders raised by staff will appear here." />
          ) : (
            data.map((w) => <WorkOrderCard key={w._id} wo={w} onDone={reload} showComplaint />)
          )}
        </div>
      </div>
    </div>
  )
}
