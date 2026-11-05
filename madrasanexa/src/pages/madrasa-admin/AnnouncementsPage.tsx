import { useState, useEffect, useCallback, useRef } from 'react';
import {
  announcementService,
  type MadrasaAnnouncementItem,
  type AnnouncementPriority,
} from '../../services/announcement.service';
import {
  Megaphone,
  Search,
  CheckCircle2,
  CheckCheck,
  Clock,
  AlertTriangle,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<MadrasaAnnouncementItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [readStatusFilter, setReadStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selected announcement for detail modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<MadrasaAnnouncementItem | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // Load announcements
  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await announcementService.listMadrasaAnnouncements({
        page: pagination.page,
        limit: pagination.limit,
        readStatus: readStatusFilter,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        search: debouncedSearch || undefined,
      });
      setAnnouncements(data.announcements);
      setUnreadCount(data.unreadCount);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, readStatusFilter, categoryFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Open detail and mark read
  const handleOpenDetail = async (item: MadrasaAnnouncementItem) => {
    setSelectedAnnouncement(item);

    try {
      // Fetch fresh detail
      const full = await announcementService.getMadrasaAnnouncement(item.id);
      setSelectedAnnouncement(full);

      // If unread, mark read
      if (!full.isRead) {
        await announcementService.markAnnouncementAsRead(item.id);
        // Update local state
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, isRead: true, readAt: new Date().toISOString() } : a))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        // Dispatch global event for header bell synchronization
        window.dispatchEvent(new CustomEvent('announcements:updated'));
      }
    } catch (err) {
      console.error('Failed to open announcement detail:', err);
    }
  };

  const handleCloseDetail = () => {
    setSelectedAnnouncement(null);
  };

  // Priority badge styling
  const renderPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            URGENT
          </span>
        );
      case 'IMPORTANT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <Info className="w-3 h-3 text-amber-600" />
            IMPORTANT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            NORMAL
          </span>
        );
    }
  };

  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const handleMarkAllAsRead = async () => {
    if (isMarkingAll) return;
    try {
      setIsMarkingAll(true);
      await announcementService.markAllAnnouncementsAsRead();
      await loadAnnouncements();
      window.dispatchEvent(new CustomEvent('announcements:updated'));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">
            <Megaphone className="w-4 h-4 text-[#37C6A3]" />
            Official Platform Bulletins
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight mt-0.5">
            Announcements & Bulletins
          </h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Official system notices, scheduled maintenance schedules, platform updates, and billing bulletins.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl flex items-center gap-2.5">
            <span className="text-xs font-semibold text-[#7C8A9A]">Unread:</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                unreadCount > 0 ? 'bg-[#37C6A3] text-[#0F172A]' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {unreadCount}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7E9EE] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setReadStatusFilter('ALL');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                readStatusFilter === 'ALL'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
              }`}
            >
              All Notices
            </button>
            <button
              onClick={() => {
                setReadStatusFilter('UNREAD');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                readStatusFilter === 'UNREAD'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-[#37C6A3] text-[#0F172A]">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setReadStatusFilter('READ');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                readStatusFilter === 'READ'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1]'
              }`}
            >
              Read History
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:text-[#37C6A3] bg-[#F7F6F1] hover:bg-[#E7E9EE] rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#37C6A3]" />
              <span>{isMarkingAll ? 'Marking...' : 'Mark all as read'}</span>
            </button>
          )}
        </div>

        {/* Dropdowns & Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search announcements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium text-[#0F172A] placeholder-[#7C8A9A] focus:outline-hidden focus:border-[#0F172A]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-hidden"
          >
            <option value="">All Categories</option>
            <option value="GENERAL">General</option>
            <option value="SYSTEM">System</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="UPDATE">Platform Update</option>
            <option value="BILLING">Billing</option>
            <option value="EVENT">Event</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-hidden"
          >
            <option value="">All Priorities</option>
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Important</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      {/* Announcements List Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E7E9EE] text-center text-xs font-medium text-[#7C8A9A] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0F172A]" />
            Loading bulletins...
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-[#E7E9EE] text-center">
            <Megaphone className="w-10 h-10 text-[#7C8A9A]/40 mx-auto mb-3" />
            <div className="text-sm font-bold text-[#0F172A]">No announcements found</div>
            <p className="text-xs text-[#7C8A9A] mt-1">
              There are no announcements matching your selected filters.
            </p>
          </div>
        ) : (
          announcements.map((item) => (
            <div
              key={item.id}
              onClick={() => handleOpenDetail(item)}
              className={`p-5 rounded-2xl border transition cursor-pointer bg-white ${
                !item.isRead
                  ? 'border-emerald-300 shadow-sm ring-1 ring-emerald-200 hover:border-emerald-400'
                  : 'border-[#E7E9EE] shadow-xs hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-[#E7E9EE]/60">
                <div className="flex items-center gap-2.5">
                  {!item.isRead ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#37C6A3] shrink-0" title="Unread" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 shrink-0" title="Read" />
                  )}

                  {renderPriorityBadge(item.priority)}

                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F7F6F1] border border-[#E7E9EE] text-slate-700 rounded-md font-semibold">
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#7C8A9A]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString()
                      : new Date(item.createdAt).toLocaleDateString()}
                  </span>

                  {item.expiresAt && (
                    <span className="text-orange-700 flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3" />
                      Expires: {new Date(item.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3">
                <h3 className="text-sm font-bold text-[#0F172A] tracking-tight">{item.title}</h3>
                <p className="text-xs text-[#7C8A9A] line-clamp-2 mt-1 leading-relaxed">
                  {item.message}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-[#E7E9EE]/40 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-[#37C6A3] hover:underline flex items-center gap-1">
                  View Full Notice &rarr;
                </span>
                {item.isRead && (
                  <span className="text-[10px] text-[#7C8A9A] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Read
                  </span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] flex items-center justify-between text-xs">
            <div className="text-[#7C8A9A]">
              Page <span className="font-bold text-[#0F172A]">{pagination.page}</span> of{' '}
              <span className="font-bold text-[#0F172A]">{pagination.totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="p-1.5 border border-[#E7E9EE] rounded-lg text-[#7C8A9A] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="p-1.5 border border-[#E7E9EE] rounded-lg text-[#7C8A9A] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          ANNOUNCEMENT DETAIL MODAL (Accessible Plain Text Presentation)
          ======================================================== */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                {renderPriorityBadge(selectedAnnouncement.priority)}
                <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F7F6F1] border border-[#E7E9EE] text-slate-700 rounded-md font-semibold">
                  {selectedAnnouncement.category}
                </span>
              </div>
              <button
                onClick={handleCloseDetail}
                className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              <div>
                <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
                  {selectedAnnouncement.title}
                </h2>
                <div className="flex items-center gap-3 text-[11px] text-[#7C8A9A] mt-1">
                  <span>
                    Published on:{' '}
                    {selectedAnnouncement.publishedAt
                      ? new Date(selectedAnnouncement.publishedAt).toLocaleString()
                      : new Date(selectedAnnouncement.createdAt).toLocaleString()}
                  </span>
                  {selectedAnnouncement.expiresAt && (
                    <span className="text-orange-700 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Valid until: {new Date(selectedAnnouncement.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Message Body: plain text with whitespace-pre-wrap, strictly avoiding HTML parsing */}
              <div className="p-4 bg-[#F7F6F1] rounded-xl text-xs text-[#0F172A] leading-relaxed font-sans whitespace-pre-wrap border border-[#E7E9EE]">
                {selectedAnnouncement.message}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#E7E9EE] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#7C8A9A] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Marked as read
              </span>
              <button
                onClick={handleCloseDetail}
                className="px-5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
