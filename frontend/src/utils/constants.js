export const STATUSES = {
  submitted: { label: 'Submitted', className: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  under_review: { label: 'Under Review', className: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  needs_information: { label: 'Needs Info', className: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  assigned: { label: 'Assigned', className: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  in_progress: { label: 'In Progress', className: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-600' },
  resolved: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', className: 'bg-teal-50 text-teal-800 ring-teal-200', dot: 'bg-teal-600' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
}

export const STATUS_OPTIONS = Object.entries(STATUSES).map(([value, s]) => ({ value, label: s.label }))

export const PRIORITIES = {
  low: { label: 'Low', className: 'text-slate-600', bar: 'bg-slate-300' },
  medium: { label: 'Medium', className: 'text-amber-700', bar: 'bg-amber-400' },
  high: { label: 'High', className: 'text-orange-700', bar: 'bg-orange-500' },
  critical: { label: 'Critical', className: 'text-red-700', bar: 'bg-red-600' },
}

export const PRIORITY_OPTIONS = Object.entries(PRIORITIES).map(([value, p]) => ({ value, label: p.label }))

// Labels for status actions in the UI (what the button says).
export const STATUS_ACTIONS = {
  under_review: 'Mark under review',
  needs_information: 'Request more information',
  in_progress: 'Start work',
  resolved: 'Mark resolved',
  closed: 'Close complaint',
  rejected: 'Reject',
}

export const ROLE_LABELS = { student: 'Student', admin: 'Administrator', staff: 'Maintenance Staff', dept_head: 'Department Head' }

export const MAX_IMAGES = 5
export const MAX_IMAGE_MB = 5
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const ASSET_STATUS = {
  operational: { label: 'Operational', className: 'bg-emerald-50 text-emerald-700' },
  under_repair: { label: 'Under repair', className: 'bg-amber-50 text-amber-800' },
  retired: { label: 'Retired', className: 'bg-slate-100 text-slate-500' },
}
