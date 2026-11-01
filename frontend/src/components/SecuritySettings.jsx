import { Laptop, LogOut, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import useApi from '../hooks/useApi'
import { authApi, errorMessage } from '../services/api'
import { timeAgo } from '../utils/format'
import { ErrorState, Field, Modal, PageLoader, Spinner } from './ui'

/** Short, readable device name from a user-agent string. */
function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return { label: os ? `${browser} on ${os}` : browser, mobile: /Android|iPhone|iPad|Mobile/.test(ua) }
}

function CodeInput({ value, onChange, id }) {
  return (
    <input
      id={id}
      className="input text-center font-mono text-xl tracking-[0.4em]"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  )
}

function TwoFactorCard() {
  const { user, setUser } = useAuth()
  const [setup, setSetup] = useState(null)
  const [disabling, setDisabling] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    try {
      const res = await authApi.setupTwoFactor()
      setSetup(res.data)
      setCode('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable() {
    setBusy(true)
    try {
      const res = await authApi.enableTwoFactor(code)
      setUser(res.data.user)
      toast.success(res.message)
      setSetup(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDisable() {
    setBusy(true)
    try {
      const res = await authApi.disableTwoFactor({ password, code })
      setUser(res.data.user)
      toast.success(res.message)
      setDisabling(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const on = user.twoFactorEnabled
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {on ? <ShieldCheck className="size-6" aria-hidden="true" /> : <ShieldOff className="size-6" aria-hidden="true" />}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-navy-900">Two-step verification</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            {on
              ? 'On. A code from your authenticator app is required at every sign-in.'
              : 'Add a second step to sign-in with an authenticator app (Google Authenticator, Microsoft Authenticator…).'}
            {user.role === 'admin' && !on && <strong className="text-amber-700"> Strongly recommended for administrators.</strong>}
          </p>
        </div>
        {on ? (
          <button className="btn-secondary btn-sm text-red-600" onClick={() => (setDisabling(true), setCode(''), setPassword(''))}>
            Turn off
          </button>
        ) : (
          <button className="btn-primary btn-sm" onClick={start} disabled={busy}>
            {busy && <Spinner className="size-3 text-white" />} Turn on
          </button>
        )}
      </div>

      <Modal
        open={Boolean(setup)}
        onClose={() => setSetup(null)}
        title="Set up two-step verification"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSetup(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={confirmEnable} disabled={busy || code.length !== 6}>
              {busy && <Spinner className="size-4 text-white" />} Verify & turn on
            </button>
          </>
        }
      >
        {setup && (
          <div className="space-y-4 text-sm">
            <p>
              <strong>1.</strong> Scan this QR code with your authenticator app.
            </p>
            <img src={setup.qrDataUrl} alt="Two-factor QR code" className="mx-auto size-48 rounded-lg border border-line" />
            <p className="text-center text-xs text-ink-muted">
              Can't scan? Enter this key: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono break-all">{setup.secret}</code>
            </p>
            <Field label="2. Enter the 6-digit code shown in the app" htmlFor="tf-code">
              <CodeInput id="tf-code" value={code} onChange={setCode} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={disabling}
        onClose={() => setDisabling(false)}
        title="Turn off two-step verification"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDisabling(false)}>
              Cancel
            </button>
            <button className="btn-danger" onClick={confirmDisable} disabled={busy || code.length !== 6 || !password}>
              {busy && <Spinner className="size-4 text-white" />} Turn off
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Password" htmlFor="tf-pw">
            <input id="tf-pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="Current 6-digit code" htmlFor="tf-code2">
            <CodeInput id="tf-code2" value={code} onChange={setCode} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function SessionsCard() {
  const { data, loading, error, reload } = useApi(() => authApi.sessions(), [])
  const [busy, setBusy] = useState(null)

  async function run(id, fn) {
    setBusy(id)
    try {
      const res = await fn()
      toast.success(res.message)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="font-semibold text-navy-900">Signed-in devices</h3>
          <p className="text-xs text-ink-muted">Sign out any device you don't recognise.</p>
        </div>
        {data?.length > 1 && (
          <button className="btn-secondary btn-sm" disabled={busy === 'all'} onClick={() => run('all', authApi.revokeOtherSessions)}>
            Sign out all others
          </button>
        )}
      </div>
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <ul className="divide-y divide-line">
          {data.map((s) => {
            const d = describeDevice(s.userAgent)
            const Icon = d.mobile ? Smartphone : Laptop
            return (
              <li key={s._id} className="flex items-center gap-3 px-5 py-3">
                <Icon className="size-5 text-ink-muted" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {d.label} {s.current && <span className="chip ml-1 bg-emerald-50 text-emerald-700">This device</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {s.ip || 'Unknown IP'} · signed in {timeAgo(s.createdAt)} · active {timeAgo(s.lastUsedAt)}
                  </p>
                </div>
                {!s.current && (
                  <button className="btn-ghost btn-sm" disabled={busy === s._id} onClick={() => run(s._id, () => authApi.revokeSession(s._id))} aria-label="Sign out device">
                    <LogOut className="size-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function SecuritySettings() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-navy-900">Security</h2>
      <TwoFactorCard />
      <SessionsCard />
    </section>
  )
}
