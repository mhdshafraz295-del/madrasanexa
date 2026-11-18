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
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-700/60 transition-all">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#37C6A3]/20 text-[#37C6A3] rounded-xl border border-[#37C6A3]/40">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#37C6A3]">
                Community Governance Ballot
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/10 text-slate-300">
                {activePoll.category}
              </span>
              {activePoll.isAnonymous && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/10 text-slate-300 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Anonymous
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white mt-0.5 line-clamp-1">
              {activePoll.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Ballot' : 'Collapse Ballot'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss widget"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
          {activePoll.description && (
            <p className="text-xs text-slate-300 leading-relaxed">
              {activePoll.description}
            </p>
          )}

          {errorMap[activePoll.id] && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
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
                    className={`p-3 rounded-xl border relative overflow-hidden text-xs sm:text-sm ${
                      isUserChoice
                        ? 'border-[#37C6A3] bg-white/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    {/* Background Progress Bar */}
                    <div
                      className="absolute inset-y-0 left-0 bg-[#37C6A3]/25 transition-all duration-700"
                      style={{ width: `${opt.percentage}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        {isUserChoice && (
                          <span className="p-0.5 bg-[#37C6A3] text-slate-950 rounded-full">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                        <span>{opt.label}</span>
                        {isUserChoice && (
                          <span className="text-[10px] font-bold text-[#37C6A3] px-1.5 py-0.2 bg-[#37C6A3]/15 rounded">
                            Your Vote
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-300 font-mono">
                          {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-white text-slate-950">
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
                      ? 'border-[#37C6A3] bg-[#37C6A3]/15 text-white font-semibold'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'border-[#37C6A3] bg-[#37C6A3] text-slate-950'
                          : 'border-slate-500 bg-transparent'
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#37C6A3]" />
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
                className="w-full sm:w-auto px-5 py-2 bg-[#37C6A3] hover:bg-[#2fb090] active:bg-[#28997c] text-slate-950 font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
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
              <span className="inline-flex items-center gap-1 text-[#37C6A3] font-semibold">
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
