import { CheckCircle2, GraduationCap } from 'lucide-react'
import { Outlet } from 'react-router-dom'

const POINTS = [
  'Report maintenance, IT, hostel and facility issues in minutes',
  'Track every complaint with a unique tracking ID',
  'Get notified as staff work on and resolve your issue',
]

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10">
            <GraduationCap className="size-6" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Smart Campus</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl leading-tight font-bold">
            Campus issues,
            <br />
            resolved faster.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-brand-100">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-200" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200">Smart Campus Complaint Management System</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-navy-900 text-white">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <span className="font-semibold text-navy-900">Smart Campus</span>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
