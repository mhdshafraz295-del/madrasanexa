import { apiClient } from './api';

export interface ClassroomItem {
  id: string;
  madrasaId: string;
  name: string;
  roomNumber: string;
  building?: string | null;
  floor?: string | null;
  capacity?: number | null;
  roomToken: string;
  isActive: boolean;
  notes?: string | null;
  classId?: string | null;
  className?: string | null;
  classCode?: string | null;
  assignedScheduleCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListClassroomsResponse {
  success: boolean;
  data: {
    items: ClassroomItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ClassroomResponse {
  success: boolean;
  message?: string;
  data: {
    classroom?: ClassroomItem;
    [key: string]: any;
  };
}

export interface ClassroomQrPrintDataResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    roomNumber: string;
    building?: string | null;
    floor?: string | null;
    roomToken: string;
    isActive: boolean;
    qrPayload: string;
    venuePlaqueTitle: string;
    architecturalDisclaimer: string;
  };
}

export interface CreateClassroomPayload {
  name: string;
  roomNumber: string;
  building?: string;
  floor?: string;
  capacity?: number;
  notes?: string;
  classId?: string | null;
}

export interface UpdateClassroomPayload {
  name?: string;
  roomNumber?: string;
  building?: string | null;
  floor?: string | null;
  capacity?: number | null;
  notes?: string | null;
  classId?: string | null;
}

export async function listClassrooms(params: {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
} = {}): Promise<ListClassroomsResponse['data']> {
  const res = await apiClient.get<ListClassroomsResponse>('/madrasa-admin/classrooms', {
    params,
  });
  return res.data.data;
}

export async function getClassroom(id: string): Promise<ClassroomItem> {
  const res = await apiClient.get<ClassroomResponse>(`/madrasa-admin/classrooms/${id}`);
  return (res.data.data as any)?.classroom || (res.data.data as any);
}

export async function createClassroom(payload: CreateClassroomPayload): Promise<ClassroomItem> {
  const res = await apiClient.post<ClassroomResponse>('/madrasa-admin/classrooms', payload);
  return (res.data.data as any)?.classroom || (res.data.data as any);
}

export async function updateClassroom(id: string, payload: UpdateClassroomPayload): Promise<ClassroomItem> {
  const res = await apiClient.patch<ClassroomResponse>(`/madrasa-admin/classrooms/${id}`, payload);
  return (res.data.data as any)?.classroom || (res.data.data as any);
}

export async function regenerateClassroomQr(id: string): Promise<ClassroomItem> {
  const res = await apiClient.post<ClassroomResponse>(`/madrasa-admin/classrooms/${id}/regenerate-qr`);
  return (res.data.data as any)?.classroom || (res.data.data as any);
}

export async function revokeClassroomQr(id: string): Promise<ClassroomItem> {
  const res = await apiClient.post<ClassroomResponse>(`/madrasa-admin/classrooms/${id}/revoke-qr`);
  return (res.data.data as any)?.classroom || (res.data.data as any);
}

export async function activateClassroom(id: string): Promise<ClassroomItem> {
  const res = await apiClient.post<ClassroomResponse>(`/madrasa-admin/classrooms/${id}/activate`);
  return (res.data.data as any)?.classroom || (res.data.data as any);
}

export async function getClassroomQrPrintData(id: string): Promise<ClassroomQrPrintDataResponse['data']> {
  const res = await apiClient.get<ClassroomQrPrintDataResponse>(`/madrasa-admin/classrooms/${id}/qr-print`);
  return res.data.data;
}
