import { apiClient } from './api';

export interface SubjectItem {
  id: string;
  madrasaId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
}

export interface AssessmentSubjectItem {
  id: string;
  madrasaId: string;
  assessmentId: string;
  subjectId: string;
  maxMark: number | string;
  passMark: number | string;
  sortOrder: number;
  subject?: SubjectItem;
}

export interface MarkingAssessmentItem {
  id: string;
  madrasaId: string;
  classId: string;
  academicYear: string;
  term: string;
  name: string;
  status: 'DRAFT' | 'FINALIZED';
  gpaScaleSnapshot?: GpaBandItem[] | null;
  class?: {
    id: string;
    name: string;
    code?: string | null;
    academicSection?: { id: string; name: string } | null;
  };
  assessmentSubjects?: AssessmentSubjectItem[];
  _count?: {
    assessmentSubjects: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentBreakdownSubject {
  assessmentSubjectId: string;
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  maxMark: number;
  passMark: number;
  mark: number | null;
  isEntered: boolean;
  percentage: number | null;
  status: 'PASS' | 'FAIL' | 'INCOMPLETE';
}

export interface CalculatedStudentResult {
  studentId: string;
  admissionNo: string;
  fullName: string;
  guardianName?: string | null;
  isComplete: boolean;
  totalObtained: number | null;
  maxPossible: number;
  overallPercentage: number | null;
  gpa: number | null;
  overallStatus: 'PASS' | 'FAIL' | 'INCOMPLETE';
  passedSubjectsCount: number;
  failedSubjectsCount: number;
  position: number | null;
  subjects: StudentBreakdownSubject[];
}

export interface SubjectAnalyticsItem {
  assessmentSubjectId: string;
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  maxMark: number;
  passMark: number;
  enteredCount: number;
  totalStudents: number;
  averageMark: number | null;
  averagePercentage: number | null;
  highestMark: number | null;
  lowestMark: number | null;
  passCount: number;
  failCount: number;
  passRate: number | null;
}

export interface ClassAnalyticsData {
  summary: {
    totalStudents: number;
    completedStudents: number;
    incompleteStudents: number;
    subjectsCount: number;
    classAverage: number | null;
    averageGpa: number | null;
    highestAverage: number | null;
    lowestAverage: number | null;
    passRate: number | null;
  };
  subjectAnalytics: SubjectAnalyticsItem[];
  topStudents: Array<{
    studentId: string;
    admissionNo: string;
    fullName: string;
    position: number;
    overallPercentage: number;
    gpa: number;
    overallStatus: string;
  }>;
  studentsRequiringAttention: Array<{
    studentId: string;
    admissionNo: string;
    fullName: string;
    failedSubjectsCount: number;
    overallPercentage: number | null;
    overallStatus: string;
    attentionReason: string;
  }>;
}

export interface AssessmentMarksResponse {
  assessment: MarkingAssessmentItem;
  subjects: AssessmentSubjectItem[];
  students: Array<{
    id: string;
    admissionNo: string;
    fullName: string;
    guardianName?: string | null;
  }>;
  results: CalculatedStudentResult[];
  analytics: ClassAnalyticsData;
  gpaScaleUsed: GpaBandItem[];
}

export interface GpaBandItem {
  minPercentage: number;
  maxPercentage: number;
  gpa: number;
}

// ==========================================
// API CLIENT FUNCTIONS
// ==========================================

export async function fetchAssessments(filters: { classId?: string; academicYear?: string; term?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.classId) params.append('classId', filters.classId);
  if (filters.academicYear) params.append('academicYear', filters.academicYear);
  if (filters.term) params.append('term', filters.term);

  const res = await apiClient.get<{ success: boolean; data: MarkingAssessmentItem[] }>(
    `/madrasa-admin/marking-hub/assessments?${params.toString()}`
  );
  return res.data.data;
}

export async function createAssessment(data: { classId: string; academicYear: string; term: string; name: string }) {
  const res = await apiClient.post<{ success: boolean; data: MarkingAssessmentItem }>(
    '/madrasa-admin/marking-hub/assessments',
    data
  );
  return res.data.data;
}

export async function fetchAssessment(id: string) {
  const res = await apiClient.get<{ success: boolean; data: MarkingAssessmentItem }>(
    `/madrasa-admin/marking-hub/assessments/${id}`
  );
  return res.data.data;
}

export async function updateAssessment(id: string, data: { academicYear?: string; term?: string; name?: string }) {
  const res = await apiClient.patch<{ success: boolean; data: MarkingAssessmentItem }>(
    `/madrasa-admin/marking-hub/assessments/${id}`,
    data
  );
  return res.data.data;
}

export async function finalizeAssessment(id: string) {
  const res = await apiClient.post<{ success: boolean; data: MarkingAssessmentItem; message: string }>(
    `/madrasa-admin/marking-hub/assessments/${id}/finalize`
  );
  return res.data;
}

export async function reopenAssessment(id: string) {
  const res = await apiClient.post<{ success: boolean; data: MarkingAssessmentItem; message: string }>(
    `/madrasa-admin/marking-hub/assessments/${id}/reopen`
  );
  return res.data;
}

export async function addAssessmentSubject(
  assessmentId: string,
  data: {
    subjectId?: string;
    newSubject?: { name: string; code?: string | null; description?: string | null };
    maxMark: number;
    passMark: number;
    sortOrder?: number;
  }
) {
  const res = await apiClient.post<{ success: boolean; data: AssessmentSubjectItem }>(
    `/madrasa-admin/marking-hub/assessments/${assessmentId}/subjects`,
    data
  );
  return res.data.data;
}

export async function removeAssessmentSubject(assessmentId: string, subjectId: string, force = false) {
  const res = await apiClient.delete<{ success: boolean; data: { success: boolean } }>(
    `/madrasa-admin/marking-hub/assessments/${assessmentId}/subjects/${subjectId}?force=${force}`
  );
  return res.data.data;
}

export async function fetchAssessmentMarks(assessmentId: string) {
  const res = await apiClient.get<{ success: boolean; data: AssessmentMarksResponse }>(
    `/madrasa-admin/marking-hub/assessments/${assessmentId}/marks`
  );
  return res.data.data;
}

export async function saveAssessmentMarks(
  assessmentId: string,
  marks: Array<{ studentId: string; assessmentSubjectId: string; mark: number | null }>
) {
  const res = await apiClient.put<{ success: boolean; data: AssessmentMarksResponse; message: string }>(
    `/madrasa-admin/marking-hub/assessments/${assessmentId}/marks`,
    { marks }
  );
  return res.data.data;
}

export async function fetchGpaSettings() {
  const res = await apiClient.get<{ success: boolean; data: GpaBandItem[] }>(
    '/madrasa-admin/marking-hub/gpa-settings'
  );
  return res.data.data;
}

export async function updateGpaSettings(bands: GpaBandItem[]) {
  const res = await apiClient.put<{ success: boolean; data: GpaBandItem[]; message: string }>(
    '/madrasa-admin/marking-hub/gpa-settings',
    { bands }
  );
  return res.data.data;
}

export async function fetchSubjects(query: { search?: string; isActive?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.search) params.append('search', query.search);
  if (query.isActive !== undefined) params.append('isActive', String(query.isActive));

  const res = await apiClient.get<{ success: boolean; data: SubjectItem[] }>(
    `/madrasa-admin/subjects?${params.toString()}`
  );
  return res.data.data;
}

export async function createSubject(data: { name: string; code?: string; description?: string }) {
  const res = await apiClient.post<{ success: boolean; data: SubjectItem }>(
    '/madrasa-admin/subjects',
    data
  );
  return res.data.data;
}

export async function downloadAllStudentsPdf(assessmentId: string, defaultFilename: string) {
  const res = await apiClient.get(
    `/madrasa-admin/marking-hub/assessments/${assessmentId}/export/pdf`,
    { responseType: 'blob' }
  );

  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadClassCsv(assessmentId: string, defaultFilename: string) {
  const res = await apiClient.get(
    `/madrasa-admin/marking-hub/assessments/${assessmentId}/export/csv`,
    { responseType: 'blob' }
  );

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
