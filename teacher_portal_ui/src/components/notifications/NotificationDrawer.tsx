import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';
import { notificationsApi } from '../../services/api';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  timestamp: string;
  isRead: boolean;
  sender?: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'URGENT'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsApi.getNotifications(undefined, false, 1, 50);
      const items = (res?.data || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.category || 'General',
        priority: String(n.priority || 'NORMAL').toUpperCase(),
        timestamp: n.timestamp,
        isRead: Boolean(n.isRead),
        sender: n.sender || 'Madrasa Administration',
      }));
      setNotifications(items);
      const unread = items.filter((i) => !i.isRead).length;
      if (onCountChange) {
        onCountChange(unread);
      }
    } catch (err) {
      console.error('Failed to load notifications in drawer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Mark single notice as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      const nextUnread = notifications.filter((n) => n.id !== id && !n.isRead).length;
      if (onCountChange) {
        onCountChange(nextUnread);
      }
      window.dispatchEvent(new CustomEvent('teacher:notifications-updated'));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (onCountChange) {
        onCountChange(0);
      }
      window.dispatchEvent(new CustomEvent('teacher:notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Toggle expand
  const handleItemClick = (item: NotificationItem) => {
    setExpandedId(expandedId === item.id ? null : item.id);
    if (!item.isRead) {
      handleMarkAsRead(item.id);
    }
  };

  // Filtered notifications
  const filteredList = notifications.filter((n) => {
    if (activeTab === 'UNREAD') return !n.isRead;
    if (activeTab === 'URGENT') return n.priority === 'URGENT' || n.priority === 'HIGH';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden print:hidden no-print">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-[#E7E9EE] shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#E7E9EE] bg-[#FAFAFA]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#37C6A3]/15 text-[#0F172A] rounded-xl border border-[#37C6A3]/30">
                  <Megaphone className="w-5 h-5 text-[#0F172A]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] leading-tight">
                    Staff Notices & Alerts
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time updates from administration
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-[#0F172A] rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close notification drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions & Tabs Strip */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#F1F3F5] p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTab === 'ALL'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-slate-500 hover:text-[#0F172A]'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveTab('UNREAD')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTab === 'UNREAD'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-500 hover:text-[#0F172A]'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setActiveTab('URGENT')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTab === 'URGENT'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-500 hover:text-[#0F172A]'
                  }`}
                >
                  Urgent
                </button>
              </div>

              {/* Mark All Read */}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline px-1 py-0.5 disabled:opacity-50"
                >
                  {markingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Body / List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F6F1]">
            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#37C6A3] mb-2" />
                <p className="text-xs text-slate-500">Checking for notices...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-[#E7E9EE] p-6 shadow-xs">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Inbox className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#0F172A]">No notices in this view</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {activeTab === 'UNREAD'
                    ? 'You are all caught up! Zero unread notices.'
                    : activeTab === 'URGENT'
                    ? 'No urgent action items or emergency memos at this time.'
                    : 'No administrative notices have been posted yet.'}
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const isUrgent = item.priority === 'URGENT' || item.priority === 'HIGH';
                const isExpanded = expandedId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`bg-white rounded-xl p-3.5 sm:p-4 border shadow-xs transition-all cursor-pointer relative group ${
                      isUrgent
                        ? 'border-l-4 border-l-rose-500 border-rose-200'
                        : !item.isRead
                        ? 'border-l-4 border-l-[#37C6A3] border-[#E7E9EE]'
                        : 'border-l-4 border-l-transparent border-[#E7E9EE] opacity-90'
                    }`}
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Priority Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            isUrgent
                              ? 'bg-rose-100 text-rose-700'
                              : item.priority === 'IMPORTANT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isUrgent && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />
                          )}
                          {item.priority}
                        </span>

                        {/* Category */}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                          {item.category}
                        </span>

                        {/* Unread indicator */}
                        {!item.isRead && (
                          <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>

                    {/* Notice Title */}
                    <h3
                      className={`text-xs sm:text-sm font-bold text-[#0F172A] leading-snug mb-1 ${
                        !item.isRead ? 'font-extrabold' : ''
                      }`}
                    >
                      {item.title}
                    </h3>

                    {/* Message Body */}
                    <p
                      className={`text-xs text-slate-600 leading-relaxed whitespace-pre-line ${
                        isExpanded ? '' : 'line-clamp-2'
                      }`}
                    >
                      {item.message}
                    </p>

                    {/* Expand toggle & sender */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <span>From: <strong className="text-slate-600">{item.sender}</strong></span>
                      <div className="flex items-center gap-1 text-[#37C6A3] font-semibold">
                        <span>{isExpanded ? 'Less' : 'More'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#E7E9EE] bg-white flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All notices read'}
            </span>
            <button
              onClick={() => {
                onClose();
                navigate('/notifications');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <span>Full Notifications Center</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDrawer;
