import { apiClient } from './api';

export interface PlatformAiSettings {
  id?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  instructions: string;
  featuresList: string[];
}

export interface AiSubscriptionRequestItem {
  id: string;
  madrasaId: string;
  madrasa?: {
    id: string;
    name: string;
    code: string;
    slug?: string;
    aiEnabled: boolean;
    aiExpiresAt: string | null;
  };
  submittedByUser?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
  planName: string;
  amount: number;
  transactionRef: string;
  receiptKey?: string;
  receiptUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiStatusResponse {
  madrasaId?: string;
  madrasaName?: string;
  madrasaCode?: string;
  aiEnabled: boolean;
  rawAiEnabled?: boolean;
  aiExpiresAt: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
  settings: PlatformAiSettings;
  latestRequest: AiSubscriptionRequestItem | null;
}

export interface ExamGenerationResult {
  examContent: string;
  language: string;
  subject: string;
  topic: string;
}

export interface LessonPlanResult {
  lessonPlan: string;
  language: string;
  subject: string;
  topic: string;
}

export interface PosterGenerationResult {
  imageDataUrl: string;
  backgroundDataUrl?: string;
  modelUsed: string;
  title: string;
  eventTitle?: string;
  category: string;
  dateText?: string;
  dateTime?: string;
  venue?: string;
  madrasaName?: string;
  bismillahLine?: string;
  language?: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface ChatResult {
  reply: string;
  modelUsed: string;
  language?: string;
}

export const aiService = {
  // Conversational Copilot Chat & Dedicated Mode Routing
  async chatWithCopilot(data: FormData | {
    message: string;
    history?: Array<{ sender?: string; role?: string; content: string }>;
    language?: string;
    mode?: string;
    pastedText?: string;
    pdfText?: string;
  }): Promise<ChatResult> {
    const isFormData = data instanceof FormData;
    const res = await apiClient.post<{ success: boolean; data: ChatResult }>(
      '/ai/tools/chat',
      data,
      {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
        timeout: 90000,
      }
    );
    return res.data.data;
  },
  // Status check for tenant or super admin
  async getAiStatus(madrasaId?: string): Promise<AiStatusResponse> {
    const res = await apiClient.get<{ success: boolean; data: AiStatusResponse }>('/ai/status', {
      params: madrasaId ? { madrasaId } : undefined,
    });
    return res.data.data;
  },

  // Submit Bank Payment Receipt for activation
  async submitSubscriptionReceipt(formData: FormData): Promise<AiSubscriptionRequestItem> {
    const res = await apiClient.post<{ success: boolean; data: AiSubscriptionRequestItem }>(
      '/ai/subscription/submit-receipt',
      formData,
      {
        timeout: 30000,
      }
    );
    return res.data.data;
  },

  // AI Workspace Tool 1: Exam Generator
  async generateExamPaper(formData: FormData): Promise<ExamGenerationResult> {
    const res = await apiClient.post<{ success: boolean; data: ExamGenerationResult }>(
      '/ai/tools/exam-paper',
      formData,
      {
        timeout: 90000,
      }
    );
    return res.data.data;
  },

  // AI Workspace Tool 2: Ustadh Lesson Planner
  async generateLessonPlan(formData: FormData): Promise<LessonPlanResult> {
    const res = await apiClient.post<{ success: boolean; data: LessonPlanResult }>(
      '/ai/tools/lesson-plan',
      formData,
      {
        timeout: 90000,
      }
    );
    return res.data.data;
  },

  // AI Workspace Tool 3: Poster Maker
  async generatePoster(data: {
    title: string;
    themePrompt?: string;
    category?: string;
    dateText?: string;
    venue?: string;
    language?: string;
  }): Promise<PosterGenerationResult> {
    const res = await apiClient.post<{ success: boolean; data: PosterGenerationResult }>(
      '/ai/tools/poster',
      data,
      {
        timeout: 90000,
      }
    );
    return res.data.data;
  },

  // AI Workspace Tool 4: Multilingual Translator
  async translateContent(data: {
    text: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    language?: string;
  }): Promise<TranslationResult> {
    const res = await apiClient.post<{ success: boolean; data: TranslationResult }>(
      '/ai/tools/translate',
      data,
      {
        timeout: 90000,
      }
    );
    return res.data.data;
  },

  // ==========================================
  // Super Admin Management Methods
  // ==========================================
  async listAllRequests(params?: { status?: string; page?: number; limit?: number }) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        requests: AiSubscriptionRequestItem[];
        pagination: {
          page: number;
          limit: number;
          totalCount: number;
          totalPages: number;
        };
      };
    }>('/ai/admin/subscriptions', { params });
    return res.data.data;
  },

  async approveRequest(requestId: string, data?: { adminNote?: string; customExpiresAt?: string }) {
    const res = await apiClient.post(`/ai/admin/subscriptions/${requestId}/approve`, data);
    return res.data;
  },

  async rejectRequest(requestId: string, data?: { adminNote?: string }) {
    const res = await apiClient.post(`/ai/admin/subscriptions/${requestId}/reject`, data);
    return res.data;
  },

  async toggleMadrasaAi(madrasaId: string, data: { enabled: boolean; expiresAt?: string | null; note?: string }) {
    const res = await apiClient.post(`/ai/admin/madrasas/${madrasaId}/toggle`, data);
    return res.data;
  },

  async getPlatformSettings(): Promise<PlatformAiSettings> {
    const res = await apiClient.get<{ success: boolean; data: PlatformAiSettings }>('/ai/admin/settings');
    return res.data.data;
  },

  async updatePlatformSettings(data: Partial<PlatformAiSettings>): Promise<PlatformAiSettings> {
    const res = await apiClient.put<{ success: boolean; data: PlatformAiSettings }>('/ai/admin/settings', data);
    return res.data.data;
  },
};

export default aiService;
