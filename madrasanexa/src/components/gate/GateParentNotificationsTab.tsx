import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Info,
  ShieldCheck,
  Mail,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  apiGetGateEvents,
  type GateEventItem,
} from '../../services/gate.service';

export const GateParentNotificationsTab: React.FC = () => {
  const [events, setEvents] = useState<GateEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Fetches latest 50 events for notification status auditing
   */
  const loadNotificationAudit = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiGetGateEvents({
        page: 1,
        limit: 50,
      });

      if (response.success && response.data) {
        setEvents(response.data.events || []);
      }
    } catch (err: any) {
      console.error('Failed to load parent notification audit:', err);
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to load parent notification audit.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificationAudit();
  }, [loadNotificationAudit]);

  // Derive metrics safely from the retrieved audit batch
  const metrics = React.useMemo(() => {
    let queued = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let processing = 0;

    events.forEach((ev) => {
      if (ev.emailStatus === 'QUEUED') queued++;
      else if (ev.emailStatus === 'SENT') sent++;
      else if (ev.emailStatus === 'FAILED') failed++;
      else if (ev.emailStatus === 'PROCESSING') processing++;
      else if (
        ev.emailStatus === 'SKIPPED_NO_RECIPIENT' ||
        ev.emailStatus === 'NOT_APPLICABLE'
      )
        skipped++;
    });

    return { queued, sent, failed, skipped, processing, total: events.length };
  }, [events]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. HEADER & REFRESH */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600" />
            Parent Email Notification Monitor
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time monitoring of automated gate entry and exit email notifications dispatched to guardians.
          </p>
        </div>

        <button
          onClick={() => loadNotificationAudit()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shrink-0 self-start md:self-auto"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Outbox Status
        </button>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. OUTBOX METRICS CARDS (BATCH AUDIT) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Sent Card */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Successfully Sent</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.sent}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">SMTP Confirmed</div>
        </div>

        {/* Queued Card */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Queued for Dispatch</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.queued}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">Awaiting Worker Pick</div>
        </div>

        {/* Processing Card */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Processing Leases</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.processing}</div>
          <div className="text-[11px] text-blue-700 font-medium mt-0.5">In-Flight Delivery</div>
        </div>

        {/* Skipped / Exempt Card */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Policy Skipped</span>
            <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.skipped}</div>
          <div className="text-[11px] text-stone-500 font-medium mt-0.5">Exempt / No Email</div>
        </div>

        {/* Failed Deliveries Card */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-sm col-span-2 sm:col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Failed Retries</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.failed}</div>
          <div className="text-[11px] text-rose-700 font-medium mt-0.5">3 Retries Exhausted</div>
        </div>
      </div>

      <div className="text-[11px] text-stone-400 italic text-right">
        * Metrics reflect the latest {metrics.total} gate events retrieved in the active audit window.
      </div>

      {/* ============================================================== */}
      {/* 3. INSTITUTIONAL SKIP REASON GUIDE */}
      {/* ============================================================== */}
      <div className="bg-stone-50/70 rounded-2xl border border-stone-200 p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Approved Parent Notification Governance & Skip Reasons
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs">
            <div className="font-bold text-slate-800 font-mono text-[11px]">
              BOARDING_STUDENT_EXEMPT
            </div>
            <p className="text-stone-500 mt-1">
              Boarding campus residents are intentionally excluded from daily gate email notifications.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs">
            <div className="font-bold text-slate-800 font-mono text-[11px]">
              NOTIFICATIONS_DISABLED_BY_TENANT
            </div>
            <p className="text-stone-500 mt-1">
              The institution administrator has currently disabled the automated parent email notification toggle.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs">
            <div className="font-bold text-slate-800 font-mono text-[11px]">
              NO_GUARDIAN_EMAIL_REGISTERED
            </div>
            <p className="text-stone-500 mt-1">
              Student is an eligible Day Scholar, but no parent/guardian email address is on file in their profile.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs">
            <div className="font-bold text-slate-800 font-mono text-[11px]">
              TENANT_NOTIFICATIONS_DISABLED_AT_DISPATCH
            </div>
            <p className="text-stone-500 mt-1">
              Event was queued, but institutional notifications were disabled before the background worker claimed the job.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. RECENT NOTIFICATION AUDIT FEED */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
          Recent Notification Events
        </h4>

        {isLoading ? (
          <div className="py-8 text-center text-stone-400 flex items-center justify-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            Loading notifications feed...
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-stone-400 text-xs italic">
            No gate events recorded yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {events.slice(0, 15).map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-stone-50/60 border border-stone-100 text-xs gap-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 font-bold shrink-0">
                    <Mail className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{ev.student.fullName}</div>
                    <div className="text-[11px] text-stone-500">
                      Admission: <span className="font-mono">{ev.student.admissionNo}</span> &bull;{' '}
                      Movement: <span className="font-semibold">{ev.eventType}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                  <div className="text-[11px] text-stone-400">
                    {new Date(ev.scannedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div>
                    {ev.emailStatus === 'SENT' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                      </span>
                    )}
                    {ev.emailStatus === 'QUEUED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <Clock className="w-3.5 h-3.5" /> Queued (Attempt {ev.attemptCount || 0}/3)
                      </span>
                    )}
                    {ev.emailStatus === 'FAILED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                        <XCircle className="w-3.5 h-3.5" /> Failed (3/3)
                      </span>
                    )}
                    {ev.emailStatus === 'SKIPPED_NO_RECIPIENT' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        No Guardian Email
                      </span>
                    )}
                    {ev.emailStatus === 'NOT_APPLICABLE' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600">
                        {ev.emailSkipReason === 'BOARDING_STUDENT_EXEMPT'
                          ? 'Boarding Exempt'
                          : 'Tenant Disabled'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
