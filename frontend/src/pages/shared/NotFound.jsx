import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound({ standalone }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${standalone ? 'min-h-screen' : 'py-20'}`}>
      <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Compass className="size-8" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-bold text-navy-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-soft">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn-primary mt-6">
        Go home
      </Link>
    </div>
  )
}
