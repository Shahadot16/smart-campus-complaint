import { Pencil, Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi, commonApi, errorMessage, fieldErrors } from '../../services/api'

function CategoryModal({ category, onClose, onSaved }) {
  const editing = Boolean(category?._id)
  const [form, setForm] = useState({ name: category?.name || '', description: category?.description || '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (form.name.trim().length < 2) return setErrors({ name: 'Category name must be 2–60 characters' })
    setBusy(true)
    try {
      const body = { name: form.name.trim(), description: form.description.trim() }
      const res = editing ? await adminApi.updateCategory(category._id, body) : await adminApi.createCategory(body)
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
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit category' : 'New category'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="category-form" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} Save
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="c-name" error={errors.name} required>
          <input id="c-name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description" htmlFor="c-desc" error={errors.description}>
          <textarea id="c-desc" rows={3} className="input" value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </form>
    </Modal>
  )
}

export default function AdminCategories() {
  const { data, loading, error, reload } = useApi(() => commonApi.categories({ all: 'true' }), [])
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function toggle(c) {
    setBusyId(c._id)
    try {
      await adminApi.updateCategory(c._id, { isActive: !c.isActive })
      toast.success(c.isActive ? `"${c.name}" hidden from students` : `"${c.name}" activated`)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Categories"
        subtitle="Categories students choose from. Deactivated categories are kept for history."
        actions={
          <button className="btn-primary" onClick={() => setEditing({})}>
            <Plus className="size-4" /> New category
          </button>
        }
      />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data.length ? (
        <div className="card">
          <EmptyState icon={Tags} title="No categories" message="Create the first category so students can file complaints." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <div key={c._id} className={`card flex flex-col p-5 ${c.isActive ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-navy-900">{c.name}</h3>
                <span className={`chip ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm text-ink-soft">{c.description || <span className="italic text-ink-muted">No description</span>}</p>
              <div className="mt-4 flex gap-2">
                <button className="btn-secondary btn-sm" onClick={() => setEditing(c)}>
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button className="btn-ghost btn-sm" onClick={() => toggle(c)} disabled={busyId === c._id}>
                  {busyId === c._id && <Spinner className="size-3" />}
                  {c.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <CategoryModal category={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  )
}
