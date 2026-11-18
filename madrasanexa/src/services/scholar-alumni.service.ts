import apiClient from './api';

export type AcademicStatus =
  | 'UNDERGRADUATE'
  | 'GRADUATE'
  | 'POSTGRADUATE'
  | 'WORKING_SCHOLAR';

export type ScholarApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AlumniScholarItem {
  id: string;
  madrasaId?: string;
  fullName: string;
  photoUrl?: string | null;
  batchYear: string;
  classOrDivision?: string | null;
  classId?: string | null;
  academicStatus: AcademicStatus;
  qualification: string;
  university: string;
  facultyOrDepartment?: string | null;
  currentRole?: string | null;
  cityCountry?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  showContactPublicly: boolean;
  availableForMentorship: boolean;
  approvalStatus: ScholarApprovalStatus;
  isFeatured: boolean;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AlumniHubKpis {
  totalApproved: number;
  pendingCount: number;
  undergraduatesCount: number;
  mentorsCount: number;
  totalCount: number;
}

export interface AlumniHubResponse {
  items: AlumniScholarItem[];
  kpis: AlumniHubKpis;
  showAlumniOnWebsite: boolean;
  madrasa: {
    id: string;
    code: string;
    slug: string;
    name: string;
  };
  availableBatchYears: string[];
  availableClassOrDivisions: string[];
}

export interface PublicAlumniResponse {
  madrasa: {
    id: string;
    name: string;
    code: string;
    slug: string;
    logoUrl?: string | null;
    showAlumniOnWebsite: boolean;
  };
  alumni: AlumniScholarItem[];
  batchYears: string[];
  classOrDivisions: string[];
  totalCount: number;
}

export interface ScholarCreatePayload {
  fullName: string;
  photoUrl?: string | null;
  batchYear: string;
  classOrDivision?: string | null;
  classId?: string | null;
  academicStatus: AcademicStatus;
  qualification: string;
  university: string;
  facultyOrDepartment?: string | null;
  currentRole?: string | null;
  cityCountry?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  showContactPublicly?: boolean;
  availableForMentorship?: boolean;
  approvalStatus?: ScholarApprovalStatus;
  isFeatured?: boolean;
}

// ---------------- Public Endpoints ----------------

export async function getPublicAlumni(madrasaCode: string): Promise<PublicAlumniResponse> {
  const response = await apiClient.get<{ success: boolean; data: PublicAlumniResponse }>(
    `/public/alumni/${encodeURIComponent(madrasaCode)}`
  );
  return response.data.data;
}

export async function submitPublicAlumni(
  madrasaCode: string,
  payload: ScholarCreatePayload
): Promise<AlumniScholarItem> {
  const response = await apiClient.post<{ success: boolean; data: AlumniScholarItem; message: string }>(
    `/public/alumni/${encodeURIComponent(madrasaCode)}/submit`,
    payload
  );
  return response.data.data;
}

// ---------------- Madrasa Admin Endpoints ----------------

export async function getAdminAlumniHub(params: {
  status?: string;
  batchYear?: string;
  classOrDivision?: string;
  search?: string;
} = {}): Promise<AlumniHubResponse> {
  const response = await apiClient.get<{ success: boolean; data: AlumniHubResponse }>(
    '/madrasa-admin/alumni-hub',
    { params }
  );
  return response.data.data;
}

export async function toggleWebsiteVisibility(showAlumniOnWebsite: boolean): Promise<{ showAlumniOnWebsite: boolean }> {
  const response = await apiClient.patch<{ success: boolean; data: { showAlumniOnWebsite: boolean } }>(
    '/madrasa-admin/alumni-hub/website-visibility',
    { showAlumniOnWebsite }
  );
  return response.data.data;
}

export async function createAdminScholar(payload: ScholarCreatePayload): Promise<AlumniScholarItem> {
  const response = await apiClient.post<{ success: boolean; data: AlumniScholarItem; message: string }>(
    '/madrasa-admin/alumni-hub',
    payload
  );
  return response.data.data;
}

export async function updateAdminScholar(
  id: string,
  payload: Partial<ScholarCreatePayload>
): Promise<AlumniScholarItem> {
  const response = await apiClient.patch<{ success: boolean; data: AlumniScholarItem; message: string }>(
    `/madrasa-admin/alumni-hub/${id}`,
    payload
  );
  return response.data.data;
}

export async function updateAdminScholarStatus(
  id: string,
  statusPayload: { approvalStatus?: ScholarApprovalStatus; isFeatured?: boolean }
): Promise<AlumniScholarItem> {
  const response = await apiClient.patch<{ success: boolean; data: AlumniScholarItem; message: string }>(
    `/madrasa-admin/alumni-hub/${id}/status`,
    statusPayload
  );
  return response.data.data;
}

export async function deleteAdminScholar(id: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/madrasa-admin/alumni-hub/${id}`
  );
  return response.data;
}
