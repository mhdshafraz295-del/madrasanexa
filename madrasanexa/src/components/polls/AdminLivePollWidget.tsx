import React, { useState, useEffect } from 'react';
import {
  Vote,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  getMadrasaAdminPolls,
  voteMadrasaAdminPoll,
} from '../../services/poll.service';
import type { PlatformPollItem } from '../../services/poll.service';

export const AdminLivePollWidget: React.FC = () => {
  const [polls, setPolls] = useState<PlatformPollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const data = await getMadrasaAdminPolls();
      setPolls(data || []);
      // Pre-populate selections for already-voted polls
      const preselected: Record<string, string[]> = {};
      for (const p of data || []) {
        if (p.hasVoted && p.userSelectedOptionIds) {
          preselected[p.id] = p.userSelectedOptionIds;
        }
      }
      setSelectedOptionsMap(preselected);
    } catch (err) {
      console.error('Failed to load active polls for admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  if (loading || polls.length === 0 || isDismissed) {
    return null;
  }

  // Focus on the first active poll
  const activePoll = polls[0];
  const hasVoted = Boolean(activePoll.hasVoted);
  const selectedOptionIds = selectedOptionsMap[activePoll.id] || [];

  const handleOptionToggle = (optionId: string) => {
    if (hasVoted) return;
    if (activePoll.allowMultipleChoice) {
      setSelectedOptionsMap((prev) => {
        const current = prev[activePoll.id] || [];
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [activePoll.id]: next };
      });
    } else {
      setSelectedOptionsMap((prev) => ({
        ...prev,
        [activePoll.id]: [optionId],
      }));
    }
  };

  const handleVoteSubmit = async () => {
    if (selectedOptionIds.length === 0) return;
    try {
      setVotingId(activePoll.id);
      setErrorMap((prev) => ({ ...prev, [activePoll.id]: '' }));
      const updatedPoll = await voteMadrasaAdminPoll(activePoll.id, selectedOptionIds);
      setPolls((prev) =>
        prev.map((p) => (p.id === activePoll.id ? { ...p, ...updatedPoll, hasVoted: true } : p))
      );
    } catch (err: any) {
      setErrorMap((prev) => ({
        ...prev,
        [activePoll.id]: err.response?.data?.message || err.message || 'Failed to submit vote.',
      }));
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-[#121614] rounded-2xl transition-all ${
        !hasVoted
          ? 'border-2 border-emerald-400/90 dark:border-emerald-600/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20'
          : 'border border-slate-200/90 dark:border-slate-800 shadow-lg shadow-slate-200/70 dark:shadow-none ring-1 ring-slate-900/[0.03] dark:ring-white/[0.05]'
      }`}
    >
      {/* Top animated accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 z-10 ${
          !hasVoted
            ? 'bg-gradient-to-r from-emerald-500 via-teal-400 via-amber-400 to-emerald-500 animate-poll-gradient'
            : 'bg-emerald-500/80'
        }`}
      />

      {/* Header Section with Animated Gradient & Live Attention Badge */}
      <div
        className={`relative overflow-hidden p-4 sm:p-5 transition-all ${
          !hasVoted
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50/90 to-amber-50/70 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-amber-950/25 border-b border-emerald-100/80 dark:border-emerald-900/40 animate-poll-gradient'
            : 'bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800'
        }`}
      >
        {/* Shimmer sweep overlay when voting is pending */}
        {!hasVoted && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30 dark:opacity-15">
            <div className="h-full w-full -translate-x-full bg-gradient-to-r from-transparent via-white/60 dark:via-white/20 to-transparent animate-poll-shimmer" />
          </div>
        )}

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                !hasVoted
                  ? 'bg-white/90 dark:bg-slate-800/90 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800 shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800'
              }`}
            >
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Community Governance Ballot
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
                  {activePoll.category}
                </span>
                {activePoll.isAnonymous && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Anonymous
                  </span>
                )}
                {/* Attention Badge: "Mark Your Vote" vs "Vote Recorded" */}
                {!hasVoted ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white shadow-xs animate-pulse">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-90" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-300" />
                    </span>
                    <span>Mark Your Vote • Action Required</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/60 transition-all">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>✓ Vote Recorded</span>
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
                {activePoll.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Ballot' : 'Collapse Ballot'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Dismiss widget"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-3 bg-white dark:bg-[#121614]">
          {activePoll.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {activePoll.description}
            </p>
          )}

          {errorMap[activePoll.id] && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMap[activePoll.id]}</span>
            </div>
          )}

          {/* Options: Voting Mode vs Results Mode */}
          <div className="space-y-2">
            {activePoll.options.map((opt) => {
              const isSelected = selectedOptionIds.includes(opt.id);
              const isUserChoice = opt.isUserChoice || isSelected;

              if (hasVoted) {
                // Results Mode
                return (
                  <div
                    key={opt.id}
                    className={`p-3 rounded-xl border relative overflow-hidden text-xs sm:text-sm transition-all ${
                      isUserChoice
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-900 dark:text-white font-medium'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {/* Background Progress Bar */}
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                        isUserChoice ? 'bg-emerald-500/20 dark:bg-emerald-500/25' : 'bg-emerald-500/10 dark:bg-emerald-500/15'
                      }`}
                      style={{ width: `${opt.percentage}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        {isUserChoice && (
                          <span className="p-0.5 bg-emerald-600 text-white rounded-full">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                        <span className="text-slate-800 dark:text-slate-200">{opt.label}</span>
                        {isUserChoice && (
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 rounded">
                            Your Vote
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isUserChoice
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {opt.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Voting Mode (Interactive Radio/Checkbox)
              return (
                <div
                  key={opt.id}
                  onClick={() => handleOptionToggle(opt.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs sm:text-sm ${
                    isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-xs font-semibold'
                      : 'bg-slate-50/80 dark:bg-slate-900/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{opt.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {activePoll.closesAt
                  ? `Closes ${new Date(activePoll.closesAt).toLocaleDateString()}`
                  : 'Open Poll'}
              </span>
              <span>&bull;</span>
              <span>{activePoll.totalVotes || 0} votes recorded</span>
            </div>

            {!hasVoted && (
              <button
                onClick={handleVoteSubmit}
                disabled={selectedOptionIds.length === 0 || votingId === activePoll.id}
                className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 text-white font-semibold rounded-xl transition-all shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {votingId === activePoll.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Vote</span>
                )}
              </button>
            )}

            {hasVoted && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Response Recorded</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLivePollWidget;
