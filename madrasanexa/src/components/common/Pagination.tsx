import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
  hideIfSinglePage?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'records',
  className = '',
  hideIfSinglePage = true,
}) => {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  if (hideIfSinglePage && totalPages <= 1) {
    return null;
  }

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-3 border-t border-slate-100 bg-slate-50/50 ${className}`}
    >
      <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
        Showing <span className="font-semibold text-slate-700">{startIndex}–{endIndex}</span> of{' '}
        <span className="font-semibold text-slate-700">{totalItems}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous Page"
          className="h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, index) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="h-8 w-6 flex items-center justify-center text-xs text-slate-400 select-none"
                >
                  &hellip;
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next Page"
          className="h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
