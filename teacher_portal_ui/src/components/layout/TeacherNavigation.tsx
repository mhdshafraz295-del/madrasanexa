import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  Calendar,
  BookOpen,
  ScanLine,
  History,
  Banknote,
  Bell,
  User,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export interface TeacherNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  isAi?: boolean;
}

export const TEACHER_NAV_ITEMS: TeacherNavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Sparkles, isAi: true },
  { to: '/attendance/my', label: 'Attendance Check-In', icon: QrCode },
  { to: '/timetable', label: 'Timetable', icon: Calendar },
  { to: '/classes', label: 'Classes & Subjects', icon: BookOpen },
  { to: '/attendance/students', label: 'Student Attendance', icon: ScanLine },
  { to: '/attendance/history', label: 'Attendance History', icon: History },
  { to: '/salary', label: 'My Salary & Payslips', icon: Banknote },
  { to: '/alumni', label: 'Alumni & Scholars', icon: GraduationCap },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'My Profile', icon: User },
];

export default TEACHER_NAV_ITEMS;
