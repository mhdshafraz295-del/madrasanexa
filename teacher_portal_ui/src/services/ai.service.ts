import { BASE_URL, AUTH_STORAGE_KEYS } from './api';

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

export interface AiStatusResponse {
  madrasaId?: string;
  madrasaName?: string;
  madrasaCode?: string;
  isActive: boolean;
  aiEnabled: boolean;
  rawAiEnabled?: boolean;
  aiExpiresAt: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
  settings: PlatformAiSettings;
  latestRequest: any;
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

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response, defaultMessage: string): Promise<T> {
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const error: any = new Error(errData.message || defaultMessage);
    error.status = res.status;
    error.response = { status: res.status, data: errData };
    throw error;
  }
  const json = await res.json();
  return json.data;
}

export const teacherAiService = {
  async chatWithCopilot(data: FormData | {
    message: string;
    history?: Array<{ sender?: string; role?: string; content: string }>;
    language?: string;
    mode?: string;
    pastedText?: string;
    pdfText?: string;
  }): Promise<ChatResult> {
    const isFormData = data instanceof FormData;
    const res = await fetch(`${BASE_URL}/ai/tools/chat`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      },
      body: isFormData ? data : JSON.stringify(data),
    });
    return handleResponse<ChatResult>(res, 'Failed to generate response.');
  },

  async getAiStatus(): Promise<AiStatusResponse> {
    const res = await fetch(`${BASE_URL}/ai/status?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<AiStatusResponse>(res, 'Failed to fetch AI Assistant status.');
  },

  async generateExamPaper(formData: FormData): Promise<ExamGenerationResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/exam-paper`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    });
    return handleResponse<ExamGenerationResult>(res, 'Failed to generate exam paper.');
  },

  async generateLessonPlan(formData: FormData): Promise<LessonPlanResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/lesson-plan`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    });
    return handleResponse<LessonPlanResult>(res, 'Failed to generate lesson plan.');
  },

  async generatePoster(data: {
    title: string;
    themePrompt?: string;
    category?: string;
    dateText?: string;
    venue?: string;
    language?: string;
  }): Promise<PosterGenerationResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/poster`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<PosterGenerationResult>(res, 'Failed to generate poster.');
  },

  async translateContent(data: {
    text: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    language?: string;
  }): Promise<TranslationResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/translate`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<TranslationResult>(res, 'Failed to translate content.');
  },
};

export default teacherAiService;
