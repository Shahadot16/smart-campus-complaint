import { Briefcase, GraduationCap, ShieldCheck, Wrench } from 'lucide-react'

/**
 * Login-page presentation of each role. Colours follow the IUBAT logo:
 * green (students), gold (staff) and red (administration); department heads in blue.
 */
export const LOGIN_ROLES = [
  {
    key: 'student',
    title: 'Student',
    subtitle: 'Report and track campus issues',
    icon: GraduationCap,
    card: 'border-emerald-500 bg-emerald-50/70 ring-emerald-500/30',
    iconBox: 'bg-emerald-600 text-white',
    idle: 'bg-emerald-50 text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    demo: { email: 'student@iubat.edu', password: 'Student@123' },
    canRegister: true,
  },
  {
    key: 'staff',
    title: 'Maintenance Staff',
    subtitle: 'Work on assigned tasks',
    icon: Wrench,
    card: 'border-amber-500 bg-amber-50/70 ring-amber-500/30',
    iconBox: 'bg-amber-500 text-white',
    idle: 'bg-amber-50 text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
  {
    key: 'dept_head',
    title: 'Dept. Head',
    subtitle: 'Oversee your department, approve costs',
    icon: Briefcase,
    card: 'border-sky-500 bg-sky-50/70 ring-sky-500/30',
    iconBox: 'bg-sky-600 text-white',
    idle: 'bg-sky-50 text-sky-700',
    button: 'bg-sky-600 hover:bg-sky-700',
  },
  {
    key: 'admin',
    title: 'Administrator',
    subtitle: 'Manage complaints, staff and reports',
    icon: ShieldCheck,
    card: 'border-red-500 bg-red-50/70 ring-red-500/30',
    iconBox: 'bg-red-600 text-white',
    idle: 'bg-red-50 text-red-700',
    button: 'bg-red-600 hover:bg-red-700',
  },
]
