import ComplaintList from '../../components/ComplaintList'
import { EmptyState, PageHeader } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { commonApi, staffApi } from '../../services/api'

export default function StaffTasks() {
  const { data: categories } = useApi(() => commonApi.categories(), [])
  return (
    <div className="animate-fade-in">
      <PageHeader title="My tasks" subtitle="Complaints assigned to you." />
      <ComplaintList
        fetcher={staffApi.complaints}
        columns={{ student: true }}
        categories={categories || []}
        empty={<EmptyState title="No assignments yet" message="Complaints assigned to you by the administrator will appear here." />}
      />
    </div>
  )
}
