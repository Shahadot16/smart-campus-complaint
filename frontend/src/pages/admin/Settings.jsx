import { Image as ImageIcon, Palette, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ErrorState, Field, PageHeader, PageLoader, Spinner } from '../../components/ui'
import { useTenant } from '../../context/TenantContext'
import useApi from '../../hooks/useApi'
import { errorMessage, settingsApi } from '../../services/api'
import { applyTenantTheme } from '../../utils/theme'

const HEX = /^#[0-9a-fA-F]{6}$/

/** Shrinks an uploaded image to a small square-ish logo and returns a data URL. */
function resizeToDataUrl(file, max = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That file is not a valid image'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

function ColorField({ label, value, onChange }) {
  const valid = HEX.test(value)
  return (
    <Field label={label} error={valid ? '' : 'Use a hex value like #0a4029'}>
      <div className="flex items-center gap-2">
        <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="size-9 shrink-0 cursor-pointer rounded-lg border border-line" />
        <input className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} />
      </div>
    </Field>
  )
}

/** A small, live preview of how the branding looks across the app. */
function Preview({ name, shortName, tagline, logo, primary, accent }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line shadow-card">
      {/* sidebar-style header */}
      <div className="flex items-center gap-3 p-4" style={{ background: primary }}>
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/15 text-sm font-bold text-white">
          {logo ? <img src={logo} alt="" className="size-full object-contain" /> : (shortName || 'SC').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{name || 'Your University'}</p>
          <p className="truncate text-xs text-white/70">{tagline || 'Complaint & maintenance portal'}</p>
        </div>
      </div>
      {/* body with accent buttons */}
      <div className="space-y-3 bg-white p-4">
        <div className="h-2 w-2/3 rounded-full bg-slate-100" />
        <div className="h-2 w-1/2 rounded-full bg-slate-100" />
        <div className="flex gap-2 pt-1">
          <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: accent }}>Primary action</span>
          <span className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: `${accent}22`, color: accent }}>Accent</span>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { reloadMeta, tenant } = useTenant()
  const { data, loading, error, reload } = useApi(() => settingsApi.getBranding(), [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const realBranding = useRef(null)

  // Seed the form once the current settings load.
  useEffect(() => {
    if (!data) return
    realBranding.current = data.branding
    setForm({
      name: data.name || '',
      shortName: data.shortName || '',
      tagline: data.branding?.tagline || '',
      website: data.website || '',
      address: data.address || '',
      phone: data.phone || '',
      primaryColor: data.branding?.primaryColor || '#0a4029',
      accentColor: data.branding?.accentColor || '#16a34a',
      logo: data.branding?.logo || '',
    })
  }, [data])

  // Live-preview the colours across the whole app while editing; restore on leave.
  useEffect(() => {
    if (form && HEX.test(form.primaryColor) && HEX.test(form.accentColor)) {
      applyTenantTheme({ primaryColor: form.primaryColor, accentColor: form.accentColor })
    }
  }, [form])

  useEffect(
    () => () => {
      if (realBranding.current) applyTenantTheme(realBranding.current) // restore saved theme on unmount
    },
    []
  )

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  async function onPickLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file')
    try {
      const url = await resizeToDataUrl(file)
      setForm((f) => ({ ...f, logo: url }))
    } catch (err) {
      toast.error(err.message || 'Could not process that image')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = useCallback(async () => {
    if (!HEX.test(form.primaryColor) || !HEX.test(form.accentColor)) return toast.error('Please enter valid hex colours')
    if (!form.name.trim()) return toast.error('University name is required')
    setSaving(true)
    try {
      await settingsApi.updateBranding({
        name: form.name,
        shortName: form.shortName,
        website: form.website,
        address: form.address,
        phone: form.phone,
        branding: {
          tagline: form.tagline,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          logo: form.logo,
        },
      })
      realBranding.current = { primaryColor: form.primaryColor, accentColor: form.accentColor, logo: form.logo, tagline: form.tagline }
      await reloadMeta() // re-theme the whole app for everyone
      toast.success('Settings saved — your branding is live')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save settings'))
    } finally {
      setSaving(false)
    }
  }, [form, reloadMeta])

  function resetForm() {
    if (!data) return
    setForm({
      name: data.name || '',
      shortName: data.shortName || '',
      tagline: data.branding?.tagline || '',
      website: data.website || '',
      address: data.address || '',
      phone: data.phone || '',
      primaryColor: data.branding?.primaryColor || '#0a4029',
      accentColor: data.branding?.accentColor || '#16a34a',
      logo: data.branding?.logo || '',
    })
  }

  if (loading || !form) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Branding & settings" subtitle="Customise how your university portal looks. Changes apply across the whole app." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <p className="mb-4 flex items-center gap-2 font-semibold text-navy-900"><ImageIcon className="size-4 text-brand-600" /> University profile</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="University name"><input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} /></Field>
              <Field label="Short name"><input className="input" value={form.shortName} onChange={(e) => set('shortName')(e.target.value)} placeholder="IUBAT" /></Field>
              <div className="sm:col-span-2"><Field label="Tagline"><input className="input" value={form.tagline} onChange={(e) => set('tagline')(e.target.value)} placeholder="Complaint & maintenance portal" /></Field></div>
              <Field label="Website"><input className="input" value={form.website} onChange={(e) => set('website')(e.target.value)} placeholder="https://…" /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => set('phone')(e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Address"><input className="input" value={form.address} onChange={(e) => set('address')(e.target.value)} /></Field></div>
            </div>
          </div>

          <div className="card p-6">
            <p className="mb-4 flex items-center gap-2 font-semibold text-navy-900"><Palette className="size-4 text-brand-600" /> Colours & logo</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Primary colour (sidebar / headers)" value={form.primaryColor} onChange={set('primaryColor')} />
              <ColorField label="Accent colour (buttons / links)" value={form.accentColor} onChange={set('accentColor')} />
            </div>

            <div className="mt-4">
              <p className="label">Logo</p>
              <div className="flex items-center gap-4">
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-slate-50">
                  {form.logo ? <img src={form.logo} alt="logo" className="size-full object-contain" /> : <ImageIcon className="size-6 text-ink-muted" />}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="size-3.5" /> Upload image
                  </button>
                  {form.logo && (
                    <button type="button" className="btn-sm btn gap-1.5 border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100" onClick={() => set('logo')('')}>
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-muted">PNG or JPG. It's resized automatically to a small logo.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner className="size-4 text-white" /> : <Save className="size-4" />} Save changes
            </button>
            <button className="btn-secondary" onClick={resetForm} disabled={saving}>
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-sm font-semibold text-ink-soft">Live preview</p>
          <Preview
            name={form.name}
            shortName={form.shortName}
            tagline={form.tagline}
            logo={form.logo}
            primary={HEX.test(form.primaryColor) ? form.primaryColor : '#0a4029'}
            accent={HEX.test(form.accentColor) ? form.accentColor : '#16a34a'}
          />
          <p className="mt-3 text-xs text-ink-muted">
            This is how the sidebar, headers and buttons will look{tenant?.name ? ` for ${tenant.name}` : ''}. The colours update across the whole app as you edit.
          </p>
        </div>
      </div>
    </div>
  )
}
