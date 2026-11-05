import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  DollarSign,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  listUstadhs,
  type UstadhItem,
  buildUstadhWhatsAppContactUrl,
} from '../../services/ustadh.service';
import { formatDateOnly } from '../../utils/dateTime';

interface UstadhDirectoryTabProps {
  onAddUstadh: () => void;
  onEditUstadh: (ustadh: UstadhItem) => void;
  onViewSchedule: (ustadh: UstadhItem) => void;
  onOpenEmailModal: (ustadh: UstadhItem) => void;
  refreshKey: number;
}

export const UstadhDirectoryTab: React.FC<UstadhDirectoryTabProps> = ({
  onAddUstadh,
  onEditUstadh,
  onViewSchedule,
  onOpenEmailModal,
  refreshKey,
}) => {
  const [items, setItems] = useState<UstadhItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [staffTypeFilter, setStaffTypeFilter] = useState<'ALL' | 'USTADH' | 'SCHOOL_TEACHER'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUstadhs = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeParam =
        statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;
      const res = await listUstadhs({
        search: search.trim() || undefined,
        isActive: activeParam,
        staffType: staffTypeFilter === 'ALL' ? undefined : staffTypeFilter,
        page,
        pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to load Ustadh directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUstadhs();
  }, [page, statusFilter, staffTypeFilter, refreshKey]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUstadhs();
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, phone, or email..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Staff Type Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setStaffTypeFilter('ALL');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                staffTypeFilter === 'ALL'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => {
                setStaffTypeFilter('USTADH');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                staffTypeFilter === 'USTADH'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ustadh
            </button>
            <button
              type="button"
              onClick={() => {
                setStaffTypeFilter('SCHOOL_TEACHER');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                staffTypeFilter === 'SCHOOL_TEACHER'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Teacher
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('INACTIVE');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                statusFilter === 'INACTIVE'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inactive
            </button>
          </div>

          <button
            type="button"
            onClick={onAddUstadh}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Base Salary</th>
                <th className="py-3.5 px-4">Weekly Sessions</th>
                <th className="py-3.5 px-4">Join Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Loading staff directory...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No staff records found matching the filter.
                  </td>
                </tr>
              ) : (
                items.map((u) => {
                  const waUrl = u.whatsappNumber
                    ? buildUstadhWhatsAppContactUrl(u.whatsappNumber, u.fullName)
                    : null;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Code & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900">{u.fullName}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                                  u.staffType === 'SCHOOL_TEACHER'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {u.staffType === 'SCHOOL_TEACHER' ? 'Teacher' : 'Ustadh'}
                              </span>
                            </div>
                            <div className="text-xs font-mono font-medium text-emerald-700">
                              {u.ustadhCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 text-xs">
                          {u.phoneNumber && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{u.phoneNumber}</span>
                            </div>
                          )}
                          {u.whatsappNumber && (
                            <div className="flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <a
                                href={waUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 hover:underline font-mono"
                                title="Open WhatsApp Chat"
                              >
                                {u.whatsappNumber}
                              </a>
                            </div>
                          )}
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate max-w-[160px]">{u.email}</span>
                            </div>
                          )}
                          {!u.phoneNumber && !u.whatsappNumber && !u.email && (
                            <span className="text-slate-400 italic">No contact provided</span>
                          )}
                        </div>
                      </td>

                      {/* Base Salary */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.baseMonthlySalary.toLocaleString()}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">Fixed monthly</div>
                      </td>

                      {/* Weekly Sessions */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onViewSchedule(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          <span>{u.activeScheduleCount ?? 0} sessions</span>
                        </button>
                      </td>

                      {/* Join Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateOnly(u.joinDate)}</span>
                        </div>
                        {u.leaveDate && (
                          <div className="text-[11px] text-red-500">
                            Left: {formatDateOnly(u.leaveDate)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {u.email && (
                            <button
                              type="button"
                              onClick={() => onOpenEmailModal(u)}
                              title="Send Email"
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Message on WhatsApp"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditUstadh(u)}
                            title="Edit Profile"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div>
              Showing {items.length} of {total} Ustadh records
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 hover:bg-slate-100"
              >
                Previous
              </button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
