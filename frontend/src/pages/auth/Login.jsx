import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext'
import { errorMessage, fieldErrors } from '../../services/api'

const DEMO = [
  { role: 'Student', email: 'student@campus.edu', password: 'Student@123' },
  { role: 'Admin', email: 'admin@campus.edu', password: 'Admin@123' },
  { role: 'Staff', email: 'staff@campus.edu', password: 'Staff@123' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.email.trim()) errs.email = 'Email is required'
    if (!form.password) errs.password = 'Password is required'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      const user = await login({ email: form.email.trim(), password: form.password })
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      const from = location.state?.from
      navigate(from && from !== '/login' ? from : HOME_BY_ROLE[user.role], { replace: true })
    } catch (err) {
      setErrors(fieldErrors(err))
      toast.error(errorMessage(err, 'Login failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-navy-900">Sign in</h1>
      <p className="mt-1 text-sm text-ink-soft">Use your campus account to continue.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            value={form.email}
            onChange={set('email')}
            placeholder="you@campus.edu"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
              value={form.password}
              onChange={set('password')}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 right-0 px-3 text-ink-muted hover:text-ink"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? <Spinner className="size-4 text-white" /> : <LogIn className="size-4" />}
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        New student?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-line bg-white p-4">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Demo accounts</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <button
              key={d.role}
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setForm({ email: d.email, password: d.password })
                setErrors({})
              }}
            >
              {d.role}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
