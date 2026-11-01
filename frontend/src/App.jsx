import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute'
import { PageLoader } from './components/ui'
import { HOME_BY_ROLE, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminCategories from './pages/admin/Categories'
import AdminComplaints from './pages/admin/Complaints'
import AdminDashboard from './pages/admin/Dashboard'
import AdminReports from './pages/admin/Reports'
import AdminUsers from './pages/admin/Users'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ComplaintDetail from './pages/shared/ComplaintDetail'
import NotFound from './pages/shared/NotFound'
import Notifications from './pages/shared/Notifications'
import Profile from './pages/shared/Profile'
import StaffDashboard from './pages/staff/Dashboard'
import StaffTasks from './pages/staff/Tasks'
import StudentDashboard from './pages/student/Dashboard'
import MyComplaints from './pages/student/MyComplaints'
import NewComplaint from './pages/student/NewComplaint'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute roles={['student']} />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/complaints" element={<MyComplaints />} />
            <Route path="/student/new" element={<NewComplaint />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/complaints" element={<AdminComplaints />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>

          <Route element={<ProtectedRoute roles={['staff']} />}>
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/staff/tasks" element={<StaffTasks />} />
          </Route>

          <Route path="/complaints/:id" element={<ComplaintDetail />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound standalone />} />
    </Routes>
  )
}
