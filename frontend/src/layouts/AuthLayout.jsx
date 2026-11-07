import { Outlet } from 'react-router-dom'
import { LanguageSwitch } from '../context/LanguageContext'
import useApi from '../hooks/useApi'
import { commonApi } from '../services/api'

export default function AuthLayout() {
  const { data: meta } = useApi(() => commonApi.meta(), [])
  const departments = meta?.departments || []

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      {/* Soft, slow-drifting brand glow — subtle warmth, not loud */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="animate-aurora absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-[120px]" />
        <div className="animate-aurora absolute top-1/3 -right-24 size-80 rounded-full bg-emerald-100/70 blur-[110px] [animation-delay:-8s]" />
        <div className="animate-aurora absolute -bottom-32 -left-20 size-80 rounded-full bg-emerald-100/60 blur-[110px] [animation-delay:-14s]" />
      </div>

      <LanguageSwitch className="absolute top-5 right-4 z-10 text-ink-soft ring-line" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative">
            <span className="animate-glow-pulse absolute -inset-3 rounded-full bg-brand-300/30 blur-xl" aria-hidden="true" />
            <img src="/brand/iubat-logo.png" alt="IUBAT" className="animate-fade-in-down relative h-14 w-auto" />
          </div>
          <p className="animate-fade-in-up mt-3 text-lg font-bold text-navy-900 [animation-delay:0.08s]">IUBAT Smart Campus</p>
          <p className="animate-fade-in-up text-sm text-ink-muted [animation-delay:0.14s]">Complaint &amp; maintenance portal</p>
        </div>

        <Outlet context={{ departments }} />

        <p className="animate-fade-in mt-10 text-center text-xs text-ink-muted [animation-delay:0.4s]">
          {meta?.university.name || 'International University of Business Agriculture and Technology'}
        </p>
      </div>
    </div>
  )
}
