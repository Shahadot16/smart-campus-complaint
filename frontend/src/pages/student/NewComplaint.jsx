import { CheckCircle2, Send } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import ImagePicker from '../../components/ImagePicker'
import { ErrorState, Field, PageHeader, PageLoader, Spinner } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { commonApi, complaintApi, errorMessage, fieldErrors } from '../../services/api'
import { PRIORITY_OPTIONS } from '../../utils/constants'

const EMPTY = { title: '', description: '', category: '', building: '', room: '', priority: 'medium' }

function validate(f) {
  const e = {}
  if (f.title.trim().length < 5 || f.title.trim().length > 120) e.title = 'Title must be 5–120 characters'
  if (f.description.trim().length < 10 || f.description.trim().length > 2000) e.description = 'Description must be 10–2000 characters'
  if (!f.category) e.category = 'Please choose a category'
  if (!f.building.trim()) e.building = 'Building is required'
  return e
}

export default function NewComplaint() {
  const navigate = useNavigate()
  const { data: categories, loading, error, reload } = useApi(() => commonApi.categories(), [])
  const [form, setForm] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return

    const fd = new FormData()
    for (const [k, v] of Object.entries(form)) fd.append(k, v.trim())
    files.forEach((f) => fd.append('images', f))

    setSubmitting(true)
    try {
      const res = await complaintApi.create(fd)
      setCreated(res.data)
      toast.success('Complaint submitted')
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err, 'Could not submit complaint'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  if (created) {
    return (
      <div className="animate-fade-in mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-9" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-navy-900">Complaint submitted</h1>
        <p className="mt-2 text-ink-soft">Keep this tracking ID for reference. You'll be notified as it progresses.</p>
        <p className="mt-5 inline-block rounded-lg border border-line bg-white px-5 py-3 font-mono text-lg font-semibold text-navy-800">
          {created.trackingCode}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            className="btn-secondary"
            onClick={() => {
              setCreated(null)
              setForm(EMPTY)
              setFiles([])
            }}
          >
            Submit another
          </button>
          <button className="btn-primary" onClick={() => navigate(`/complaints/${created.id}`)}>
            View complaint
          </button>
        </div>
      </div>
    )
  }

  const cls = (k) => `input ${errors[k] ? 'input-error' : ''}`

  return (
    <div className="animate-fade-in mx-auto max-w-3xl">
      <PageHeader title="New complaint" subtitle="Describe the issue clearly so the right team can fix it quickly." />
      <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <Field label="Title" htmlFor="title" error={errors.title} hint={`${form.title.length}/120`} required>
          <input id="title" className={cls('title')} value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Ceiling fan not working in Room 204" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" error={errors.category} required>
            <select id="category" className={cls('category')} value={form.category} onChange={set('category')}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="priority" error={errors.priority} hint="How urgently does this need attention?">
            <select id="priority" className={cls('priority')} value={form.priority} onChange={set('priority')}>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Building" htmlFor="building" error={errors.building} required>
            <input id="building" className={cls('building')} value={form.building} onChange={set('building')} maxLength={80} placeholder="e.g. Academic Block A" />
          </Field>
          <Field label="Room / area" htmlFor="room" error={errors.room}>
            <input id="room" className={cls('room')} value={form.room} onChange={set('room')} maxLength={40} placeholder="e.g. 204 or 2nd floor washroom" />
          </Field>
        </div>

        <Field label="Description" htmlFor="description" error={errors.description} hint={`${form.description.length}/2000`} required>
          <textarea
            id="description"
            rows={5}
            className={cls('description')}
            value={form.description}
            onChange={set('description')}
            maxLength={2000}
            placeholder="What is the problem, since when, and how is it affecting you?"
          />
        </Field>

        <Field label="Photos (optional)">
          <ImagePicker files={files} onChange={setFiles} disabled={submitting} />
        </Field>

        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Link to="/student" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? <Spinner className="size-4 text-white" /> : <Send className="size-4" />}
            Submit complaint
          </button>
        </div>
      </form>
    </div>
  )
}
