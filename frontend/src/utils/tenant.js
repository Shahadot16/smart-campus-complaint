const KEY = 'scc_tenant'

/**
 * In production the tenant is the subdomain (iubat.app.com -> "iubat").
 * In local development there is no subdomain, so we remember the chosen
 * university in localStorage.
 */
export function tenantFromSubdomain() {
  const host = window.location.hostname || ''
  const labels = host.split('.')
  if (labels.length > 2) {
    const sub = labels[0]
    if (sub && !['www', 'app', 'api', 'admin', 'localhost'].includes(sub)) return sub
  }
  return null
}

export function getTenantSlug() {
  const sub = tenantFromSubdomain()
  if (sub) return sub
  try {
    return localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

export function setTenantSlug(slug) {
  try {
    if (slug) localStorage.setItem(KEY, slug)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked (private mode) — ignore */
  }
}

export const isSubdomainTenant = () => Boolean(tenantFromSubdomain())
