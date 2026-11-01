import { Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Avatar, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, Pagination, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import useDebounce from '../../hooks/useDebounce'
import { adminApi, errorMessage, fieldErrors } from '../../services/api'
import { ROLE_LABELS } from '../../utils/constants'
import { formatDate } from '../../utils/format'

const EMPTY = { name: '', email: '', password: '', role: 'staff', department: '', phone: '' }

const ROLE_CHIP = {
  student: 'bg-sky-50 text-sky-700 ring-sky-200',
  staff: 'bg-amber-50 text-amber-800 ring-amber-200',
  admin: 'bg-violet-50 text-violet-700 ring-violet-200',
}

function CreateUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const res = await adminApi.createUser({ ...form, name: form.name.trim(), email: form.email.trim() })
      toast.success(res.message)
      setForm(EMPTY)
      onCreated()
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const cls = (k) => `input ${errors[k] ? 'input-error' : ''}`
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create staff / admin account"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" form="create-user" disabled={busy}>
            {busy && <Spinner className="size-4 text-white" />} Create account
          </button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="u-name" error={errors.name} required>
          <input id="u-name" className={cls('name')} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" htmlFor="u-email" error={errors.email} required>
          <input id="u-email" type="email" className={cls('email')} value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Temporary password" htmlFor="u-pw" error={errors.password} hint="At least 8 characters with a letter and a number" required>
          <input id="u-pw" type="text" className={cls('password')} value={form.password} onChange={set('password')} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="u-role" error={errors.role} required>
            <select id="u-role" className={cls('role')} value={form.role} onChange={set('role')}>
              <option value="staff">Maintenance Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>
          <Field label="Department" htmlFor="u-dept" error={errors.department}>
            <input id="u-dept" className={cls('department')} value={form.department} onChange={set('department')} placeholder="e.g. Electrical" />
          </Field>
        </div>
        <Field label="Phone" htmlFor="u-phone" error={errors.phone}>
          <input id="u-phone" className={cls('phone')} value={form.phone} onChange={set('phone')} />
        </Field>
      </form>
    </Modal>
  )
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const q = useDebounce(search)

  const { data, meta, loading, error, reload } = useApi(
    () => adminApi.users({ page, role: role || undefined, search: q.trim() || undefined }),
    [page, role, q]
  )

  async function toggleActive(u) {
    setBusyId(u.id)
    try {
      await adminApi.updateUser(u.id, { isActive: !u.isActive })
      toast.success(u.isActive ? `${u.name} deactivated` : `${u.name} activated`)
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
        title="Users"
        subtitle="Manage students, maintenance staff and administrators."
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <UserPlus className="size-4" /> Add staff / admin
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              className="input pl-9"
              placeholder="Search name, email, student ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Search users"
            />
          </div>
          <select
            className="input sm:w-48"
            value={role}
            onChange={(e) => {
              setRole(e.target.value)
              setPage(1)
            }}
            aria-label="Role"
          >
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data.length ? (
          <EmptyState title="No users found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className="table-head">User</th>
                    <th className="table-head">Role</th>
                    <th className="table-head hidden md:table-cell">Department</th>
                    <th className="table-head hidden lg:table-cell">Joined</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.map((u) => (
                    <tr key={u.id}>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} className="size-8 text-xs" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {u.name} {u.id === me.id && <span className="text-xs text-ink-muted">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-ink-muted">
                              {u.email}
                              {u.studentId ? ` · ${u.studentId}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`chip ring-1 ring-inset ${ROLE_CHIP[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td className="table-cell hidden text-ink-soft md:table-cell">{u.department || '—'}</td>
                      <td className="table-cell hidden text-xs text-ink-soft lg:table-cell">{formatDate(u.createdAt)}</td>
                      <td className="table-cell">
                        <span className={`chip ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        {u.id !== me.id && (
                          <button
                            className={u.isActive ? 'btn-secondary btn-sm text-red-600' : 'btn-secondary btn-sm text-emerald-700'}
                            onClick={() => toggleActive(u)}
                            disabled={busyId === u.id}
                          >
                            {busyId === u.id && <Spinner className="size-3" />}
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
    </div>
  )
}
