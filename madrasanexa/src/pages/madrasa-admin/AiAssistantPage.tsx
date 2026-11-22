import { useState, useEffect } from 'react';
import { aiService, type AiStatusResponse } from '../../services/ai.service';
import AiShowcaseLocked from '../../components/ai/AiShowcaseLocked';
import AiWorkspaceUnlocked from '../../components/ai/AiWorkspaceUnlocked';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function AiAssistantPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<AiStatusResponse | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await aiService.getAiStatus();
      setStatusData(res);
    } catch (err: any) {
      console.error('Failed to load AI status:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load AI Assistant information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <RefreshCw className="w-8 h-8 text-[#37C6A3] animate-spin" />
        <span className="text-xs font-semibold text-[#7C8A9A]">Loading MadrasaNexa AI Assistant...</span>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl p-8 border border-red-200 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[#0F172A]">Unable to Load AI Assistant</h3>
        <p className="text-xs text-[#7C8A9A] mt-1.5">{error || 'Unknown error occurred.'}</p>
        <button
          onClick={loadStatus}
          className="mt-5 px-5 py-2.5 min-h-[44px] text-xs font-bold text-white bg-[#0F172A] rounded-xl hover:bg-[#1E293B] transition cursor-pointer flex items-center justify-center mx-auto"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8">
      {statusData.aiEnabled ? (
        <AiWorkspaceUnlocked statusData={statusData} onRefresh={loadStatus} />
      ) : (
        <AiShowcaseLocked statusData={statusData} onRefresh={loadStatus} />
      )}
    </div>
  );
}
