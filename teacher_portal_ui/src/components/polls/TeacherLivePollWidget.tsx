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
import { pollsApi, TeacherPollItem } from '../../services/api';

export const TeacherLivePollWidget: React.FC = () => {
  const [polls, setPolls] = useState<TeacherPollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const data = await pollsApi.getActivePolls();
      setPolls(data || []);
      const preselected: Record<string, string[]> = {};
      for (const p of data || []) {
        if (p.hasVoted && p.userSelectedOptionIds) {
          preselected[p.id] = p.userSelectedOptionIds;
        }
      }
      setSelectedOptionsMap(preselected);
    } catch (err) {
      console.error('Failed to load active polls for teacher:', err);
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
      const updatedPoll = await pollsApi.submitVote(activePoll.id, selectedOptionIds);
      setPolls((prev) =>
        prev.map((p) => (p.id === activePoll.id ? { ...p, ...updatedPoll, hasVoted: true } : p))
      );
    } catch (err: any) {
      setErrorMap((prev) => ({
        ...prev,
        [activePoll.id]: err.message || 'Failed to submit vote.',
      }));
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div className="relative overflow-hidden bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-lg shadow-slate-200/70 ring-1 ring-slate-900/[0.03] transition-all">
      {/* Subtle top emerald accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200/80">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Community Governance Ballot
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                {activePoll.category}
              </span>
              {activePoll.isAnonymous && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Anonymous
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 line-clamp-1">
              {activePoll.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand Ballot' : 'Collapse Ballot'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Dismiss widget"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          {activePoll.description && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {activePoll.description}
            </p>
          )}

          {errorMap[activePoll.id] && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMap[activePoll.id]}</span>
            </div>
          )}

          {/* Options: Voting vs Results Mode */}
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
                        ? 'border-emerald-300 bg-emerald-50/40 text-slate-900 font-medium'
                        : 'border-slate-200 bg-slate-50/40 text-slate-800'
                    }`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                        isUserChoice ? 'bg-emerald-500/20' : 'bg-emerald-500/10'
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
                        <span className="text-slate-800">{opt.label}</span>
                        {isUserChoice && (
                          <span className="text-[10px] font-bold text-emerald-800 px-1.5 py-0.5 bg-emerald-100 border border-emerald-200/80 rounded">
                            Your Vote
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500 font-mono">
                          {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isUserChoice
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-slate-800 border border-slate-200'
                          }`}
                        >
                          {opt.percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Interactive Voting Mode
              return (
                <div
                  key={opt.id}
                  onClick={() => handleOptionToggle(opt.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs sm:text-sm ${
                    isSelected
                      ? 'bg-emerald-50/80 border-2 border-emerald-500 text-emerald-950 shadow-xs font-semibold'
                      : 'bg-slate-50/80 hover:bg-emerald-50/40 border border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 bg-white'
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
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
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl transition-all shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
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
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
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

export default TeacherLivePollWidget;
