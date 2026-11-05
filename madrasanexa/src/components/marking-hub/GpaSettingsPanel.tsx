import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type { GpaBandItem } from '../../services/marking-hub.service';
import {
  fetchGpaSettings,
  updateGpaSettings,
} from '../../services/marking-hub.service';

const DEFAULT_BANDS: GpaBandItem[] = [
  { minPercentage: 85, maxPercentage: 100, gpa: 4.0 },
  { minPercentage: 75, maxPercentage: 84.99, gpa: 3.5 },
  { minPercentage: 65, maxPercentage: 74.99, gpa: 3.0 },
  { minPercentage: 55, maxPercentage: 64.99, gpa: 2.5 },
  { minPercentage: 45, maxPercentage: 54.99, gpa: 2.0 },
  { minPercentage: 35, maxPercentage: 44.99, gpa: 1.5 },
  { minPercentage: 0, maxPercentage: 34.99, gpa: 0.0 },
];

export const GpaSettingsPanel: React.FC = () => {
  const [bands, setBands] = useState<GpaBandItem[]>(DEFAULT_BANDS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await fetchGpaSettings();
      if (data && Array.isArray(data) && data.length > 0) {
        setBands(data);
      } else {
        setBands(DEFAULT_BANDS);
      }
    } catch (err: any) {
      console.error('Failed to load GPA settings', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load GPA settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBandChange = (
    index: number,
    field: 'minPercentage' | 'maxPercentage' | 'gpa',
    val: string
  ) => {
    const num = val === '' ? 0 : Number(val);
    setBands((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: num };
      return updated;
    });
    setSuccessMessage(null);
  };

  const handleAddBand = () => {
    setBands((prev) => [
      ...prev,
      { minPercentage: 0, maxPercentage: 0, gpa: 0.0 },
    ]);
    setSuccessMessage(null);
  };

  const handleRemoveBand = (index: number) => {
    if (bands.length <= 1) return;
    setBands((prev) => prev.filter((_, i) => i !== index));
    setSuccessMessage(null);
  };

  const handleResetDefault = () => {
    setBands(DEFAULT_BANDS);
    setSuccessMessage('Reset to standard default GPA scale. Click "Save GPA Scale" to apply.');
  };

  // Basic validation check
  const validateBands = (): string | null => {
    if (bands.length === 0) return 'At least one GPA band is required';

    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      if (b.minPercentage < 0 || b.maxPercentage > 100) {
        return `Band #${i + 1}: Percentages must be between 0 and 100`;
      }
      if (b.minPercentage > b.maxPercentage) {
        return `Band #${i + 1}: Min percentage (${b.minPercentage}) cannot exceed Max (${b.maxPercentage})`;
      }
      if (b.gpa < 0 || b.gpa > 4.0) {
        return `Band #${i + 1}: GPA must be between 0.00 and 4.00`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const valErr = validateBands();
    if (valErr) {
      setErrorMessage(valErr);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      await updateGpaSettings(bands);
      setSuccessMessage('GPA scale settings successfully saved');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save GPA settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 p-8 text-center text-xs text-stone-500 shadow-xs">
        Loading GPA scale configuration...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">GPA Scale Configuration</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure the numeric GPA bands used to evaluate student percentages
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save GPA Scale'}
          </button>
        </div>
      </div>

      {/* Preservation Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-900">Historical Result Preservation Rule</p>
          <p className="text-amber-700 leading-relaxed">
            Assessments that are <strong>FINALIZED</strong> capture an immutable snapshot of the GPA scale
            active at the time of finalization. Editing the scale below will apply to new and draft
            assessments, but will <em>not</em> alter past finalized report cards.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* GPA Bands Table */}
      <div className="border border-stone-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider">
              <th className="p-3 text-center w-12">#</th>
              <th className="p-3">Min %</th>
              <th className="p-3">Max %</th>
              <th className="p-3">Numeric GPA</th>
              <th className="p-3 text-right pr-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {bands.map((band, idx) => (
              <tr key={idx} className="hover:bg-stone-50/50">
                <td className="p-3 text-center text-stone-400 font-medium">{idx + 1}</td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={band.minPercentage}
                    onChange={(e) => handleBandChange(idx, 'minPercentage', e.target.value)}
                    className="w-24 h-8 px-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="ml-1 text-stone-400">%</span>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={band.maxPercentage}
                    onChange={(e) => handleBandChange(idx, 'maxPercentage', e.target.value)}
                    className="w-24 h-8 px-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="ml-1 text-stone-400">%</span>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4.0"
                    value={band.gpa}
                    onChange={(e) => handleBandChange(idx, 'gpa', e.target.value)}
                    className="w-20 h-8 px-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold font-mono text-emerald-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </td>
                <td className="p-3 text-right pr-4">
                  {bands.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBand(idx)}
                      className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove Band"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={handleAddBand}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-stone-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-stone-600 hover:text-emerald-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add GPA Band
        </button>

        <p className="text-[11px] text-stone-400">
          Tip: Bands should be continuous without gaps (e.g. 85-100, 75-84.99).
        </p>
      </div>
    </div>
  );
};
