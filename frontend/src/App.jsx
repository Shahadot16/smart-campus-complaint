import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute'
import { PageLoader } from './components/ui'
import { HOME_BY_ROLE, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import AuditLog from './pages/admin/AuditLog'
import AdminCategories from './pages/admin/Categories'
import AdminComplaints from './pages/admin/Complaints'
import AdminDashboard from './pages/admin/Dashboard'
import Locations from './pages/admin/Locations'
import QrSheet from './pages/admin/QrSheet'
import Inventory from './pages/admin/Inventory'
import Roles from './pages/admin/Roles'
import StaffProfiles from './pages/admin/StaffProfiles'
import DeptComplaints from './pages/dept/Complaints'
import DeptDashboard from './pages/dept/Dashboard'
import Approvals from './pages/shared/Approvals'
import AssetDetail from './pages/shared/AssetDetail'
import Assets from './pages/shared/Assets'
import AdminReports from './pages/admin/Reports'
import Analytics from './pages/admin/Analytics'
import SlaSettings from './pages/admin/SlaSettings'
import AdminUsers from './pages/admin/Users'
import ForgotPassword from './pages/auth/ForgotPassword'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ResetPassword from './pages/auth/ResetPassword'
import VerifyEmail from './pages/auth/VerifyEmail'
import CampusMap from './pages/shared/CampusMap'
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
      </Route>

      {/* Works whether or not the user is signed in */}
      <Route element={<AuthLayout />}>
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      {/* Full-page printable view, outside the app chrome */}
      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin/locations/:id/qr" element={<QrSheet />} />
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
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/audit-log" element={<AuditLog />} />
            <Route path="/admin/sla" element={<SlaSettings />} />
            <Route path="/admin/locations" element={<Locations />} />
            <Route path="/admin/inventory" element={<Inventory />} />
            <Route path="/admin/staff" element={<StaffProfiles />} />
            <Route path="/admin/roles" element={<Roles />} />
          </Route>

          <Route element={<ProtectedRoute roles={['dept_head']} />}>
            <Route path="/dept" element={<DeptDashboard />} />
            <Route path="/dept/complaints" element={<DeptComplaints />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'dept_head']} />}>
            <Route path="/approvals" element={<Approvals />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'staff', 'dept_head']} />}>
            <Route path="/assets" element={<Assets />} />
            <Route path="/assets/:id" element={<AssetDetail />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'staff', 'dept_head']} />}>
            <Route path="/map" element={<CampusMap />} />
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
