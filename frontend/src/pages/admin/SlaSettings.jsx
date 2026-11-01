import { Clock3, Play, Save, ShieldAlert, TimerReset } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ErrorState, PageHeader, PageLoader, PriorityBadge, Spinner, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, errorMessage } from '../../services/api'
import { formatHours, timeAgo } from '../../utils/format'

function PolicyRow({ policy, onSaved }) {
  const [form, setForm] = useState({ responseHours: policy.responseHours, resolveHours: policy.resolveHours })
  const [busy, setBusy] = useState(false)
  const dirty = Number(form.responseHours) !== policy.responseHours || Number(form.resolveHours) !== policy.resolveHours

  async function save() {
    setBusy(true)
    try {
      const res = await adminApi.saveSlaPolicy({ priority: policy.priority, responseHours: Number(form.responseHours), resolveHours: Number(form.resolveHours) })
      toast.success(res.message)
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr>
      <td className="table-cell">
        <PriorityBadge priority={policy.priority} />
        {policy.isDefault && <span className="ml-2 text-[11px] text-ink-muted">default</span>}
      </td>
      {['responseHours', 'resolveHours'].map((k) => (
        <td key={k} className="table-cell">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={k === 'responseHours' ? 0.25 : 0.5}
              step="0.25"
              className="input w-24"
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              aria-label={`${policy.priority} ${k}`}
            />
            <span className="text-xs text-ink-muted">hours ({formatHours(Number(form[k]))})</span>
          </div>
        </td>
      ))}
      <td className="table-cell text-right">
        <button className="btn-primary btn-sm" disabled={!dirty || busy} onClick={save}>
          {busy ? <Spinner className="size-3 text-white" /> : <Save className="size-3.5" />} Save
        </button>
      </td>
    </tr>
  )
}

function ComplianceTable({ title, rows }) {
  return (
    <div className="card overflow-hidden">
      <h3 className="border-b border-line px-5 py-3 font-semibold text-navy-900">{title}</h3>
      {rows.length ? (
        <table className="w-full">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="table-head"> </th>
              <th className="table-head text-right">Total</th>
              <th className="table-head text-right">Missed</th>
              <th className="table-head text-right">On time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const pct = r.total ? Math.round(((r.total - r.breached) / r.total) * 100) : null
              return (
                <tr key={r.label}>
                  <td className="table-cell capitalize">{r.label}</td>
                  <td className="table-cell text-right tabular-nums">{r.total}</td>
                  <td className="table-cell text-right text-red-600 tabular-nums">{r.breached}</td>
                  <td className="table-cell text-right">
                    {pct == null ? '—' : (
                      <span className={`chip ${pct >= 90 ? 'bg-emerald-50 text-emerald-700' : pct >= 70 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>{pct}%</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-5 py-4 text-sm text-ink-muted">No data yet.</p>
      )}
    </div>
  )
}

function JobsPanel() {
  const { data, loading, reload } = useApi(() => adminApi.jobs(), [])
  const [busy, setBusy] = useState(null)
  const LABELS = { 'sla-check': 'SLA check & escalation', 'daily-digest': 'Daily admin email summary' }

  async function run(name) {
    setBusy(name)
    try {
      const res = await adminApi.runJob(name)
      toast.success(res.message)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <h3 className="flex items-center gap-2 border-b border-line px-5 py-3 font-semibold text-navy-900">
        <TimerReset className="size-4 text-brand-600" aria-hidden="true" /> Background jobs
      </h3>
      {loading ? (
        <PageLoader />
      ) : (
        <ul className="divide-y divide-line">
          {data.map((j) => (
            <li key={j.name} className="flex items-center gap-3 px-5 py-3">
              <span className={`size-2 rounded-full ${j.lastError ? 'bg-red-500' : j.lastRunAt ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{LABELS[j.name] || j.name}</p>
                <p className="truncate text-xs text-ink-muted">
                  Every {j.everyMinutes} min · last run {j.lastRunAt ? timeAgo(j.lastRunAt) : 'never'}
                  {j.lastError && <span className="text-red-600"> · {j.lastError}</span>}
                  {j.lastResult && !j.lastError && <span> · {Object.entries(j.lastResult).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>}
                </p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => run(j.name)} disabled={busy === j.name}>
                {busy === j.name ? <Spinner className="size-3" /> : <Play className="size-3.5" />} Run now
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SlaSettings() {
  const policies = useApi(() => adminApi.slaPolicies(), [])
  const report = useApi(() => adminApi.slaReport(), [])

  if (policies.loading || report.loading) return <PageLoader />
  if (policies.error || report.error) return <ErrorState message={policies.error || report.error} onRetry={() => (policies.reload(), report.reload())} />

  const r = report.data
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="SLA & escalation" subtitle="Response and resolution targets, compliance, and the automatic escalation jobs." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Resolved on time" value={r.resolution.compliance == null ? '—' : `${r.resolution.compliance}%`} icon={Clock3} tone="green" hint={`${r.resolution.breached} of ${r.resolution.total} missed`} />
        <StatCard label="Responded on time" value={r.response.compliance == null ? '—' : `${r.response.compliance}%`} icon={Clock3} tone="sky" hint={`${r.response.breached} of ${r.response.total} missed`} />
        <StatCard label="Overdue right now" value={r.overdueNow} icon={ShieldAlert} tone={r.overdueNow ? 'red' : 'green'} />
        <StatCard label="Escalation steps" value="4" icon={TimerReset} tone="violet" hint="Warn → breach → raise priority → final" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h3 className="font-semibold text-navy-900">Targets by priority</h3>
          <p className="text-xs text-ink-muted">Changes apply to new complaints and to complaints whose priority changes.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="table-head">Priority</th>
                <th className="table-head">First response within</th>
                <th className="table-head">Resolve within</th>
                <th className="table-head" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {policies.data.general.map((p) => (
                <PolicyRow key={`${p.priority}-${p.responseHours}-${p.resolveHours}`} policy={p} onSaved={() => (policies.reload(), report.reload())} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ComplianceTable title="By priority" rows={r.byPriority} />
        <ComplianceTable title="By category" rows={r.byCategory} />
        <ComplianceTable title="By staff member" rows={r.byStaff} />
      </div>

      <JobsPanel />
    </div>
  )
}
