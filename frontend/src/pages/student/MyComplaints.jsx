import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ComplaintList from '../../components/ComplaintList'
import { EmptyState, PageHeader } from '../../components/ui'
import useApi from '../../hooks/useApi'
import { commonApi, complaintApi } from '../../services/api'

export default function MyComplaints() {
  const { data: categories } = useApi(() => commonApi.categories(), [])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My complaints"
        subtitle="Everything you've reported, with live status."
        actions={
          <Link to="/student/new" className="btn-primary">
            <FilePlus2 className="size-4" /> New complaint
          </Link>
        }
      />
      <ComplaintList
        fetcher={complaintApi.mine}
        categories={categories || []}
        empty={
          <EmptyState
            title="No complaints yet"
            message="Report an issue and it will appear here."
            action={
              <Link to="/student/new" className="btn-primary">
                Submit a complaint
              </Link>
            }
          />
        }
      />
    </div>
  )
}
