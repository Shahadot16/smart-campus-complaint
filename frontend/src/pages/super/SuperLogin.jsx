import { ArrowRight, Building2, Eye, EyeOff, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { errorMessage, superApi } from '../../services/api'
import { resetTenantTheme } from '../../utils/theme'

export default function SuperLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    resetTenantTheme()
    superApi
      .me()
      .then(() => navigate('/super', { replace: true }))
      .catch(() => {})
  }, [navigate])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    // Read straight from the inputs so browser autofill (which doesn't always
    // fire React's onChange) can't submit empty credentials.
    const email = (e.currentTarget.email?.value ?? form.email).trim()
    // Trim the password too — browser autofill sometimes appends a stray space.
    const password = (e.currentTarget.password?.value ?? form.password).trim()
    if (!email || !password) {
      toast.error('Enter your email and password')
      return
    }
    setBusy(true)
    try {
      await superApi.login({ email, password })
      toast.success('Welcome back, platform admin')
      navigate('/super', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err, 'Login failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="animate-aurora absolute -top-32 -left-24 size-[32rem] rounded-full bg-indigo-500/25 blur-[110px]" />
        <div className="animate-aurora absolute -bottom-32 -right-20 size-[28rem] rounded-full bg-sky-500/20 blur-[110px] [animation-delay:-8s]" />
      </div>

      <div className="animate-fade-in-up relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="animate-pop-in mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg">
            <Building2 className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Smart Campus Platform</h1>
          <p className="mt-1 text-sm text-slate-400">Administrator sign-in</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl" noValidate>
          <Field label={<span className="text-slate-200">Email</span>} htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/30 focus:outline-none"
              value={form.email}
              onChange={set('email')}
              placeholder="super@smartcampus.app"
            />
          </Field>
          <Field label={<span className="text-slate-200">Password</span>} htmlFor="password">
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 pr-10 text-sm text-white focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/30 focus:outline-none"
                value={form.password}
                onChange={set('password')}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white" aria-label="Toggle password">
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="btn group w-full gap-2 bg-gradient-to-br from-indigo-500 to-sky-500 py-2.5 font-semibold text-white shadow-sm hover:from-indigo-600 hover:to-sky-600 disabled:opacity-60"
          >
            {busy ? <Spinner className="size-4 text-white" /> : <Lock className="size-4" />}
            Sign in
            {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/" className="hover:text-slate-300">
            ← Back to the university portal
          </Link>
        </p>
      </div>
    </div>
  )
}
