import React, { useState, useEffect, useMemo } from 'react';
import {
  Vote,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Users,
  Trash2,
  X,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  Lock,
  BarChart3,
} from 'lucide-react';
import {
  getSuperAdminPolls,
  createSuperAdminPoll,
  updateSuperAdminPollStatus,
  deleteSuperAdminPoll,
} from '../../services/poll.service';
import type {
  PlatformPollItem,
  PollKPIs,
  CreatePollPayload,
} from '../../services/poll.service';

export const SuperAdminPollsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [polls, setPolls] = useState<PlatformPollItem[]>([]);
  const [kpis, setKpis] = useState<PollKPIs>({
    totalPolls: 0,
    activePolls: 0,
    totalVotesCast: 0,
    participatingMadrasasCount: 0,
    totalActiveMadrasas: 0,
  });
  const [allMadrasas, setAllMadrasas] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [audienceFilter, setAudienceFilter] = useState('ALL');

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [expandedMadrasaPollId, setExpandedMadrasaPollId] = useState<string | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<'GOVERNANCE' | 'ACADEMIC' | 'CALENDAR' | 'CURRICULUM' | 'FEEDBACK'>('GOVERNANCE');
  const [formAudience, setFormAudience] = useState<'ALL' | 'MADRASA_ADMINS' | 'TEACHERS'>('ALL');
  const [formTargetType, setFormTargetType] = useState<'ALL_MADRASAS' | 'SPECIFIC'>('ALL_MADRASAS');
  const [formSelectedMadrasas, setFormSelectedMadrasas] = useState<string[]>([]);
  const [formAllowMultiple, setFormAllowMultiple] = useState(false);
  const [formIsAnonymous, setFormIsAnonymous] = useState(false);
  const [formClosesAt, setFormClosesAt] = useState('');
  const [formOptions, setFormOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getSuperAdminPolls();
      setPolls(res.polls || []);
      setKpis(res.kpis || { totalPolls: 0, activePolls: 0, totalVotesCast: 0, participatingMadrasasCount: 0 });
      setAllMadrasas(res.allMadrasas || []);
    } catch (err: any) {
      console.error('Failed to load super admin polls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPolls = useMemo(() => {
    return polls.filter((p) => {
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesAudience = audienceFilter === 'ALL' || p.targetAudience === audienceFilter;
      return matchesSearch && matchesCategory && matchesStatus && matchesAudience;
    });
  }, [polls, searchQuery, categoryFilter, statusFilter, audienceFilter]);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('GOVERNANCE');
    setFormAudience('ALL');
    setFormTargetType('ALL_MADRASAS');
    setFormSelectedMadrasas([]);
    setFormAllowMultiple(false);
    setFormIsAnonymous(false);
    setFormClosesAt('');
    setFormOptions(['', '']);
    setFormError(null);
  };

  const handleAddOption = () => {
    if (formOptions.length >= 8) return;
    setFormOptions([...formOptions, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (formOptions.length <= 2) return;
    setFormOptions(formOptions.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...formOptions];
    updated[index] = val;
    setFormOptions(updated);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError('Please enter a poll title.');
      return;
    }

    const cleanOptions = formOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setFormError('A poll requires at least 2 non-empty options.');
      return;
    }

    if (formTargetType === 'SPECIFIC' && formSelectedMadrasas.length === 0) {
      setFormError('Please choose at least one target madrasa.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreatePollPayload = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        category: formCategory,
        targetAudience: formAudience,
        targetMadrasaIds: formTargetType === 'SPECIFIC' ? formSelectedMadrasas : undefined,
        allowMultipleChoice: formAllowMultiple,
        isAnonymous: formIsAnonymous,
        closesAt: formClosesAt ? new Date(formClosesAt).toISOString() : null,
        options: cleanOptions,
      };

      await createSuperAdminPoll(payload);
      setIsCreateOpen(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Failed to publish poll.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (poll: PlatformPollItem) => {
    const nextStatus = poll.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    try {
      setStatusUpdatingId(poll.id);
      await updateSuperAdminPollStatus(poll.id, nextStatus);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update poll status.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this poll and all associated votes?')) return;
    try {
      setDeletingId(id);
      await deleteSuperAdminPoll(id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete poll.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F1] p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-[#E7E9EE] rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 bg-[#0F172A] text-[#37C6A3] rounded-xl shadow-xs">
            <Vote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              Polls & Governance
            </h1>
            <p className="text-xs sm:text-sm text-[#7C8A9A] mt-0.5">
              Launch multi-tenant ballots, collect community feedback, and view real-time governance voting analytics
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 active:bg-slate-900 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#37C6A3]" />
          <span>Create New Poll</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Polls */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7C8A9A]">Total Polls</p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F172A] mt-1">{kpis.totalPolls}</p>
          </div>
          <div className="p-2.5 bg-slate-100 text-[#0F172A] rounded-xl">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {/* Active Polls */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7C8A9A]">Active Ballots</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{kpis.activePolls}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Total Votes */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7C8A9A]">Total Votes Cast</p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F172A] mt-1">{kpis.totalVotesCast}</p>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Participating Madrasas */}
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#7C8A9A]">Participating Madrasas</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1">
              {kpis.participatingMadrasasCount}
              {kpis.totalActiveMadrasas ? ` / ${kpis.totalActiveMadrasas}` : ''}
            </p>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E7E9EE] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7C8A9A]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search polls by title or description..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] placeholder-[#7C8A9A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/20 focus:border-[#37C6A3]"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="GOVERNANCE">Governance</option>
            <option value="ACADEMIC">Academic</option>
            <option value="CALENDAR">Calendar</option>
            <option value="CURRICULUM">Curriculum</option>
            <option value="FEEDBACK">Feedback</option>
          </select>

          {/* Audience Filter */}
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Audiences</option>
            <option value="MADRASA_ADMINS">Madrasa Admins Only</option>
            <option value="TEACHERS">Teachers Only</option>
          </select>
        </div>
      </div>

      {/* Polls Feed */}
      {loading ? (
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F172A] mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading polls and governance metrics...</p>
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="bg-white border border-[#E7E9EE] rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#0F172A]">
            <Vote className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">No polls found</h3>
          <p className="text-xs sm:text-sm text-[#7C8A9A] max-w-sm mx-auto mt-1 mb-5">
            {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No polls match your search criteria. Try clearing active filters.'
              : 'Launch your first multi-tenant survey or academic policy vote to collect feedback from institutions.'}
          </p>
          <button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white text-sm font-semibold rounded-xl shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#37C6A3]" />
            <span>Create First Poll</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolls.map((poll) => {
            const isActive = poll.status === 'ACTIVE';
            const isExpandedBreakdown = expandedMadrasaPollId === poll.id;
            const totalVotes = poll.stats?.totalVotes || 0;

            return (
              <div
                key={poll.id}
                className="bg-white border border-[#E7E9EE] rounded-2xl p-4 sm:p-6 shadow-xs transition-all hover:shadow-sm"
              >
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {poll.status}
                    </span>

                    {/* Category */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-[#E7E9EE]">
                      <Layers className="w-3 h-3 text-[#7C8A9A]" />
                      {poll.category}
                    </span>

                    {/* Audience */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200">
                      <Users className="w-3 h-3 text-blue-500" />
                      {poll.targetAudience === 'ALL'
                        ? 'All Admins & Teachers'
                        : poll.targetAudience === 'MADRASA_ADMINS'
                        ? 'Madrasa Admins Only'
                        : 'Teachers & Ustadhs Only'}
                    </span>

                    {/* Multiple choice or Anonymous indicator */}
                    {poll.allowMultipleChoice && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[11px] font-semibold border border-amber-200">
                        Multi-Select
                      </span>
                    )}
                    {poll.isAnonymous && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Anonymous
                      </span>
                    )}
                  </div>

                  {/* Closing Date */}
                  <div className="text-xs text-[#7C8A9A] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {poll.closesAt
                        ? `Closes ${new Date(poll.closesAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}`
                        : 'No Expiry'}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1.5 leading-snug">
                  {poll.title}
                </h2>
                {poll.description && (
                  <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed mb-4">
                    {poll.description}
                  </p>
                )}

                {/* Options List with Percentage Bars */}
                <div className="space-y-2.5 my-4">
                  {poll.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden"
                    >
                      {/* Background Bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-[#37C6A3]/15 transition-all duration-500"
                        style={{ width: `${opt.percentage}%` }}
                      />

                      <div className="relative flex items-center justify-between gap-3 text-xs sm:text-sm">
                        <span className="font-semibold text-[#0F172A]">{opt.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs text-[#7C8A9A]">
                            {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#0F172A] text-white">
                            {opt.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Participation Summary & Expand Breakdown */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#E7E9EE] text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-[#7C8A9A]">
                    <span>
                      Total Responses: <strong className="text-[#0F172A]">{totalVotes}</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Participating Institutions:{' '}
                      <strong className="text-[#0F172A]">
                        {poll.stats?.participatingMadrasasCount || 0}
                      </strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Admins: <strong className="text-[#0F172A]">{poll.stats?.adminVotesCount || 0}</strong> | Teachers: <strong className="text-[#0F172A]">{poll.stats?.teacherVotesCount || 0}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Toggle Breakdown */}
                    {(poll.stats?.participatingMadrasas?.length || 0) > 0 && (
                      <button
                        onClick={() =>
                          setExpandedMadrasaPollId(isExpandedBreakdown ? null : poll.id)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#0F172A]" />
                        <span>{isExpandedBreakdown ? 'Hide Breakdown' : 'Madrasa Breakdown'}</span>
                        {isExpandedBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Toggle Status */}
                    <button
                      onClick={() => handleToggleStatus(poll)}
                      disabled={statusUpdatingId === poll.id}
                      className="px-3 py-1.5 rounded-lg border border-[#E7E9EE] hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {statusUpdatingId === poll.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isActive ? (
                        'Close Poll'
                      ) : (
                        'Reopen Poll'
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(poll.id)}
                      disabled={deletingId === poll.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Delete Poll"
                    >
                      {deletingId === poll.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Madrasa Breakdown Panel */}
                {isExpandedBreakdown && (
                  <div className="mt-4 pt-4 border-t border-dashed border-[#E7E9EE] bg-slate-50/70 p-4 rounded-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#7C8A9A] mb-3 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#0F172A]" />
                      Participating Madrasas ({poll.stats?.participatingMadrasas.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {poll.stats?.participatingMadrasas.map((m) => (
                        <div
                          key={m.madrasaId}
                          className="bg-white border border-[#E7E9EE] p-3 rounded-xl text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0F172A] truncate">{m.madrasaName}</span>
                            <span className="font-mono text-[10px] text-[#7C8A9A]">{m.madrasaCode}</span>
                          </div>
                          <div className="flex items-center justify-between text-[#7C8A9A] pt-1 border-t border-slate-100">
                            <span>Total: <strong className="text-[#0F172A]">{m.totalVotes}</strong></span>
                            <span>Admins: {m.adminVotes} | Teachers: {m.teacherVotes}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Poll Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-[#E7E9EE] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E7E9EE]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0F172A] text-[#37C6A3] rounded-xl">
                  <Vote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#0F172A]">
                    Create Multi-Tenant Poll
                  </h3>
                  <p className="text-xs text-[#7C8A9A]">
                    Collect voting responses across active Madrasa Admins & Teachers
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-[#0F172A] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePoll} className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Poll Question / Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Standardizing 2027 Mid-Year Examination Windows"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] placeholder-[#7C8A9A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/20 focus:border-[#37C6A3]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Context / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide background context or rationale for voters..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] placeholder-[#7C8A9A] focus:outline-none focus:ring-2 focus:ring-[#37C6A3]/20 focus:border-[#37C6A3]"
                />
              </div>

              {/* Category & Audience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e: any) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] focus:outline-none"
                  >
                    <option value="GOVERNANCE">Governance & Policy</option>
                    <option value="ACADEMIC">Academic Standards</option>
                    <option value="CALENDAR">Calendar & Schedule</option>
                    <option value="CURRICULUM">Curriculum Guidelines</option>
                    <option value="FEEDBACK">Platform Feedback</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Audience
                  </label>
                  <select
                    value={formAudience}
                    onChange={(e: any) => setFormAudience(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] focus:outline-none"
                  >
                    <option value="ALL">All Admins & Teachers</option>
                    <option value="MADRASA_ADMINS">Madrasa Admins Only</option>
                    <option value="TEACHERS">Teachers & Ustadhs Only</option>
                  </select>
                </div>
              </div>

              {/* Target Madrasa Scope */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Institution Reach
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-2">
                  <button
                    type="button"
                    onClick={() => setFormTargetType('ALL_MADRASAS')}
                    className={`py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      formTargetType === 'ALL_MADRASAS'
                        ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                        : 'text-slate-600 hover:text-[#0F172A]'
                    }`}
                  >
                    All Madrasas ({allMadrasas.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTargetType('SPECIFIC')}
                    className={`py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      formTargetType === 'SPECIFIC'
                        ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                        : 'text-slate-600 hover:text-[#0F172A]'
                    }`}
                  >
                    Selected Madrasas
                  </button>
                </div>

                {formTargetType === 'SPECIFIC' && (
                  <div className="p-3 bg-slate-50 border border-[#E7E9EE] rounded-xl max-h-36 overflow-y-auto space-y-1">
                    {allMadrasas.map((m) => {
                      const isChecked = formSelectedMadrasas.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-100 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormSelectedMadrasas([...formSelectedMadrasas, m.id]);
                              } else {
                                setFormSelectedMadrasas(formSelectedMadrasas.filter((id) => id !== m.id));
                              }
                            }}
                            className="rounded text-[#0F172A]"
                          />
                          <span className="font-semibold text-[#0F172A]">{m.name}</span>
                          <span className="text-[10px] text-[#7C8A9A] font-mono">({m.code})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Poll Options ({formOptions.length} of 8) *
                  </label>
                  {formOptions.length < 8 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs font-semibold text-[#0F172A] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#37C6A3]" />
                      <span>Add Option</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {formOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#7C8A9A] w-5 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1} label...`}
                        className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] focus:outline-none"
                      />
                      {formOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggles: Multiple Choice, Anonymous, Closing Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E7E9EE]">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAllowMultiple}
                    onChange={(e) => setFormAllowMultiple(e.target.checked)}
                    className="rounded text-[#0F172A]"
                  />
                  <span>Allow Multiple Selections</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsAnonymous}
                    onChange={(e) => setFormIsAnonymous(e.target.checked)}
                    className="rounded text-[#0F172A]"
                  />
                  <span>Anonymous Voting (Hide voter identity)</span>
                </label>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Closing Date & Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formClosesAt}
                  onChange={(e) => setFormClosesAt(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-[#E7E9EE] rounded-xl text-[#0F172A] focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-[#E7E9EE]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing Poll...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-[#37C6A3]" />
                      <span>Launch Poll</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPollsPage;
