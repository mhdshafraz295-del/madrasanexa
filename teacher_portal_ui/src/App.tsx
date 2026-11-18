import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import TeacherLayout from './layouts/TeacherLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import TimetablePage from './pages/TimetablePage';
import ClassesSubjectsPage from './pages/ClassesSubjectsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';

// Phase 2 Attendance Interfaces
import TeacherAttendancePage from './pages/attendance/TeacherAttendancePage';
import StudentAttendancePage from './pages/attendance/StudentAttendancePage';
import AttendanceHistoryPage from './pages/attendance/AttendanceHistoryPage';

// Phase 3 Salary & Payslips Interfaces
import MySalaryPage from './pages/salary/MySalaryPage';
import PaymentHistoryPage from './pages/salary/PaymentHistoryPage';
import PayslipsPage from './pages/salary/PayslipsPage';
import TeacherAlumniPage from './pages/alumni/TeacherAlumniPage';

export default function App() {
  return (
    <Routes>
      {/* Standalone Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated Teacher Portal Workspace */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="classes" element={<ClassesSubjectsPage />} />

        {/* Phase 2: Attendance Operations */}
        <Route path="attendance" element={<Navigate to="/attendance/my" replace />} />
        <Route path="attendance/my" element={<TeacherAttendancePage />} />
        <Route path="attendance/students" element={<StudentAttendancePage />} />
        <Route path="attendance/history" element={<AttendanceHistoryPage />} />

        {/* Phase 3: Salary & Payments */}
        <Route path="salary" element={<MySalaryPage />} />
        <Route path="salary/history" element={<PaymentHistoryPage />} />
        <Route path="salary/payslips" element={<PayslipsPage />} />

        {/* Phase 4: Alumni & Scholar Directory */}
        <Route path="alumni" element={<TeacherAlumniPage />} />

        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
