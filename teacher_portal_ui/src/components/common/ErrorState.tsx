import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  message = 'Failed to load data from faculty server.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`p-6 bg-rose-50/70 border border-rose-200/90 rounded-2xl shadow-xs text-center flex flex-col items-center justify-center ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-2.5">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-rose-950 mb-1">Notice</h3>
      <p className="text-xs text-rose-700 max-w-md leading-relaxed mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Request</span>
        </button>
      )}
    </div>
  );
}

export { ErrorState };
