import { KeyRound, Save } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import SecuritySettings from '../../components/SecuritySettings'
import { Avatar, Field, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { authApi, errorMessage, fieldErrors } from '../../services/api'
import { ROLE_LABELS } from '../../utils/constants'
import { formatDate } from '../../utils/format'

function ProfileForm() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: user.name, department: user.department || '', phone: user.phone || '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const res = await authApi.updateProfile({ name: form.name.trim(), department: form.department.trim(), phone: form.phone.trim() })
      setUser(res.data.user)
      toast.success('Profile updated')
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h2 className="font-semibold text-navy-900">Personal details</h2>
      <Field label="Full name" htmlFor="p-name" error={errors.name}>
        <input id="p-name" className="input" value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Email" htmlFor="p-email" hint="Contact the administrator to change your email.">
        <input id="p-email" className="input" value={user.email} disabled />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor="p-dept" error={errors.department}>
          <input id="p-dept" className="input" value={form.department} onChange={set('department')} />
        </Field>
        <Field label="Phone" htmlFor="p-phone" error={errors.phone}>
          <input id="p-phone" className="input" value={form.phone} onChange={set('phone')} />
        </Field>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="size-4 text-white" /> : <Save className="size-4" />} Save
        </button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.currentPassword) errs.currentPassword = 'Current password is required'
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword))
      errs.newPassword = 'At least 8 characters with a letter and a number'
    if (form.confirm !== form.newPassword) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setBusy(true)
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      toast.success('Password changed')
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const cls = (k) => `input ${errors[k] ? 'input-error' : ''}`
  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h2 className="font-semibold text-navy-900">Change password</h2>
      <Field label="Current password" htmlFor="pw-cur" error={errors.currentPassword}>
        <input id="pw-cur" type="password" autoComplete="current-password" className={cls('currentPassword')} value={form.currentPassword} onChange={set('currentPassword')} />
      </Field>
      <Field label="New password" htmlFor="pw-new" error={errors.newPassword}>
        <input id="pw-new" type="password" autoComplete="new-password" className={cls('newPassword')} value={form.newPassword} onChange={set('newPassword')} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-conf" error={errors.confirm}>
        <input id="pw-conf" type="password" autoComplete="new-password" className={cls('confirm')} value={form.confirm} onChange={set('confirm')} />
      </Field>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="size-4 text-white" /> : <KeyRound className="size-4" />} Update password
        </button>
      </div>
    </form>
  )
}

export default function Profile() {
  const { user } = useAuth()
  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile" />
      <div className="card flex items-center gap-4 p-5">
        <Avatar name={user.name} className="size-14 text-lg" />
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold text-navy-900">
            {user.name}
            <span className={`chip ${user.emailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {user.emailVerified ? 'Email verified' : 'Email not verified'}
            </span>
          </p>
          <p className="text-sm text-ink-soft">
            {ROLE_LABELS[user.role]}
            {user.studentId ? ` · ${user.studentId}` : ''} · member since {formatDate(user.createdAt)}
          </p>
        </div>
      </div>
      <ProfileForm />
      <PasswordForm />
      <SecuritySettings />
    </div>
  )
}
