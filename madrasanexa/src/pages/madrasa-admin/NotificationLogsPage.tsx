import { useState, useEffect, useCallback } from 'react';
import {
  notificationService,
  type NotificationJob,
  type NotificationStatus,
  type NotificationEventType,
} from '../../services/notification.service';
import {
  Mail,
  MessageSquare,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Eye,
  RotateCcw,
  Loader2,
  X,
  Send,
  User,
} from 'lucide-react';

export default function NotificationLogsPage() {
  const [jobs, setJobs] = useState<NotificationJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Selected job for detail view modal
  const [selectedJob, setSelectedJob] = useState<NotificationJob | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await notificationService.listJobs({
        page,
        pageSize,
        channel: channelFilter,
        status: statusFilter,
        eventType: eventTypeFilter,
        search: debouncedSearch.trim() || undefined,
      });

      setJobs(res.items || []);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load notification jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, channelFilter, statusFilter, eventTypeFilter, debouncedSearch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRetry = async (jobId: string) => {
    try {
      setRetryingJobId(jobId);
      setFeedbackMessage(null);
      const updated = await notificationService.retryJob(jobId);
      setFeedbackMessage({ type: 'success', text: `Job #${jobId.slice(0, 8)} queued for retry.` });
      // Update local state
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      if (selectedJob?.id === jobId) {
        setSelectedJob(updated);
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to retry job.',
      });
    } finally {
      setRetryingJobId(null);
    }
  };

  const getStatusBadge = (status: NotificationStatus) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sent</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      case 'DELIVERY_UNKNOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle className="w-3 h-3" />
            <span>Timeout</span>
          </span>
        );
      case 'SKIPPED_NO_RECIPIENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <User className="w-3 h-3" />
            <span>No Recipient</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const formatEventType = (type: NotificationEventType) => {
    switch (type) {
      case 'FEE_FULLY_PAID':
        return 'Fee Fully Paid';
      case 'FEE_PARTIAL_PAYMENT':
        return 'Partial Fee Payment';
      case 'FEE_MONTH_END_REMINDER':
        return 'Month-End Reminder';
      case 'SALARY_PAID':
        return 'Salary Paid';
      case 'TIMETABLE_FINALIZED':
        return 'Timetable Finalized';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Communication Logs</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Real-time audit log of automated notifications dispatched across SMS and Email channels.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchJobs()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#0F172A] bg-white border border-[#E7E9EE] rounded-xl hover:bg-[#F7F6F1] transition shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Feedback Toast / Alert */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7C8A9A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient, address, key..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
            />
          </div>

          {/* Channel Filter */}
          <div>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] cursor-pointer"
            >
              <option value="ALL">All Channels</option>
              <option value="SMS">SMS Only</option>
              <option value="EMAIL">Email Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DELIVERY_UNKNOWN">Delivery Unknown</option>
              <option value="SKIPPED_NO_RECIPIENT">Skipped (No Recipient)</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <option value="FEE_FULLY_PAID">Fee Fully Paid</option>
              <option value="FEE_PARTIAL_PAYMENT">Partial Fee Payment</option>
              <option value="FEE_MONTH_END_REMINDER">Month-End Reminder</option>
              <option value="SALARY_PAID">Salary Paid</option>
              <option value="TIMETABLE_FINALIZED">Timetable Finalized</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#7C8A9A]">
            <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
            <p className="text-xs font-medium">Loading notification audit logs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-[#7C8A9A] space-y-2">
            <Send className="w-8 h-8 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-[#0F172A]">No notification logs found</p>
            <p className="text-xs">Adjust your search query or filters to inspect earlier records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[#7C8A9A] uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Channel & Event</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Status & Attempts</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE]">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#F7F6F1]/50 transition">
                    {/* Channel & Event */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            job.channel === 'SMS'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}
                        >
                          {job.channel === 'SMS' ? (
                            <MessageSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-[#0F172A] block">
                            {formatEventType(job.eventType)}
                          </span>
                          <span className="text-[10px] text-[#7C8A9A] font-mono uppercase">
                            {job.channel}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Recipient */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#0F172A] block">
                        {job.recipientName || 'Unknown Recipient'}
                      </span>
                      <span className="font-mono text-[11px] text-[#7C8A9A] block">
                        {job.recipientAddress || 'No Address'}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">
                        {job.recipientType}
                      </span>
                    </td>

                    {/* Status & Attempts */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(job.status)}
                        <span className="text-[10px] font-mono text-[#7C8A9A]">
                          {job.attemptCount}/{job.maxAttempts}
                        </span>
                      </div>
                      {job.lastError && (
                        <span className="text-[10px] text-rose-600 block mt-0.5 line-clamp-1 max-w-xs font-mono">
                          {job.lastError}
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-[11px] text-[#7C8A9A]">
                      <div>{new Date(job.createdAt).toLocaleDateString()}</div>
                      <div className="font-mono text-[10px]">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          title="View Details"
                          className="p-1.5 rounded-lg text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#E7E9EE] transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {(job.status === 'FAILED' || job.status === 'DELIVERY_UNKNOWN') && (
                          <button
                            type="button"
                            onClick={() => handleRetry(job.id)}
                            disabled={retryingJobId === job.id}
                            title="Retry Dispatch"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            {retryingJobId === job.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#E7E9EE] flex items-center justify-between text-xs text-[#7C8A9A]">
          <span>
            Showing page <strong className="text-[#0F172A]">{page}</strong> of{' '}
            <strong className="text-[#0F172A]">{totalPages}</strong> ({total} total entries)
          </span>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-[#F7F6F1] text-[#0F172A] font-semibold disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-[#E7E9EE] bg-[#F7F6F1] text-[#0F172A] font-semibold disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] max-w-xl w-full p-6 shadow-xl space-y-5 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedJob.channel === 'SMS'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  {selectedJob.channel === 'SMS' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Notification Job Details</h3>
                  <span className="text-[10px] font-mono text-[#7C8A9A]">ID: {selectedJob.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F7F6F1] border border-[#E7E9EE]">
                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Channel & Event</span>
                  <span className="font-bold text-[#0F172A] block mt-1">
                    {selectedJob.channel} &bull; {formatEventType(selectedJob.eventType)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Recipient</span>
                  <span className="font-semibold text-[#0F172A] block mt-0.5">
                    {selectedJob.recipientName || 'N/A'} ({selectedJob.recipientType})
                  </span>
                  <span className="font-mono text-[11px] text-[#7C8A9A]">
                    {selectedJob.recipientAddress || 'No Address'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block">Attempts</span>
                  <span className="font-mono font-bold text-[#0F172A] block mt-0.5">
                    {selectedJob.attemptCount} of {selectedJob.maxAttempts}
                  </span>
                </div>
              </div>

              {/* Dedupe Key */}
              <div>
                <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block mb-1">
                  Deterministic Deduplication Key
                </span>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-[#E7E9EE] font-mono text-[11px] text-gray-700 break-all select-all">
                  {selectedJob.dedupeKey}
                </div>
              </div>

              {/* Subject if applicable */}
              {selectedJob.subject && (
                <div>
                  <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block mb-1">
                    Message Subject
                  </span>
                  <div className="p-2.5 bg-[#F7F6F1] rounded-lg border border-[#E7E9EE] font-semibold text-[#0F172A]">
                    {selectedJob.subject}
                  </div>
                </div>
              )}

              {/* Sanitized Last Error */}
              {selectedJob.lastError && (
                <div>
                  <span className="text-[10px] text-rose-600 uppercase tracking-wider block mb-1 font-bold">
                    Last Sanitized Error
                  </span>
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 font-mono text-[11px] text-rose-800 break-all">
                    {selectedJob.lastError}
                  </div>
                </div>
              )}

              {/* Message Content Preview */}
              <div>
                <span className="text-[10px] text-[#7C8A9A] uppercase tracking-wider block mb-1">
                  Dispatched Message Payload
                </span>
                <div className="p-3 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] max-h-48 overflow-y-auto">
                  {selectedJob.channel === 'EMAIL' && selectedJob.message.includes('<') ? (
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-mono block">HTML Message Preview:</span>
                      <iframe
                        srcDoc={selectedJob.message}
                        title="Email Preview"
                        className="w-full h-40 bg-white border border-gray-200 rounded"
                      />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                      {selectedJob.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#E7E9EE] pt-3">
              <span className="text-[10px] text-[#7C8A9A]">
                Created: {new Date(selectedJob.createdAt).toLocaleString()}
              </span>
              <div className="inline-flex items-center gap-2">
                {(selectedJob.status === 'FAILED' || selectedJob.status === 'DELIVERY_UNKNOWN') && (
                  <button
                    type="button"
                    onClick={() => handleRetry(selectedJob.id)}
                    disabled={retryingJobId === selectedJob.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {retryingJobId === selectedJob.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Retry Dispatch</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
