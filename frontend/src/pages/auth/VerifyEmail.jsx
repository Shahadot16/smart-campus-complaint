import { CheckCircle2, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageLoader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { authApi, errorMessage } from '../../services/api'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const { user, setUser } = useAuth()
  const token = params.get('token')
  const [state, setState] = useState(
    token ? { status: 'loading', message: '' } : { status: 'error', message: 'This verification link is incomplete.' }
  )
  const started = useRef(false)

  useEffect(() => {
    // Tokens are single-use, so make sure StrictMode's double effect doesn't send it twice.
    if (started.current || !token) return
    started.current = true
    authApi
      .verifyEmail(token)
      .then((res) => {
        setState({ status: 'ok', message: res.message })
        setUser((u) => (u ? { ...u, emailVerified: true } : u))
      })
      .catch((err) => setState({ status: 'error', message: errorMessage(err) }))
  }, [token, setUser])

  if (state.status === 'loading') return <PageLoader label="Verifying your email…" />
  const ok = state.status === 'ok'
  return (
    <div className="animate-fade-in text-center">
      <span className={`mx-auto grid size-16 place-items-center rounded-full ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 className="size-9" aria-hidden="true" /> : <XCircle className="size-9" aria-hidden="true" />}
      </span>
      <h1 className="mt-5 text-2xl font-bold text-navy-900">{ok ? 'Email verified' : 'Verification failed'}</h1>
      <p className="mt-2 text-sm text-ink-soft">{state.message}</p>
      <Link to={user ? '/' : '/login'} className="btn-primary mt-8">
        {user ? 'Go to dashboard' : 'Sign in'}
      </Link>
    </div>
  )
}
