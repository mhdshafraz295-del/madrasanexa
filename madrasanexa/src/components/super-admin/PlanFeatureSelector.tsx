import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react';
import type { FeatureCategoryGroup, FeatureCatalogueItem } from '../../services/api';

interface PlanFeatureSelectorProps {
  categories: FeatureCategoryGroup[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

export const PlanFeatureSelector: React.FC<PlanFeatureSelectorProps> = ({
  categories,
  selectedKeys,
  onChange,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryNumber, setSelectedCategoryNumber] = useState<number | 'ALL'>('ALL');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<number, boolean>>({});

  // Flatten all assignable implemented features for global stats
  const allAssignableFeatures = useMemo(() => {
    const list: FeatureCatalogueItem[] = [];
    for (const group of categories) {
      for (const feat of group.features) {
        if (feat.status === 'IMPLEMENTED' && feat.isAssignable) {
          list.push(feat);
        }
      }
    }
    return list;
  }, [categories]);

  const allAssignableKeySet = useMemo(() => {
    return new Set(allAssignableFeatures.map((f) => f.key));
  }, [allAssignableFeatures]);

  // Set for fast lookup of selected keys
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  // Toggle individual feature
  const handleToggleFeature = (key: string, isAssignable: boolean, status: string) => {
    if (disabled || !isAssignable || status !== 'IMPLEMENTED') return;

    if (selectedSet.has(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  // Toggle category bulk selection
  const handleToggleCategory = (group: FeatureCategoryGroup, selectAll: boolean) => {
    if (disabled) return;

    const assignableInGroup = group.features
      .filter((f) => f.status === 'IMPLEMENTED' && f.isAssignable)
      .map((f) => f.key);

    if (assignableInGroup.length === 0) return;

    if (selectAll) {
      const merged = Array.from(new Set([...selectedKeys, ...assignableInGroup]));
      onChange(merged);
    } else {
      const groupKeySet = new Set(assignableInGroup);
      onChange(selectedKeys.filter((k) => !groupKeySet.has(k)));
    }
  };

  // Global select all assignable
  const handleSelectAllGlobal = () => {
    if (disabled) return;
    onChange(allAssignableFeatures.map((f) => f.key));
  };

  // Global deselect all
  const handleDeselectAllGlobal = () => {
    if (disabled) return;
    onChange([]);
  };

  // Toggle accordion expand/collapse
  const toggleAccordion = (num: number) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [num]: !prev[num],
    }));
  };

  // Expand all / Collapse all
  const handleToggleAllAccordions = (collapse: boolean) => {
    const next: Record<number, boolean> = {};
    for (const cat of categories) {
      next[cat.number] = collapse;
    }
    setCollapsedCategories(next);
  };

  // Filter categories and features based on search & category filter
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .map((group) => {
        if (selectedCategoryNumber !== 'ALL' && group.number !== selectedCategoryNumber) {
          return null;
        }

        const filteredFeatures = group.features.filter((feat) => {
          if (!query) return true;
          return (
            feat.name.toLowerCase().includes(query) ||
            feat.key.toLowerCase().includes(query) ||
            feat.description.toLowerCase().includes(query) ||
            feat.categoryName.toLowerCase().includes(query)
          );
        });

        if (filteredFeatures.length === 0) return null;

        return {
          ...group,
          features: filteredFeatures,
        };
      })
      .filter((g): g is FeatureCategoryGroup => g !== null);
  }, [categories, searchQuery, selectedCategoryNumber]);

  return (
    <div className="space-y-4 text-xs text-[#0F172A]">
      {/* 1. Global Toolbar: Search + Quick Category Filter */}
      <div className="bg-[#F7F6F1] p-3.5 rounded-2xl border border-[#E7E9EE] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7C8A9A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search features by name, key, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled}
              className="w-full pl-9 pr-8 py-2 bg-white rounded-xl border border-[#E7E9EE] focus:border-[#37C6A3] focus:outline-none text-xs text-[#0F172A] placeholder-[#7C8A9A]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C8A9A] hover:text-[#0F172A] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Global Bulk Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleSelectAllGlobal}
              disabled={disabled || selectedKeys.length === allAssignableFeatures.length}
              className="px-3 py-1.5 bg-white hover:bg-[#E7E9EE] text-[#0F172A] border border-[#E7E9EE] rounded-xl font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#37C6A3]" />
              <span>Select All 61</span>
            </button>
            <button
              type="button"
              onClick={handleDeselectAllGlobal}
              disabled={disabled || selectedKeys.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-[#E7E9EE] text-[#7C8A9A] hover:text-[#0F172A] border border-[#E7E9EE] rounded-xl font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Category Filter Chips & Expand/Collapse Toggles */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E7E9EE]/60">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedCategoryNumber('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 cursor-pointer ${
                selectedCategoryNumber === 'ALL'
                  ? 'bg-[#0F172A] text-white shadow-2xs'
                  : 'bg-white text-[#7C8A9A] hover:text-[#0F172A] border border-[#E7E9EE]'
              }`}
            >
              All Categories ({categories.length})
            </button>
            {categories.map((cat) => {
              const countInCat = cat.features.filter(
                (f) => f.status === 'IMPLEMENTED' && f.isAssignable && selectedSet.has(f.key)
              ).length;
              const totalAssignableInCat = cat.features.filter(
                (f) => f.status === 'IMPLEMENTED' && f.isAssignable
              ).length;

              return (
                <button
                  key={cat.number}
                  type="button"
                  onClick={() => setSelectedCategoryNumber(cat.number)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition shrink-0 cursor-pointer flex items-center gap-1 ${
                    selectedCategoryNumber === cat.number
                      ? 'bg-[#0F172A] text-white shadow-2xs'
                      : 'bg-white text-[#7C8A9A] hover:text-[#0F172A] border border-[#E7E9EE]'
                  }`}
                >
                  <span>{cat.name}</span>
                  {totalAssignableInCat > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                        selectedCategoryNumber === cat.number
                          ? 'bg-white/20 text-white'
                          : countInCat > 0
                          ? 'bg-emerald-50 text-[#059669]'
                          : 'bg-slate-100 text-[#7C8A9A]'
                      }`}
                    >
                      {countInCat}/{totalAssignableInCat}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0 pl-2">
            <button
              type="button"
              onClick={() => handleToggleAllAccordions(false)}
              className="text-[10px] text-[#7C8A9A] hover:text-[#0F172A] underline cursor-pointer"
            >
              Expand
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => handleToggleAllAccordions(true)}
              className="text-[10px] text-[#7C8A9A] hover:text-[#0F172A] underline cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>
      </div>

      {/* 2. Selection Stats Banner */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-emerald-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#059669]" />
          <span className="font-semibold text-xs">
            {selectedKeys.filter((k) => allAssignableKeySet.has(k)).length} of {allAssignableFeatures.length} Plan-Assignable Features Selected
          </span>
        </div>
        <span className="text-[11px] text-slate-600 font-medium">
          20 Core platform features (Catalogue classification)
        </span>
      </div>

      {/* 3. Category Accordion List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {filteredCategories.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#E7E9EE] text-[#7C8A9A]">
            <Layers className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <p className="font-semibold text-xs text-[#0F172A]">No features match your query</p>
            <p className="text-[11px] mt-0.5">Try a different search term or category filter.</p>
          </div>
        ) : (
          filteredCategories.map((group) => {
            const isCollapsed = Boolean(collapsedCategories[group.number]);
            const assignableInGroup = group.features.filter(
              (f) => f.status === 'IMPLEMENTED' && f.isAssignable
            );
            const selectedInGroup = assignableInGroup.filter((f) => selectedSet.has(f.key));
            const isAllSelectedInGroup =
              assignableInGroup.length > 0 && selectedInGroup.length === assignableInGroup.length;

            return (
              <div
                key={group.number}
                className="bg-white rounded-2xl border border-[#E7E9EE] overflow-hidden shadow-2xs transition"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleAccordion(group.number)}
                  className="px-4 py-3 bg-[#F7F6F1]/50 hover:bg-[#F7F6F1] flex items-center justify-between cursor-pointer border-b border-[#E7E9EE] transition select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      className="text-[#7C8A9A] hover:text-[#0F172A] p-0.5"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <div className="font-bold text-xs text-[#0F172A] flex items-center gap-2">
                        <span>{group.label}</span>
                        {assignableInGroup.length > 0 && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              selectedInGroup.length === assignableInGroup.length
                                ? 'bg-emerald-100 text-emerald-800'
                                : selectedInGroup.length > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {selectedInGroup.length} / {assignableInGroup.length} selected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Category-Level Quick Actions */}
                  {assignableInGroup.length > 0 && !disabled && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleCategory(group, !isAllSelectedInGroup)}
                        className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-white border border-[#E7E9EE] text-[#0F172A] hover:bg-[#E7E9EE] cursor-pointer transition"
                      >
                        {isAllSelectedInGroup ? 'Clear Cat' : 'Select All'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Features List */}
                {!isCollapsed && (
                  <div className="divide-y divide-[#E7E9EE]/60">
                    {group.features.map((feat) => {
                      const isImplemented = feat.status === 'IMPLEMENTED' && feat.isAssignable;
                      const isCore = feat.status === 'CORE';
                      const isPartial = feat.status === 'PARTIALLY_IMPLEMENTED';
                      const isPlanned = feat.status === 'PLANNED';
                      const isChecked = isCore ? true : selectedSet.has(feat.key);

                      return (
                        <div
                          key={feat.key}
                          onClick={() => {
                            if (isImplemented) {
                              handleToggleFeature(feat.key, feat.isAssignable, feat.status);
                            }
                          }}
                          className={`p-3.5 flex items-start gap-3 transition ${
                            isImplemented
                              ? 'cursor-pointer hover:bg-[#F7F6F1]/50'
                              : 'bg-slate-50/50 cursor-not-allowed opacity-80'
                          }`}
                        >
                          {/* Checkbox / Indicator */}
                          <div className="pt-0.5 shrink-0">
                            {isCore ? (
                              <div
                                title="Core Platform Classification (Not plan-assignable)"
                                className="w-4 h-4 rounded bg-slate-200 text-slate-600 flex items-center justify-center"
                              >
                                <Lock className="w-2.5 h-2.5" />
                              </div>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={disabled || !isImplemented}
                                onChange={() =>
                                  handleToggleFeature(feat.key, feat.isAssignable, feat.status)
                                }
                                className={`rounded border-[#E7E9EE] text-[#37C6A3] focus:ring-[#37C6A3] ${
                                  isImplemented ? 'cursor-pointer' : 'cursor-not-allowed'
                                }`}
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`font-semibold text-xs ${
                                  isChecked ? 'text-[#0F172A]' : 'text-slate-600'
                                }`}
                              >
                                {feat.name}
                              </span>

                              <span className="font-mono text-[10px] text-[#7C8A9A] bg-[#F7F6F1] px-1.5 py-0.5 rounded border border-[#E7E9EE]">
                                {feat.key}
                              </span>

                              {/* Status Badges */}
                              {isCore && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <Lock className="w-2.5 h-2.5" />
                                  Core Platform
                                </span>
                              )}

                              {isPartial && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Partially Implemented
                                </span>
                              )}

                              {isPlanned && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Coming Soon
                                </span>
                              )}

                              {isImplemented && isChecked && (
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Assigned
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[#7C8A9A] mt-0.5 line-clamp-2">
                              {feat.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
