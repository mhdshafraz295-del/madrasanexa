import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Bell,
  CalendarCheck,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import {
  apiGetGateSettings,
  apiUpdateGateSettings,
  type GateSettings,
} from '../../services/gate.service';
import { useAuth } from '../../context/AuthContext';

export const GateSettingsTab: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'MADRASA_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Settings State
  const [settings, setSettings] = useState<GateSettings>({
    gateParentEmailNotificationsEnabled: false,
    autoGateAttendanceReconciliation: false,
    timezone: 'Asia/Colombo',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confirmation Modal State (Required before enabling either institutional toggle)
  const [pendingConfirm, setPendingConfirm] = useState<{
    settingKey: 'gateParentEmailNotificationsEnabled' | 'autoGateAttendanceReconciliation';
    targetValue: boolean;
    title: string;
    description: string;
  } | null>(null);

  /**
   * Loads current institutional gate settings
   */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiGetGateSettings();
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load gate settings:', err);
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to load institutional gate settings.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /**
   * Initiates toggle change, prompting confirmation dialog if turning ON
   */
  const handleToggleRequest = (
    settingKey: 'gateParentEmailNotificationsEnabled' | 'autoGateAttendanceReconciliation'
  ) => {
    if (!isAdmin) return;

    const nextValue = !settings[settingKey];

    // If turning ON, show mandatory institutional confirmation modal
    if (nextValue) {
      if (settingKey === 'gateParentEmailNotificationsEnabled') {
        setPendingConfirm({
          settingKey,
          targetValue: true,
          title: 'Enable Automated Parent Email Notifications?',
          description:
            'When enabled, the gate background worker will automatically dispatch email notifications to registered guardians whenever an eligible Day Scholar passes through the gate. Boarding students remain exempt.',
        });
      } else {
        setPendingConfirm({
          settingKey,
          targetValue: true,
          title: 'Enable Automatic Attendance Reconciliation?',
          description:
            'When enabled, approved gate ENTRY scans will automatically find or create today’s class attendance session and record the student as PRESENT. Exit scans will never alter attendance.',
        });
      }
    } else {
      // Disabling applies directly
      applySettingChange(settingKey, false);
    }
  };

  /**
   * Persists the setting change to backend
   */
  const applySettingChange = async (
    settingKey: 'gateParentEmailNotificationsEnabled' | 'autoGateAttendanceReconciliation',
    value: boolean
  ) => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        [settingKey]: value,
      };

      const response = await apiUpdateGateSettings(payload);

      if (response.success && response.data) {
        setSettings(response.data);
        setSuccessMessage('Gate settings updated and synchronized successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to update gate settings:', err);
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to update institutional gate settings.'
      );
    } finally {
      setIsSaving(false);
      setPendingConfirm(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ============================================================== */}
      {/* 1. HEADER */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Smart Gate Institutional Settings
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Configure institutional automation policies for student gate scans, attendance reconciliation, and guardian notifications.
            </p>
          </div>
        </div>

        {/* RBAC Viewer-Only Banner if non-admin */}
        {!isAdmin && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Read-Only Mode:</strong> Institutional gate policy mutations require Madrasa Administrator privileges.
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. SUCCESS / ERROR BANNERS */}
      {/* ============================================================== */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SETTINGS TOGGLES */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 shadow-sm overflow-hidden">
        {/* Setting 1: Parent Email Notifications */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Parent Email Movement Notifications
              </h4>
              {settings.gateParentEmailNotificationsEnabled ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 leading-relaxed max-w-xl">
              Automatically triggers real-time email notifications to registered guardians when students
              scan through school gates.
            </p>
            <div className="pt-2 text-[11px] text-stone-400 space-y-1">
              <div>&bull; <strong>Eligibility:</strong> Strictly Day Scholars (<span className="font-mono">DAY_SCHOLAR</span>) with a non-empty guardian email on file.</div>
              <div>&bull; <strong>Exemption:</strong> Boarding students are exempt from daily notifications.</div>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            disabled={!isAdmin || isSaving || isLoading}
            onClick={() => handleToggleRequest('gateParentEmailNotificationsEnabled')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed ${
              settings.gateParentEmailNotificationsEnabled ? 'bg-emerald-600' : 'bg-stone-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                settings.gateParentEmailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Setting 2: Automatic Attendance Reconciliation */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Automatic Gate Attendance Reconciliation
              </h4>
              {settings.autoGateAttendanceReconciliation ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 leading-relaxed max-w-xl">
              Automatically creates or updates the student's daily attendance record to <span className="font-semibold text-emerald-700">PRESENT</span> upon scanning ENTRY at the gate.
            </p>
            <div className="pt-2 text-[11px] text-stone-400 space-y-1">
              <div>&bull; <strong>Direction Rule:</strong> Only approved <span className="font-mono">ENTRY</span> scans reconcile attendance. <span className="font-mono">EXIT</span> scans are pure movement facts and never alter attendance.</div>
              <div>&bull; <strong>Timezone Safe:</strong> Calendar dates are derived using institutional timezone (<span className="font-mono">{settings.timezone || 'Asia/Colombo'}</span>).</div>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            type="button"
            disabled={!isAdmin || isSaving || isLoading}
            onClick={() => handleToggleRequest('autoGateAttendanceReconciliation')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed ${
              settings.autoGateAttendanceReconciliation ? 'bg-emerald-600' : 'bg-stone-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                settings.autoGateAttendanceReconciliation ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Setting 3: Timezone Information (Read-only Institutional Context) */}
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50/50">
          <div>
            <div className="text-xs font-bold text-slate-800">Institution Local Timezone</div>
            <div className="text-xs text-stone-500 mt-0.5">
              Governs daily calendar date rollover for gate scans and parent notifications.
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 font-mono text-xs font-semibold text-slate-700">
            {settings.timezone || 'Asia/Colombo'}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900">{pendingConfirm.title}</h4>
              <p className="text-xs text-stone-500 leading-relaxed mt-2">
                {pendingConfirm.description}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  applySettingChange(pendingConfirm.settingKey, pendingConfirm.targetValue)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirm & Enable Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
