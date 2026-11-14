import { apiClient } from './api';
import type { ApiResponse } from './api';

export interface CardTokenListItem {
  studentId: string;
  admissionNo: string;
  fullName: string;
  studentStatus: string;
  classId: string | null;
  className: string | null;
  hasActiveToken: boolean;
  tokenId: string | null;
  tokenHint: string | null;
  version: number | null;
  scanCount: number;
  lastScannedAt: string | null;
  issuedAt: string | null;
}

export interface ListCardTokensParams {
  classId?: string;
  search?: string;
  status?: 'ALL' | 'ACTIVE_TOKEN' | 'MISSING_TOKEN' | 'REVOKED';
  page?: number;
  pageSize?: number;
}

export interface ListCardTokensResponse {
  items: CardTokenListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IssueCardTokenResponse {
  tokenId: string;
  tokenHint: string;
  version: number;
  rawToken: string;
  issuedAt: string;
}

export interface BatchGenerateTokensResponse {
  totalEligible: number;
  generatedCount: number;
  skippedCount: number;
}

export interface CardStudentProfile {
  id: string;
  admissionNo: string;
  fullName: string;
  className: string | null;
  classId: string | null;
  admissionDate: string;
  photoFileId: string | null;
  status: string;
}

export interface CardSecretData {
  tokenId: string;
  tokenHint: string;
  version: number;
  issuedAt: string;
  rawToken: string;
}

export interface CardPrintData {
  student: CardStudentProfile;
  card: CardSecretData;
}

export interface BatchCardPrintDataResponse {
  cards: CardPrintData[];
}

export interface RegenerateCardTokenResponse {
  tokenId: string;
  tokenHint: string;
  version: number;
  rawToken: string;
  previousTokenId: string | null;
  issuedAt: string;
}

export interface RevokeCardTokenResponse {
  id: string;
  tokenHint: string;
  version: number;
  isActive: boolean;
  revokedAt: string;
  revokedById: string | null;
  revokeReason: string;
}

export interface CardTokenHistoryItem {
  id: string;
  tokenHint: string;
  version: number;
  isActive: boolean;
  issuedAt: string;
  issuedById: string | null;
  revokedAt: string | null;
  revokedById: string | null;
  revokeReason: string | null;
  scanCount: number;
  lastScannedAt: string | null;
  createdAt: string;
}

/**
 * Lists students and their card token statuses within tenant boundary.
 * Never leaks raw tokens or cryptographic secrets.
 */
export async function apiListCardTokens(
  params?: ListCardTokensParams
): Promise<ListCardTokensResponse> {
  const response = await apiClient.get<ApiResponse<ListCardTokensResponse>>(
    '/madrasa-admin/students/card-tokens',
    { params }
  );
  return response.data.data;
}

/**
 * Issues an initial canonical card token for a student without an active card.
 */
export async function apiIssueCardToken(
  studentId: string
): Promise<IssueCardTokenResponse> {
  const response = await apiClient.post<ApiResponse<IssueCardTokenResponse>>(
    `/madrasa-admin/students/${studentId}/card-tokens/issue`
  );
  return response.data.data;
}

/**
 * Additive batch token generation for students missing active cards.
 * Skips students who already have active tokens.
 */
export async function apiBatchGenerateTokens(payload?: {
  classId?: string;
}): Promise<BatchGenerateTokensResponse> {
  const response = await apiClient.post<ApiResponse<BatchGenerateTokensResponse>>(
    '/madrasa-admin/students/card-tokens/batch-generate',
    payload || {}
  );
  return response.data.data;
}

/**
 * Retrieves decrypted card print data for a single student.
 * Uses POST and Cache-Control: no-store to prevent caching.
 * NOTE: Raw token must only be held in ephemeral component state.
 */
export async function apiGetCardPrintData(
  studentId: string
): Promise<CardPrintData> {
  const response = await apiClient.post<ApiResponse<CardPrintData>>(
    `/madrasa-admin/students/${studentId}/card-tokens/print-data`
  );
  return response.data.data;
}

/**
 * Retrieves decrypted card print data for a batch of students.
 * Uses POST and Cache-Control: no-store.
 */
export async function apiGetBatchCardPrintData(payload: {
  studentIds?: string[];
  classId?: string;
}): Promise<BatchCardPrintDataResponse> {
  const response = await apiClient.post<ApiResponse<BatchCardPrintDataResponse>>(
    '/madrasa-admin/students/card-tokens/batch-print-data',
    payload
  );
  return response.data.data;
}

/**
 * Atomically revokes existing active card token and issues a replacement.
 * Requires mandatory reason >= 3 characters.
 */
export async function apiRegenerateCardToken(
  studentId: string,
  reason: string
): Promise<RegenerateCardTokenResponse> {
  const response = await apiClient.post<ApiResponse<RegenerateCardTokenResponse>>(
    `/madrasa-admin/students/${studentId}/card-tokens/regenerate`,
    { reason }
  );
  return response.data.data;
}

/**
 * Revokes active card token with mandatory reason >= 3 characters.
 */
export async function apiRevokeCardToken(
  studentId: string,
  reason: string
): Promise<RevokeCardTokenResponse> {
  const response = await apiClient.post<ApiResponse<RevokeCardTokenResponse>>(
    `/madrasa-admin/students/${studentId}/card-tokens/revoke`,
    { reason }
  );
  return response.data.data;
}

/**
 * Retrieves full audit history of tokens issued for a student.
 */
export async function apiGetCardTokenHistory(
  studentId: string
): Promise<CardTokenHistoryItem[]> {
  const response = await apiClient.get<ApiResponse<CardTokenHistoryItem[]>>(
    `/madrasa-admin/students/${studentId}/card-tokens/history`
  );
  return response.data.data;
}

/**
 * Renders batch A4 card sheets into a downloadable PDF via the server Puppeteer singleton.
 */
export async function apiRenderBatchCardPdf(payload: {
  html: string;
  title?: string;
}): Promise<Blob> {
  const response = await apiClient.post(
    '/madrasa-admin/students/card-tokens/render-sheet-pdf',
    payload,
    { responseType: 'blob' }
  );
  return response.data;
}

