import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMadrasaInitials } from '../../utils/initials';
import {
  apiGetMadrasaSettings,
  apiUpdateMadrasaSettings,
  apiGetMadrasaAdminProfile,
  apiUpdateMadrasaAdminProfile,
  apiUploadMadrasaLogo,
  apiRemoveMadrasaLogo,
  type TenantSettingsData,
  type AdminProfileData,
} from '../../services/api';
import {
  Building2,
  Receipt,
  User,
  Image as ImageIcon,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
  Upload,
  Trash2,
  X,
  AlertTriangle,
  Bell,
  Mail,
  Clock,
} from 'lucide-react';
import NotificationSettingsTab from '../../components/settings/NotificationSettingsTab';
import EmailSenderSettingsTab from '../../components/settings/EmailSenderSettingsTab';
import DateTimeSettingsTab from '../../components/settings/DateTimeSettingsTab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'admin' | 'branding' | 'notifications' | 'email-sender' | 'datetime'>('profile');
  const [settingsData, setSettingsData] = useState<TenantSettingsData | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfileData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states for Madrasa Settings
  const [madrasaForm, setMadrasaForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    invoicePrefix: 'INV-',
    receiptPrefix: 'REC-',
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    academicYear: '2026',
    receiptHeader: '',
    receiptFooter: '',
  });

  // Form states for Admin Profile
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
  });

  // Branding states
  const { refreshUser } = useAuth();
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [settingsRes, profileRes] = await Promise.all([
        apiGetMadrasaSettings(),
        apiGetMadrasaAdminProfile(),
      ]);

      setSettingsData(settingsRes);
      setAdminProfile(profileRes);
      setBrandingLogoUrl(settingsRes.madrasa.logoUrl || null);

      setMadrasaForm({
        name: settingsRes.madrasa.name || '',
        email: settingsRes.madrasa.email || '',
        phone: settingsRes.madrasa.phone || '',
        address: settingsRes.madrasa.address || '',
        invoicePrefix: settingsRes.settings.invoicePrefix || 'INV-',
        receiptPrefix: settingsRes.settings.receiptPrefix || 'REC-',
        currency: settingsRes.settings.currency || 'LKR',
        timezone: settingsRes.settings.timezone || 'Asia/Colombo',
        academicYear: settingsRes.settings.academicYear || '',
        receiptHeader: settingsRes.settings.receiptHeader || '',
        receiptFooter: settingsRes.settings.receiptFooter || '',
      });

      setAdminForm({
        name: profileRes.name || '',
        email: profileRes.email || '',
      });
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to load configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBrandingError(null);
    setBrandingSuccess(null);

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.svg') || file.type === 'image/svg+xml') {
      setBrandingError('SVG images are not allowed for security reasons. Please select a JPG, PNG or WebP image.');
      return;
    }

    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type) && !lowerName.match(/\.(jpg|jpeg|png|webp)$/)) {
      setBrandingError('Please upload a JPG, PNG or WebP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBrandingError('Logo must be smaller than 5 MB.');
      return;
    }

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCancelPreview = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setBrandingError(null);
  };

  const handleUploadLogo = async () => {
    if (!selectedFile || !(selectedFile instanceof File) || selectedFile.size === 0) {
      setBrandingError('Please select a logo image first.');
      return;
    }

    setIsUploadingLogo(true);
    setBrandingError(null);
    setBrandingSuccess(null);

    try {
      const res = await apiUploadMadrasaLogo(selectedFile);
      setBrandingSuccess('Institutional logo updated successfully.');
      setBrandingLogoUrl(res.logoUrl);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      await refreshUser();
    } catch (err: any) {
      setBrandingError(err.response?.data?.message || err.message || 'Failed to upload logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setIsRemovingLogo(true);
    setBrandingError(null);
    setBrandingSuccess(null);

    try {
      await apiRemoveMadrasaLogo();
      setBrandingSuccess('Institutional logo removed successfully.');
      setBrandingLogoUrl(null);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setShowRemoveConfirm(false);
      await refreshUser();
    } catch (err: any) {
      setBrandingError(err.response?.data?.message || err.message || 'Failed to remove logo.');
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updated = await apiUpdateMadrasaSettings({
        name: madrasaForm.name.trim(),
        email: madrasaForm.email.trim() || null,
        phone: madrasaForm.phone.trim() || null,
        address: madrasaForm.address.trim() || null,
      });
      setSettingsData(updated);
      setMadrasaForm(prev => ({
        ...prev,
        name: updated.madrasa.name || '',
        email: updated.madrasa.email || '',
        phone: updated.madrasa.phone || '',
        address: updated.madrasa.address || '',
      }));
      await refreshUser();
      setSuccessMessage('Institution profile updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save profile settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const billingPayload: {
        invoicePrefix: string;
        receiptPrefix: string;
        currency: string;
        timezone: string;
        academicYear?: string;
        receiptHeader: string | null;
        receiptFooter: string | null;
      } = {
        invoicePrefix: madrasaForm.invoicePrefix.trim(),
        receiptPrefix: madrasaForm.receiptPrefix.trim(),
        currency: madrasaForm.currency.trim(),
        timezone: madrasaForm.timezone.trim(),
        receiptHeader: madrasaForm.receiptHeader.trim() || null,
        receiptFooter: madrasaForm.receiptFooter.trim() || null,
      };

      const trimmedYear = madrasaForm.academicYear.trim();
      if (trimmedYear) {
        billingPayload.academicYear = trimmedYear;
      }

      const updated = await apiUpdateMadrasaSettings(billingPayload);
      setSettingsData(updated);
      setMadrasaForm(prev => ({
        ...prev,
        invoicePrefix: updated.settings.invoicePrefix || 'INV-',
        receiptPrefix: updated.settings.receiptPrefix || 'REC-',
        currency: updated.settings.currency || 'LKR',
        timezone: updated.settings.timezone || 'Asia/Colombo',
        academicYear: updated.settings.academicYear || '',
        receiptHeader: updated.settings.receiptHeader || '',
        receiptFooter: updated.settings.receiptFooter || '',
      }));
      setSuccessMessage('Billing and receipt settings saved successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save billing settings.');
    } finally {
      setIsSaving(false);
    }
  };


  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const updated = await apiUpdateMadrasaAdminProfile(adminForm);
      setAdminProfile(updated);
      setSuccessMessage('Administrator profile updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update administrator profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !settingsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3]" />
        <p className="text-xs text-[#7C8A9A]">Loading configuration settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Madrasa Settings</h1>
        <p className="text-xs text-[#7C8A9A] mt-1">
          Manage your institutional profile, receipt formatting, academic year, and administrator account.
        </p>
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-px overflow-x-auto">
        {[
          { id: 'profile', label: 'Institution Profile', icon: Building2 },
          { id: 'datetime', label: 'Date & Time', icon: Clock },
          { id: 'billing', label: 'Billing & Receipts', icon: Receipt },
          { id: 'admin', label: 'Administrator Profile', icon: User },
          { id: 'branding', label: 'Branding & Logo', icon: ImageIcon },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'email-sender', label: 'Sender Email Settings', icon: Mail },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[#0F172A] text-[#0F172A]'
                  : 'border-transparent text-[#7C8A9A] hover:text-[#0F172A] hover:border-[#E7E9EE]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Institution Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Institution Profile</h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Official institutional metadata. Identity code and slug are permanently protected.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Institution Code (Read-Only) */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Institution Code (Immutable)
              </label>
              <div className="flex items-center gap-2 p-3 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-mono font-bold text-[#7C8A9A]">
                <Lock className="w-3.5 h-3.5 text-[#7C8A9A]" />
                <span>{settingsData?.madrasa.code}</span>
              </div>
            </div>

            {/* URL Slug (Read-Only) */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Tenant Slug (Immutable)
              </label>
              <div className="flex items-center gap-2 p-3 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-mono text-[#7C8A9A]">
                <Lock className="w-3.5 h-3.5 text-[#7C8A9A]" />
                <span>{settingsData?.madrasa.slug}</span>
              </div>
            </div>

            {/* Madrasa Name */}
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Madrasa Name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={madrasaForm.name}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            {/* Official Contact Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Official Email
              </label>
              <input
                id="email"
                type="email"
                value={madrasaForm.email}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                placeholder="office@darululoom.lk"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Contact Phone
              </label>
              <input
                id="phone"
                type="text"
                value={madrasaForm.phone}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                placeholder="+94 77 123 4567"
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label htmlFor="address" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Campus Address
              </label>
              <textarea
                id="address"
                rows={3}
                value={madrasaForm.address}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, address: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 resize-none"
                placeholder="No. 12, Main Street, Colombo"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E7E9EE] flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFD978] hover:bg-[#FFD978]/90 text-[#0F172A] font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Billing & Receipts */}
      {activeTab === 'billing' && (
        <form onSubmit={handleBillingSubmit} className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Billing, Invoices & Receipt Configuration</h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Customize sequence prefixes, default currency, and printed receipt header & footer text.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Invoice Prefix */}
            <div>
              <label htmlFor="invoicePrefix" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Invoice Prefix *
              </label>
              <input
                id="invoicePrefix"
                type="text"
                required
                value={madrasaForm.invoicePrefix}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, invoicePrefix: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 uppercase"
                placeholder="INV-"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">e.g. INV- or DUA-INV-</p>
            </div>

            {/* Receipt Prefix */}
            <div>
              <label htmlFor="receiptPrefix" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Receipt Prefix *
              </label>
              <input
                id="receiptPrefix"
                type="text"
                required
                value={madrasaForm.receiptPrefix}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, receiptPrefix: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 uppercase"
                placeholder="REC-"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">e.g. REC- or DUA-REC-</p>
            </div>

            {/* Currency */}
            <div>
              <label htmlFor="currency" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Currency (ISO 3-Letter) *
              </label>
              <input
                id="currency"
                type="text"
                required
                maxLength={3}
                value={madrasaForm.currency}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, currency: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 uppercase"
                placeholder="LKR"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">Default: LKR</p>
            </div>

            {/* Timezone */}
            <div className="sm:col-span-2">
              <label htmlFor="timezone" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Display Timezone *
              </label>
              <input
                id="timezone"
                type="text"
                required
                value={madrasaForm.timezone}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, timezone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                placeholder="Asia/Colombo"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">Standard IANA timezone, e.g. Asia/Colombo</p>
            </div>

            {/* Academic Year */}
            <div>
              <label htmlFor="academicYear" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Current Academic Year
              </label>
              <input
                id="academicYear"
                type="text"
                value={madrasaForm.academicYear}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, academicYear: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
                placeholder="2026 or 2026/2027"
              />
              <p className="text-[10px] text-[#7C8A9A] mt-1">e.g. 2026 or 2026/2027</p>
            </div>

            {/* Receipt Header Text */}
            <div className="sm:col-span-3">
              <label htmlFor="receiptHeader" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Receipt Printed Header Note
              </label>
              <textarea
                id="receiptHeader"
                rows={2}
                value={madrasaForm.receiptHeader}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, receiptHeader: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 resize-none"
                placeholder="Islamic Education Trust - Official Payment Receipt"
              />
            </div>

            {/* Receipt Footer Text */}
            <div className="sm:col-span-3">
              <label htmlFor="receiptFooter" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Receipt Printed Footer Note
              </label>
              <textarea
                id="receiptFooter"
                rows={2}
                value={madrasaForm.receiptFooter}
                onChange={(e) => setMadrasaForm({ ...madrasaForm, receiptFooter: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30 resize-none"
                placeholder="May Allah bless your contribution to knowledge. Receipts are non-transferable."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E7E9EE] flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFD978] hover:bg-[#FFD978]/90 text-[#0F172A] font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Billing Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Administrator Profile */}
      {activeTab === 'admin' && (
        <form onSubmit={handleAdminSubmit} className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Administrator Account Profile</h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Personal credentials for the authenticated Madrasa Administrator.
              {adminProfile && (
                <span className="ml-2 font-mono text-[11px] text-[#7C8A9A]">
                  (ID: {adminProfile.id} &bull; {adminProfile.role})
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="adminName" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Your Full Name *
              </label>
              <input
                id="adminName"
                type="text"
                required
                value={adminForm.name}
                onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            <div>
              <label htmlFor="adminEmail" className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-2">
                Login Email Address *
              </label>
              <input
                id="adminEmail"
                type="email"
                required
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-[#E7E9EE] text-xs font-mono font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/30"
              />
            </div>

            <div className="sm:col-span-2 p-4 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#0F172A]">Password Security</div>
                <div className="text-[11px] text-[#7C8A9A] mt-0.5">
                  Update your personal login password (minimum 10 characters with bcrypt cost 12 protection).
                </div>
              </div>
              <Link
                to="/change-password"
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] font-semibold text-xs rounded-xl transition shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#7C8A9A]" />
                <span>Change Password</span>
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E7E9EE] flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFD978] hover:bg-[#FFD978]/90 text-[#0F172A] font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Update Admin Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: Branding & Logo */}
      {activeTab === 'branding' && (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Madrasa Branding & Identity</h2>
            <p className="text-xs text-[#7C8A9A] mt-0.5">
              Upload your institution's emblem. It will automatically appear in your sidebar, all fee report PDFs, student statements, and printable receipts.
            </p>
          </div>

          {brandingSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{brandingSuccess}</span>
            </div>
          )}

          {brandingError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{brandingError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Current Active / Preview Emblem */}
            <div className="lg:col-span-4 p-6 bg-[#F7F6F1] border border-[#E7E9EE] rounded-2xl flex flex-col items-center text-center space-y-4">
              <span className="text-[11px] font-bold text-[#7C8A9A] uppercase tracking-wider">
                {previewUrl ? 'New Logo (Preview)' : brandingLogoUrl ? 'Active Institution Logo' : 'Default Initials Fallback'}
              </span>

              <div className="w-36 h-36 rounded-2xl bg-white border border-[#E7E9EE] shadow-sm flex items-center justify-center p-3 overflow-hidden relative">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Logo Preview"
                    className="w-full h-full object-contain"
                  />
                ) : brandingLogoUrl ? (
                  <img
                    src={brandingLogoUrl}
                    alt="Active Logo"
                    onError={() => setBrandingLogoUrl(null)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-[#0F172A] text-[#37C6A3] flex items-center justify-center font-black text-3xl select-none">
                    {getMadrasaInitials(madrasaForm.name || 'Madrasa')}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-[#0F172A]">
                  {madrasaForm.name || 'Madrasa Workspace'}
                </div>
                <div className="text-[11px] text-[#7C8A9A] font-mono">
                  Code: {settingsData?.madrasa?.code || 'WORKSPACE'}
                </div>
              </div>

              {previewUrl ? (
                <div className="flex items-center gap-2 w-full pt-2">
                  <button
                    type="button"
                    onClick={handleUploadLogo}
                    disabled={isUploadingLogo}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#37C6A3] hover:bg-[#37C6A3]/90 text-[#0F172A] font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                  >
                    {isUploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Logo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    disabled={isUploadingLogo}
                    className="inline-flex items-center justify-center px-3 py-2 bg-white border border-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A] font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : brandingLogoUrl ? (
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={isRemovingLogo}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition cursor-pointer pt-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Logo</span>
                </button>
              ) : (
                <span className="text-[11px] text-[#7C8A9A]">No custom logo uploaded yet.</span>
              )}
            </div>

            {/* Right Column: Upload Controls & Format Rules */}
            <div className="lg:col-span-8 space-y-6">
              {/* Dropzone Container */}
              <div className="border-2 border-dashed border-[#E7E9EE] hover:border-[#37C6A3] transition-colors rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 bg-[#F7F6F1]/30">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E7E9EE] flex items-center justify-center text-[#37C6A3] shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A]">Choose an image file</h3>
                  <p className="text-[11px] text-[#7C8A9A] mt-0.5">
                    PNG, JPG, or WebP up to 5 MB. Aspect ratio is preserved automatically (scaled up to 512&times;512).
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{brandingLogoUrl ? 'Change Logo Image' : 'Select Logo Image'}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>

              {/* Scope & Placement Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-[#0F172A]">Admin Navigation</div>
                  <div className="text-[10px] text-[#7C8A9A]">
                    Replaces generic icon in sidebar & mobile drawer with crisp custom branding.
                  </div>
                </div>

                <div className="p-3.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-[#0F172A]">PDF Fee Reports</div>
                  <div className="text-[10px] text-[#7C8A9A]">
                    Automatically embedded in official report headers and student statements.
                  </div>
                </div>

                <div className="p-3.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-[#0F172A]">Payment Receipts</div>
                  <div className="text-[10px] text-[#7C8A9A]">
                    Crisp branding on official receipt screens and printable A4 parent vouchers.
                  </div>
                </div>
              </div>

              {/* Security & Restrictions Notice */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-3 text-amber-900 text-[11px]">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">Security & Quality Guidelines:</span>
                  <p className="text-amber-800 leading-relaxed">
                    SVGs are strictly prohibited to protect against malicious scripts. Uploaded files undergo server-side format verification, decompression bomb checks, and WebP optimization.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Remove Confirmation Dialog Modal */}
          {showRemoveConfirm && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
              <div className="bg-white rounded-2xl border border-[#E7E9EE] max-w-md w-full p-6 shadow-xl space-y-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#0F172A]">Remove Institutional Logo?</h3>
                  <p className="text-xs text-[#7C8A9A] leading-relaxed">
                    This will delete your logo from storage and revert your sidebar, PDF reports, and receipts to deterministic initials and text-only headers.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(false)}
                    disabled={isRemovingLogo}
                    className="px-4 py-2 bg-[#F7F6F1] hover:bg-[#E7E9EE] text-[#0F172A] font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isRemovingLogo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                  >
                    {isRemovingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Confirm Removal</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Automatic Notifications */}
      {activeTab === 'notifications' && <NotificationSettingsTab />}

      {/* TAB 6: Sender Email Settings */}
      {activeTab === 'email-sender' && <EmailSenderSettingsTab />}

      {/* TAB 7: Date & Time Settings */}
      {activeTab === 'datetime' && (
        <DateTimeSettingsTab
          settingsData={settingsData}
          onSettingsUpdated={(updated) => setSettingsData(updated)}
        />
      )}
    </div>
  );
}
