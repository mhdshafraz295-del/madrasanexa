import { useState, useEffect } from 'react';
import {
  apiGetMadrasaActivity,
  type TenantActivityItem,
} from '../../services/api';
import {
  User,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function ActivityPage() {
  const [logs, setLogs] = useState<TenantActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async (targetPage = page, filter = actionFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGetMadrasaActivity({
        page: targetPage,
        pageSize,
        action: filter.trim() || undefined,
      });
      setLogs(res.logs);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load activity log.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity(page, actionFilter);
  }, [page]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchActivity(1, actionFilter);
  };

  const getActionBadge = (action: string) => {
    let color = 'bg-blue-50 text-blue-700 border-blue-200';
    if (action.includes('SETTINGS') || action.includes('PROFILE')) {
      color = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (action.includes('PASSWORD') || action.includes('LOGIN')) {
      color = 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (action.includes('APPROVED') || action.includes('RENEW') || action.includes('ACTIVE')) {
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${color}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Institutional Activity Log</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Tamper-evident audit trail for actions executed within your Madrasa workspace.
          </p>
        </div>
        <button
          onClick={() => fetchActivity(page, actionFilter)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-xs font-semibold text-[#0F172A] rounded-xl transition shadow-xs cursor-pointer w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#7C8A9A]" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Filter className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by action name (e.g. SETTINGS, PASSWORD)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E7E9EE] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto px-5 py-2 bg-[#0F172A] text-white font-semibold text-xs rounded-xl hover:bg-[#0F172A]/90 transition cursor-pointer"
        >
          Search
        </button>
        {actionFilter && (
          <button
            type="button"
            onClick={() => {
              setActionFilter('');
              setPage(1);
              fetchActivity(1, '');
            }}
            className="text-xs text-[#7C8A9A] hover:underline"
          >
            Clear
          </button>
        )}
      </form>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Activity Log Table */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-[#7C8A9A]">
            <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            <span className="text-xs">Loading activity logs...</span>
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold uppercase tracking-wider border-b border-[#E7E9EE]">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Entity</th>
                  <th className="px-6 py-3">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-[#0F172A]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[#7C8A9A] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-[#7C8A9A]">
                      {log.entityType || '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-[#7C8A9A]" />
                        <span>{log.user?.name || 'System Actor'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-[#7C8A9A] text-xs">
            No activity log entries found matching this query.
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#E7E9EE] flex items-center justify-between text-xs text-[#7C8A9A]">
            <span>
              Showing {logs.length} of {total} events (Page {page} of {totalPages})
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-[#E7E9EE] hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
