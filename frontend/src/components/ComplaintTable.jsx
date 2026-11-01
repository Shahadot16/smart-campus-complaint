import { ChevronRight, MapPin, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDate, timeAgo } from '../utils/format'
import SlaBadge from './SlaBadge'
import { PriorityBadge, StatusBadge } from './ui'

/**
 * Responsive complaint list: a table on desktop, stacked cards on mobile.
 * `columns` toggles optional columns: student, staff.
 */
export default function ComplaintTable({ items, columns = {} }) {
  const navigate = useNavigate()
  const open = (c) => navigate(`/complaints/${c._id}`)

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-line bg-slate-50/70">
            <tr>
              <th className="table-head">Tracking ID</th>
              <th className="table-head">Title</th>
              <th className="table-head">Category</th>
              {columns.student && <th className="table-head">Student</th>}
              {columns.staff && <th className="table-head">Assigned to</th>}
              <th className="table-head">Priority</th>
              <th className="table-head">Status</th>
              <th className="table-head">SLA</th>
              <th className="table-head">Date</th>
              <th className="table-head w-8">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((c) => (
              <tr key={c._id} onClick={() => open(c)} className="group cursor-pointer transition hover:bg-brand-50/50">
                <td className="table-cell font-mono text-xs font-medium text-navy-800">
                  <Link to={`/complaints/${c._id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {c.trackingCode}
                  </Link>
                </td>
                <td className="table-cell max-w-xs">
                  <p className="truncate font-medium text-ink">{c.title}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-ink-muted">
                    <MapPin className="size-3" aria-hidden="true" />
                    {c.location?.building}
                    {c.location?.room ? `, ${c.location.room}` : ''}
                  </p>
                </td>
                <td className="table-cell text-ink-soft">{c.category?.name || '—'}</td>
                {columns.student && (
                  <td className="table-cell">
                    <p className="text-ink">{c.student?.name || '—'}</p>
                    {c.student?.studentId && <p className="text-xs text-ink-muted">{c.student.studentId}</p>}
                  </td>
                )}
                {columns.staff && (
                  <td className="table-cell text-ink-soft">
                    {c.assignedStaff?.name || <span className="text-ink-muted italic">Unassigned</span>}
                  </td>
                )}
                <td className="table-cell">
                  <PriorityBadge priority={c.priority} />
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={c.status} />
                    {c.reopenRequest?.requested && (
                      <RotateCcw className="size-3.5 text-amber-600" aria-label="Reopen requested">
                        <title>Reopen requested</title>
                      </RotateCcw>
                    )}
                  </div>
                </td>
                <td className="table-cell">
                  <SlaBadge complaint={c} compact />
                </td>
                <td className="table-cell text-xs whitespace-nowrap text-ink-soft" title={formatDate(c.createdAt)}>
                  {formatDate(c.createdAt)}
                </td>
                <td className="table-cell">
                  <ChevronRight className="size-4 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {items.map((c) => (
          <li key={c._id}>
            <Link to={`/complaints/${c._id}`} className="block px-4 py-4 active:bg-brand-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-navy-800">{c.trackingCode}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1.5 font-medium text-ink">{c.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {c.category?.name} · {c.location?.building}
                {c.location?.room ? `, ${c.location.room}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
                <span className="flex items-center gap-2">
                  <PriorityBadge priority={c.priority} />
                  <SlaBadge complaint={c} compact />
                </span>
                <span>
                  {columns.staff && (c.assignedStaff?.name ? `${c.assignedStaff.name} · ` : 'Unassigned · ')}
                  {timeAgo(c.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
