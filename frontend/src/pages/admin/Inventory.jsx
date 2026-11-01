import { History, PackagePlus, Plus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner, StatCard } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, errorMessage, fieldErrors, opsApi } from '../../services/api'
import { taka, timeAgo } from '../../utils/format'

function PartModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ sku: '', name: '', unit: 'pcs', minQuantity: 5, unitCost: 0, supplier: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await adminApi.createPart({ ...form, minQuantity: Number(form.minQuantity), unitCost: Number(form.unitCost) })
      toast.success(res.message)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} title="New spare part" footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="part-form" disabled={busy}>{busy && <Spinner className="size-4 text-white" />} Save</button></>}>
      <form id="part-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="SKU" htmlFor="p-sku" error={errors.sku} required><input id="p-sku" className="input font-mono uppercase" value={form.sku} onChange={set('sku')} maxLength={24} /></Field>
        <Field label="Name" htmlFor="p-name" error={errors.name} required><input id="p-name" className="input" value={form.name} onChange={set('name')} maxLength={100} /></Field>
        <Field label="Unit" htmlFor="p-unit"><input id="p-unit" className="input" value={form.unit} onChange={set('unit')} maxLength={12} /></Field>
        <Field label="Unit cost (৳)" htmlFor="p-cost" error={errors.unitCost}><input id="p-cost" type="number" min="0" className="input" value={form.unitCost} onChange={set('unitCost')} /></Field>
        <Field label="Low-stock alert at" htmlFor="p-min" error={errors.minQuantity}><input id="p-min" type="number" min="0" className="input" value={form.minQuantity} onChange={set('minQuantity')} /></Field>
        <Field label="Supplier" htmlFor="p-sup"><input id="p-sup" className="input" value={form.supplier} onChange={set('supplier')} maxLength={100} /></Field>
      </form>
    </Modal>
  )
}

function StockModal({ part, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'in', quantity: '', unitCost: part.unitCost, note: '' })
  const [busy, setBusy] = useState(false)
  const { data: moves } = useApi(() => adminApi.partMovements(part._id), [part._id])
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await adminApi.addStock(part._id, { type: form.type, quantity: Number(form.quantity), unitCost: Number(form.unitCost), note: form.note })
      toast.success(res.message)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open onClose={onClose} size="max-w-2xl" title={`${part.name} — ${part.quantity} ${part.unit} in stock`} footer={<><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" form="stock-form" disabled={busy || !form.quantity}>{busy && <Spinner className="size-4 text-white" />} Update stock</button></>}>
      <form id="stock-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-4">
        <Field label="Action" htmlFor="s-type">
          <select id="s-type" className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="in">Receive (+)</option>
            <option value="adjust">Correct count (±)</option>
          </select>
        </Field>
        <Field label="Quantity" htmlFor="s-qty" hint={form.type === 'adjust' ? 'Negative to remove' : ''}><input id="s-qty" type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
        <Field label="Unit cost (৳)" htmlFor="s-cost"><input id="s-cost" type="number" min="0" className="input" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></Field>
        <Field label="Note" htmlFor="s-note"><input id="s-note" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} placeholder="Invoice no…" /></Field>
      </form>
      <h3 className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-navy-900"><History className="size-4" /> Recent movements</h3>
      <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
        {(moves || []).map((m) => (
          <li key={m._id} className="flex items-center justify-between px-3 py-2">
            <span>
              <span className={m.quantity > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>{' '}
              {m.type === 'out' && m.complaint ? <Link to={`/complaints/${m.complaint._id}`} className="text-brand-700 hover:underline">{m.complaint.trackingCode}</Link> : m.note || m.type}
            </span>
            <span className="text-xs text-ink-muted">{m.by?.name} · {timeAgo(m.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default function Inventory() {
  const [lowOnly, setLowOnly] = useState(false)
  const { data, loading, error, reload } = useApi(() => opsApi.parts({ all: 'true', lowStock: lowOnly ? 'true' : undefined }), [lowOnly])
  const [adding, setAdding] = useState(false)
  const [stockFor, setStockFor] = useState(null)

  if (loading && !data) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const low = data.filter((p) => p.lowStock).length
  const value = data.reduce((n, p) => n + p.quantity * p.unitCost, 0)

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Spare-parts inventory" subtitle="Stock is reduced automatically when staff record parts on a repair." actions={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="size-4" /> New part</button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Parts tracked" value={data.length} tone="sky" />
        <StatCard label="Low on stock" value={low} icon={TriangleAlert} tone={low ? 'red' : 'green'} />
        <StatCard label="Stock value" value={taka(value)} tone="amber" />
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Show low stock only</label>
        </div>
        {!data.length ? <EmptyState title="No parts" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className="table-head">Part</th>
                  <th className="table-head text-right">In stock</th>
                  <th className="table-head text-right">Alert at</th>
                  <th className="table-head text-right">Unit cost</th>
                  <th className="table-head">Supplier</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((p) => (
                  <tr key={p._id} className={p.lowStock ? 'bg-red-50/40' : ''}>
                    <td className="table-cell"><p className="font-medium">{p.name}</p><p className="font-mono text-xs text-ink-muted">{p.sku}</p></td>
                    <td className="table-cell text-right tabular-nums"><span className={p.lowStock ? 'font-bold text-red-600' : ''}>{p.quantity}</span> {p.unit}</td>
                    <td className="table-cell text-right text-ink-soft tabular-nums">{p.minQuantity}</td>
                    <td className="table-cell text-right tabular-nums">{taka(p.unitCost)}</td>
                    <td className="table-cell text-sm text-ink-soft">{p.supplier || '—'}</td>
                    <td className="table-cell text-right"><button className="btn-secondary btn-sm" onClick={() => setStockFor(p)}><PackagePlus className="size-3.5" /> Stock</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adding && <PartModal onClose={() => setAdding(false)} onSaved={reload} />}
      {stockFor && <StockModal part={stockFor} onClose={() => setStockFor(null)} onSaved={reload} />}
    </div>
  )
}
