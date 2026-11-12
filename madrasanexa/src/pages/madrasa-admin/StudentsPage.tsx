import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  apiListStudents,
  apiListClasses,
  apiListAcademicSections,
  apiActivateStudent,
  apiInactivateStudent,
  apiArchiveStudent,
  type StudentListItem,
  type ClassItem,
  type AcademicSectionItem,
} from '../../services/api';
import {
  GraduationCap,
  Plus,
  Search,
  BookOpen,
  Layers,
  Filter,
  Eye,
  Edit2,
  Archive,
  MessageSquare,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
} from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicSections, setAcademicSections] = useState<AcademicSectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Action Modal
  const [statusAction, setStatusAction] = useState<{
    student: StudentListItem;
    type: 'ACTIVATE' | 'INACTIVATE' | 'ARCHIVE';
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load Classes & Sections for filter dropdowns
  useEffect(() => {
    async function loadFilterData() {
      try {
        const [clsRes, secRes] = await Promise.all([
          apiListClasses({ pageSize: 100, status: 'ALL' }),
          apiListAcademicSections({ pageSize: 100, status: 'ALL' }),
        ]);
        setClasses(clsRes.items || clsRes.classes || []);
        setAcademicSections(secRes.items || secRes.sections || []);
      } catch (err) {
        console.error('Failed to load filter data:', err);
      }
    }
    loadFilterData();
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiListStudents({
        page,
        pageSize,
        search: search.trim() || undefined,
        academicSectionId: sectionFilter === 'ALL' ? undefined : sectionFilter,
        classId: classFilter === 'ALL' ? undefined : classFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setStudents(data.items || data.students || []);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      console.error('Failed to load students:', err);
      setError(err.response?.data?.message || 'Failed to load students. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, sectionFilter, classFilter, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleExecuteStatusChange = async () => {
    if (!statusAction) return;

    try {
      setIsUpdatingStatus(true);
      if (statusAction.type === 'ACTIVATE') {
        await apiActivateStudent(statusAction.student.id);
      } else if (statusAction.type === 'INACTIVATE') {
        await apiInactivateStudent(statusAction.student.id);
      } else if (statusAction.type === 'ARCHIVE') {
        await apiArchiveStudent(statusAction.student.id);
      }

      setStatusAction(null);
      fetchStudents();
    } catch (err: any) {
      console.error('Failed to change student status:', err);
      alert(err.response?.data?.message || 'Failed to update student status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">Student Directory</h1>
          <p className="text-xs sm:text-sm text-[#7C8A9A] mt-1">
            Manage student enrollments, status lifecycle, class assignments, and individual fee structures.
          </p>
        </div>
        <Link
          to="/madrasa-admin/students/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#37C6A3] hover:bg-[#30b594] text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Student</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E9EE] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C8A9A]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, admission #, guardian..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#37C6A3] focus:bg-white transition"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Academic Section Filter Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
            <Layers className="w-3.5 h-3.5 text-[#7C8A9A] shrink-0" />
            <select
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value);
                setClassFilter('ALL');
                setPage(1);
              }}
              className="w-full flex-1 sm:w-auto min-w-0 px-3 py-1.5 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
            >
              <option value="ALL">All Sections</option>
              {academicSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
              <option value="UNASSIGNED">Unassigned Section</option>
            </select>
          </div>

          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
            <Filter className="w-3.5 h-3.5 text-[#7C8A9A] shrink-0" />
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="w-full flex-1 sm:w-auto min-w-0 px-3 py-1.5 text-xs bg-[#F7F6F1] border border-[#E7E9EE] rounded-xl text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#37C6A3]"
            >
              <option value="ALL">All Classes</option>
              {classes
                .filter((c) => {
                  if (sectionFilter === 'ALL') return true;
                  if (sectionFilter === 'UNASSIGNED') return !c.academicSectionId;
                  return c.academicSectionId === sectionFilter;
                })
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#F7F6F1] p-1 rounded-xl border border-[#E7E9EE] overflow-x-auto w-full sm:w-auto">
            {(['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#7C8A9A] hover:text-[#0F172A]'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : st === 'INACTIVE' ? 'Inactive' : 'Archived'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 flex flex-col items-center justify-center text-[#7C8A9A]">
          <Loader2 className="w-8 h-8 animate-spin text-[#37C6A3] mb-3" />
          <p className="text-xs font-medium">Loading student directory...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-xs text-rose-700 font-medium">{error}</p>
          <button
            onClick={fetchStudents}
            className="mt-3 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-semibold rounded-lg hover:bg-[#0F172A]/90 transition"
          >
            Retry
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] p-12 text-center">
          <GraduationCap className="w-12 h-12 text-[#7C8A9A]/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#0F172A]">No Students Found</h3>
          <p className="text-xs text-[#7C8A9A] mt-1 max-w-sm mx-auto">
            {search || classFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No students match your query criteria. Try clearing some filters.'
              : 'Start building your student register by enrolling your first student.'}
          </p>
          {!search && classFilter === 'ALL' && statusFilter === 'ALL' && (
            <Link
              to="/madrasa-admin/students/new"
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#37C6A3] text-white text-xs font-semibold rounded-xl hover:bg-[#30b594] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enroll First Student</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xs overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E9EE] bg-[#F7F6F1]/50 text-[11px] font-bold uppercase tracking-wider text-[#7C8A9A]">
                  <th className="py-3 px-4">Admission No</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Guardian</th>
                  <th className="py-3 px-4">Monthly Fee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E9EE] text-xs">
                {students.map((st) => (
                  <tr key={st.id} className="hover:bg-[#F7F6F1]/40 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] font-bold bg-[#E7E9EE] text-[#0F172A] px-2 py-0.5 rounded">
                        {st.admissionNo}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <Link
                        to={`/madrasa-admin/students/${st.id}`}
                        className="font-bold text-[#0F172A] hover:text-[#37C6A3] transition block"
                      >
                        {st.fullName}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      {st.class ? (
                        <div className="flex flex-col gap-1 items-start">
                          {st.class.academicSection ? (
                            <span className="text-[10px] font-bold text-[#08483A] bg-[#08483A]/10 px-2 py-0.5 rounded border border-[#08483A]/20">
                              {st.class.academicSection.name}
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Unassigned Section
                            </span>
                          )}
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                            <BookOpen className="w-3 h-3 text-emerald-600" />
                            <span>{st.class.name}</span>
                            {st.class.code && (
                              <span className="text-[10px] text-emerald-700 font-mono">
                                ({st.class.code})
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#7C8A9A] italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#0F172A]">{st.guardianName}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#7C8A9A]">
                        <span className="font-mono">{st.guardianPhone || 'N/A'}</span>
                        {(st.whatsappNotification || st.whatsappOptIn) && (
                          <span
                            title="WhatsApp notifications enabled"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800"
                          >
                            <MessageSquare className="w-2.5 h-2.5 text-emerald-600" />
                            <span>WA</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#0F172A]">
                        LKR {st.effectiveMonthlyFee || st.effectiveFee || '0.00'}
                      </div>
                      <div className="mt-0.5">
                        {st.feeSource === 'STUDENT_OVERRIDE' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Custom Override
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                            Class Default
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {st.status === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}
                      {st.status === 'INACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                      {st.status === 'ARCHIVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <Archive className="w-2.5 h-2.5 text-purple-500" />
                          Archived
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to={`/madrasa-admin/students/${st.id}`}
                          className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition"
                          title="View Student Dossier & Fee History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to={`/madrasa-admin/students/${st.id}/edit`}
                          className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] hover:bg-[#F7F6F1] rounded-lg transition"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>

                        {/* Status Transition Action Buttons */}
                        {st.status === 'ACTIVE' && (
                          <>
                            <button
                              onClick={() => setStatusAction({ student: st, type: 'INACTIVATE' })}
                              className="p-1.5 text-[#7C8A9A] hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Set Inactive"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setStatusAction({ student: st, type: 'ARCHIVE' })}
                              className="p-1.5 text-[#7C8A9A] hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                              title="Archive Student"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {st.status === 'INACTIVE' && (
                          <>
                            <button
                              onClick={() => setStatusAction({ student: st, type: 'ACTIVATE' })}
                              className="p-1.5 text-[#7C8A9A] hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Activate Student"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setStatusAction({ student: st, type: 'ARCHIVE' })}
                              className="p-1.5 text-[#7C8A9A] hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                              title="Archive Student"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {st.status === 'ARCHIVED' && (
                          <button
                            onClick={() => setStatusAction({ student: st, type: 'ACTIVATE' })}
                            className="p-1.5 text-[#7C8A9A] hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Reactivate Student"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-[#E7E9EE]">
            {students.map((st) => (
              <div key={st.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {/* 1. Student Name */}
                    <Link
                      to={`/madrasa-admin/students/${st.id}`}
                      className="text-xs font-bold text-[#0F172A] hover:underline"
                    >
                      {st.fullName}
                    </Link>
                    {/* 2. Admission No */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] font-bold bg-[#E7E9EE] text-[#0F172A] px-1.5 py-0.5 rounded">
                        {st.admissionNo}
                      </span>
                      {/* 4. Status */}
                      {st.status === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                      {st.status === 'INACTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Inactive
                        </span>
                      )}
                      {st.status === 'ARCHIVED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link
                      to={`/madrasa-admin/students/${st.id}`}
                      className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      to={`/madrasa-admin/students/${st.id}/edit`}
                      className="p-1.5 text-[#7C8A9A] hover:text-[#0F172A] rounded-lg border border-[#E7E9EE]"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#F7F6F1] p-2.5 rounded-xl">
                  {/* 3. Class & Section */}
                  <div>
                    <span className="text-[10px] text-[#7C8A9A] block font-medium">Class & Section</span>
                    {st.class?.academicSection && (
                      <span className="text-[9px] font-bold text-[#08483A] bg-[#08483A]/10 px-1.5 py-0.2 rounded border border-[#08483A]/20 mb-0.5 inline-block">
                        {st.class.academicSection.name}
                      </span>
                    )}
                    <span className="font-semibold text-[#0F172A] block">
                      {st.class?.name ?? 'Unassigned'}
                    </span>
                    {st.class?.code && (
                      <span className="font-mono text-[10px] text-[#7C8A9A] block">
                        {st.class.code}
                      </span>
                    )}
                  </div>
                  {/* 6. Fee */}
                  <div>
                    <span className="text-[10px] text-[#7C8A9A] block font-medium">Monthly Fee</span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      LKR {st.effectiveMonthlyFee || st.effectiveFee || '0.00'}
                    </span>
                    <span className="text-[9px] text-[#7C8A9A] block">
                      {st.feeSource === 'STUDENT_OVERRIDE' ? 'Custom Override' : 'Class Default'}
                    </span>
                  </div>
                </div>

                {/* 5. Guardian */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] pt-2 border-t border-[#E7E9EE]/60">
                  <div className="text-[#7C8A9A] min-w-0 break-words">
                    Guardian: <span className="font-semibold text-[#0F172A]">{st.guardianName}</span> (
                    {st.guardianPhone || 'N/A'})
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {st.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => setStatusAction({ student: st, type: 'INACTIVATE' })}
                          className="px-2 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded border border-amber-200 cursor-pointer"
                        >
                          Inactivate
                        </button>
                        <button
                          onClick={() => setStatusAction({ student: st, type: 'ARCHIVE' })}
                          className="px-2 py-0.5 text-[10px] font-semibold text-purple-700 bg-purple-50 rounded border border-purple-200 cursor-pointer"
                        >
                          Archive
                        </button>
                      </>
                    )}
                    {st.status === 'INACTIVE' && (
                      <button
                        onClick={() => setStatusAction({ student: st, type: 'ACTIVATE' })}
                        className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded border border-emerald-200 cursor-pointer"
                      >
                        Activate
                      </button>
                    )}
                    {st.status === 'ARCHIVED' && (
                      <button
                        onClick={() => setStatusAction({ student: st, type: 'ACTIVATE' })}
                        className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded border border-emerald-200 cursor-pointer"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[#E7E9EE] flex flex-wrap items-center justify-between gap-3 text-xs text-[#7C8A9A]">
              <div>
                Showing <span className="font-semibold text-[#0F172A]">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-[#0F172A]">
                  {Math.min(page * pageSize, total)}
                </span>{' '}
                of <span className="font-semibold text-[#0F172A]">{total}</span> students
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-[#E7E9EE] rounded-lg hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 py-1 text-xs font-semibold text-[#0F172A]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-[#E7E9EE] rounded-lg hover:bg-[#F7F6F1] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Status Transition Modal */}
      {statusAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E7E9EE] shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  statusAction.type === 'ACTIVATE'
                    ? 'bg-emerald-50 text-emerald-600'
                    : statusAction.type === 'INACTIVATE'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-purple-50 text-purple-600'
                }`}
              >
                {statusAction.type === 'ACTIVATE' ? (
                  <UserCheck className="w-5 h-5" />
                ) : statusAction.type === 'INACTIVATE' ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <Archive className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {statusAction.type === 'ACTIVATE'
                    ? 'Activate Student'
                    : statusAction.type === 'INACTIVATE'
                    ? 'Set Student Inactive'
                    : 'Archive Student'}
                </h3>
                <p className="text-xs text-[#7C8A9A]">
                  {statusAction.student.fullName} ({statusAction.student.admissionNo})
                </p>
              </div>
            </div>

            <p className="text-xs text-[#0F172A]/80 leading-relaxed">
              {statusAction.type === 'ACTIVATE' &&
                'Activating this student will include them in upcoming monthly billing runs and active attendance rosters.'}
              {statusAction.type === 'INACTIVATE' &&
                'Marking this student inactive temporarily suspends automated invoice generation. Existing financial history is strictly preserved.'}
              {statusAction.type === 'ARCHIVE' &&
                'Archiving moves this student to alumni / inactive storage. Historical records and fee logs remain intact, but the student will not appear in daily operations.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusAction(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#7C8A9A] hover:text-[#0F172A] rounded-xl hover:bg-[#F7F6F1] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleExecuteStatusChange}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition disabled:opacity-50 ${
                  statusAction.type === 'ACTIVATE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : statusAction.type === 'INACTIVATE'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {statusAction.type === 'ACTIVATE'
                    ? 'Confirm Activate'
                    : statusAction.type === 'INACTIVATE'
                    ? 'Confirm Inactive'
                    : 'Confirm Archive'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
