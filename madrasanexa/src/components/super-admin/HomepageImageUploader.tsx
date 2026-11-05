import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import {
  apiUploadHomepageImages,
} from '../../services/homepage.service';

interface HomepageImageUploaderProps {
  section: 'hero' | 'product-preview' | 'features';
  currentUrl?: string | null;
  currentAlt?: string | null;
  onImageSelected: (data: { fileId: string; url: string; suggestedAlt: string }) => void;
  onImageCleared?: () => void;
  label?: string;
  helperText?: string;
}

/**
 * Derives a human-friendly alt text recommendation from a clean file name.
 */
function deriveAltTextFromFilename(filename: string): string {
  if (!filename) return '';
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const clean = withoutExt
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export const HomepageImageUploader: React.FC<HomepageImageUploaderProps> = ({
  section,
  currentUrl,
  currentAlt,
  onImageSelected,
  onImageCleared,
  label = 'Upload Screenshot / Visual Image',
  helperText = 'Supported formats: JPG, PNG, WebP (Max 5 MB)',
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Client-side quick validations
    if (file.size > 5 * 1024 * 1024) {
      setError('Selected image exceeds the 5 MB limit.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const uploadedList = await apiUploadHomepageImages([file], section);
      if (uploadedList && uploadedList.length > 0) {
        const item = uploadedList[0];
        const suggestedAlt = deriveAltTextFromFilename(file.name);
        onImageSelected({
          fileId: item.fileId,
          url: item.url,
          suggestedAlt,
        });
      }
    } catch (err: any) {
      console.error('[HomepageImageUploader] Upload failed:', err);
      setError(
        err?.response?.data?.message || err?.message || 'Failed to upload image. Please try again.'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Current Preview or Upload Area */}
      {currentUrl ? (
        <div className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-16 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700">
              <img
                src={currentUrl}
                alt={currentAlt || 'Selected image preview'}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="truncate text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                {currentAlt || 'Image attached'}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                Ready for draft save & publication
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              Replace
            </button>
            {onImageCleared && (
              <button
                type="button"
                onClick={onImageCleared}
                disabled={uploading}
                aria-label="Remove image"
                className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-900/40'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center py-3 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Optimizing and uploading to R2 storage...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Click to upload or drag and drop
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {helperText}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFileChange(e.target.files)}
        className="hidden"
      />

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
