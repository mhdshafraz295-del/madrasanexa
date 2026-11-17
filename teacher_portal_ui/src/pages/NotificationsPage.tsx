import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Trash2,
  Filter,
  Sparkles,
  AlertCircle,
  Clock,
  Building2,
  GraduationCap,
  X,
  Check,
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import { MOCK_NOTIFICATIONS, TeacherNotification } from '../mock/teacherMockData';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';

type CategoryFilter = 'All' | 'Unread' | 'Exam' | 'Administrative' | 'Academic';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [selectedNotif, setSelectedNotif] = useState<TeacherNotification | null>(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationsApi.getNotifications(undefined, undefined, 1, 50);
      setNotifications(res.data || []);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.warn('Using fallback notifications data in DEV:', err);
        setNotifications(MOCK_NOTIFICATIONS);
      } else {
        setNotifications([]);
      }
      setError(err?.message || 'Failed to load notifications from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsApi.markAllRead();
      window.dispatchEvent(new CustomEvent('teacher_profile_updated'));
    } catch (err) {
      console.warn('Offline mark-all-read fallback:', err);
    }
  };

  const handleToggleRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    const willBeRead = !target?.isRead;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: willBeRead } : n))
    );
    if (willBeRead) {
      try {
        await notificationsApi.markRead(id);
        window.dispatchEvent(new CustomEvent('teacher_profile_updated'));
      } catch (err) {
        console.warn('Offline mark-read fallback:', err);
      }
    }
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (categoryFilter === 'Unread') return !n.isRead;
    if (categoryFilter === 'All') return true;
    return n.category === categoryFilter;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <Bell className="w-4 h-4" />
            <span>Faculty Announcements & Notices</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Institutional Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            You have <strong className="text-slate-800">{unreadCount} unread notices</strong> requiring your attention
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition self-start md:self-auto cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* 2. Category Filter Pills */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['All', 'Unread', 'Exam', 'Administrative', 'Academic'] as const).map((filter) => {
            const isSelected = categoryFilter === filter;
            const count = filter === 'All'
              ? notifications.length
              : filter === 'Unread'
              ? unreadCount
              : notifications.filter((n) => n.category === filter).length;

            return (
              <button
                key={filter}
                onClick={() => setCategoryFilter(filter)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{filter === 'All' ? 'All Notices' : filter}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-[#37C6A3] text-[#0F172A]' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12">
            <LoadingState message="Loading faculty notices..." />
          </div>
        ) : error && notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <ErrorState message={error} onRetry={loadNotifications} />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <EmptyState
              title="No Notices Found"
              description="There are no announcements or circulars matching your active category filter."
            />
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white rounded-2xl border p-4 sm:p-5 transition shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                !notif.isRead
                  ? 'border-teal-300 bg-teal-50/20'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                    !notif.isRead ? 'bg-[#0D9488]' : 'bg-transparent'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {notif.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        notif.priority === 'High'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {notif.priority} Priority
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {notif.timestamp}
                    </span>
                    <span className="text-[11px] text-slate-400">• By {notif.sender}</span>
                  </div>

                  <h3
                    onClick={() => setSelectedNotif(notif)}
                    className="text-sm font-bold text-slate-900 hover:text-[#0D9488] transition cursor-pointer"
                  >
                    {notif.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                    {notif.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-2 sm:pt-0">
                <button
                  onClick={() => handleToggleRead(notif.id)}
                  title={notif.isRead ? 'Mark as unread' : 'Mark as read'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer text-xs"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(notif.id)}
                  title="Dismiss notification"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer text-xs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Reader Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0D9488]">
                {selectedNotif.category} Notice
              </span>
              <button
                onClick={() => setSelectedNotif(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4">
              <h2 className="text-base font-bold text-slate-900 mb-2">
                {selectedNotif.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-4 font-mono">
                <span>{selectedNotif.timestamp}</span>
                <span>•</span>
                <span>Sender: {selectedNotif.sender}</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                {selectedNotif.message}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0F172A] hover:bg-slate-800 rounded-xl"
              >
                Done Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
