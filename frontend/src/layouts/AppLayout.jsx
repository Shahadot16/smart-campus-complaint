import {
  BarChart3,
  Bell,
  ClipboardList,
  FilePlus2,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
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
import { commonApi } from '../services/api'
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
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/categories', label: 'Categories', icon: Tags },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  ],
  staff: [
    { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/staff/tasks', label: 'My Tasks', icon: ListChecks },
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

  async function handleLogout() {
    await logout()
    toast.success('Signed out')
    navigate('/login', { replace: true })
  }

  const items = NAV[user.role] || []
  const RoleIcon = user.role === 'staff' ? Wrench : user.role === 'admin' ? ShieldCheck : GraduationCap

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
      <nav className="flex-1 space-y-1" aria-label="Main">
        {items.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
        <div className="my-4 border-t border-white/10" />
        {COMMON.map((item) => (
          <NavItem key={item.to} item={item} badge={item.to === '/notifications' ? unread : 0} />
        ))}
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-white/6 p-3">
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
        <Outlet context={{ refreshUnread }} />
      </main>
    </div>
  )
}
