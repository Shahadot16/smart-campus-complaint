import { BadgeCheck, Check, CreditCard, Download, Receipt, Smartphone, Sparkles, Zap } from 'lucide-react'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { billingApi, errorMessage } from '../../services/api'
import { taka } from '../../utils/format'

const PLAN_ICON = { free: Sparkles, pro: Zap, premium: BadgeCheck }
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function UsageBar({ label, value, max }) {
  const unlimited = max >= 100000
  const pct = unlimited ? 0 : Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  const atLimit = !unlimited && value >= max
  const near = !unlimited && !atLimit && pct >= 80
  const barColor = atLimit ? 'bg-rose-500' : near ? 'bg-amber-500' : 'bg-brand-500'
  const countColor = atLimit ? 'text-rose-600' : near ? 'text-amber-600' : 'text-ink'
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-ink-soft">{label}</span>
        <span className={`font-medium tabular-nums ${countColor}`}>
          {value.toLocaleString()} / {unlimited ? '∞' : max.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className={`bar-grow h-2 rounded-full ${barColor}`} style={{ width: `${unlimited ? 4 : pct}%` }} />
      </div>
      {atLimit && <p className="mt-1 text-[11px] font-medium text-rose-600">Limit reached — upgrade to add more.</p>}
      {near && <p className="mt-1 text-[11px] font-medium text-amber-600">Approaching your plan limit.</p>}
    </div>
  )
}

function PayModal({ invoice, onClose, onPaid }) {
  const [method, setMethod] = useState('card')
  const [busy, setBusy] = useState(false)
  if (!invoice) return null

  async function pay() {
    setBusy(true)
    try {
      await billingApi.pay(invoice._id, { method })
      toast.success('Payment successful 🎉')
      onPaid()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, 'Payment failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Complete payment"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={pay} disabled={busy}>
            {busy ? <Spinner className="size-4 text-white" /> : <CreditCard className="size-4" />} Pay {taka(invoice.amount)}
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-line bg-slate-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-ink-soft">{invoice.planName} plan · 1 month</span>
          <span className="font-semibold text-navy-900">{taka(invoice.amount)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">Invoice {invoice.number}</p>
      </div>

      <p className="label mt-5">Payment method</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'card', label: 'Card', icon: CreditCard },
          { key: 'bkash', label: 'bKash', icon: Smartphone },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${method === m.key ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink hover:border-slate-300'}`}
          >
            <m.icon className="size-4" /> {m.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Card / account number" htmlFor="pay-num">
          <input id="pay-num" className="input font-mono" placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242" />
        </Field>
        <Field label="Expiry" htmlFor="pay-exp">
          <input id="pay-exp" className="input font-mono" placeholder="12 / 28" defaultValue="12 / 28" />
        </Field>
      </div>
      <p className="mt-3 text-center text-xs text-ink-muted">🔒 Demo sandbox — no real charge is made.</p>
    </Modal>
  )
}

export default function Billing() {
  const { data, loading, error, reload } = useApi(
    async () => {
      const [sub, inv] = await Promise.all([billingApi.subscription(), billingApi.invoices()])
      return { data: { ...sub.data, invoices: inv.data } }
    },
    []
  )
  const [payInvoice, setPayInvoice] = useState(null)
  const [changing, setChanging] = useState('')

  const reloadAll = useCallback(() => reload(), [reload])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const { plan, subscription, usage, allPlans, invoices } = data

  async function choosePlan(p) {
    if (p.key === plan.key && p.price === 0) return
    setChanging(p.key)
    try {
      const res = await billingApi.subscribe(p.key)
      if (res.data.invoice) {
        setPayInvoice(res.data.invoice) // paid plan -> open checkout
        reloadAll()
      } else {
        toast.success(`Switched to ${p.name}`)
        reloadAll()
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setChanging('')
    }
  }

  const statusTone = subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Billing & subscription" subtitle="Manage your university's plan and payments." />

      {/* Current plan + usage */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card relative overflow-hidden p-6 lg:col-span-2">
          <span className="sheen" aria-hidden="true" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-ink-soft">Current plan</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-navy-900">
                {plan.name}
                <span className={`chip ring-1 ring-inset ${statusTone}`}>{subscription?.status || 'active'}</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {plan.price === 0 ? 'Free forever' : `${taka(plan.price)} / month`}
                {subscription?.currentPeriodEnd && ` · renews ${fmtDate(subscription.currentPeriodEnd)}`}
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              {(() => {
                const Icon = PLAN_ICON[plan.key] || Sparkles
                return <Icon className="size-6" />
              })()}
            </span>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <UsageBar label="Users" value={usage.users} max={usage.maxUsers} />
            <UsageBar label="Complaints this month" value={usage.complaintsThisMonth} max={usage.maxComplaintsPerMonth} />
          </div>
        </div>

        <div className="card p-6">
          <p className="font-semibold text-navy-900">Plan includes</p>
          <ul className="mt-3 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-600" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="mb-3 font-semibold text-navy-900">Choose a plan</h2>
        <div className="stagger grid gap-4 md:grid-cols-3">
          {allPlans.map((p) => {
            const Icon = PLAN_ICON[p.key] || Sparkles
            const current = p.key === plan.key
            const featured = p.key === 'pro'
            return (
              <div key={p.key} className={`relative flex flex-col rounded-2xl border-2 p-5 transition ${current ? 'border-brand-500 bg-brand-50/40' : featured ? 'border-brand-200 bg-white shadow-pop' : 'border-line bg-white'}`}>
                {featured && !current && <span className="absolute -top-2.5 left-5 chip bg-brand-600 text-white">Popular</span>}
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon className="size-[18px]" /></span>
                  <span className="font-semibold text-navy-900">{p.name}</span>
                </div>
                <p className="mt-3 text-2xl font-bold text-navy-900">
                  {p.price === 0 ? 'Free' : taka(p.price)}
                  {p.price > 0 && <span className="text-sm font-normal text-ink-muted"> /mo</span>}
                </p>
                <p className="text-xs text-ink-muted">{p.tagline}</p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-ink-soft">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={current || changing === p.key}
                  onClick={() => choosePlan(p)}
                  className={`btn mt-5 w-full ${current ? 'cursor-default border border-line bg-slate-50 text-ink-muted' : 'btn-primary'}`}
                >
                  {changing === p.key && <Spinner className="size-4 text-white" />}
                  {current ? 'Current plan' : p.price === 0 ? 'Downgrade' : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <div className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy-900">Invoices</h2>
        </div>
        {invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" message="Invoices appear here when you subscribe to a paid plan." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="table-head">Invoice</th>
                  <th className="table-head">Plan</th>
                  <th className="table-head">Amount</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Date</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id} className="border-b border-line last:border-0 hover:bg-slate-50">
                    <td className="table-cell font-mono text-xs">{inv.number}</td>
                    <td className="table-cell">{inv.planName}</td>
                    <td className="table-cell font-medium tabular-nums">{taka(inv.amount)}</td>
                    <td className="table-cell">
                      <span className={`chip ring-1 ring-inset ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'}`}>{inv.status}</span>
                    </td>
                    <td className="table-cell text-ink-soft">{fmtDate(inv.issuedAt)}</td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-2">
                        {inv.status === 'pending' && (
                          <button className="btn-primary btn-sm" onClick={() => setPayInvoice(inv)}>
                            <CreditCard className="size-3.5" /> Pay
                          </button>
                        )}
                        <a href={`/admin/billing/invoice/${inv._id}`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
                          <Download className="size-3.5" /> Receipt
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payInvoice && <PayModal invoice={payInvoice} onClose={() => setPayInvoice(null)} onPaid={reloadAll} />}
    </div>
  )
}
