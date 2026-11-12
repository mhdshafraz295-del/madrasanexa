import { useState, useEffect, useCallback } from 'react';
import {
  apiListClasses,
  apiCreateClass,
  apiUpdateClass,
  apiActivateClass,
  apiDeactivateClass,
  apiListAcademicSections,
  apiCreateAcademicSection,
  apiUpdateAcademicSection,
  apiActivateAcademicSection,
  apiDeactivateAcademicSection,
  type ClassItem,
  type AcademicSectionItem,
} from '../../services/api';
import {
  BookOpen,
  Layers,
  Plus,
  Search,
  Users,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function ClassesPage() {
  const [activeTab, setActiveTab] = useState<'CLASSES' | 'SECTIONS'>('CLASSES');

  // ==========================================
  // CLASSES STATE
  // ==========================================
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);
  const [classPage, setClassPage] = useState(1);
  const [classPageSize] = useState(10);
  const [classTotalPages, setClassTotalPages] = useState(1);
  const [classSearch, setClassSearch] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [classSectionFilter, setClassSectionFilter] = useState<string>('ALL');
  const [isClassesLoading, setIsClassesLoading] = useState(true);
  const [classError, setClassError] = useState<string | null>(null);

  // Class Modal states
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [classModalForm, setClassModalForm] = useState({
    academicSectionId: '',
    name: '',
    code: '',
    description: '',
    defaultMonthlyFee: '',
  });
  const [classModalError, setClassModalError] = useState<string | null>(null);
  const [isClassSubmitting, setIsClassSubmitting] = useState(false);

  // Confirm Status Toggle for Class
  const [confirmToggleClass, setConfirmToggleClass] = useState<ClassItem | null>(null);
  const [isTogglingClass, setIsTogglingClass] = useState(false);

  // ==========================================
  // ACADEMIC SECTIONS STATE
  // ==========================================
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [activeSectionsList, setActiveSectionsList] = useState<AcademicSectionItem[]>([]);
  const [totalSections, setTotalSections] = useState(0);
  const [sectionPage, setSectionPage] = useState(1);
  const [sectionPageSize] = useState(10);
  const [sectionTotalPages, setSectionTotalPages] = useState(1);
  const [sectionSearch, setSectionSearch] = useState('');
  const [sectionStatusFilter, setSectionStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isSectionsLoading, setIsSectionsLoading] = useState(true);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Section Modal states
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<AcademicSectionItem | null>(null);
  const [sectionModalForm, setSectionModalForm] = useState({
    name: '',
    code: '',
    description: '',
    sortOrder: '0',
  });
  const [sectionModalError, setSectionModalError] = useState<string | null>(null);
  const [isSectionSubmitting, setIsSectionSubmitting] = useState(false);

  // Confirm Status Toggle for Section
  const [confirmToggleSection, setConfirmToggleSection] = useState<AcademicSectionItem | null>(null);
  const [isTogglingSection, setIsTogglingSection] = useState(false);

  // Load Active Sections for dropdown selection
  const fetchActiveSectionsForDropdown = useCallback(async () => {
    try {
      const data = await apiListAcademicSections({
        pageSize: 100,
        status: 'ACTIVE',
        isActive: true,
      });
      setActiveSectionsList(data.items || data.sections || []);
    } catch (err) {
      console.error('Failed to load active academic sections:', err);
    }
  }, []);

  useEffect(() => {
    fetchActiveSectionsForDropdown();
  }, [fetchActiveSectionsForDropdown]);

  // Fetch Classes
  const fetchClasses = useCallback(async () => {
    try {
      setIsClassesLoading(true);
      setClassError(null);
      const data = await apiListClasses({
        page: classPage,
        pageSize: classPageSize,
        search: classSearch.trim() || undefined,
        status: classStatusFilter === 'ALL' ? undefined : classStatusFilter,
        academicSectionId: classSectionFilter === 'ALL' ? undefined : classSectionFilter,
      });
      setClasses(data.classes || data.items || []);
      setTotalClasses(data.total);
      setClassTotalPages(data.totalPages);
    } catch (err: any) {
      console.error('Failed to load classes:', err);
      setClassError(err.response?.data?.message || 'Failed to load classes. Please try again.');
    } finally {
      setIsClassesLoading(false);
    }
  }, [classPage, classPageSize, classSearch, classStatusFilter, classSectionFilter]);

  useEffect(() => {
    if (activeTab === 'CLASSES') {
      fetchClasses();
    }
  }, [activeTab, fetchClasses]);

  // Fetch Academic Sections
  const fetchSections = useCallback(async () => {
    try {
      setIsSectionsLoading(true);
      setSectionError(null);
      const data = await apiListAcademicSections({
        page: sectionPage,
        pageSize: sectionPageSize,
        search: sectionSearch.trim() || undefined,
        status: sectionStatusFilter === 'ALL' ? undefined : sectionStatusFilter,
      });
      setSections(data.items || data.sections || []);
      setTotalSections(data.total);
      setSectionTotalPages(data.totalPages);
    } catch (err: any) {
      console.error('Failed to load academic sections:', err);
      setSectionError(err.response?.data?.message || 'Failed to load academic sections. Please try again.');
    } finally {
      setIsSectionsLoading(false);
    }
  }, [sectionPage, sectionPageSize, sectionSearch, sectionStatusFilter]);

  useEffect(() => {
    if (activeTab === 'SECTIONS') {
      fetchSections();
    }
  }, [activeTab, fetchSections]);

  // ==========================================
  // CLASS HANDLERS
  // ==========================================
  const handleOpenCreateClassModal = () => {
    setEditingClass(null);
    setClassModalForm({
      academicSectionId: activeSectionsList.length > 0 ? activeSectionsList[0].id : '',
      name: '',
      code: '',
      description: '',
      defaultMonthlyFee: '',
    });
    setClassModalError(null);
    setIsClassModalOpen(true);
  };

  const handleOpenEditClassModal = (c: ClassItem) => {
    setEditingClass(c);
    setClassModalForm({
      academicSectionId: c.academicSectionId || '',
      name: c.name,
      code: c.code || '',
      description: c.description || '',
      defaultMonthlyFee: c.defaultMonthlyFee,
    });
    setClassModalError(null);
    setIsClassModalOpen(true);
  };

  const handleClassModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classModalForm.name.trim() || !classModalForm.code.trim() || classModalForm.defaultMonthlyFee === '') {
      setClassModalError('Please fill in all required fields.');
      return;
    }

    if (!editingClass && !classModalForm.academicSectionId) {
      setClassModalError('Please select an Academic Section. Classes must belong to an academic section.');
      return;
    }

    const feeNum = parseFloat(classModalForm.defaultMonthlyFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setClassModalError('Default monthly fee must be a valid non-negative number.');
      return;
    }

    try {
      setIsClassSubmitting(true);
      setClassModalError(null);

      if (editingClass) {
        await apiUpdateClass(editingClass.id, {
          academicSectionId: classModalForm.academicSectionId || undefined,
          name: classModalForm.name.trim(),
          code: classModalForm.code.trim().toUpperCase(),
          description: classModalForm.description.trim() || null,
          defaultMonthlyFee: feeNum,
        });
      } else {
        await apiCreateClass({
          academicSectionId: classModalForm.academicSectionId,
          name: classModalForm.name.trim(),
          code: classModalForm.code.trim().toUpperCase(),
          description: classModalForm.description.trim() || null,
          defaultMonthlyFee: feeNum,
        });
      }

      setIsClassModalOpen(false);
      fetchClasses();
      fetchActiveSectionsForDropdown();
    } catch (err: any) {
      console.error('Failed to save class:', err);
      setClassModalError(err.response?.data?.message || 'Failed to save class details. Please verify name & code uniqueness.');
    } finally {
      setIsClassSubmitting(false);
    }
  };

  const handleToggleClassStatus = async () => {
    if (!confirmToggleClass) return;

    try {
      setIsTogglingClass(true);
      if (confirmToggleClass.status === 'ACTIVE') {
        await apiDeactivateClass(confirmToggleClass.id);
      } else {
        await apiActivateClass(confirmToggleClass.id);
      }
      setConfirmToggleClass(null);
      fetchClasses();
    } catch (err: any) {
      console.error('Failed to toggle class status:', err);
      alert(err.response?.data?.message || 'Failed to update class status.');
    } finally {
      setIsTogglingClass(false);
    }
  };

  // ==========================================
  // SECTION HANDLERS
  // ==========================================
  const handleOpenCreateSectionModal = () => {
    setEditingSection(null);
    setSectionModalForm({
      name: '',
      code: '',
      description: '',
      sortOrder: '0',
    });
    setSectionModalError(null);
    setIsSectionModalOpen(true);
  };

  const handleOpenEditSectionModal = (sec: AcademicSectionItem) => {
    setEditingSection(sec);
    setSectionModalForm({
      name: sec.name,
      code: sec.code || '',
      description: sec.description || '',
      sortOrder: String(sec.sortOrder ?? 0),
    });
    setSectionModalError(null);
    setIsSectionModalOpen(true);
  };

  const handleSectionModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionModalForm.name.trim() || !sectionModalForm.code.trim()) {
      setSectionModalError('Section Name and Code are required.');
      return;
    }

    const sortOrderNum = parseInt(sectionModalForm.sortOrder, 10);
    if (isNaN(sortOrderNum)) {
      setSectionModalError('Sort order must be an integer.');
      return;
    }

    try {
      setIsSectionSubmitting(true);
      setSectionModalError(null);

      if (editingSection) {
        await apiUpdateAcademicSection(editingSection.id, {
          name: sectionModalForm.name.trim(),
          code: sectionModalForm.code.trim().toUpperCase() || null,
          description: sectionModalForm.description.trim() || null,
          sortOrder: sortOrderNum,
        });
      } else {
        await apiCreateAcademicSection({
          name: sectionModalForm.name.trim(),
          code: sectionModalForm.code.trim().toUpperCase(),
          description: sectionModalForm.description.trim() || null,
          sortOrder: sortOrderNum,
        });
      }

      setIsSectionModalOpen(false);
      fetchSections();
      fetchActiveSectionsForDropdown();
    } catch (err: any) {
      console.error('Failed to save academic section:', err);
      setSectionModalError(err.response?.data?.message || 'Failed to save academic section. Please verify code/name uniqueness.');
    } finally {
      setIsSectionSubmitting(false);
    }
  };

  const handleToggleSectionStatus = async () => {
    if (!confirmToggleSection) return;

    try {
      setIsTogglingSection(true);
      if (confirmToggleSection.status === 'ACTIVE') {
        await apiDeactivateAcademicSection(confirmToggleSection.id);
      } else {
        await apiActivateAcademicSection(confirmToggleSection.id);
      }
      setConfirmToggleSection(null);
      fetchSections();
      fetchActiveSectionsForDropdown();
    } catch (err: any) {
      console.error('Failed to toggle section status:', err);
      alert(err.response?.data?.message || 'Failed to update section status.');
    } finally {
      setIsTogglingSection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">Academic Structure</h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-1">
            Configure dynamic academic divisions (e.g. Hifz, Kitab) and manage class batches with base tuition rates.
          </p>
        </div>

        {activeTab === 'CLASSES' ? (
          <button
            onClick={handleOpenCreateClassModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#37C6A3] hover:bg-[#30b594] text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Class</span>
          </button>
        ) : (
          <button
            onClick={handleOpenCreateSectionModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#08483A] hover:bg-[#06382d] text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Academic Section</span>
          </button>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E7E9EE] pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('CLASSES')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'CLASSES'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#37C6A3]" />
          <span>Classes ({totalClasses})</span>
        </button>

        <button
          onClick={() => setActiveTab('SECTIONS')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'SECTIONS'
              ? 'text-[#08483A] border-[#08483A] bg-white shadow-xs'
              : 'text-[#5B6B7F] border-transparent hover:text-[#0F172A]'
          }`}
        >
          <Layers className="w-4 h-4 text-[#08483A]" />
          <span>Academic Sections ({totalSections || activeSectionsList.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CLASSES */}
      {/* ========================================================================= */}
      {activeTab === 'CLASSES' && (
        <div className="space-y-6">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8A9A]" />
              <input
                type="text"
                value={classSearch}
                onChange={(e) => {
                  setClassSearch(e.target.value);
                  setClassPage(1);
                }}
                placeholder="Search classes by name or code..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white transition"
              />
            </div>

            {/* Filters Group */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Section Filter Dropdown */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-[#7C8A9A]" />
                <select
                  value={classSectionFilter}
                  onChange={(e) => {
                    setClassSectionFilter(e.target.value);
                    setClassPage(1);
                  }}
                  className="px-3 py-1.5 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
                >
                  <option value="ALL">All Sections</option>
                  {activeSectionsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                  <option value="UNASSIGNED">Unassigned Section (Legacy)</option>
                </select>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#F7F6F1] p-1 rounded-xl border border-[#E7E9EE] w-full sm:w-auto justify-center sm:justify-start">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setClassStatusFilter(st);
                      setClassPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      classStatusFilter === st
                        ? 'bg-white text-[#0F172A] shadow-xs'
                        : 'text-[#7C8A9A] hover:text-[#0F172A]'
                    }`}
                  >
                    {st === 'ALL' ? 'All Classes' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Classes Main Content */}
          {isClassesLoading ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 flex flex-col items-center justify-center text-[#7C8A9A]">
              <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
              <p className="text-xs font-medium">Loading classes...</p>
            </div>
          ) : classError ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="text-xs text-rose-700 font-medium">{classError}</p>
              <button
                onClick={fetchClasses}
                className="mt-3 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-semibold rounded-lg hover:bg-[#0F172A]/90 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 text-center">
              <BookOpen className="w-12 h-12 text-[#7C8A9A]/40 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#0F172A]">No Classes Found</h3>
              <p className="text-xs text-[#7C8A9A] mt-1 max-w-sm mx-auto">
                {classSearch || classStatusFilter !== 'ALL' || classSectionFilter !== 'ALL'
                  ? 'No classes match your search and filter criteria.'
                  : 'Create your first class group under an academic section to start enrolling students.'}
              </p>
              {!classSearch && classStatusFilter === 'ALL' && classSectionFilter === 'ALL' && (
                <button
                  onClick={handleOpenCreateClassModal}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#37C6A3] text-white text-xs font-semibold rounded-xl hover:bg-[#30b594] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Class</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E7E9EE] bg-[#F7F6F1]/50 text-[11px] font-bold uppercase tracking-wider text-[#7C8A9A]">
                      <th className="py-3 px-4">Class Details</th>
                      <th className="py-3 px-4">Academic Section</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Default Monthly Fee</th>
                      <th className="py-3 px-4">Enrolled</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE] text-xs">
                    {classes.map((cls) => (
                      <tr key={cls.id} className="hover:bg-[#F7F6F1]/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#0F172A]">{cls.name}</div>
                          {cls.description && (
                            <div className="text-[11px] text-[#7C8A9A] line-clamp-1 mt-0.5">{cls.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {cls.academicSection ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#08483A]/10 text-[#08483A] border border-[#08483A]/20">
                              <Layers className="w-3 h-3" />
                              <span>{cls.academicSection.name}</span>
                              {cls.academicSection.code && (
                                <span className="font-mono opacity-75">({cls.academicSection.code})</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Unassigned (Legacy)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-[11px] font-bold bg-[#E7E9EE] text-[#0F172A] px-2 py-0.5 rounded">
                            {cls.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-[#0F172A]">
                          LKR {cls.defaultMonthlyFee}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1 text-[11px] text-[#0F172A]">
                            <Users className="w-3.5 h-3.5 text-[#7C8A9A]" />
                            <span>{cls.studentCount ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {cls.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditClassModal(cls)}
                              className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition cursor-pointer"
                              title="Edit Class"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmToggleClass(cls)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                cls.status === 'ACTIVE'
                                  ? 'text-[#7C8A9A] hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-[#7C8A9A] hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={cls.status === 'ACTIVE' ? 'Deactivate Class' : 'Activate Class'}
                            >
                              {cls.status === 'ACTIVE' ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-[#E7E9EE]">
                {classes.map((cls) => (
                  <div key={cls.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#0F172A]">{cls.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] font-bold bg-[#E7E9EE] text-[#0F172A] px-1.5 py-0.5 rounded">
                            {cls.code}
                          </span>
                          {cls.academicSection ? (
                            <span className="text-[10px] font-bold bg-[#08483A]/10 text-[#08483A] px-2 py-0.5 rounded-full border border-[#08483A]/20">
                              {cls.academicSection.name}
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-full border border-amber-200">
                              Unassigned
                            </span>
                          )}
                          {cls.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditClassModal(cls)}
                          className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmToggleClass(cls)}
                          className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE]"
                        >
                          {cls.status === 'ACTIVE' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#F7F6F1] p-2.5 rounded-xl">
                      <div>
                        <span className="text-[10px] text-[#7C8A9A] block">Monthly Fee</span>
                        <span className="font-mono font-bold text-[#0F172A]">LKR {cls.defaultMonthlyFee}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7C8A9A] block">Enrolled Students</span>
                        <span className="font-semibold text-[#0F172A]">{cls.studentCount ?? 0}</span>
                      </div>
                    </div>

                    {cls.description && (
                      <p className="text-[11px] text-[#7C8A9A] line-clamp-2">{cls.description}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {classTotalPages > 1 && (
                <div className="p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#7C8A9A]">
                  <div>
                    Showing <span className="font-semibold text-[#0F172A]">{(classPage - 1) * classPageSize + 1}</span> to{' '}
                    <span className="font-semibold text-[#0F172A]">
                      {Math.min(classPage * classPageSize, totalClasses)}
                    </span>{' '}
                    of <span className="font-semibold text-[#0F172A]">{totalClasses}</span> classes
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setClassPage((p) => Math.max(p - 1, 1))}
                      disabled={classPage === 1}
                      className="p-1.5 border border-[#E7E9EE] rounded-lg hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 py-1 text-xs font-semibold text-[#0F172A]">
                      {classPage} / {classTotalPages}
                    </span>
                    <button
                      onClick={() => setClassPage((p) => Math.min(p + 1, classTotalPages))}
                      disabled={classPage === classTotalPages}
                      className="p-1.5 border border-[#E7E9EE] rounded-lg hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACADEMIC SECTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'SECTIONS' && (
        <div className="space-y-6">
          {/* Search and Status Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8A9A]" />
              <input
                type="text"
                value={sectionSearch}
                onChange={(e) => {
                  setSectionSearch(e.target.value);
                  setSectionPage(1);
                }}
                placeholder="Search sections by name or code..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08483A] focus:bg-white transition"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#F7F6F1] p-1 rounded-xl border border-[#E7E9EE] w-full sm:w-auto justify-center sm:justify-start">
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setSectionStatusFilter(st);
                    setSectionPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    sectionStatusFilter === st
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#7C8A9A] hover:text-[#0F172A]'
                  }`}
                >
                  {st === 'ALL' ? 'All Sections' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
          </div>

          {/* Academic Sections Main Content */}
          {isSectionsLoading ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 flex flex-col items-center justify-center text-[#7C8A9A]">
              <Loader2 className="w-8 h-8 animate-spin text-[#08483A] mb-3" />
              <p className="text-xs font-medium">Loading academic sections...</p>
            </div>
          ) : sectionError ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
              <p className="text-xs text-rose-700 font-medium">{sectionError}</p>
              <button
                onClick={fetchSections}
                className="mt-3 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-semibold rounded-lg hover:bg-[#0F172A]/90 transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : sections.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 text-center">
              <Layers className="w-12 h-12 text-[#7C8A9A]/40 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#0F172A]">No Academic Sections Found</h3>
              <p className="text-xs text-[#7C8A9A] mt-1 max-w-sm mx-auto">
                {sectionSearch || sectionStatusFilter !== 'ALL'
                  ? 'No sections match your query criteria.'
                  : 'Define your first academic division (e.g. Hifz, Kitab, Primary, Arabic) to group classes.'}
              </p>
              {!sectionSearch && sectionStatusFilter === 'ALL' && (
                <button
                  onClick={handleOpenCreateSectionModal}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#08483A] text-white text-xs font-semibold rounded-xl hover:bg-[#06382d] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Section</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E7E9EE] bg-[#F7F6F1]/50 text-[11px] font-bold uppercase tracking-wider text-[#7C8A9A]">
                      <th className="py-3 px-4">Section Name</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Sort Order</th>
                      <th className="py-3 px-4">Classes</th>
                      <th className="py-3 px-4">Enrolled Students</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7E9EE] text-xs">
                    {sections.map((sec) => (
                      <tr key={sec.id} className="hover:bg-[#F7F6F1]/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#0F172A]">{sec.name}</div>
                          {sec.description && (
                            <div className="text-[11px] text-[#7C8A9A] line-clamp-1 mt-0.5">{sec.description}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {sec.code ? (
                            <span className="font-mono text-[11px] font-bold bg-[#E7E9EE] text-[#0F172A] px-2 py-0.5 rounded">
                              {sec.code}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#7C8A9A] italic">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#0F172A]">{sec.sortOrder ?? 0}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                            <BookOpen className="w-3.5 h-3.5 text-[#37C6A3]" />
                            {sec.classCount ?? 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                            <Users className="w-3.5 h-3.5 text-[#7C8A9A]" />
                            {sec.studentCount ?? 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {sec.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditSectionModal(sec)}
                              className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition cursor-pointer"
                              title="Edit Section"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmToggleSection(sec)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                sec.status === 'ACTIVE'
                                  ? 'text-[#7C8A9A] hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-[#7C8A9A] hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={sec.status === 'ACTIVE' ? 'Deactivate Section' : 'Activate Section'}
                            >
                              {sec.status === 'ACTIVE' ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-[#E7E9EE]">
                {sections.map((sec) => (
                  <div key={sec.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-[#0F172A]">{sec.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {sec.code && (
                            <span className="font-mono text-[10px] font-bold bg-[#E7E9EE] text-[#0F172A] px-1.5 py-0.5 rounded">
                              {sec.code}
                            </span>
                          )}
                          {sec.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditSectionModal(sec)}
                          className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmToggleSection(sec)}
                          className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE]"
                        >
                          {sec.status === 'ACTIVE' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-[#F7F6F1] p-2.5 rounded-xl">
                      <div>
                        <span className="text-[10px] text-[#7C8A9A] block">Associated Classes</span>
                        <span className="font-bold text-[#0F172A]">{sec.classCount ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#7C8A9A] block">Enrolled Students</span>
                        <span className="font-bold text-[#0F172A]">{sec.studentCount ?? 0}</span>
                      </div>
                    </div>

                    {sec.description && (
                      <p className="text-[11px] text-[#7C8A9A] line-clamp-2">{sec.description}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {sectionTotalPages > 1 && (
                <div className="p-4 border-t border-[#E7E9EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#7C8A9A]">
                  <div>
                    Showing <span className="font-semibold text-[#0F172A]">{(sectionPage - 1) * sectionPageSize + 1}</span> to{' '}
                    <span className="font-semibold text-[#0F172A]">
                      {Math.min(sectionPage * sectionPageSize, totalSections)}
                    </span>{' '}
                    of <span className="font-semibold text-[#0F172A]">{totalSections}</span> sections
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSectionPage((p) => Math.max(p - 1, 1))}
                      disabled={sectionPage === 1}
                      className="p-1.5 border border-[#E7E9EE] rounded-lg hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2.5 py-1 text-xs font-semibold text-[#0F172A]">
                      {sectionPage} / {sectionTotalPages}
                    </span>
                    <button
                      onClick={() => setSectionPage((p) => Math.min(p + 1, sectionTotalPages))}
                      disabled={sectionPage === sectionTotalPages}
                      className="p-1.5 border border-[#E7E9EE] rounded-lg hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT CLASS */}
      {/* ========================================================================= */}
      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E7E9EE] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#37C6A3]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {editingClass ? 'Edit Class Details' : 'Create New Class'}
                </h3>
              </div>
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="text-[#7C8A9A] hover:text-[#0F172A] p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClassModalSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {classModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{classModalError}</span>
                </div>
              )}

              {/* Academic Section Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Academic Section <span className="text-rose-500">*</span>
                </label>
                {activeSectionsList.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
                    <p className="font-semibold">No active Academic Sections found.</p>
                    <p>You must create at least one Academic Section before creating classes.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsClassModalOpen(false);
                        setActiveTab('SECTIONS');
                        handleOpenCreateSectionModal();
                      }}
                      className="px-3 py-1.5 bg-[#08483A] text-white rounded-lg text-xs font-bold hover:bg-[#06382d] cursor-pointer"
                    >
                      Create Academic Section First
                    </button>
                  </div>
                ) : (
                  <select
                    required
                    value={classModalForm.academicSectionId}
                    onChange={(e) => setClassModalForm({ ...classModalForm, academicSectionId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                  >
                    {!classModalForm.academicSectionId && (
                      <option value="">-- Select Academic Section --</option>
                    )}
                    {activeSectionsList.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} {sec.code ? `(${sec.code})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-[#7C8A9A] mt-1">
                  Assigns this class under a dynamic educational division (e.g. Hifz, Kitab).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={classModalForm.name}
                  onChange={(e) => setClassModalForm({ ...classModalForm, name: e.target.value })}
                  placeholder="e.g., Level 1, Grade 5, Sanah Ula"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Class Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={classModalForm.code}
                  onChange={(e) => setClassModalForm({ ...classModalForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., HIFZ-1, SANAH-1, GR5"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
                <p className="text-[10px] text-[#7C8A9A] mt-1">Unique short identifier within your madrasa.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Default Monthly Fee (LKR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={classModalForm.defaultMonthlyFee}
                  onChange={(e) => setClassModalForm({ ...classModalForm, defaultMonthlyFee: e.target.value })}
                  placeholder="2000.00"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
                <p className="text-[10px] text-[#7C8A9A] mt-1">
                  Enrolled students inherit this standard rate unless an override is set.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Description <span className="text-[#7C8A9A] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={classModalForm.description}
                  onChange={(e) => setClassModalForm({ ...classModalForm, description: e.target.value })}
                  placeholder="Optional syllabus, age group, or schedule details..."
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClassSubmitting || (!editingClass && activeSectionsList.length === 0)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#37C6A3] hover:bg-[#30b594] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isClassSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingClass ? 'Save Changes' : 'Create Class'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT ACADEMIC SECTION */}
      {/* ========================================================================= */}
      {isSectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E7E9EE] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#08483A]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {editingSection ? 'Edit Academic Section' : 'Create Academic Section'}
                </h3>
              </div>
              <button
                onClick={() => setIsSectionModalOpen(false)}
                className="text-[#7C8A9A] hover:text-[#0F172A] p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSectionModalSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {sectionModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sectionModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Section Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sectionModalForm.name}
                  onChange={(e) => setSectionModalForm({ ...sectionModalForm, name: e.target.value })}
                  placeholder="e.g., Hifz, Kitab, Arabic College, Primary"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08483A] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Section Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sectionModalForm.code}
                  onChange={(e) => setSectionModalForm({ ...sectionModalForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., HIFZ, KITAB, ARB, PRI"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#08483A] focus:bg-white"
                />
                <p className="text-[10px] text-[#7C8A9A] mt-1">Unique short identifier for this section.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Display Sort Order
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={sectionModalForm.sortOrder}
                  onChange={(e) => setSectionModalForm({ ...sectionModalForm, sortOrder: e.target.value })}
                  placeholder="0"
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#08483A] focus:bg-white"
                />
                <p className="text-[10px] text-[#7C8A9A] mt-1">Lower numbers appear first in lists.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Description <span className="text-[#7C8A9A] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={sectionModalForm.description}
                  onChange={(e) => setSectionModalForm({ ...sectionModalForm, description: e.target.value })}
                  placeholder="Optional details regarding department goals or requirements..."
                  className="w-full px-3.5 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#08483A] focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSectionSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08483A] hover:bg-[#06382d] text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isSectionSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSection ? 'Save Changes' : 'Create Section'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM TOGGLE CLASS STATUS */}
      {/* ========================================================================= */}
      {confirmToggleClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmToggleClass.status === 'ACTIVE'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {confirmToggleClass.status === 'ACTIVE' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {confirmToggleClass.status === 'ACTIVE' ? 'Deactivate Class' : 'Activate Class'}
                </h3>
                <p className="text-xs text-[#7C8A9A]">
                  {confirmToggleClass.name} ({confirmToggleClass.code})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#0F172A]/80 leading-relaxed">
              {confirmToggleClass.status === 'ACTIVE'
                ? `Deactivating this class will prevent new students from being assigned to it. All ${
                    confirmToggleClass.studentCount ?? 0
                  } currently enrolled students will remain safely associated with this class.`
                : 'Activating this class will make it available again for student enrollment and class reassignments.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmToggleClass(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTogglingClass}
                onClick={handleToggleClassStatus}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition disabled:opacity-50 cursor-pointer ${
                  confirmToggleClass.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTogglingClass && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmToggleClass.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM TOGGLE SECTION STATUS */}
      {/* ========================================================================= */}
      {confirmToggleSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmToggleSection.status === 'ACTIVE'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {confirmToggleSection.status === 'ACTIVE' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {confirmToggleSection.status === 'ACTIVE' ? 'Deactivate Academic Section' : 'Activate Academic Section'}
                </h3>
                <p className="text-xs text-[#7C8A9A]">
                  {confirmToggleSection.name} {confirmToggleSection.code ? `(${confirmToggleSection.code})` : ''}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#0F172A]/80 leading-relaxed">
              {confirmToggleSection.status === 'ACTIVE'
                ? `Deactivating this section will prevent new classes and students from being assigned to it. All ${
                    confirmToggleSection.classCount ?? 0
                  } associated classes and ${
                    confirmToggleSection.studentCount ?? 0
                  } enrolled students remain safely preserved.`
                : 'Activating this section makes it available again for class creation and student assignments.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmToggleSection(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTogglingSection}
                onClick={handleToggleSectionStatus}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition disabled:opacity-50 cursor-pointer ${
                  confirmToggleSection.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTogglingSection && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmToggleSection.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
