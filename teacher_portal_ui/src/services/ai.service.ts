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

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem(AUTH_STORAGE_KEYS.TEACHER_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const teacherAiService = {
  async getAiStatus(): Promise<AiStatusResponse> {
    const res = await fetch(`${BASE_URL}/ai/status`, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch AI Assistant status.');
    }
    const json = await res.json();
    return json.data;
  },

  async generateExamPaper(formData: FormData): Promise<ExamGenerationResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/exam-paper`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to generate exam paper.');
    }
    const json = await res.json();
    return json.data;
  },

  async generateLessonPlan(formData: FormData): Promise<LessonPlanResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/lesson-plan`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to generate lesson plan.');
    }
    const json = await res.json();
    return json.data;
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to generate poster.');
    }
    const json = await res.json();
    return json.data;
  },

  async translateContent(data: {
    text: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  }): Promise<TranslationResult> {
    const res = await fetch(`${BASE_URL}/ai/tools/translate`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to translate content.');
    }
    const json = await res.json();
    return json.data;
  },
};

export default teacherAiService;
