import React, { useState, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  Search,
  Eye,
  X,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type {
  AssessmentMarksResponse,
  CalculatedStudentResult,
} from '../../services/marking-hub.service';
import {
  downloadAllStudentsPdf,
  downloadClassCsv,
} from '../../services/marking-hub.service';

interface ResultsTableProps {
  data: AssessmentMarksResponse;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data }) => {
  const { assessment, results } = data;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL' | 'INCOMPLETE'>('ALL');
  const [selectedStudent, setSelectedStudent] = useState<CalculatedStudentResult | null>(null);

  // Download loading states
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Filtered results
  const filteredResults = useMemo(() => {
    return results.filter((st) => {
      // Search
      const matchesSearch =
        st.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.admissionNo.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PASS') return st.overallStatus === 'PASS';
      if (statusFilter === 'FAIL') return st.overallStatus === 'FAIL';
      if (statusFilter === 'INCOMPLETE') return st.overallStatus === 'INCOMPLETE';
      return true;
    });
  }, [results, searchTerm, statusFilter]);

  // Download PDF handler
  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      setDownloadError(null);
      const safeClassName = (assessment.class?.name || 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeTerm = (assessment.term || 'term').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `student_reports_${safeClassName}_${safeTerm}.pdf`;
      await downloadAllStudentsPdf(assessment.id, filename);
    } catch (err: any) {
      console.error('PDF export failed', err);
      setDownloadError(err.response?.data?.message || err.message || 'Failed to generate PDF reports');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Download CSV handler
  const handleDownloadCsv = async () => {
    try {
      setIsDownloadingCsv(true);
      setDownloadError(null);
      const safeClassName = (assessment.class?.name || 'class').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeTerm = (assessment.term || 'term').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `marking_hub_${safeClassName}_${safeTerm}.csv`;
      await downloadClassCsv(assessment.id, filename);
    } catch (err: any) {
      console.error('CSV export failed', err);
      setDownloadError(err.response?.data?.message || err.message || 'Failed to export CSV');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Export Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Class Performance & Reports</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            View student results, rankings, and download official reports
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || results.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download All Reports PDF
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isDownloadingCsv || results.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            {isDownloadingCsv ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Export Full Class CSV
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name or admission no..."
            className="w-full h-9 pl-9 pr-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
          {(['ALL', 'PASS', 'FAIL', 'INCOMPLETE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'PASS' ? 'Passed' : st === 'FAIL' ? 'Failed' : 'Incomplete'}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider">
                <th className="p-3 text-center w-14">Rank</th>
                <th className="p-3 w-28">Admission No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3 text-center">Marks Total</th>
                <th className="p-3 text-center">Average %</th>
                <th className="p-3 text-center">GPA</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Subjects</th>
                <th className="p-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-400 text-xs italic">
                    No student results match your filter or search query.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r, idx) => (
                  <tr
                    key={r.studentId}
                    className={`hover:bg-stone-50/70 transition-colors ${
                      idx % 2 === 1 ? 'bg-stone-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Rank */}
                    <td className="p-3 text-center font-bold">
                      {r.position ? (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-xs font-bold">
                          #{r.position}
                        </span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Admission */}
                    <td className="p-3 font-mono text-stone-600 font-medium">{r.admissionNo}</td>

                    {/* Student Name */}
                    <td className="p-3 font-medium text-stone-900">
                      <div>{r.fullName}</div>
                      {r.guardianName && (
                        <div className="text-[10px] text-stone-400">Guardian: {r.guardianName}</div>
                      )}
                    </td>

                    {/* Marks Total */}
                    <td className="p-3 text-center font-mono text-stone-700">
                      {r.isComplete && r.totalObtained !== null ? (
                        <span>
                          {r.totalObtained} / {r.maxPossible}
                        </span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Average % */}
                    <td className="p-3 text-center font-bold text-stone-800">
                      {r.isComplete && r.overallPercentage !== null ? (
                        `${r.overallPercentage.toFixed(2)}%`
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* GPA */}
                    <td className="p-3 text-center font-bold text-stone-900">
                      {r.isComplete && r.gpa !== null ? (
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-900">
                          {r.gpa.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center">
                      {!r.isComplete ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600">
                          Incomplete
                        </span>
                      ) : r.overallStatus === 'PASS' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" /> FAIL
                        </span>
                      )}
                    </td>

                    {/* Subjects pass / fail count */}
                    <td className="p-3 text-center text-[11px]">
                      <span className="text-emerald-700 font-medium">{r.passedSubjectsCount} passed</span>
                      {r.failedSubjectsCount > 0 && (
                        <span className="text-rose-600 font-medium ml-1.5">
                          ({r.failedSubjectsCount} fail)
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-3 text-right pr-4">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Breakdown Modal / Drawer */}
      {selectedStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">{selectedStudent.fullName}</h3>
                  <p className="text-xs text-stone-500">
                    Admission No: <span className="font-mono">{selectedStudent.admissionNo}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-stone-400 hover:text-stone-600 rounded-lg p-1.5 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Summary Cards */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-center">
                  <div className="text-[10px] uppercase font-semibold text-stone-400">Class Rank</div>
                  <div className="text-lg font-bold text-stone-900 mt-0.5">
                    {selectedStudent.position ? `#${selectedStudent.position}` : '-'}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-center">
                  <div className="text-[10px] uppercase font-semibold text-stone-400">Total Marks</div>
                  <div className="text-lg font-bold text-stone-900 mt-0.5 font-mono">
                    {selectedStudent.isComplete && selectedStudent.totalObtained !== null
                      ? `${selectedStudent.totalObtained} / ${selectedStudent.maxPossible}`
                      : '-'}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-center">
                  <div className="text-[10px] uppercase font-semibold text-stone-400">Average %</div>
                  <div className="text-lg font-bold text-stone-900 mt-0.5">
                    {selectedStudent.isComplete && selectedStudent.overallPercentage !== null
                      ? `${selectedStudent.overallPercentage.toFixed(2)}%`
                      : '-'}
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-center">
                  <div className="text-[10px] uppercase font-semibold text-stone-400">GPA</div>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    {selectedStudent.isComplete && selectedStudent.gpa !== null
                      ? selectedStudent.gpa.toFixed(2)
                      : '-'}
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div>
                <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2.5">
                  Subject Breakdown
                </h4>
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
                        <th className="p-2.5">Subject</th>
                        <th className="p-2.5 text-center">Max</th>
                        <th className="p-2.5 text-center">Pass</th>
                        <th className="p-2.5 text-center">Score</th>
                        <th className="p-2.5 text-center">%</th>
                        <th className="p-2.5 text-right pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-normal">
                      {selectedStudent.subjects.map((sub) => (
                        <tr key={sub.assessmentSubjectId} className="hover:bg-stone-50/50">
                          <td className="p-2.5 font-medium text-stone-800">
                            {sub.subjectName}
                            {sub.subjectCode && (
                              <span className="text-[10px] text-stone-400 font-mono ml-1.5">
                                ({sub.subjectCode})
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-stone-500">{sub.maxMark}</td>
                          <td className="p-2.5 text-center text-stone-500">{sub.passMark}</td>
                          <td className="p-2.5 text-center font-mono font-semibold text-stone-900">
                            {sub.mark !== null ? sub.mark : <span className="text-stone-300">-</span>}
                          </td>
                          <td className="p-2.5 text-center font-medium text-stone-700">
                            {sub.percentage !== null ? `${sub.percentage.toFixed(1)}%` : '-'}
                          </td>
                          <td className="p-2.5 text-right pr-3">
                            {sub.status === 'PASS' ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                PASS
                              </span>
                            ) : sub.status === 'FAIL' ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700">
                                FAIL
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-500">
                                INCOMPLETE
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-stone-100 flex justify-end bg-stone-50/50">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
