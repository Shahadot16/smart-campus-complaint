import { ArrowLeft, MailCheck, Send } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { Field, Spinner } from '../../components/ui'
import { authApi, errorMessage } from '../../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error('Please enter a valid email address')
    setBusy(true)
    try {
      const res = await authApi.forgotPassword(email.trim())
      setSent(res)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-in text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
          <MailCheck className="size-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-navy-900">Check your email</h1>
        <p className="mt-2 text-sm text-ink-soft">{sent.message}</p>
        {sent.data?.devLink && (
          <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-left text-xs text-amber-900">
            <p className="font-semibold">Development mode — no email server configured</p>
            <a href={sent.data.devLink} className="mt-1 block break-all text-brand-700 underline">
              Open the reset link
            </a>
          </div>
        )}
        <Link to="/login" className="btn-secondary mt-8">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <Link to="/login" className="btn-ghost btn-sm -ml-2 mb-4">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <h1 className="text-2xl font-bold text-navy-900">Forgot your password?</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Enter your account email and we'll send you a link to choose a new password.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-5" noValidate>
        <Field label="Email" htmlFor="fp-email">
          <input id="fp-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@iubat.edu" autoFocus />
        </Field>
        <button className="btn-primary w-full py-2.5" disabled={busy}>
          {busy ? <Spinner className="size-4 text-white" /> : <Send className="size-4" />} Send reset link
        </button>
      </form>
    </div>
  )
}
