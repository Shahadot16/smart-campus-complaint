import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { BrandMark, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { LanguageSwitch } from '../context/LanguageContext'
import { useTenant } from '../context/TenantContext'

function UniversityPicker({ tenants, onPick }) {
  return (
    <div className="animate-fade-in w-full max-w-2xl">
      <div className="mb-8 text-center">
        <span className="animate-pop-in mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-pop">
          <Building2 className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-gradient-brand mt-4 text-3xl font-bold tracking-tight">Smart Campus</h1>
        <p className="mt-1.5 text-sm text-ink-soft">Choose your university to continue</p>
      </div>

      {tenants.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">No universities are available yet.</div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {tenants.map((t) => (
            <button
              key={t.slug}
              onClick={() => onPick(t.slug)}
              className="hover-lift group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-left shadow-card"
            >
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                style={{ background: t.branding?.primaryColor || '#0a4029' }}
              >
                {t.branding?.logo ? (
                  <img src={t.branding.logo} alt="" className="size-8 object-contain" />
                ) : (
                  <span className="text-sm font-bold">{t.shortName?.slice(0, 2)}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{t.shortName}</span>
                <span className="block truncate text-xs text-ink-muted">{t.name}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-600" />
            </button>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-ink-muted">
        <ShieldCheck className="mr-1 inline size-3.5 align-text-bottom" />
        Platform administrator?{' '}
        <Link to="/super/login" className="font-semibold text-brand-600 hover:underline">
          Sign in here
        </Link>
      </p>
    </div>
  )
}

export default function AuthLayout() {
  const { tenant, departments, tenants, ready, needsSelection, lockedToSubdomain, selectTenant, clearTenant } = useTenant()
  const { logout } = useAuth()

  async function switchUniversity() {
    await logout().catch(() => {})
    clearTenant()
  }

  const bg = (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="animate-aurora absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-[120px]" />
      <div className="animate-aurora absolute top-1/3 -right-24 size-80 rounded-full bg-emerald-100/70 blur-[110px] [animation-delay:-8s]" />
      <div className="animate-aurora absolute -bottom-32 -left-20 size-80 rounded-full bg-emerald-100/60 blur-[110px] [animation-delay:-14s]" />
    </div>
  )

  if (!ready) {
    return (
      <div className="relative grid min-h-screen place-items-center bg-surface">
        {bg}
        <Spinner className="relative size-8" />
      </div>
    )
  }

  if (needsSelection) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-12">
        {bg}
        <LanguageSwitch className="absolute top-5 right-4 z-10 text-ink-soft ring-line" />
        <div className="relative">
          <UniversityPicker tenants={tenants} onPick={selectTenant} />
        </div>
      </div>
    )
  }

  const branding = tenant?.branding || {}

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      {bg}
      <LanguageSwitch className="absolute top-5 right-4 z-10 text-ink-soft ring-line" />
      {!lockedToSubdomain && (
        <button
          onClick={switchUniversity}
          className="absolute top-5 left-4 z-10 flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-sm backdrop-blur transition hover:-translate-x-0.5 hover:text-brand-700"
        >
          <Building2 className="size-3.5" /> Change university
        </button>
      )}

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative">
            <span className="animate-glow-pulse absolute -inset-3 rounded-full bg-brand-300/30 blur-xl" aria-hidden="true" />
            <div className="animate-fade-in-down relative">
              <BrandMark tenant={tenant} className="size-14" text="text-lg" />
            </div>
          </div>
          <p className="animate-fade-in-up mt-3 text-lg font-bold text-navy-900 [animation-delay:0.08s]">{tenant?.name || 'Smart Campus'}</p>
          <p className="animate-fade-in-up text-sm text-ink-muted [animation-delay:0.14s]">{branding.tagline || 'Complaint & maintenance portal'}</p>
        </div>

        <Outlet context={{ departments: departments || [] }} />

        {!lockedToSubdomain && (
          <button onClick={switchUniversity} className="mt-8 text-center text-xs text-ink-muted transition hover:text-brand-700">
            Not {tenant?.shortName}? <span className="font-semibold text-brand-600">Switch university</span>
          </button>
        )}
      </div>
    </div>
  )
}
