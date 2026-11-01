import { Check, Minus } from 'lucide-react'
import { ErrorState, PageHeader, PageLoader } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { adminApi } from '../../services/api'
import { ROLE_LABELS } from '../../utils/constants'

const ORDER = ['student', 'staff', 'dept_head', 'admin']

export default function Roles() {
  const { data, loading, error, reload } = useApi(() => adminApi.permissions(), [])
  if (loading) return <PageLoader />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="animate-fade-in">
      <PageHeader title="Roles & permissions" subtitle="What each role can do. Every API route checks one of these permissions." />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-line bg-slate-50/70">
            <tr>
              <th className="table-head">Permission</th>
              {ORDER.map((r) => (
                <th key={r} className="table-head text-center">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Object.entries(data.permissions).map(([key, label]) => (
              <tr key={key}>
                <td className="table-cell">
                  <p className="text-ink">{label}</p>
                  <p className="font-mono text-[11px] text-ink-muted">{key}</p>
                </td>
                {ORDER.map((r) => (
                  <td key={r} className="table-cell text-center">
                    {data.roles[r]?.includes(key) ? (
                      <Check className="mx-auto size-4 text-emerald-600" aria-label="Allowed" />
                    ) : (
                      <Minus className="mx-auto size-4 text-slate-300" aria-label="Not allowed" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
