import {
  BarChart3,
  Boxes,
  Briefcase,
  KeyRound,
  Package,
  Receipt,
  UserCog,
  Bell,
  ClipboardList,
  FilePlus2,
  FolderKanban,
  History,
  MailWarning,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map,
  MapPin,
  Menu,
  Timer,
  ShieldCheck,
  Tags,
  UserCircle,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSocket, useSocketEvent } from '../context/SocketContext'
import { authApi, commonApi, errorMessage } from '../services/api'
import { ROLE_LABELS } from '../utils/constants'

const NAV = {
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/new', label: 'New Complaint', icon: FilePlus2 },
    { to: '/student/complaints', label: 'My Complaints', icon: ClipboardList },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/complaints', label: 'Complaints', icon: FolderKanban },
    { to: '/approvals', label: 'Approvals', icon: Receipt },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/staff', label: 'Staff & Skills', icon: UserCog },
    { to: '/assets', label: 'Assets', icon: Boxes },
    { to: '/admin/inventory', label: 'Inventory', icon: Package },
    { to: '/admin/categories', label: 'Categories', icon: Tags },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { to: '/admin/sla', label: 'SLA & Jobs', icon: Timer },
    { to: '/admin/locations', label: 'Locations & QR', icon: MapPin },
    { to: '/map', label: 'Campus Map', icon: Map },
    { to: '/admin/roles', label: 'Roles & Permissions', icon: KeyRound },
    { to: '/admin/audit-log', label: 'Audit Log', icon: History },
  ],
  staff: [
    { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/staff/tasks', label: 'My Tasks', icon: ListChecks },
    { to: '/assets', label: 'Assets', icon: Boxes },
    { to: '/map', label: 'Campus Map', icon: Map },
  ],
  dept_head: [
    { to: '/dept', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/dept/complaints', label: 'Department Complaints', icon: FolderKanban },
    { to: '/approvals', label: 'Approvals', icon: Receipt },
    { to: '/assets', label: 'Assets', icon: Boxes },
    { to: '/map', label: 'Campus Map', icon: Map },
  ],
}

const COMMON = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserCircle },
]

function NavItem({ item, badge }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-white/12 text-white' : 'text-brand-100/80 hover:bg-white/6 hover:text-white'
        }`
      }
    >
      <Icon className="size-[18px]" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {badge > 0 && (
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] leading-none font-bold text-navy-950">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

function VerifyEmailBanner({ email }) {
  const [sending, setSending] = useState(false)
  const [devLink, setDevLink] = useState(null)
  async function resend() {
    setSending(true)
    try {
      const res = await authApi.resendVerification()
      toast.success(res.message)
      // Development only: the server returns the link because no real email is sent.
      if (res.data?.devLink) setDevLink(res.data.devLink)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center">
      <MailWarning className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
      <p className="flex-1">
        Please verify your email <strong>{email}</strong>. Check your inbox for the verification link.
        {devLink && (
          <a href={devLink} className="ml-1 font-semibold text-brand-700 underline">
            (Development: open the link)
          </a>
        )}
      </p>
      <button className="btn-secondary btn-sm" onClick={resend} disabled={sending}>
        Resend link
      </button>
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // The mobile menu is tied to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === location.pathname
  const setOpen = (v) => setOpenOn(v ? location.pathname : null)
  const [unread, setUnread] = useState(0)

  const refreshUnread = useCallback(() => {
    commonApi
      .notifications({ unread: 'true', limit: 1 })
      .then((res) => setUnread(res.meta?.unread || 0))
      .catch(() => {})
  }, [])

  // Poll for new notifications, and refresh on navigation.
  useEffect(() => {
    refreshUnread()
    const t = setInterval(refreshUnread, 30000)
    return () => clearInterval(t)
  }, [refreshUnread, location.pathname])

  const { connected } = useSocket()

  // Live notifications: show a toast and bump the badge without polling.
  useSocketEvent('notification:new', (n) => {
    setUnread((u) => u + 1)
    toast(
      (t) => (
        <button
          className="text-left"
          onClick={() => {
            toast.dismiss(t.id)
            if (n.complaint) navigate(`/complaints/${n.complaint}`)
          }}
        >
          <span className="block text-sm font-semibold text-navy-900">{n.title}</span>
          <span className="block text-xs text-ink-soft">{n.message}</span>
        </button>
      ),
      { icon: '🔔', duration: 5000 }
    )
  })

  async function handleLogout() {
    await logout()
    toast.success('Signed out')
    navigate('/login', { replace: true })
  }

  const items = NAV[user.role] || []
  const RoleIcon = { staff: Wrench, admin: ShieldCheck, dept_head: Briefcase }[user.role] || GraduationCap

  const sidebar = (
    <div className="relative flex h-full flex-col bg-navy-900 px-3 py-5">
      <div className="absolute top-0 left-0 flex h-1 w-full" aria-hidden="true">
        <span className="flex-1 bg-emerald-500" />
        <span className="flex-1 bg-accent-gold" />
        <span className="flex-1 bg-accent-red" />
      </div>
      <Link to="/" className="mb-8 block px-2">
        <img src="/brand/iubat-logo-name.png" alt="IUBAT" className="h-8 w-auto" />
        <span className="mt-3 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-brand-200 uppercase">
          <RoleIcon className="size-3.5" aria-hidden="true" />
          Smart Campus · {ROLE_LABELS[user.role]}
        </span>
      </Link>
      <nav className="-mr-1 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Main">
        {items.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
        <div className="my-4 border-t border-white/10" />
        {COMMON.map((item) => (
          <NavItem key={item.to} item={item} badge={item.to === '/notifications' ? unread : 0} />
        ))}
      </nav>
      <p className="mt-4 flex items-center gap-2 px-3 text-[11px] text-brand-200/80" title={connected ? 'Live updates on' : 'Reconnecting…'}>
        <span className={`size-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-400'}`} aria-hidden="true" />
        {connected ? 'Live updates on' : 'Connecting…'}
      </p>
      <div className="mt-2 flex items-center gap-3 rounded-lg bg-white/6 p-3">
        <Avatar name={user.name} className="size-9 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-brand-200">{user.email}</p>
        </div>
        <button onClick={handleLogout} className="rounded-md p-1.5 text-brand-100 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setOpen(false)} />
          <aside className="animate-fade-in absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          <button onClick={() => setOpen(false)} className="absolute top-4 left-[17rem] rounded-full bg-white p-1.5" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="btn-ghost p-2" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <span className="flex items-center gap-2 font-semibold text-navy-900">
          <img src="/brand/iubat-logo.png" alt="" className="h-6 w-auto" /> IUBAT Smart Campus
        </span>
        <Link to="/notifications" className="relative btn-ghost p-2" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-amber-500" />}
        </Link>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {!user.emailVerified && <VerifyEmailBanner email={user.email} />}
        <Outlet context={{ refreshUnread }} />
      </main>
    </div>
  )
}
