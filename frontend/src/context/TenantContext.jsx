import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { commonApi, superApi } from '../services/api'
import { getTenantSlug, isSubdomainTenant, setTenantSlug } from '../utils/tenant'
import { applyTenantTheme, resetTenantTheme } from '../utils/theme'

const TenantContext = createContext(null)
const CACHE = 'scc_tenant_meta'

// Apply the last known branding immediately (before the API responds) to avoid a colour flash.
try {
  const cached = JSON.parse(localStorage.getItem(CACHE) || 'null')
  if (cached?.branding) applyTenantTheme(cached.branding)
} catch {
  /* ignore */
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null)
  const [departments, setDepartments] = useState([])
  const [tenants, setTenants] = useState([])
  const [slug, setSlug] = useState(getTenantSlug())
  const [ready, setReady] = useState(false)

  const loadMeta = useCallback(async () => {
    const res = await commonApi.meta()
    const uni = res.data.university
    setTenant(uni)
    setDepartments(res.data.departments || [])
    if (uni?.branding) {
      applyTenantTheme(uni.branding)
      try {
        localStorage.setItem(CACHE, JSON.stringify({ branding: uni.branding, slug: getTenantSlug() }))
      } catch {
        /* ignore */
      }
    }
    return uni
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        if (slug) {
          await loadMeta()
        } else {
          // Local dev with no subdomain: offer a university picker.
          const res = await superApi.publicTenants()
          if (active) setTenants(res.data || [])
          resetTenantTheme()
        }
      } catch {
        /* network issue — handled by showing the picker / default */
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [slug, loadMeta])

  const selectTenant = useCallback((newSlug) => {
    setTenantSlug(newSlug)
    setSlug(newSlug)
    setReady(false)
  }, [])

  const clearTenant = useCallback(() => {
    setTenantSlug(null)
    setSlug(null)
    setTenant(null)
    resetTenantTheme()
    try {
      localStorage.removeItem(CACHE)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      tenant,
      departments,
      tenants,
      slug,
      ready,
      needsSelection: !slug && !isSubdomainTenant(),
      lockedToSubdomain: isSubdomainTenant(),
      selectTenant,
      clearTenant,
      reloadMeta: loadMeta,
    }),
    [tenant, departments, tenants, slug, ready, selectTenant, clearTenant, loadMeta]
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider')
  return ctx
}
