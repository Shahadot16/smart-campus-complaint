import { Download, Frown, Meh, Smile, Sparkles } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorState, PageHeader, PageLoader, Spinner, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, errorMessage } from '../../services/api'
import { formatDate, formatHours, taka } from '../../utils/format'

// Two series, validated for colour-blind separation (blue vs green); "resolved" is also dashed.
const CREATED = '#2a78d6'
const RESOLVED = '#15803d'
const AXIS = { fontSize: 11, fill: '#7a8c82' }
const GRID = '#e7eee9'
// Sequential single-hue ramp (light -> dark green) for the heatmap.
const RAMP = ['#f1f8f3', '#d1fadf', '#a6f4c5', '#6ce9a6', '#32d583', '#16a34a', '#15803d', '#0a4029']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ChartTooltip({ active, payload, label, format = (v) => v }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{format(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink-soft">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: <span className="font-semibold text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function Heatmap({ cells }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const c of cells) grid[c.day - 1][c.hour] = c.count
  const max = Math.max(1, ...cells.map((c) => c.count))
  const color = (n) => (n ? RAMP[Math.min(RAMP.length - 1, 1 + Math.floor((n / max) * (RAMP.length - 2)))] : RAMP[0])
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px]" aria-label="Complaints by weekday and hour">
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h} className="w-5 text-[9px] font-normal text-ink-muted">
                {h % 3 === 0 ? h : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, d) => (
            <tr key={d}>
              <th className="pr-1 text-right text-[10px] font-normal text-ink-muted">{DAYS[d]}</th>
              {row.map((n, h) => (
                <td key={h} className="size-5 rounded-[3px] transition hover:ring-2 hover:ring-navy-800" style={{ background: color(n) }} title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00 — ${n} complaint${n === 1 ? '' : 's'}`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-ink-muted">
        Fewer
        {RAMP.map((c) => (
          <span key={c} className="size-3 rounded-[2px]" style={{ background: c }} />
        ))}
        More
      </div>
    </div>
  )
}

export default function Analytics() {
  const [range, setRange] = useState({ from: '', to: '' })
  const [exporting, setExporting] = useState(false)
  const params = { from: range.from || undefined, to: range.to || undefined }
  const { data, loading, error, reload } = useApi(() => adminApi.analytics(params), [range.from, range.to])
  const summary = useApi(() => adminApi.aiSummary(), [])

  async function exportXlsx() {
    setExporting(true)
    try {
      const blob = await adminApi.exportExcel(params)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `iubat-complaints-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Trends, busy times and team performance."
        actions={
          <button className="btn-primary" onClick={exportXlsx} disabled={exporting}>
            {exporting ? <Spinner className="size-4 text-white" /> : <Download className="size-4" />} Export Excel
          </button>
        }
      />

      {/* Filters: one row above all charts */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="an-from">From</label>
          <input id="an-from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="an-to">To</label>
          <input id="an-to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        {(range.from || range.to) && (
          <button className="btn-ghost" onClick={() => setRange({ from: '', to: '' })}>
            All time
          </button>
        )}
      </div>

      <div className="card border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Sparkles className="size-4 text-brand-600" aria-hidden="true" /> Weekly briefing
          {summary.data && <span className="chip bg-white text-[10px] text-ink-muted ring-1 ring-line">{summary.data.source === 'claude' ? 'Claude AI' : 'Auto-generated'}</span>}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink">{summary.loading ? 'Preparing summary…' : summary.data?.text || summary.error}</p>
      </div>

      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <div className="card p-5">
            <h2 className="font-semibold text-navy-900">Complaints created vs resolved per day</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer>
                <LineChart data={data.trend} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(d) => formatDate(d).slice(0, 6)} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip format={formatDate} />} cursor={{ stroke: '#9fb3a7', strokeDasharray: '3 3' }} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="linear" dataKey="created" name="Created" stroke={CREATED} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="linear" dataKey="resolved" name="Resolved" stroke={RESOLVED} strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-semibold text-navy-900">Complaints by category</h2>
              <div className="mt-4" style={{ height: Math.max(180, data.byCategory.length * 36) }}>
                <ResponsiveContainer>
                  <BarChart data={data.byCategory} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={6}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="category" width={120} tick={{ ...AXIS, fill: '#4d6156' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f1f8f3' }}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
                            <p className="font-semibold text-ink">{payload[0].payload.category}</p>
                            <p className="text-ink-soft">{payload[0].payload.count} complaints</p>
                            <p className="text-ink-soft">Avg. resolution: {formatHours(payload[0].payload.avgHours)}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="count" name="Complaints" fill="#15803d" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#4d6156' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-navy-900">When are problems reported?</h2>
              <p className="text-xs text-ink-muted">Weekday × hour (Dhaka time). Hover a cell for the count.</p>
              <div className="mt-4">
                <Heatmap cells={data.heatmap} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Positive feedback" value={data.sentiment.positive} icon={Smile} tone="green" />
            <StatCard label="Neutral feedback" value={data.sentiment.neutral} icon={Meh} tone="sky" />
            <StatCard label="Negative feedback" value={data.sentiment.negative} icon={Frown} tone={data.sentiment.negative ? 'red' : 'green'} />
          </div>

          <div className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 font-semibold text-navy-900">Staff leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="table-head">#</th>
                    <th className="table-head">Staff</th>
                    <th className="table-head text-right">Assigned</th>
                    <th className="table-head text-right">Resolved</th>
                    <th className="table-head text-right">Avg. time</th>
                    <th className="table-head text-right">SLA on time</th>
                    <th className="table-head text-right">Rating</th>
                    <th className="table-head text-right">Parts used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.leaderboard.map((s, i) => (
                    <tr key={s.name}>
                      <td className="table-cell text-ink-muted">{i + 1}</td>
                      <td className="table-cell font-medium">{s.name}</td>
                      <td className="table-cell text-right tabular-nums">{s.assigned}</td>
                      <td className="table-cell text-right tabular-nums">{s.resolved}</td>
                      <td className="table-cell text-right tabular-nums">{formatHours(s.avgHours)}</td>
                      <td className="table-cell text-right tabular-nums">{s.slaOnTime == null ? '—' : `${s.slaOnTime}%`}</td>
                      <td className="table-cell text-right tabular-nums">{s.rating ?? '—'}</td>
                      <td className="table-cell text-right tabular-nums">{taka(s.partsCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
