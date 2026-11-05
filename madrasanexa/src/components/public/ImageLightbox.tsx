import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl: string | null;
  altText: string;
  caption?: string | null;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  imageUrl,
  altText,
  caption,
  onClose,
  triggerRef,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember previous active element to restore focus on close
    previouslyFocusedElement.current = (document.activeElement as HTMLElement) || null;

    // Lock body scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move initial focus to the close button inside modal
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape key closes the modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // 2. Tab / Shift+Tab Focus Trap
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.offsetParent !== null);

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: wrap from first to last, or bring into dialog if focus escaped
          if (document.activeElement === first || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: wrap from last to first, or bring into dialog if focus escaped
          if (document.activeElement === last || !dialog.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      // Restore body scrolling
      document.body.style.overflow = originalOverflow;
      // Remove keydown listener
      window.removeEventListener('keydown', handleKeyDown);

      // Return focus to trigger element or previously focused element
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={altText || 'Expanded image viewer'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-8 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="absolute -top-12 right-0 md:top-2 md:right-2 z-10 p-2.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 hover:text-emerald-400 transition-colors shadow-lg border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* High-Resolution Expanded Image */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-slate-950/80">
          <img
            src={imageUrl}
            alt={altText || 'Expanded preview'}
            className="max-h-[80vh] max-w-full object-contain select-none"
          />

          {/* Caption / Alt overlay */}
          {(caption || altText) && (
            <div className="p-4 bg-slate-900/90 border-t border-white/10 text-center">
              {caption ? (
                <>
                  <p className="text-white text-sm md:text-base font-medium">{caption}</p>
                  {altText && altText !== caption && (
                    <p className="text-slate-400 text-xs mt-0.5">{altText}</p>
                  )}
                </>
              ) : (
                <p className="text-slate-300 text-sm">{altText}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
