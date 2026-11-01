import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute'
import { PageLoader } from './components/ui'
import { HOME_BY_ROLE, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'

// Each page is loaded on demand, keeping the first download small.
const AuditLog = lazy(() => import('./pages/admin/AuditLog'))
const AdminCategories = lazy(() => import('./pages/admin/Categories'))
const AdminComplaints = lazy(() => import('./pages/admin/Complaints'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const Locations = lazy(() => import('./pages/admin/Locations'))
const QrSheet = lazy(() => import('./pages/admin/QrSheet'))
const Inventory = lazy(() => import('./pages/admin/Inventory'))
const Roles = lazy(() => import('./pages/admin/Roles'))
const StaffProfiles = lazy(() => import('./pages/admin/StaffProfiles'))
const DeptComplaints = lazy(() => import('./pages/dept/Complaints'))
const DeptDashboard = lazy(() => import('./pages/dept/Dashboard'))
const Approvals = lazy(() => import('./pages/shared/Approvals'))
const AssetDetail = lazy(() => import('./pages/shared/AssetDetail'))
const Assets = lazy(() => import('./pages/shared/Assets'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))
const Analytics = lazy(() => import('./pages/admin/Analytics'))
const SlaSettings = lazy(() => import('./pages/admin/SlaSettings'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'))
const CampusMap = lazy(() => import('./pages/shared/CampusMap'))
const ComplaintDetail = lazy(() => import('./pages/shared/ComplaintDetail'))
const NotFound = lazy(() => import('./pages/shared/NotFound'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Profile = lazy(() => import('./pages/shared/Profile'))
const StaffDashboard = lazy(() => import('./pages/staff/Dashboard'))
const StaffTasks = lazy(() => import('./pages/staff/Tasks'))
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const MyComplaints = lazy(() => import('./pages/student/MyComplaints'))
const NewComplaint = lazy(() => import('./pages/student/NewComplaint'))
const IssueBoard = lazy(() => import('./pages/student/IssueBoard'))

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/login'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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

            <Route path="/board" element={<IssueBoard />} />
            <Route path="/complaints/:id" element={<ComplaintDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound standalone />} />
      </Routes>
    </Suspense>
  )
}
