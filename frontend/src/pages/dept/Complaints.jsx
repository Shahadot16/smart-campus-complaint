import ComplaintList from '../../components/ComplaintList'
import { EmptyState, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { commonApi, opsApi } from '../../services/api'

export default function DeptComplaints() {
  const { user } = useAuth()
  const { data: categories } = useApi(() => commonApi.categories(), [])
  return (
    <div className="animate-fade-in">
      <PageHeader title={`${user.department} complaints`} subtitle="Every complaint about your department's labs and rooms (read-only)." />
      <ComplaintList
        fetcher={opsApi.deptComplaints}
        columns={{ student: true, staff: true }}
        categories={categories || []}
        showDates
        empty={<EmptyState title="No complaints yet" message="Complaints about your department will appear here." />}
      />
    </div>
  )
}
