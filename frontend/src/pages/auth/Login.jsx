import { ArrowRight, Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { HOME_BY_ROLE, useAuth } from '../../context/AuthContext'
import { errorMessage, fieldErrors } from '../../services/api'
import { LOGIN_ROLES } from '../../utils/roles'

function RoleCard({ role, selected, onSelect }) {
  const Icon = role.icon
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-4 text-center transition duration-200 ${
        selected ? `${role.card} shadow-pop ring-4 -translate-y-0.5` : 'border-line bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card'
      }`}
    >
      {selected && (
        <span className={`absolute top-2 right-2 grid size-5 place-items-center rounded-full ${role.iconBox}`}>
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
      )}
      <span className={`grid size-12 place-items-center rounded-xl transition ${selected ? role.iconBox : role.idle}`}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="text-sm leading-tight font-semibold text-ink">{role.title}</span>
      <span className="hidden text-[11px] leading-snug text-ink-muted sm:block">{role.subtitle}</span>
    </button>
  )
}

export default function Login() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [roleKey, setRoleKey] = useState('student')
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const role = LOGIN_ROLES.find((r) => r.key === roleKey)
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
      // The account's real role decides access; a mismatched choice is undone so users pick the right portal.
      if (user.role !== roleKey) {
        await logout()
        const actual = LOGIN_ROLES.find((r) => r.key === user.role)
        toast.error(`This is a ${actual?.title || user.role} account. Please choose "${actual?.title || user.role}" above.`)
        if (actual) setRoleKey(actual.key)
        return
      }
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
      <h1 className="text-3xl font-bold tracking-tight text-navy-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Choose your role, then sign in with your IUBAT account.</p>

      <div className="mt-7 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Sign in as">
        {LOGIN_ROLES.map((r) => (
          <RoleCard
            key={r.key}
            role={r}
            selected={r.key === roleKey}
            onSelect={() => {
              setRoleKey(r.key)
              setErrors({})
            }}
          />
        ))}
      </div>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-5 sm:p-6" noValidate>
        <div className="flex items-center gap-2">
          <span className={`grid size-7 place-items-center rounded-lg ${role.iconBox}`}>
            <role.icon className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-ink">{role.title} sign in</p>
        </div>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            value={form.email}
            onChange={set('email')}
            placeholder="you@iubat.edu"
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

        <button type="submit" className={`btn w-full py-2.5 text-white ${role.button}`} disabled={submitting}>
          {submitting ? <Spinner className="size-4 text-white" /> : null}
          Sign in as {role.title}
          {!submitting && <ArrowRight className="size-4" />}
        </button>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-ink-soft hover:text-brand-700"
          onClick={() => {
            setForm(role.demo)
            setErrors({})
          }}
        >
          <Sparkles className="size-3.5" aria-hidden="true" /> Fill demo {role.title.toLowerCase()} account
        </button>
      </form>

      {role.canRegister ? (
        <p className="mt-6 text-center text-sm text-ink-soft">
          New to IUBAT Smart Campus?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            Create a student account
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-xs text-ink-muted">Staff and admin accounts are created by the Facilities Office.</p>
      )}
    </div>
  )
}
