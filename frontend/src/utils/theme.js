/**
 * Per-tenant theming. Tailwind v4 exposes the palette as CSS custom properties
 * (e.g. `--color-navy-900`), and every utility like `bg-navy-900` resolves to
 * `var(--color-navy-900)`. So overriding these variables at runtime re-colours
 * the entire UI for the current university.
 */
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n) || full.length !== 6) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Mix a hex colour toward another (white to lighten, black to darken). */
function mix(hex, target, amount) {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  if (!a || !b) return hex
  const ch = (x, y) => Math.round(x + (y - x) * amount)
  const to2 = (v) => v.toString(16).padStart(2, '0')
  return `#${to2(ch(a.r, b.r))}${to2(ch(a.g, b.g))}${to2(ch(a.b, b.b))}`
}

const BLACK = '#000000'
const WHITE = '#ffffff'

const VARS = [
  '--color-navy-950', '--color-navy-900', '--color-navy-800', '--color-navy-700',
  '--color-brand-700', '--color-brand-600', '--color-brand-500',
  '--color-brand-200', '--color-brand-100', '--color-brand-50',
]

export function applyTenantTheme(branding) {
  const primary = branding?.primaryColor || '#0a4029'
  const accent = branding?.accentColor || '#16a34a'
  const root = document.documentElement.style

  root.setProperty('--color-navy-950', mix(primary, BLACK, 0.28))
  root.setProperty('--color-navy-900', primary)
  root.setProperty('--color-navy-800', mix(primary, WHITE, 0.1))
  root.setProperty('--color-navy-700', mix(primary, WHITE, 0.2))

  root.setProperty('--color-brand-700', mix(accent, BLACK, 0.3))
  root.setProperty('--color-brand-600', mix(accent, BLACK, 0.14))
  root.setProperty('--color-brand-500', accent)
  root.setProperty('--color-brand-200', mix(accent, WHITE, 0.55))
  root.setProperty('--color-brand-100', mix(accent, WHITE, 0.78))
  root.setProperty('--color-brand-50', mix(accent, WHITE, 0.92))

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta) themeMeta.setAttribute('content', primary)
}

export function resetTenantTheme() {
  const root = document.documentElement.style
  for (const v of VARS) root.removeProperty(v)
}
