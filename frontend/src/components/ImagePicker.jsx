import { ImagePlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IMAGE_TYPES, MAX_IMAGE_MB, MAX_IMAGES } from '../utils/constants'
import { formatBytes } from '../utils/format'

/** Drag-and-drop image picker with previews and client-side checks (the server re-validates). */
export default function ImagePicker({ files, onChange, max = MAX_IMAGES, disabled }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files])
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  function addFiles(list) {
    setError('')
    const incoming = Array.from(list || [])
    const accepted = []
    for (const f of incoming) {
      if (!IMAGE_TYPES.includes(f.type)) {
        setError(`"${f.name}" is not a supported image (JPG, PNG, WEBP, GIF).`)
        continue
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        setError(`"${f.name}" is larger than ${MAX_IMAGE_MB} MB.`)
        continue
      }
      accepted.push(f)
    }
    const next = [...files, ...accepted]
    if (next.length > max) setError(`You can attach up to ${max} images.`)
    onChange(next.slice(0, max))
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) addFiles(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-line bg-slate-50/50 hover:border-brand-200 hover:bg-brand-50/40'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <ImagePlus className="size-7 text-brand-600" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-ink">
          Drop images here or <span className="text-brand-600 underline">browse</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          JPG, PNG, WEBP or GIF · up to {MAX_IMAGE_MB} MB each · max {max}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="field-error">{error}</p>}
      {previews.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {previews.map(({ file, url }, i) => (
            <li key={url} className="group relative overflow-hidden rounded-lg border border-line bg-white">
              <img src={url} alt={file.name} className="aspect-square w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-navy-950/60 px-1.5 py-0.5 text-[10px] text-white">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
