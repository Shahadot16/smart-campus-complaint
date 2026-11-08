import { Building2, Check, CreditCard, ExternalLink, LogOut, Pause, Play, Plus, TrendingUp, Users, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { Field, Modal, Spinner } from '../../components/ui'
import { errorMessage, superApi } from '../../services/api'
import { setTenantSlug } from '../../utils/tenant'
import { resetTenantTheme } from '../../utils/theme'

const BLANK = {
  name: '', shortName: '', slug: '', emailDomain: '', adminName: '', adminEmail: '', adminPassword: '',
  primaryColor: '#0a4029', accentColor: '#16a34a', tagline: 'Complaint & maintenance portal',
}

function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon className="size-5 text-indigo-300" aria-hidden="true" />
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function CreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

  async function submit() {
    if (!form.name || !form.shortName || !form.slug || !form.adminEmail || !form.adminPassword) {
      return toast.error('Please fill in name, short name, slug, admin email and password')
    }
    setBusy(true)
    try {
      await superApi.createTenant(form)
      toast.success(`${form.name} created`)
      setForm(BLANK)
      onCreated()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create university'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a university"
      size="max-w-xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner className="size-4 text-white" /> : <Plus className="size-4" />} Create
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="University name" htmlFor="t-name">
          <input id="t-name" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} placeholder="North South University" />
        </Field>
        <Field label="Short name" htmlFor="t-short">
          <input id="t-short" className="input" value={form.shortName} onChange={set('shortName')} placeholder="NSU" />
        </Field>
        <Field label="Slug (subdomain)" htmlFor="t-slug" hint="lowercase, letters/numbers/hyphens">
          <input id="t-slug" className="input font-mono" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} placeholder="nsu" />
        </Field>
        <Field label="Email domain" htmlFor="t-domain">
          <input id="t-domain" className="input" value={form.emailDomain} onChange={set('emailDomain')} placeholder="northsouth.edu" />
        </Field>
        <Field label="Primary colour" htmlFor="t-primary">
          <div className="flex items-center gap-2">
            <input type="color" value={form.primaryColor} onChange={set('primaryColor')} className="size-9 shrink-0 cursor-pointer rounded-lg border border-line" />
            <input className="input font-mono" value={form.primaryColor} onChange={set('primaryColor')} />
          </div>
        </Field>
        <Field label="Accent colour" htmlFor="t-accent">
          <div className="flex items-center gap-2">
            <input type="color" value={form.accentColor} onChange={set('accentColor')} className="size-9 shrink-0 cursor-pointer rounded-lg border border-line" />
            <input className="input font-mono" value={form.accentColor} onChange={set('accentColor')} />
          </div>
        </Field>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-slate-50 p-4">
        <p className="mb-3 text-sm font-semibold text-ink">First administrator account</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admin name" htmlFor="t-aname">
            <input id="t-aname" className="input" value={form.adminName} onChange={set('adminName')} placeholder="Facilities Admin" />
          </Field>
          <Field label="Admin email" htmlFor="t-aemail">
            <input id="t-aemail" type="email" className="input" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@northsouth.edu" />
          </Field>
          <Field label="Admin password" htmlFor="t-apass" hint="at least 8 characters">
            <input id="t-apass" className="input" value={form.adminPassword} onChange={set('adminPassword')} placeholder="••••••••" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

const taka = (n) => `৳${Number(n || 0).toLocaleString('en-US')}`

export default function SuperDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [billing, setBilling] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, b, t] = await Promise.all([superApi.stats(), superApi.billing(), superApi.tenants()])
      setStats(s.data)
      setBilling(b.data)
      setTenants(t.data || [])
    } catch (err) {
      if (err?.response?.status === 401) navigate('/super/login', { replace: true })
      else toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    resetTenantTheme()
    load()
  }, [load])

  async function toggleStatus(t) {
    const next = t.status === 'active' ? 'suspended' : 'active'
    try {
      await superApi.updateTenant(t.id, { status: next })
      toast.success(`${t.shortName} ${next === 'active' ? 'activated' : 'suspended'}`)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  function openPortal(t) {
    setTenantSlug(t.slug)
    window.open('/login', '_blank', 'noopener')
  }

  async function logout() {
    await superApi.logout().catch(() => {})
    navigate('/super/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950">
        <Spinner className="size-8 text-indigo-300" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold leading-tight">Smart Campus Platform</p>
              <p className="text-xs text-slate-400">Super administrator</p>
            </div>
          </div>
          <button onClick={logout} className="btn gap-2 border border-white/15 bg-white/5 text-sm text-slate-200 hover:bg-white/10">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="animate-fade-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Universities</h1>
            <p className="mt-1 text-sm text-slate-400">Every organization running on the platform.</p>
          </div>
          <button onClick={() => setCreating(true)} className="btn gap-2 bg-gradient-to-br from-indigo-500 to-sky-500 font-semibold text-white shadow hover:from-indigo-600 hover:to-sky-600">
            <Plus className="size-4" /> Add university
          </button>
        </div>

        <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Universities" value={stats?.tenants ?? 0} icon={Building2} />
          <StatTile label="Active" value={stats?.activeTenants ?? 0} icon={Check} />
          <StatTile label="Total users" value={stats?.users ?? 0} icon={Users} />
          <StatTile label="Total complaints" value={stats?.complaints ?? 0} icon={ExternalLink} />
        </div>

        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Wallet className="size-4 text-emerald-300" /> Revenue
        </p>
        <div className="stagger mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Monthly recurring (MRR)" value={taka(billing?.mrr)} icon={TrendingUp} />
          <StatTile label="Total collected" value={taka(billing?.totalRevenue)} icon={Wallet} />
          <StatTile label="Paid invoices" value={billing?.paidInvoices ?? 0} icon={CreditCard} />
          <StatTile label="Pending invoices" value={billing?.pendingInvoices ?? 0} icon={CreditCard} />
        </div>

        <div className="stagger grid gap-4 md:grid-cols-2">
          {tenants.map((t) => (
            <div key={t.id} className="hover-lift rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl text-white shadow" style={{ background: t.branding?.primaryColor || '#0a4029' }}>
                  <span className="text-sm font-bold">{t.shortName?.slice(0, 2)}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{t.name}</p>
                    <span className={`chip ring-1 ring-inset ${t.status === 'active' ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'}`}>
                      {t.status}
                    </span>
                    <span className="chip bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-500/30 capitalize">{t.plan}</span>
                  </div>
                  <p className="font-mono text-xs text-slate-400">{t.slug}.smartcampus.app</p>
                  <div className="mt-3 flex gap-4 text-sm text-slate-300">
                    <span><b className="tabular-nums">{t.usage?.users ?? 0}</b> <span className="text-slate-500">users</span></span>
                    <span><b className="tabular-nums">{t.usage?.complaints ?? 0}</b> <span className="text-slate-500">complaints</span></span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openPortal(t)} className="btn btn-sm flex-1 gap-1.5 border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10">
                  <ExternalLink className="size-3.5" /> Open portal
                </button>
                <button onClick={() => toggleStatus(t)} className={`btn btn-sm gap-1.5 ${t.status === 'active' ? 'border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}>
                  {t.status === 'active' ? <><Pause className="size-3.5" /> Suspend</> : <><Play className="size-3.5" /> Activate</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <CreateModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  )
}
