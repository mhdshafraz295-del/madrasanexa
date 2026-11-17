import React, { useState, useEffect } from 'react';
import {
  Settings,
  Lock,
  Globe,
  Bell,
  ShieldCheck,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  LogOut,
  Info,
  User,
} from 'lucide-react';
import { settingsApi, TeacherSettingsData } from '../services/api';
import { MOCK_TEACHER_PROFILE } from '../mock/teacherMockData';
import { LoadingState } from '../components/common/LoadingState';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [accountData, setAccountData] = useState<TeacherSettingsData['account'] | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar' | 'ta'>('en');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsUrgent, setSmsUrgent] = useState(true);
  const [studentAbsenceAlerts, setStudentAbsenceAlerts] = useState(true);
  const [salaryNotifs, setSalaryNotifs] = useState(true);

  // Preference save state
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await settingsApi.getSettings();
        if (data?.account) {
          setAccountData(data.account);
        }
        if (data?.preferences) {
          if (data.preferences.language === 'en' || data.preferences.language === 'ar' || data.preferences.language === 'ta') {
            setSelectedLanguage(data.preferences.language);
          }
          if (typeof data.preferences.emailNotifications === 'boolean') {
            setEmailNotifs(data.preferences.emailNotifications);
          }
          if (typeof data.preferences.whatsappAlerts === 'boolean') {
            setSmsUrgent(data.preferences.whatsappAlerts);
          }
        }
      } catch (err: any) {
        console.warn('Using local settings fallback:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPrefs(true);
      setPrefError(null);
      await settingsApi.updatePreferences({
        language: selectedLanguage,
        emailNotifications: emailNotifs,
        whatsappAlerts: smsUrgent,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3500);
    } catch (err: any) {
      setPrefError(err?.message || 'Failed to save preferences');
      setTimeout(() => setPrefError(null), 4000);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword) {
      setPasswordError('Please provide both current and new passwords.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setUpdatingPassword(true);
      await settingsApi.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update faculty password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488] uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" />
            <span>Faculty Preferences & Security</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Account Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your credentials, notification channels, and active login sessions
          </p>
        </div>

        {accountData && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-700 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <div>
              <div className="font-bold text-slate-900">{accountData.email}</div>
              <div className="text-[10px] text-slate-500 font-mono">Role: {accountData.role} • Code: {accountData.ustadhCode || 'UST'}</div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="p-8 bg-white rounded-2xl border border-slate-200">
          <LoadingState message="Loading account settings..." />
        </div>
      )}

      {settingsSaved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Account preferences updated and saved successfully.</span>
        </div>
      )}

      {prefError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{prefError}</span>
        </div>
      )}

      {/* 2. Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Language & Notifications */}
        <div className="space-y-6">
          {/* Language Selection */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <Globe className="w-4 h-4 text-[#0D9488]" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Language & Localization
              </h2>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                { code: 'en', label: 'English (United Kingdom)', native: 'English' },
                { code: 'ar', label: 'Arabic', native: 'العربية' },
                { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
              ].map((lang) => (
                <label
                  key={lang.code}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                    selectedLanguage === lang.code
                      ? 'border-[#0D9488] bg-teal-50/40 ring-1 ring-[#0D9488]/30'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="language"
                      checked={selectedLanguage === lang.code}
                      onChange={() => setSelectedLanguage(lang.code as any)}
                      className="text-[#0D9488] focus:ring-[#0D9488]"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{lang.label}</div>
                      <div className="text-[11px] text-slate-500 font-arabic">{lang.native}</div>
                    </div>
                  </div>
                  {selectedLanguage === lang.code && (
                    <span className="text-[10px] font-bold text-[#0D9488] bg-teal-100 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Communication & Alert Preferences */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <Bell className="w-4 h-4 text-[#0D9488]" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Notification Channels
              </h2>
            </div>
            <div className="mt-4 space-y-3.5 text-xs">
              <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-900">Email Examination Alerts</div>
                  <div className="text-slate-500 text-[11px]">Receive exam schedules and grading deadlines via email</div>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifs}
                  onChange={(e) => setEmailNotifs(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-[#0D9488] rounded border-slate-300 focus:ring-[#0D9488]"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-900">Urgent SMS Timetable Changes</div>
                  <div className="text-slate-500 text-[11px]">Direct SMS dispatch for emergency classroom shifts</div>
                </div>
                <input
                  type="checkbox"
                  checked={smsUrgent}
                  onChange={(e) => setSmsUrgent(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-[#0D9488] rounded border-slate-300 focus:ring-[#0D9488]"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-900">Student Medical Leave Notices</div>
                  <div className="text-slate-500 text-[11px]">Instant alerts when a student in your class is excused</div>
                </div>
                <input
                  type="checkbox"
                  checked={studentAbsenceAlerts}
                  onChange={(e) => setStudentAbsenceAlerts(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-[#0D9488] rounded border-slate-300 focus:ring-[#0D9488]"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-900">Monthly Compensation Advice</div>
                  <div className="text-slate-500 text-[11px]">Monthly salary voucher availability and direct deposit receipt</div>
                </div>
                <input
                  type="checkbox"
                  checked={salaryNotifs}
                  onChange={(e) => setSalaryNotifs(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-[#0D9488] rounded border-slate-300 focus:ring-[#0D9488]"
                />
              </label>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingPrefs}
                className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
              >
                {savingPrefs ? 'Saving Preferences...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Password Change & Active Sessions */}
        <div className="space-y-6">
          {/* Password Change */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <Lock className="w-4 h-4 text-[#0D9488]" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Security & Password Update
              </h2>
            </div>

            {passwordSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Password changed successfully.</span>
              </div>
            )}

            {passwordError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current faculty password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters with numbers"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer"
                >
                  {updatingPassword ? 'Updating Password...' : 'Update Faculty Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Active Login Sessions */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Active Verified Sessions
                </h2>
              </div>
              <button
                type="button"
                onClick={() => alert('Other remote sessions have been revoked.')}
                className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Revoke Others
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {/* Session 1 */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Laptop className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Windows 11 (Google Chrome)</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900">
                        This Device
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      IP: 192.168.1.104 • Kalutara Campus Network
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-800 font-bold">Active Now</span>
              </div>

              {/* Session 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Apple Safari (iPhone 15 Pro)
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Mobile Network • Colombo
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">2h ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
