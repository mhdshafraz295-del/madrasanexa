import { apiClient } from './api';

export interface PollOption {
  id: string;
  label: string;
  sortOrder: number;
  voteCount: number;
  percentage: number;
  isUserChoice?: boolean;
}

export interface ParticipatingMadrasa {
  madrasaId: string;
  madrasaName: string;
  madrasaCode: string;
  adminVotes: number;
  teacherVotes: number;
  totalVotes: number;
}

export interface PollStats {
  totalVotes: number;
  totalVotersCount: number;
  participatingMadrasasCount: number;
  adminVotesCount: number;
  teacherVotesCount: number;
  participatingMadrasas: ParticipatingMadrasa[];
}

export interface PlatformPollItem {
  id: string;
  title: string;
  description?: string | null;
  category: 'GOVERNANCE' | 'ACADEMIC' | 'CALENDAR' | 'CURRICULUM' | 'FEEDBACK';
  targetAudience: 'MADRASA_ADMINS' | 'TEACHERS' | 'ALL';
  targetMadrasaIds?: string[] | null;
  allowMultipleChoice: boolean;
  isAnonymous: boolean;
  status: 'ACTIVE' | 'CLOSED';
  closesAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  options: PollOption[];
  stats?: PollStats;
  // User voting view fields
  hasVoted?: boolean;
  userSelectedOptionIds?: string[];
  totalVotes?: number;
}

export interface PollKPIs {
  totalPolls: number;
  activePolls: number;
  totalVotesCast: number;
  participatingMadrasasCount: number;
  totalActiveMadrasas?: number;
}

export interface SuperAdminPollsResponse {
  kpis: PollKPIs;
  allMadrasas: Array<{ id: string; name: string; code: string }>;
  polls: PlatformPollItem[];
}

export interface CreatePollPayload {
  title: string;
  description?: string;
  category: 'GOVERNANCE' | 'ACADEMIC' | 'CALENDAR' | 'CURRICULUM' | 'FEEDBACK';
  targetAudience: 'MADRASA_ADMINS' | 'TEACHERS' | 'ALL';
  targetMadrasaIds?: string[];
  allowMultipleChoice: boolean;
  isAnonymous: boolean;
  closesAt?: string | null;
  options: string[];
}

// Super Admin APIs
export async function getSuperAdminPolls(): Promise<SuperAdminPollsResponse> {
  const res = await apiClient.get<{ success: boolean; data: SuperAdminPollsResponse }>('/super-admin/polls');
  return res.data.data;
}

export async function createSuperAdminPoll(payload: CreatePollPayload): Promise<PlatformPollItem> {
  const res = await apiClient.post<{ success: boolean; data: PlatformPollItem }>('/super-admin/polls', payload);
  return res.data.data;
}

export async function updateSuperAdminPollStatus(pollId: string, status: 'ACTIVE' | 'CLOSED'): Promise<PlatformPollItem> {
  const res = await apiClient.patch<{ success: boolean; data: PlatformPollItem }>(`/super-admin/polls/${pollId}/status`, { status });
  return res.data.data;
}

export async function deleteSuperAdminPoll(pollId: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean; message: string } }>(`/super-admin/polls/${pollId}`);
  return res.data.data;
}

// Madrasa Admin & User Voting APIs
export async function getMadrasaAdminPolls(): Promise<PlatformPollItem[]> {
  const res = await apiClient.get<{ success: boolean; data: PlatformPollItem[] }>('/madrasa-admin/polls');
  return res.data.data;
}

export async function voteMadrasaAdminPoll(pollId: string, optionIds: string[]): Promise<PlatformPollItem> {
  const res = await apiClient.post<{ success: boolean; data: PlatformPollItem }>(`/madrasa-admin/polls/${pollId}/vote`, { optionIds });
  return res.data.data;
}
