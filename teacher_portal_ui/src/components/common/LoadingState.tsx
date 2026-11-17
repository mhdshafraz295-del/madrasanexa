import React from 'react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export default function LoadingState({ message = 'Loading faculty records...', className = '' }: LoadingStateProps) {
  return (
    <div className={`p-8 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col items-center justify-center text-center ${className}`}>
      <div className="relative mb-3">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-[#0D9488] rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-[#37C6A3] rounded-full animate-ping" />
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-700">{message}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Contacting MadrasaNexa secure API...</p>
    </div>
  );
}

export { LoadingState };
