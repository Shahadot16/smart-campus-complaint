import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { authApi, errorMessage } from '../../services/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      errs.password = 'At least 8 characters with a letter and a number'
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setBusy(true)
    try {
      const res = await authApi.resetPassword({ token, password: form.password })
      toast.success(res.message)
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-navy-900">Invalid link</h1>
        <p className="mt-2 text-sm text-ink-soft">This password reset link is incomplete.</p>
        <Link to="/forgot-password" className="btn-primary mt-6">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <KeyRound className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-soft">For your security, all devices will be signed out.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-5" noValidate>
        <Field label="New password" htmlFor="rp-pw" error={errors.password}>
          <input id="rp-pw" type="password" autoComplete="new-password" className={`input ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoFocus />
        </Field>
        <Field label="Confirm password" htmlFor="rp-confirm" error={errors.confirm}>
          <input id="rp-confirm" type="password" autoComplete="new-password" className={`input ${errors.confirm ? 'input-error' : ''}`} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <button className="btn-primary w-full py-2.5" disabled={busy}>
          {busy && <Spinner className="size-4 text-white" />} Update password
        </button>
      </form>
    </div>
  )
}
