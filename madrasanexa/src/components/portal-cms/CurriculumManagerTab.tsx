import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Layers,
  GraduationCap,
  BookMarked,
  Clock,
  FileText
} from 'lucide-react';
import type {
  CurriculumPayload,
  CurriculumProgramme,
  CurriculumLevel,
  CurriculumSubject,
  CurriculumBook,
  CurriculumCategoryConfig,
} from '../../services/api';

interface CurriculumManagerTabProps {
  curriculum: CurriculumPayload | null | undefined;
  syllabusInfo: string;
  rulesAndRegulations: string;
  onUpdateSyllabusInfo: (value: string) => void;
  onUpdateRules: (value: string) => void;
  onSaveCurriculum: (updatedCurriculum: CurriculumPayload) => Promise<void>;
  saving: boolean;
}

const DEFAULT_CATEGORIES: CurriculumCategoryConfig[] = [
  { id: 'general_school', label: 'General School Education', description: 'Grade 1–13, O/L & A/L pathways with streams', displayOrder: 1 },
  { id: 'hifz', label: 'Hifz-ul-Quran Programme', description: 'Quran memorization cycles with Juz allocations', displayOrder: 2 },
  { id: 'aalim', label: 'Aalim / Kitab Programme', description: 'Traditional Islamic jurisprudence, Hadith & Tafseer', displayOrder: 3 },
  { id: 'arabic', label: 'Arabic Language & Literature', description: 'Grammar (Nahw), Morphology (Sarf) & Adab', displayOrder: 4 },
  { id: 'custom', label: 'Other Custom Programmes', description: 'Short courses, diplomas, and evening classes', displayOrder: 5 }
];

export const CurriculumManagerTab: React.FC<CurriculumManagerTabProps> = ({
  curriculum,
  syllabusInfo,
  rulesAndRegulations,
  onUpdateSyllabusInfo,
  onUpdateRules,
  onSaveCurriculum,
  saving
}) => {
  // Initialize payload with safe fallbacks
  const [categories, setCategories] = useState<CurriculumCategoryConfig[]>(() => {
    if (curriculum?.categories && curriculum.categories.length > 0) {
      return curriculum.categories;
    }
    return DEFAULT_CATEGORIES;
  });

  const [programmes, setProgrammes] = useState<CurriculumProgramme[]>(() => {
    return curriculum?.programmes || [];
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(null);
  const [showProgrammeModal, setShowProgrammeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tabFeedback, setTabFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states for Programme
  const [editingProgId, setEditingProgId] = useState<string | null>(null);
  const [progName, setProgName] = useState('');
  const [progCategoryId, setProgCategoryId] = useState('general_school');
  const [progCode, setProgCode] = useState('');
  const [progDuration, setProgDuration] = useState('1 Year');
  const [progDesc, setProgDesc] = useState('');
  const [progAdmissionReq, setProgAdmissionReq] = useState('');
  const [progPublished, setProgPublished] = useState(false);

  // Form states for Category
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Selected programme object
  const activeProgramme = programmes.find((p) => p.id === selectedProgrammeId) || null;

  // Filtered programmes
  const filteredProgrammes = selectedCategoryId === 'all'
    ? programmes
    : programmes.filter((p) => p.categoryId === selectedCategoryId);

  // Save handler
  const handleSaveAll = async () => {
    try {
      setTabFeedback(null);
      const payload: CurriculumPayload = {
        categories,
        programmes,
      };
      await onSaveCurriculum(payload);
      setHasUnsavedChanges(false);
      setTabFeedback({ type: 'success', message: 'Curriculum structure saved successfully.' });
    } catch (err: any) {
      setTabFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to save curriculum changes.'
      });
    }
  };

  // Programme Modal Openers
  const openNewProgrammeModal = () => {
    setEditingProgId(null);
    setProgName('');
    setProgCategoryId(selectedCategoryId !== 'all' ? selectedCategoryId : (categories[0]?.id || 'general_school'));
    setProgCode('');
    setProgDuration('1 Year');
    setProgDesc('');
    setProgAdmissionReq('');
    setProgPublished(false);
    setShowProgrammeModal(true);
  };

  const openEditProgrammeModal = (p: CurriculumProgramme) => {
    setEditingProgId(p.id);
    setProgName(p.name);
    setProgCategoryId(p.categoryId);
    setProgCode(p.code || '');
    setProgDuration(p.durationYears?.toString() || '1 Year');
    setProgDesc(p.description || '');
    setProgAdmissionReq(p.admissionRequirements || '');
    setProgPublished(p.isPublished);
    setShowProgrammeModal(true);
  };

  const handleSaveProgrammeForm = () => {
    if (!progName.trim()) {
      alert('Programme name is required.');
      return;
    }

    if (editingProgId) {
      setProgrammes((prev) =>
        prev.map((p) =>
          p.id === editingProgId
            ? {
                ...p,
                name: progName.trim(),
                categoryId: progCategoryId,
                code: progCode.trim() || null,
                durationYears: progDuration.trim() || null,
                description: progDesc.trim() || null,
                admissionRequirements: progAdmissionReq.trim() || null,
                isPublished: progPublished,
              }
            : p
        )
      );
    } else {
      const newProg: CurriculumProgramme = {
        id: `prog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        categoryId: progCategoryId,
        name: progName.trim(),
        code: progCode.trim() || null,
        durationYears: progDuration.trim() || null,
        description: progDesc.trim() || null,
        admissionRequirements: progAdmissionReq.trim() || null,
        isPublished: progPublished,
        displayOrder: programmes.length + 1,
        levels: [],
      };
      setProgrammes((prev) => [...prev, newProg]);
      setSelectedProgrammeId(newProg.id);
    }

    setHasUnsavedChanges(true);
    setShowProgrammeModal(false);
  };

  const handleDeleteProgramme = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}" and all its subjects & books? This cannot be undone.`)) {
      setProgrammes((prev) => prev.filter((p) => p.id !== id));
      if (selectedProgrammeId === id) setSelectedProgrammeId(null);
      setHasUnsavedChanges(true);
    }
  };

  const handleTogglePublishProgramme = (id: string) => {
    setProgrammes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPublished: !p.isPublished } : p))
    );
    setHasUnsavedChanges(true);
  };

  // Add Category Handler
  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    const catId = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCat: CurriculumCategoryConfig = {
      id: catId,
      label: newCatLabel.trim(),
      description: newCatDesc.trim() || null,
      displayOrder: categories.length + 1,
      isCustom: true,
    };
    setCategories((prev) => [...prev, newCat]);
    setNewCatLabel('');
    setNewCatDesc('');
    setShowCategoryModal(false);
    setSelectedCategoryId(catId);
    setHasUnsavedChanges(true);
  };

  // Level Operations
  const handleAddLevel = (type: 'GRADE' | 'YEAR' | 'STREAM' | 'LEVEL') => {
    if (!activeProgramme) return;
    const defaultLabels: Record<string, string> = {
      GRADE: `Grade ${activeProgramme.levels.length + 1}`,
      YEAR: `Year ${activeProgramme.levels.length + 1}`,
      STREAM: 'A/L Stream (e.g. Science / Arts)',
      LEVEL: `Level ${activeProgramme.levels.length + 1}`,
    };

    const newLevel: CurriculumLevel = {
      id: `lvl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      levelType: type,
      levelLabel: defaultLabels[type] || 'New Academic Level',
      streamName: type === 'STREAM' ? 'General' : null,
      displayOrder: activeProgramme.levels.length + 1,
      subjects: [],
    };

    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? { ...p, levels: [...p.levels, newLevel] }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateLevel = (levelId: string, updates: Partial<CurriculumLevel>) => {
    if (!activeProgramme) return;
    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) => (lvl.id === levelId ? { ...lvl, ...updates } : lvl)),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteLevel = (levelId: string) => {
    if (!activeProgramme) return;
    if (window.confirm('Delete this academic level and all its subjects?')) {
      setProgrammes((prev) =>
        prev.map((p) =>
          p.id === activeProgramme.id
            ? { ...p, levels: p.levels.filter((lvl) => lvl.id !== levelId) }
            : p
        )
      );
      setHasUnsavedChanges(true);
    }
  };

  // Subject Operations
  const handleAddSubject = (levelId: string) => {
    if (!activeProgramme) return;
    const newSub: CurriculumSubject = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: 'New Subject',
      code: '',
      isOptional: false,
      displayOrder: 1,
      learningOutcomes: [],
      books: [],
    };

    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) =>
                lvl.id === levelId
                  ? { ...lvl, subjects: [...lvl.subjects, { ...newSub, displayOrder: lvl.subjects.length + 1 }] }
                  : lvl
              ),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateSubject = (levelId: string, subId: string, updates: Partial<CurriculumSubject>) => {
    if (!activeProgramme) return;
    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) =>
                lvl.id === levelId
                  ? {
                      ...lvl,
                      subjects: lvl.subjects.map((s) => (s.id === subId ? { ...s, ...updates } : s)),
                    }
                  : lvl
              ),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteSubject = (levelId: string, subId: string) => {
    if (!activeProgramme) return;
    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) =>
                lvl.id === levelId
                  ? { ...lvl, subjects: lvl.subjects.filter((s) => s.id !== subId) }
                  : lvl
              ),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  // Book Operations
  const handleAddBook = (levelId: string, subId: string) => {
    if (!activeProgramme) return;
    const newBook: CurriculumBook = {
      id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: 'New Book / Kitab',
      author: '',
      completionNotes: '',
      displayOrder: 1,
      chapters: [],
    };

    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) =>
                lvl.id === levelId
                  ? {
                      ...lvl,
                      subjects: lvl.subjects.map((s) =>
                        s.id === subId
                          ? { ...s, books: [...s.books, { ...newBook, displayOrder: s.books.length + 1 }] }
                          : s
                      ),
                    }
                  : lvl
              ),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateBook = (levelId: string, subId: string, bookId: string, updates: Partial<CurriculumBook>) => {
    if (!activeProgramme) return;
    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) =>
                lvl.id === levelId
                  ? {
                      ...lvl,
                      subjects: lvl.subjects.map((s) =>
                        s.id === subId
                          ? {
                              ...s,
                              books: s.books.map((b) => (b.id === bookId ? { ...b, ...updates } : b)),
                            }
                          : s
                      ),
                    }
                  : lvl
              ),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteBook = (levelId: string, subId: string, bookId: string) => {
    if (!activeProgramme) return;
    setProgrammes((prev) =>
      prev.map((p) =>
        p.id === activeProgramme.id
          ? {
              ...p,
              levels: p.levels.map((lvl) =>
                lvl.id === levelId
                  ? {
                      ...lvl,
                      subjects: lvl.subjects.map((s) =>
                        s.id === subId ? { ...s, books: s.books.filter((b) => b.id !== bookId) } : s
                      ),
                    }
                  : lvl
              ),
            }
          : p
      )
    );
    setHasUnsavedChanges(true);
  };

  return (
    <div className="space-y-8">
      {/* Tab Feedback */}
      {tabFeedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start space-x-2.5 ${
            tabFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {tabFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{tabFeedback.message}</span>
        </div>
      )}

      {/* Legacy Syllabus & Rules Intro Card (Backwards Compatibility Preserved) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Institutional Guidelines & General Syllabus Overview
              </h3>
              <p className="text-xs text-slate-500">
                General syllabus description and institution code of conduct shown on the public portal.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Syllabus Overview Text (Introductory Notes)
            </label>
            <textarea
              rows={4}
              value={syllabusInfo}
              onChange={(e) => {
                onUpdateSyllabusInfo(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="e.g. Our curriculum combines traditional Islamic sciences with the Sri Lankan national curriculum..."
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Appears as an introductory briefing above the structured curriculum on your public website.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Rules & Regulations / Code of Conduct
            </label>
            <textarea
              rows={4}
              value={rulesAndRegulations}
              onChange={(e) => {
                onUpdateRules(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="e.g. Punctuality for Fajr prayers, mandatory dress code, library protocols..."
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Accessible to parents and students via the Institutional Rules dialog.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Curriculum Management Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <GraduationCap className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold">Unified Curriculum & Education System</h2>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Configure General School grades (1–13, O/L, A/L Streams) and Islamic Education programmes (Hifz, Aalim/Kitab, Arabic).
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Public Preview</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* Category Pills & Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Education Categories
          </span>
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Category</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              selectedCategoryId === 'all'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Programmes ({programmes.length})
          </button>

          {categories.map((cat) => {
            const count = programmes.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  selectedCategoryId === cat.id
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{cat.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Programme Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Programme Sidebar / List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Programmes
            </span>
            <button
              type="button"
              onClick={openNewProgrammeModal}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Programme</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {filteredProgrammes.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No programmes found</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Click "New Programme" to add General School or Islamic curricula.
                </p>
              </div>
            ) : (
              filteredProgrammes.map((prog) => {
                const isSelected = prog.id === selectedProgrammeId;
                const totalSubjects = prog.levels.reduce((acc, l) => acc + l.subjects.length, 0);
                const totalBooks = prog.levels.reduce(
                  (acc, l) => acc + l.subjects.reduce((bAcc, s) => bAcc + s.books.length, 0),
                  0
                );

                return (
                  <div
                    key={prog.id}
                    onClick={() => setSelectedProgrammeId(prog.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50/50 border-emerald-600 shadow-xs ring-1 ring-emerald-600/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-slate-900">{prog.name}</h4>
                          {prog.code && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                              {prog.code}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {categories.find((c) => c.id === prog.categoryId)?.label || 'Programme'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePublishProgramme(prog.id);
                          }}
                          title={prog.isPublished ? 'Published (Click to unpublish)' : 'Unpublished (Click to publish)'}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                            prog.isPublished
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {prog.isPublished ? 'Public' : 'Draft'}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditProgrammeModal(prog);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProgramme(prog.id, prog.name);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center space-x-3 text-[10px] text-slate-500 border-t border-slate-100 pt-2.5">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{prog.durationYears || 'Flexible'}</span>
                      </span>
                      <span>•</span>
                      <span>{prog.levels.length} Levels</span>
                      <span>•</span>
                      <span>{totalSubjects} Subjects</span>
                      <span>•</span>
                      <span>{totalBooks} Books</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Level / Subject / Book Hierarchy Editor */}
        <div className="lg:col-span-8">
          {activeProgramme ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Active Programme Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">{activeProgramme.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        activeProgramme.isPublished
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {activeProgramme.isPublished ? 'Visible on Public Site' : 'Draft Mode (Private)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {activeProgramme.description || 'No description provided.'}
                  </p>
                </div>

                {/* Level Creation Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddLevel('GRADE')}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Grade</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddLevel('STREAM')}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add A/L Stream</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddLevel('YEAR')}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Year</span>
                  </button>
                </div>
              </div>

              {/* Levels List */}
              {activeProgramme.levels.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-700">No Academic Levels Configured</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                    Add Grades (Grade 1–13), A/L Streams (Science, Commerce, Arts), or Academic Years to begin structuring this programme.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {activeProgramme.levels.map((lvl) => (
                    <div
                      key={lvl.id}
                      className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50 space-y-4"
                    >
                      {/* Level Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <input
                            type="text"
                            value={lvl.levelLabel}
                            onChange={(e) => handleUpdateLevel(lvl.id, { levelLabel: e.target.value })}
                            className="text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 min-w-0 flex-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Level label (e.g. Grade 10 O/L)"
                          />

                          {lvl.levelType === 'STREAM' && (
                            <input
                              type="text"
                              value={lvl.streamName || ''}
                              onChange={(e) => handleUpdateLevel(lvl.id, { streamName: e.target.value })}
                              className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 min-w-0 flex-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Stream (e.g. Physical Science)"
                            />
                          )}

                          <span className="text-[10px] font-mono uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                            {lvl.levelType}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleAddSubject(lvl.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Subject</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteLevel(lvl.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Delete Level"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Subjects under Level */}
                      <div className="space-y-3 pl-2">
                        {lvl.subjects.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">
                            No subjects added to this level yet. Click "+ Add Subject" above.
                          </p>
                        ) : (
                          lvl.subjects.map((sub) => (
                            <div
                              key={sub.id}
                              className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                  <input
                                    type="text"
                                    value={sub.name}
                                    onChange={(e) =>
                                      handleUpdateSubject(lvl.id, sub.id, { name: e.target.value })
                                    }
                                    className="text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg px-2 py-1 flex-1 min-w-[140px] max-w-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    placeholder="Subject Name"
                                  />

                                  <input
                                    type="text"
                                    value={sub.code || ''}
                                    onChange={(e) =>
                                      handleUpdateSubject(lvl.id, sub.id, { code: e.target.value })
                                    }
                                    className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 w-20 font-mono"
                                    placeholder="Code"
                                  />

                                  <label className="flex items-center space-x-1.5 text-[11px] text-slate-600 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={sub.isOptional || false}
                                      onChange={(e) =>
                                        handleUpdateSubject(lvl.id, sub.id, { isOptional: e.target.checked })
                                      }
                                      className="rounded text-emerald-600 focus:ring-0"
                                    />
                                    <span>Optional</span>
                                  </label>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddBook(lvl.id, sub.id)}
                                    className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 flex items-center space-x-1"
                                  >
                                    <BookMarked className="w-3 h-3 text-amber-600" />
                                    <span>+ Add Book / Kitab</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubject(lvl.id, sub.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Multi-Book Drawer under Subject */}
                              {sub.books.length > 0 && (
                                <div className="space-y-2 border-t border-slate-100 pt-2.5">
                                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center space-x-1">
                                    <BookMarked className="w-3 h-3 text-amber-600" />
                                    <span>Kitabs & Textbooks ({sub.books.length})</span>
                                  </span>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {sub.books.map((bk) => (
                                      <div
                                        key={bk.id}
                                        className="bg-amber-50/40 border border-amber-200/70 rounded-lg p-2.5 space-y-1.5 text-xs"
                                      >
                                        <div className="flex items-center justify-between">
                                          <input
                                            type="text"
                                            value={bk.title}
                                            onChange={(e) =>
                                              handleUpdateBook(lvl.id, sub.id, bk.id, { title: e.target.value })
                                            }
                                            className="font-bold text-slate-900 bg-white border border-amber-200 rounded px-1.5 py-0.5 text-xs w-full mr-2"
                                            placeholder="Book Title"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteBook(lvl.id, sub.id, bk.id)}
                                            className="text-slate-400 hover:text-rose-600"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5">
                                          <input
                                            type="text"
                                            value={bk.author || ''}
                                            onChange={(e) =>
                                              handleUpdateBook(lvl.id, sub.id, bk.id, { author: e.target.value })
                                            }
                                            className="text-[11px] bg-white border border-amber-200 rounded px-1.5 py-0.5"
                                            placeholder="Author (optional)"
                                          />
                                          <input
                                            type="text"
                                            value={bk.completionNotes || ''}
                                            onChange={(e) =>
                                              handleUpdateBook(lvl.id, sub.id, bk.id, {
                                                completionNotes: e.target.value,
                                              })
                                            }
                                            className="text-[11px] bg-white border border-amber-200 rounded px-1.5 py-0.5"
                                            placeholder="Completion Notes (e.g. Juz 1-10)"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">Select a Programme</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Choose a programme from the left or create a new one to manage its year-wise subjects, A/L streams, and books.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Programme Modal */}
      {showProgrammeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">
              {editingProgId ? 'Edit Programme' : 'Create New Programme'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Programme Name *</label>
                <input
                  type="text"
                  value={progName}
                  onChange={(e) => setProgName(e.target.value)}
                  placeholder="e.g. G.C.E. Advanced Level (A/L) or Hifz-ul-Quran"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Education Category</label>
                  <select
                    value={progCategoryId}
                    onChange={(e) => setProgCategoryId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={progDuration}
                    onChange={(e) => setProgDuration(e.target.value)}
                    placeholder="e.g. 2 Years, 7 Years, Flexible"
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={progDesc}
                  onChange={(e) => setProgDesc(e.target.value)}
                  placeholder="Summary of this educational pathway..."
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="progPub"
                  checked={progPublished}
                  onChange={(e) => setProgPublished(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <label htmlFor="progPub" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Publish to public portal immediately
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowProgrammeModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProgrammeForm}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                Save Programme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Add Custom Education Category</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Label *</label>
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="e.g. Vocational & Technical"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Short explanation..."
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-xl"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-[#FAF9F5] rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-amber-200/50 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-amber-900/10 pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                  Live Public Preview Simulation
                </span>
                <h3 className="text-lg font-bold text-[#0B3028]">
                  Curriculum & Syllabus Explorer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
              >
                Close Preview
              </button>
            </div>

            {/* Simulated Public Content */}
            <div className="space-y-6">
              {syllabusInfo && (
                <div className="bg-white rounded-2xl p-5 border border-amber-200/40 shadow-xs">
                  <h4 className="text-xs font-bold text-[#0B3028] uppercase tracking-wider mb-1">
                    Academic Overview
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {syllabusInfo}
                  </p>
                </div>
              )}

              {/* Published Programmes Only */}
              {programmes.filter((p) => p.isPublished).length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-amber-200">
                  <p className="text-xs font-semibold text-slate-600">
                    No programmes currently published.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Toggle programme status to "Public" to make it visible to website visitors.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {programmes
                    .filter((p) => p.isPublished)
                    .map((prog) => (
                      <div
                        key={prog.id}
                        className="bg-white rounded-2xl p-6 border border-emerald-900/10 shadow-xs space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                              {prog.durationYears || 'Flexible'}
                            </span>
                            <h4 className="text-sm font-bold text-[#0B3028] mt-1.5">{prog.name}</h4>
                            {prog.description && (
                              <p className="text-xs text-slate-600 mt-1">{prog.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Levels */}
                        <div className="space-y-3 pt-2">
                          {prog.levels.map((lvl) => (
                            <div
                              key={lvl.id}
                              className="bg-[#FAF9F5] border border-amber-900/10 rounded-xl p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#075E46]">
                                  {lvl.levelLabel} {lvl.streamName ? `(${lvl.streamName})` : ''}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {lvl.subjects.length} Subjects
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {lvl.subjects.map((s) => (
                                  <div
                                    key={s.id}
                                    className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-800">{s.name}</span>
                                      {s.isOptional && (
                                        <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                          Optional
                                        </span>
                                      )}
                                    </div>
                                    {s.books.length > 0 && (
                                      <div className="text-[10px] text-amber-900 font-medium space-y-0.5 border-t border-slate-100 pt-1">
                                        {s.books.map((b) => (
                                          <div key={b.id} className="flex items-center space-x-1">
                                            <span>📖</span>
                                            <span className="font-semibold">{b.title}</span>
                                            {b.completionNotes && (
                                              <span className="text-slate-400">({b.completionNotes})</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
