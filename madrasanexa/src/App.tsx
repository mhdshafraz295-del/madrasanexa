import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import SubscriptionRoute from './components/common/SubscriptionRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import SetupPasswordPage from './pages/auth/SetupPasswordPage';

// Super Admin Platform Components
import SuperAdminLayout from './layouts/SuperAdminLayout';
import DashboardPage from './pages/super-admin/DashboardPage';
import OnboardingRequestsPage from './pages/super-admin/OnboardingRequestsPage';
import MadrasasPage from './pages/super-admin/MadrasasPage';
import MadrasaDetailPage from './pages/super-admin/MadrasaDetailPage';
import PlansPage from './pages/super-admin/PlansPage';
import SubscriptionsPage from './pages/super-admin/SubscriptionsPage';
import ActivityLogsPage from './pages/super-admin/ActivityLogsPage';
import AboutUsCMSPage from './pages/super-admin/AboutUsCMSPage';
import SuperAdminAnnouncementsPage from './pages/super-admin/AnnouncementsPage';
import BankDetailsPage from './pages/super-admin/BankDetailsPage';
import SubscriptionPaymentsPage from './pages/super-admin/SubscriptionPaymentsPage';
import WebsiteContentPage from './pages/super-admin/WebsiteContentPage';
import AboutUsPage from './pages/public/AboutUsPage';
import HomePage from './pages/public/HomePage';
import MadrasaPublicPage from './pages/public/MadrasaPublicPage';
import MadrasaAdmissionsPage from './pages/public/MadrasaAdmissionsPage';
import PricingPage from './pages/public/PricingPage';

// Madrasa Admin Workspace Components
import MadrasaAdminLayout from './layouts/MadrasaAdminLayout';
import MadrasaAdminDashboardPage from './pages/madrasa-admin/DashboardPage';
import MadrasaAdminSettingsPage from './pages/madrasa-admin/SettingsPage';
import MadrasaAdminSubscriptionPage from './pages/madrasa-admin/SubscriptionPage';
import MadrasaAdminActivityPage from './pages/madrasa-admin/ActivityPage';
import MadrasaAdminAboutUsPage from './pages/madrasa-admin/AboutUsPage';
import MadrasaAdminAnnouncementsPage from './pages/madrasa-admin/AnnouncementsPage';
import SubscriptionRequiredPage from './pages/madrasa-admin/SubscriptionRequiredPage';
import MadrasaHomepageCmsPage from './pages/madrasa-admin/MadrasaHomepageCmsPage';
import AlumniManagementPage from './pages/madrasa-admin/AlumniManagementPage';
import ClassesPage from './pages/madrasa-admin/ClassesPage';
import AdmissionsManagementPage from './pages/madrasa-admin/AdmissionsManagementPage';
import StudentsPage from './pages/madrasa-admin/StudentsPage';
import StudentAddPage from './pages/madrasa-admin/StudentAddPage';
import StudentDetailPage from './pages/madrasa-admin/StudentDetailPage';
import StudentEditPage from './pages/madrasa-admin/StudentEditPage';
import InvoicesPage from './pages/madrasa-admin/InvoicesPage';
import InvoiceGenerationPage from './pages/madrasa-admin/InvoiceGenerationPage';
import InvoiceDetailPage from './pages/madrasa-admin/InvoiceDetailPage';
import FeePOSPage from './pages/madrasa-admin/FeePOSPage';
import PaymentsPage from './pages/madrasa-admin/PaymentsPage';
import PaymentDetailPage from './pages/madrasa-admin/PaymentDetailPage';
import ReceiptDetailPage from './pages/madrasa-admin/ReceiptDetailPage';
import ReportsPage from './pages/madrasa-admin/ReportsPage';
import ExpenseAnalysisPage from './pages/madrasa-admin/ExpenseAnalysisPage';
import MarkingHubPage from './pages/madrasa-admin/MarkingHubPage';
import AttendancePage from './pages/madrasa-admin/AttendancePage';
import UstadhManagementPage from './pages/madrasa-admin/UstadhManagementPage';
import TimetablePage from './pages/madrasa-admin/TimetablePage';
import NotificationLogsPage from './pages/madrasa-admin/NotificationLogsPage';
export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/setup-password" element={<SetupPasswordPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about-us" element={<AboutUsPage />} />
          <Route path="/about" element={<Navigate to="/about-us" replace />} />
          <Route path="/madrasa/:slug" element={<MadrasaPublicPage />} />
          <Route path="/madrasa/:slug/admissions" element={<MadrasaAdmissionsPage />} />

          {/* Standalone Super Admin Website Content Preview */}
          <Route
            path="/super-admin/website-content/preview"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <HomePage previewMode={true} />
              </ProtectedRoute>
            }
          />

          {/* Mandatory Password Change Route (Protected by Auth) */}
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Super Admin Platform */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="onboarding" element={<OnboardingRequestsPage />} />
            <Route path="madrasas" element={<MadrasasPage />} />
            <Route path="madrasas/:id" element={<MadrasaDetailPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="subscription-payments" element={<SubscriptionPaymentsPage />} />
            <Route path="bank-details" element={<BankDetailsPage />} />
            <Route path="announcements" element={<SuperAdminAnnouncementsPage />} />
            <Route path="about-us" element={<AboutUsCMSPage />} />
            <Route path="website-content" element={<WebsiteContentPage />} />
            <Route path="activity-logs" element={<ActivityLogsPage />} />
          </Route>

          {/* Protected Madrasa Admin Restricted Page (Auth + Role only, no SubscriptionRoute gate) */}
          <Route
            path="/madrasa-admin/subscription-required"
            element={
              <ProtectedRoute allowedRoles={['MADRASA_ADMIN']}>
                <SubscriptionRequiredPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Madrasa Admin Workspace */}
          <Route
            path="/madrasa-admin"
            element={
              <ProtectedRoute allowedRoles={['MADRASA_ADMIN']}>
                <MadrasaAdminLayout />
              </ProtectedRoute>
            }
          >
            {/* Active Subscription Protected Business Routes */}
            <Route element={<SubscriptionRoute />}>
              <Route index element={<MadrasaAdminDashboardPage />} />
              <Route path="dashboard" element={<MadrasaAdminDashboardPage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="marking-hub" element={<MarkingHubPage />} />
              <Route path="ustadh-management" element={<UstadhManagementPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="admissions" element={<AdmissionsManagementPage />} />
              <Route path="students/new" element={<StudentAddPage />} />
              <Route path="students/:id" element={<StudentDetailPage />} />
              <Route path="students/:id/edit" element={<StudentEditPage />} />
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="invoices/generate" element={<InvoiceGenerationPage />} />
              <Route path="invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="fee-pos" element={<FeePOSPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="payments/:id" element={<PaymentDetailPage />} />
              <Route path="receipts/:id" element={<ReceiptDetailPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="expense-analysis" element={<ExpenseAnalysisPage />} />
              <Route path="communication-logs" element={<NotificationLogsPage />} />
              <Route path="settings" element={<MadrasaAdminSettingsPage />} />
              <Route path="activity" element={<MadrasaAdminActivityPage />} />
              <Route path="portal-cms" element={<MadrasaHomepageCmsPage />} />
              <Route path="alumni-network" element={<AlumniManagementPage />} />
            </Route>

            {/* Subscription Overview Route (Auth + Role only, exempt from subscription gate) */}
            <Route path="subscription" element={<MadrasaAdminSubscriptionPage />} />

            {/* Platform About Route (Auth + Role only, exempt from subscription gate) */}
            <Route path="about-us" element={<MadrasaAdminAboutUsPage />} />

            {/* Platform Announcements Route (Auth + Role only, exempt from subscription gate) */}
            <Route path="announcements" element={<MadrasaAdminAnnouncementsPage />} />
          </Route>

          {/* Catch-All */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
