import { Printer } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { PageLoader, ErrorState } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { billingApi } from '../../services/api'
import { taka } from '../../utils/format'

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function InvoiceReceipt() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(() => billingApi.invoice(id), [id])

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const { invoice, tenant } = data
  const primary = tenant?.branding?.primaryColor || '#0a4029'

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end print:hidden">
          <button onClick={() => window.print()} className="btn-primary">
            <Printer className="size-4" /> Print / Save PDF
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-card print:rounded-none print:shadow-none sm:p-10">
          <div className="flex items-start justify-between border-b border-line pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-xl font-bold text-white" style={{ background: primary }}>
                  {(tenant?.shortName || 'SC').slice(0, 3).toUpperCase()}
                </span>
                <div>
                  <p className="font-bold text-navy-900">{tenant?.name}</p>
                  <p className="text-xs text-ink-muted">Smart Campus Platform</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tracking-tight text-navy-900">INVOICE</p>
              <p className="font-mono text-sm text-ink-soft">{invoice.number}</p>
              <span className={`chip mt-1 ring-1 ring-inset ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'}`}>
                {invoice.status === 'paid' ? 'PAID' : invoice.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid gap-6 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase">Billed to</p>
              <p className="mt-1 font-medium text-ink">{tenant?.name}</p>
              {tenant?.address && <p className="text-sm text-ink-soft">{tenant.address}</p>}
              {tenant?.emailDomain && <p className="text-sm text-ink-soft">@{tenant.emailDomain}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-ink-muted uppercase">Details</p>
              <p className="mt-1 text-sm text-ink-soft">Issued: {fmtDate(invoice.issuedAt)}</p>
              {invoice.paidAt && <p className="text-sm text-ink-soft">Paid: {fmtDate(invoice.paidAt)}</p>}
              <p className="text-sm text-ink-soft">
                Period: {fmtDate(invoice.period?.start)} – {fmtDate(invoice.period?.end)}
              </p>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-y border-line text-left">
                <th className="py-2 text-xs font-semibold text-ink-soft uppercase">Description</th>
                <th className="py-2 text-right text-xs font-semibold text-ink-soft uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-3 text-sm text-ink">
                  {invoice.planName} plan — monthly subscription
                  <span className="block text-xs text-ink-muted">{invoice.method ? `Paid via ${invoice.method}` : ''}</span>
                </td>
                <td className="py-3 text-right text-sm font-medium text-ink tabular-nums">{taka(invoice.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="py-3 text-right font-semibold text-navy-900">Total</td>
                <td className="py-3 text-right text-lg font-bold text-navy-900 tabular-nums">{taka(invoice.amount)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-8 border-t border-line pt-6 text-center text-xs text-ink-muted">
            Thank you for using Smart Campus. This is a computer-generated invoice.
          </p>
        </div>
      </div>
    </div>
  )
}
