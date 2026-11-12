import { useState, useEffect } from 'react';
import {
  apiListActivityLogs,
  type ActivityLogItem,
} from '../../services/api';
import {
  Loader2,
  Info,
  X,
} from 'lucide-react';

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiListActivityLogs({ page: 1, pageSize: 50 });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Platform Activity Audit</h1>
          <p className="text-xs text-[#7C8A9A] mt-1">
            Immutable audit trail of all platform-level administrative, security, and onboarding events.
          </p>
        </div>
        <span className="px-3 py-1 bg-white border border-[#E7E9EE] text-xs font-semibold text-[#0F172A] rounded-xl shadow-xs shrink-0 w-fit">
          {total} events recorded
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#37C6A3]" />
            <p className="text-xs text-[#7C8A9A]">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#7C8A9A]">No activity logs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F6F1] text-[#7C8A9A] font-semibold border-b border-[#E7E9EE]">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity Type</th>
                  <th className="px-5 py-3">Performed By</th>
                  <th className="px-5 py-3">Madrasa Context</th>
                  <th className="px-5 py-3">IP Address</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F6F1]/50 transition">
                    <td className="px-5 py-3 font-mono text-[11px] text-[#7C8A9A]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0F172A]/5 text-[#0F172A]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#7C8A9A]">{log.entityType}</td>
                    <td className="px-5 py-3">
                      {log.performedByUser ? (
                        <div>
                          <div className="font-semibold text-[#0F172A]">{log.performedByUser.name}</div>
                          <div className="text-[10px] text-[#7C8A9A]">{log.performedByUser.email}</div>
                        </div>
                      ) : (
                        <span className="text-[#7C8A9A]">System / Public</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.madrasa ? (
                        <div>
                          <span className="font-semibold text-[#0F172A]">{log.madrasa.name}</span>
                          <span className="text-[10px] text-[#7C8A9A] ml-1">({log.madrasa.code})</span>
                        </div>
                      ) : (
                        <span className="text-[#7C8A9A]">Global Platform</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-[#7C8A9A]">
                      {log.ipAddress || '-'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {log.metadata && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 hover:bg-[#F7F6F1] text-[#7C8A9A] hover:text-[#0F172A] rounded-lg transition cursor-pointer"
                          title="View Metadata"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* METADATA MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E7E9EE] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E9EE]">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Activity Details</h3>
                <p className="text-xs font-mono text-[#7C8A9A]">{selectedLog.action}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0F172A] text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-60">
              <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
            </div>

            <div className="pt-2 border-t border-[#E7E9EE] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#F7F6F1] text-[#0F172A] rounded-xl text-xs font-semibold cursor-pointer"
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
