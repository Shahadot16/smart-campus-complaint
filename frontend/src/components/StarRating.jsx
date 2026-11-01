import { Star } from 'lucide-react'
import { useState } from 'react'

const LABELS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent']

export default function StarRating({ value = 0, onChange, size = 'size-7', readOnly }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex items-center gap-3">
      <div className="flex" role={readOnly ? 'img' : 'radiogroup'} aria-label={`Rating: ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            role={readOnly ? undefined : 'radio'}
            aria-checked={readOnly ? undefined : value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(0)}
            onClick={() => onChange?.(n)}
            className={`p-0.5 transition ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          >
            <Star className={`${size} ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
      {!readOnly && shown > 0 && <span className="text-sm font-medium text-ink-soft">{LABELS[shown]}</span>}
    </div>
  )
}
