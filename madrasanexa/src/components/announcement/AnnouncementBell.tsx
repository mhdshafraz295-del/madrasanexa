import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  announcementService,
  type MadrasaAnnouncementItem,
} from '../../services/announcement.service';
import { Bell, Megaphone, ChevronRight } from 'lucide-react';
import { formatDateOnly } from '../../utils/dateTime';

export default function AnnouncementBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestAnnouncements, setLatestAnnouncements] = useState<MadrasaAnnouncementItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [count, latest] = await Promise.all([
        announcementService.getMadrasaUnreadCount(),
        announcementService.getMadrasaLatestAnnouncements(5),
      ]);
      setUnreadCount(count);
      setLatestAnnouncements(latest);
    } catch (err) {
      console.error('Failed to load bell notifications:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for custom announcement update events
    const handleUpdate = () => loadData();
    window.addEventListener('announcements:updated', handleUpdate);

    // Also poll gently every 60 seconds
    const interval = setInterval(loadData, 60000);

    return () => {
      window.removeEventListener('announcements:updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      loadData();
    }
    setIsOpen(!isOpen);
  };

  const [markingAll, setMarkingAll] = useState(false);

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (markingAll) return;
    try {
      setMarkingAll(true);
      await announcementService.markAllAnnouncementsAsRead();
      await loadData();
      window.dispatchEvent(new CustomEvent('announcements:updated'));
    } catch (err) {
      console.error('Failed to mark all announcements as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] border border-transparent hover:border-[#E7E9EE] transition cursor-pointer"
        aria-label="Announcements & Bulletins"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#37C6A3] px-1 text-[10px] font-black text-[#0F172A] ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-96 max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl bg-white border border-[#E7E9EE] shadow-2xl z-50 overflow-hidden">
          <div className="p-4 border-b border-[#E7E9EE] flex flex-wrap items-center justify-between gap-2 bg-[#F7F6F1]/50 shrink-0">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#37C6A3] shrink-0" />
              <span className="text-xs font-bold text-[#0F172A]">Platform Announcements</span>
            </div>
            {unreadCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="text-[11px] font-semibold text-[#0F172A] hover:text-[#37C6A3] transition cursor-pointer disabled:opacity-50"
                >
                  {markingAll ? 'Marking...' : 'Mark all as read'}
                </button>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#37C6A3] text-[#0F172A]">
                  {unreadCount} unread
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 max-h-80 overflow-y-auto divide-y divide-[#E7E9EE]">
            {latestAnnouncements.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#7C8A9A]">
                No announcements at this time.
              </div>
            ) : (
              latestAnnouncements.map((item) => (
                <Link
                  key={item.id}
                  to="/madrasa-admin/announcements"
                  onClick={() => setIsOpen(false)}
                  className={`p-3.5 block hover:bg-[#F7F6F1] transition text-left ${
                    !item.isRead ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#37C6A3] shrink-0" />
                      )}
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold truncate">
                        {item.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#7C8A9A] shrink-0">
                      {formatDateOnly(item.publishedAt || item.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#0F172A] line-clamp-2 break-words">{item.title}</div>
                  <div className="text-[11px] text-[#7C8A9A] line-clamp-2 break-words mt-0.5">{item.message}</div>
                </Link>
              ))
            )}
          </div>

          <div className="p-3 border-t border-[#E7E9EE] bg-[#F7F6F1] text-center">
            <Link
              to="/madrasa-admin/announcements"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#0F172A] hover:text-[#37C6A3] flex items-center justify-center gap-1 transition"
            >
              <span>View All Announcements</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
