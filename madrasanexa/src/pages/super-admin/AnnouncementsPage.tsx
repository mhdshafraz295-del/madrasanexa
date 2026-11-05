import { useState, useEffect, useCallback, useRef } from 'react';
import {
  announcementService,
  type SuperAdminAnnouncementItem,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementAudience,
} from '../../services/announcement.service';
import { apiListMadrasas, type MadrasaListItem } from '../../services/api';
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Archive,
  FileEdit,
  AlertTriangle,
  Eye,
  Send,
  Building2,
  X,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<SuperAdminAnnouncementItem[]>([]);
  const [counts, setCounts] = useState({ total: 0, published: 0, draft: 0, archived: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [targetPublishId, setTargetPublishId] = useState<string | null>(null);
  const [publishScheduleDate, setPublishScheduleDate] = useState('');
  const [publishExpiryDate, setPublishExpiryDate] = useState('');
  const [isReadsDrawerOpen, setIsReadsDrawerOpen] = useState(false);
  const [selectedAnnouncementDetail, setSelectedAnnouncementDetail] =
    useState<SuperAdminAnnouncementItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formCategory, setFormCategory] = useState<AnnouncementCategory>('GENERAL');
  const [formPriority, setFormPriority] = useState<AnnouncementPriority>('NORMAL');
  const [formAudience, setFormAudience] = useState<AnnouncementAudience>('ALL_MADRASAS');
  const [formPublishAt, setFormPublishAt] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [selectedMadrasaIds, setSelectedMadrasaIds] = useState<string[]>([]);

  // Madrasas for multi-select
  const [availableMadrasas, setAvailableMadrasas] = useState<MadrasaListItem[]>([]);
  const [madrasaSearch, setMadrasaSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

  // Load active madrasas once for targeted selection
  useEffect(() => {
    apiListMadrasas({ pageSize: 100, status: 'ACTIVE' })
      .then((res) => setAvailableMadrasas(res.madrasas))
      .catch((err) => console.error('Failed to load madrasas:', err));
  }, []);

  // Fetch announcements list
  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await announcementService.listSuperAdminAnnouncements({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: statusFilter,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        audience: audienceFilter || undefined,
      });
      setAnnouncements(data.announcements);
      setCounts(data.counts);
      setPagination(data.pagination);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to load announcements.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, statusFilter, categoryFilter, priorityFilter, audienceFilter]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormMessage('');
    setFormCategory('GENERAL');
    setFormPriority('NORMAL');
    setFormAudience('ALL_MADRASAS');
    setFormPublishAt('');
    setFormExpiresAt('');
    setSelectedMadrasaIds([]);
    setErrorMessage('');
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = async (item: SuperAdminAnnouncementItem) => {
    try {
      setIsLoading(true);
      const full = await announcementService.getSuperAdminAnnouncement(item.id);
      setEditingId(full.id);
      setFormTitle(full.title);
      setFormMessage(full.message);
      setFormCategory(full.category);
      setFormPriority(full.priority);
      setFormAudience(full.audience);
      setFormPublishAt(full.publishAt ? full.publishAt.substring(0, 16) : '');
      setFormExpiresAt(full.expiresAt ? full.expiresAt.substring(0, 16) : '');
      setSelectedMadrasaIds(full.targets.map((t) => t.madrasaId));
      setErrorMessage('');
      setIsFormOpen(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to fetch details for editing.');
    } finally {
      setIsLoading(false);
    }
  };

  // Save Draft (or Update)
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMessage('Title is required.');
      return;
    }
    if (!formMessage.trim()) {
      setErrorMessage('Message is required.');
      return;
    }
    if (formAudience === 'SELECTED_MADRASAS' && selectedMadrasaIds.length === 0) {
      setErrorMessage('Please select at least one target Madrasa.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        title: formTitle.trim(),
        message: formMessage.trim(),
        category: formCategory,
        priority: formPriority,
        audience: formAudience,
        publishAt: formPublishAt ? new Date(formPublishAt).toISOString() : null,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        selectedMadrasaIds: formAudience === 'SELECTED_MADRASAS' ? selectedMadrasaIds : [],
      };

      if (editingId) {
        await announcementService.updateAnnouncement(editingId, payload);
        setSuccessMessage('Announcement draft updated successfully.');
      } else {
        await announcementService.createAnnouncement(payload);
        setSuccessMessage('Announcement draft saved successfully.');
      }

      setIsFormOpen(false);
      loadAnnouncements();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to save announcement draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Publish Modal
  const handleOpenPublishModal = (id: string, existingPublishAt?: string | null, existingExpiresAt?: string | null) => {
    setTargetPublishId(id);
    setPublishScheduleDate(existingPublishAt ? existingPublishAt.substring(0, 16) : '');
    setPublishExpiryDate(existingExpiresAt ? existingExpiresAt.substring(0, 16) : '');
    setIsPublishModalOpen(true);
  };

  // Confirm Publish
  const handleConfirmPublish = async () => {
    if (!targetPublishId) return;
    setIsSubmitting(true);
    try {
      const payload = {
        publishAt: publishScheduleDate ? new Date(publishScheduleDate).toISOString() : null,
        expiresAt: publishExpiryDate ? new Date(publishExpiryDate).toISOString() : null,
      };

      await announcementService.publishAnnouncement(targetPublishId, payload);
      setSuccessMessage('Announcement published successfully.');
      setIsPublishModalOpen(false);
      setTargetPublishId(null);
      loadAnnouncements();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to publish announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Archive
  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this announcement? It will be removed from active Madrasa Admin feeds.')) return;
    try {
      await announcementService.archiveAnnouncement(id);
      setSuccessMessage('Announcement archived.');
      loadAnnouncements();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to archive announcement.');
    }
  };

  // Unpublish
  const handleUnpublish = async (id: string) => {
    if (!confirm('Unpublish this announcement and return it to draft?')) return;
    try {
      await announcementService.unpublishAnnouncement(id);
      setSuccessMessage('Announcement returned to draft.');
      loadAnnouncements();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to unpublish announcement.');
    }
  };

  // View Reads Details
  const handleViewReads = async (id: string) => {
    try {
      const detail = await announcementService.getSuperAdminAnnouncement(id);
      setSelectedAnnouncementDetail(detail);
      setIsReadsDrawerOpen(true);
    } catch (err: any) {
      setErrorMessage('Failed to load read statistics.');
    }
  };

  // Handle Preview from Form
  const handlePreviewFromForm = () => {
    setPreviewData({
      title: formTitle.trim() || 'Untitled Announcement',
      message: formMessage.trim() || 'No message content provided yet.',
      category: formCategory,
      priority: formPriority,
      audience: formAudience,
      publishAt: formPublishAt ? new Date(formPublishAt).toISOString() : null,
      expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
    });
    setIsPreviewOpen(true);
  };

  // Madrasa toggle helpers
  const handleToggleMadrasa = (mId: string) => {
    setSelectedMadrasaIds((prev) =>
      prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId]
    );
  };

  const handleSelectAllMadrasas = () => {
    const filteredIds = availableMadrasas
      .filter((m) =>
        m.name.toLowerCase().includes(madrasaSearch.toLowerCase()) ||
        m.code.toLowerCase().includes(madrasaSearch.toLowerCase())
      )
      .map((m) => m.id);
    setSelectedMadrasaIds((prev) => [...new Set([...prev, ...filteredIds])]);
  };

  const handleDeselectAllMadrasas = () => {
    setSelectedMadrasaIds([]);
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

  // Status badge styling
  const renderStatusBadge = (item: SuperAdminAnnouncementItem) => {
    if (item.status === 'ARCHIVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
          <Archive className="w-3 h-3" />
          Archived
        </span>
      );
    }
    if (item.status === 'DRAFT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <FileEdit className="w-3 h-3" />
          Draft
        </span>
      );
    }
    if (item.isScheduled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Clock className="w-3 h-3" />
          Scheduled
        </span>
      );
    }
    if (item.isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Published
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7C8A9A] uppercase tracking-wider">
            <Megaphone className="w-4 h-4 text-[#37C6A3]" />
            Platform Communication
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Announcement Center</h1>
          <p className="text-xs text-[#7C8A9A] mt-0.5">
            Create, schedule, target, and broadcast in-app communications to Madrasa Administrators.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-[#37C6A3]" />
          Create Announcement
        </button>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-rose-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="p-1 hover:bg-emerald-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="text-[11px] font-bold text-[#7C8A9A] uppercase tracking-wider">Total</div>
          <div className="text-2xl font-black text-[#0F172A] mt-1">{counts.total}</div>
          <div className="text-[10px] text-[#7C8A9A] mt-0.5">Platform announcements</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Published</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{counts.published}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Active / Scheduled broadcast</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Drafts</div>
          <div className="text-2xl font-black text-blue-900 mt-1">{counts.draft}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Unpublished working copies</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs">
          <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Archived</div>
          <div className="text-2xl font-black text-gray-800 mt-1">{counts.archived}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Historical records retained</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title or message content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium text-[#0F172A] placeholder-[#7C8A9A] focus:outline-hidden focus:border-[#0F172A]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Category Filter */}
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

          {/* Priority Filter */}
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

          {/* Audience Filter */}
          <select
            value={audienceFilter}
            onChange={(e) => {
              setAudienceFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-hidden"
          >
            <option value="">All Audiences</option>
            <option value="ALL_MADRASAS">All Madrasas</option>
            <option value="SELECTED_MADRASAS">Selected Madrasas</option>
          </select>
        </div>
      </div>

      {/* Announcements Table / Cards */}
      <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-medium text-[#7C8A9A] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0F172A]" />
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-10 h-10 text-[#7C8A9A]/40 mx-auto mb-3" />
            <div className="text-sm font-bold text-[#0F172A]">No announcements found</div>
            <p className="text-xs text-[#7C8A9A] mt-1 max-w-sm mx-auto">
              No matching announcements were found for the selected filters. Create a new announcement or adjust your search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F6F1] border-b border-[#E7E9EE] text-[10px] font-bold uppercase tracking-wider text-[#7C8A9A]">
                  <th className="py-3 px-4">Title & Message</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Audience</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timing</th>
                  <th className="py-3 px-4 text-center">Reads</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-xs">
                {announcements.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F7F6F1]/50 transition">
                    {/* Title & Preview */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-sm">
                      <div className="font-bold text-[#0F172A] line-clamp-1">{item.title}</div>
                      <div className="text-[11px] text-[#7C8A9A] line-clamp-1 mt-0.5">
                        {item.message}
                      </div>
                      <span className="inline-block mt-1 text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {item.category}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4 whitespace-nowrap">{renderPriorityBadge(item.priority)}</td>

                    {/* Audience */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.audience === 'ALL_MADRASAS' ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Users className="w-3.5 h-3.5 text-[#37C6A3]" />
                          <span className="font-semibold">All Madrasas</span>
                          <span className="text-[10px] text-[#7C8A9A]">({item.targetMadrasaCount})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-blue-700">
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          <span className="font-semibold">Selected</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full">
                            {item.targetMadrasaCount}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">{renderStatusBadge(item)}</td>

                    {/* Timing */}
                    <td className="py-3 px-4 whitespace-nowrap text-[11px] text-[#7C8A9A]">
                      {item.publishAt ? (
                        <div>
                          <span className="font-medium text-[#0F172A]">Pub:</span>{' '}
                          {new Date(item.publishAt).toLocaleDateString()}{' '}
                          {new Date(item.publishAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : item.publishedAt ? (
                        <div>
                          <span className="font-medium text-[#0F172A]">Pub:</span>{' '}
                          {new Date(item.publishedAt).toLocaleDateString()}
                        </div>
                      ) : (
                        <div>Draft (unscheduled)</div>
                      )}
                      {item.expiresAt && (
                        <div className="text-[10px] text-orange-700 mt-0.5">
                          Exp: {new Date(item.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    {/* Read Count */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewReads(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0F172A] hover:text-[#37C6A3] transition cursor-pointer"
                        title="View read details"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#7C8A9A]" />
                        <span>{item.readCount}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap text-right space-x-1">
                      {item.status !== 'ARCHIVED' && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit draft"
                          >
                            Edit
                          </button>

                          {item.status === 'DRAFT' ? (
                            <button
                              onClick={() => handleOpenPublishModal(item.id, item.publishAt, item.expiresAt)}
                              className="px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Publish announcement"
                            >
                              Publish
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnpublish(item.id)}
                              className="px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Unpublish back to draft"
                            >
                              Unpublish
                            </button>
                          )}

                          <button
                            onClick={() => handleArchive(item.id)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Archive announcement"
                          >
                            Archive
                          </button>
                        </>
                      )}

                      {item.status === 'ARCHIVED' && (
                        <span className="text-[11px] text-[#7C8A9A] italic px-2">Archived (Read-Only)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-[#E7E9EE] flex items-center justify-between text-xs">
            <div className="text-[#7C8A9A]">
              Showing page <span className="font-bold text-[#0F172A]">{pagination.page}</span> of{' '}
              <span className="font-bold text-[#0F172A]">{pagination.totalPages}</span> ({pagination.total} total)
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
          CREATE / EDIT MODAL
          ======================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E7E9EE] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-[#37C6A3] flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    {editingId ? 'Edit Announcement Draft' : 'Create New Announcement'}
                  </h3>
                  <p className="text-[11px] text-[#7C8A9A]">
                    Saves strictly as a Draft. Publish separately when ready.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveDraft} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={255}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Scheduled System Maintenance Window"
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-hidden focus:border-[#0F172A]"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Message (Plain Structured Text) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  maxLength={10000}
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Enter the announcement message. Plain text only. HTML tags are not permitted."
                  className="w-full px-3.5 py-2.5 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-hidden focus:border-[#0F172A] whitespace-pre-wrap font-sans"
                />
                <div className="text-[10px] text-[#7C8A9A] text-right mt-1">
                  {formMessage.length} / 10,000 characters
                </div>
              </div>

              {/* Category & Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as AnnouncementCategory)}
                    className="w-full px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-hidden"
                  >
                    <option value="GENERAL">General</option>
                    <option value="SYSTEM">System</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="UPDATE">Platform Update</option>
                    <option value="BILLING">Billing</option>
                    <option value="EVENT">Event</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as AnnouncementPriority)}
                    className="w-full px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-hidden"
                  >
                    <option value="NORMAL">Normal (Neutral)</option>
                    <option value="IMPORTANT">Important (Gold Indicator)</option>
                    <option value="URGENT">Urgent (Red Warning)</option>
                  </select>
                </div>
              </div>

              {/* Audience Choice */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">Target Audience</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormAudience('ALL_MADRASAS')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      formAudience === 'ALL_MADRASAS'
                        ? 'border-[#0F172A] bg-[#0F172A]/5 text-[#0F172A] font-bold'
                        : 'border-[#E7E9EE] text-[#7C8A9A] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="w-4 h-4 text-[#37C6A3]" />
                      <span>All Madrasas</span>
                    </div>
                    <div className="text-[10px] text-[#7C8A9A] font-normal mt-1">
                      Broadcast to every institution platform-wide
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormAudience('SELECTED_MADRASAS')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      formAudience === 'SELECTED_MADRASAS'
                        ? 'border-[#0F172A] bg-[#0F172A]/5 text-[#0F172A] font-bold'
                        : 'border-[#E7E9EE] text-[#7C8A9A] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <span>Selected Madrasas</span>
                    </div>
                    <div className="text-[10px] text-[#7C8A9A] font-normal mt-1">
                      Target specific institutions only
                    </div>
                  </button>
                </div>
              </div>

              {/* Selected Madrasas Multi-Select Picker */}
              {formAudience === 'SELECTED_MADRASAS' && (
                <div className="p-3.5 bg-[#F7F6F1] rounded-xl border border-[#E7E9EE] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">
                      Select Target Madrasas ({selectedMadrasaIds.length} selected)
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAllMadrasas}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">•</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllMadrasas}
                        className="text-gray-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Madrasa Search */}
                  <input
                    type="text"
                    placeholder="Search by madrasa name or code..."
                    value={madrasaSearch}
                    onChange={(e) => setMadrasaSearch(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#E7E9EE] rounded-lg text-xs"
                  />

                  {/* Scrollable list */}
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-[#E7E9EE]">
                    {availableMadrasas
                      .filter((m) =>
                        m.name.toLowerCase().includes(madrasaSearch.toLowerCase()) ||
                        m.code.toLowerCase().includes(madrasaSearch.toLowerCase())
                      )
                      .map((m) => {
                        const isChecked = selectedMadrasaIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center gap-2.5 p-1.5 hover:bg-[#F7F6F1] rounded-md text-xs cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleMadrasa(m.id)}
                              className="rounded text-[#0F172A] focus:ring-0"
                            />
                            <span className="font-semibold text-[#0F172A]">{m.name}</span>
                            <span className="text-[10px] font-mono text-[#7C8A9A]">({m.code})</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Optional Scheduling Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E7E9EE]">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Scheduled Publish Date/Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formPublishAt}
                    onChange={(e) => setFormPublishAt(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-[#7C8A9A] mt-0.5 block">
                    Leave blank to publish immediately upon clicking Publish.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1">
                    Expiry Date/Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs font-medium text-[#0F172A] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-[#7C8A9A] mt-0.5 block">
                    Automatic request-time expiration.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#E7E9EE] flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handlePreviewFromForm}
                  className="px-4 py-2 border border-[#E7E9EE] hover:bg-[#F7F6F1] text-[#0F172A] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-[#E7E9EE] hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Draft
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          PUBLISH MODAL (Confirmation + Optional Schedule Timing)
          ======================================================== */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Publish Announcement</h3>
                <p className="text-[11px] text-[#7C8A9A]">Confirm broadcast or set scheduling timing.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Publish At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={publishScheduleDate}
                  onChange={(e) => setPublishScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs"
                />
                <span className="text-[10px] text-[#7C8A9A] block mt-0.5">
                  Leave empty to publish immediately.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={publishExpiryDate}
                  onChange={(e) => setPublishExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E9EE] flex items-center justify-end gap-2">
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="px-4 py-2 border border-[#E7E9EE] text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPublish}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm & Broadcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PREVIEW MODAL (Exact Tenant Presentation)
          ======================================================== */}
      {isPreviewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#7C8A9A]">
                Tenant View Simulation
              </span>
              <button onClick={() => setIsPreviewOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {renderPriorityBadge(previewData.priority)}
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  {previewData.category}
                </span>
                <span className="text-[10px] text-[#7C8A9A] ml-auto">
                  {previewData.publishAt
                    ? `Scheduled for: ${new Date(previewData.publishAt).toLocaleString()}`
                    : 'Broadcast: Immediate'}
                </span>
              </div>

              <h2 className="text-lg font-bold text-[#0F172A]">{previewData.title}</h2>
              <div className="p-4 bg-[#F7F6F1] rounded-xl text-xs text-[#0F172A] whitespace-pre-wrap font-sans leading-relaxed border border-[#E7E9EE]">
                {previewData.message}
              </div>

              {previewData.expiresAt && (
                <div className="text-[10px] text-orange-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Expires on: {new Date(previewData.expiresAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E7E9EE] flex justify-end">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          READS DRAWER (Distinct Read Statistics)
          ======================================================== */}
      {isReadsDrawerOpen && selectedAnnouncementDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E7E9EE] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Read Receipts</h3>
                  <p className="text-[11px] text-[#7C8A9A]">
                    {selectedAnnouncementDetail.readCount} distinct administrators have opened this notice.
                  </p>
                </div>
                <button
                  onClick={() => setIsReadsDrawerOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-[#F7F6F1] rounded-xl text-xs space-y-1">
                <div className="font-bold text-[#0F172A]">{selectedAnnouncementDetail.title}</div>
                <div className="text-[11px] text-[#7C8A9A]">
                  Target Institutions: {selectedAnnouncementDetail.targetMadrasaCount}
                </div>
              </div>

              {/* Read list */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Readers Log ({selectedAnnouncementDetail.reads?.length || 0})
                </div>

                {!selectedAnnouncementDetail.reads || selectedAnnouncementDetail.reads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#7C8A9A] bg-slate-50 rounded-xl">
                    No administrators have opened this notice yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E7E9EE] border border-[#E7E9EE] rounded-xl overflow-hidden">
                    {selectedAnnouncementDetail.reads.map((r) => (
                      <div key={r.userId + r.readAt} className="p-3 bg-white text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#0F172A]">{r.userName || 'Administrator'}</div>
                          <div className="text-[11px] text-[#7C8A9A]">{r.madrasaName || 'Institution'}</div>
                        </div>
                        <div className="text-[10px] text-[#7C8A9A] font-mono text-right">
                          {new Date(r.readAt).toLocaleDateString()}
                          <div>{new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E7E9EE]">
              <button
                onClick={() => setIsReadsDrawerOpen(false)}
                className="w-full py-2.5 bg-[#F7F6F1] hover:bg-slate-200 text-[#0F172A] rounded-xl text-xs font-bold cursor-pointer"
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
