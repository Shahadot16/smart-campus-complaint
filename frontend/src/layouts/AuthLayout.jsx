import { BellRing, Cpu, MapPin, ShieldCheck, Timer } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import useApi from '../hooks/useApi'
import { commonApi } from '../services/api'

const FEATURES = [
  { icon: Timer, text: 'Report an issue in under a minute, with photos' },
  { icon: BellRing, text: 'Live updates as staff pick up and fix your complaint' },
  { icon: ShieldCheck, text: 'Every complaint tracked with a unique ID' },
]

export default function AuthLayout() {
  const { data: meta } = useApi(() => commonApi.meta(), [])
  const departments = meta?.departments || []

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-950 text-white lg:flex lg:flex-col">
        {/* Decorative layers in the IUBAT logo colours */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(22,163,74,0.35),transparent_45%),radial-gradient(circle_at_85%_75%,rgba(245,197,24,0.18),transparent_40%)]" aria-hidden="true" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" aria-hidden="true" />
        <div className="absolute top-0 left-0 flex h-1.5 w-full" aria-hidden="true">
          <span className="flex-1 bg-emerald-500" />
          <span className="flex-1 bg-accent-gold" />
          <span className="flex-1 bg-accent-red" />
        </div>

        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          <img src="/brand/iubat-logo-name.png" alt="IUBAT" className="h-12 w-auto self-start" />

          <div className="max-w-lg">
            <p className="text-sm font-semibold tracking-[0.2em] text-brand-200 uppercase">Smart Campus</p>
            <h2 className="mt-3 text-4xl leading-tight font-bold xl:text-5xl">
              A better campus,
              <br />
              <span className="text-accent-gold">one fix at a time.</span>
            </h2>
            <p className="mt-4 text-brand-100/80">
              The complaint &amp; maintenance portal for the engineering faculty of {meta?.university.name || 'IUBAT'}.
            </p>

            <ul className="mt-8 space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-brand-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon className="size-[18px] text-brand-200" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>

            {departments.length > 0 && (
              <div className="mt-10">
                <p className="text-xs font-semibold tracking-wide text-brand-200/80 uppercase">Engineering departments</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <span key={d.code} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/15" title={d.name}>
                      <Cpu className="size-3 text-accent-gold" aria-hidden="true" />
                      {d.code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-brand-200/70">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {meta?.university.address || 'Uttara Model Town, Dhaka-1230, Bangladesh'}
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-surface px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/brand/iubat-logo.png" alt="" className="h-10 w-auto" />
            <div>
              <p className="font-bold text-navy-900">IUBAT Smart Campus</p>
              <p className="text-xs text-ink-muted">Complaint &amp; maintenance portal</p>
            </div>
          </div>
          <Outlet context={{ departments }} />
        </div>
      </main>
    </div>
  )
}
