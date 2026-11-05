import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Award,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { ClassAnalyticsData } from '../../services/marking-hub.service';

interface ClassAnalyticsViewProps {
  analytics: ClassAnalyticsData;
}

export const ClassAnalyticsView: React.FC<ClassAnalyticsViewProps> = ({ analytics }) => {
  const { summary, subjectAnalytics, topStudents, studentsRequiringAttention } = analytics;

  // Chart data preparation
  const chartData = subjectAnalytics.map((sub) => ({
    name: sub.subjectName.length > 15 ? `${sub.subjectName.slice(0, 15)}...` : sub.subjectName,
    fullName: sub.subjectName,
    averagePercent: sub.averagePercentage !== null ? Number(sub.averagePercentage.toFixed(1)) : 0,
    passRate: sub.passRate !== null ? Number(sub.passRate.toFixed(1)) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Students */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Enrolled</span>
          </div>
          <div className="text-xl font-bold text-stone-900 mt-1">{summary.totalStudents}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            {summary.completedStudents} complete &bull; {summary.incompleteStudents} incomplete
          </div>
        </div>

        {/* Class Average % */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Class Average</span>
          </div>
          <div className="text-xl font-bold text-stone-900 mt-1">
            {summary.classAverage !== null ? `${summary.classAverage.toFixed(1)}%` : '-'}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">Excludes incomplete</div>
        </div>

        {/* Average GPA */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <Award className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Average GPA</span>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {summary.averageGpa !== null ? summary.averageGpa.toFixed(2) : '-'}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">Across complete</div>
        </div>

        {/* Pass Rate */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pass Rate</span>
          </div>
          <div className="text-xl font-bold text-stone-900 mt-1">
            {summary.passRate !== null ? `${summary.passRate.toFixed(1)}%` : '-'}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">All subjects passed</div>
        </div>

        {/* Highest % */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Highest %</span>
          </div>
          <div className="text-xl font-bold text-stone-900 mt-1">
            {summary.highestAverage !== null ? `${summary.highestAverage.toFixed(1)}%` : '-'}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">Top score</div>
        </div>

        {/* Lowest % */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-stone-400 mb-1">
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Lowest %</span>
          </div>
          <div className="text-xl font-bold text-stone-900 mt-1">
            {summary.lowestAverage !== null ? `${summary.lowestAverage.toFixed(1)}%` : '-'}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">Lowest score</div>
        </div>
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-stone-900 text-sm">Subject Performance Overview</h3>
              <p className="text-xs text-stone-500">Average Percentage vs Pass Rate per subject</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataItem = payload[0].payload;
                      return (
                        <div className="bg-stone-900 text-white text-xs p-2.5 rounded-xl shadow-lg space-y-1">
                          <p className="font-semibold">{dataItem.fullName}</p>
                          <p className="text-emerald-300">Average: {dataItem.averagePercent}%</p>
                          <p className="text-blue-300">Pass Rate: {dataItem.passRate}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="averagePercent" name="Average %" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="passRate" name="Pass Rate %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Subject Analytics Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-stone-900 text-sm">Subject-Wise Analytics Breakdown</h3>
          </div>
          <span className="text-xs text-stone-400">{subjectAnalytics.length} subjects</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider">
                <th className="p-3">Subject</th>
                <th className="p-3 text-center">Max / Pass</th>
                <th className="p-3 text-center">Entered / Enrolled</th>
                <th className="p-3 text-center">Average Mark</th>
                <th className="p-3 text-center">Average %</th>
                <th className="p-3 text-center">Pass Count</th>
                <th className="p-3 text-center">Fail Count</th>
                <th className="p-3 text-center">Pass Rate %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {subjectAnalytics.map((sub, idx) => (
                <tr
                  key={sub.assessmentSubjectId}
                  className={`hover:bg-stone-50/70 transition-colors ${
                    idx % 2 === 1 ? 'bg-stone-50/30' : 'bg-white'
                  }`}
                >
                  <td className="p-3 font-medium text-stone-900">
                    {sub.subjectName}
                    {sub.subjectCode && (
                      <span className="text-[10px] text-stone-400 font-mono ml-1.5">
                        ({sub.subjectCode})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center text-stone-600">
                    {sub.maxMark} / {sub.passMark}
                  </td>
                  <td className="p-3 text-center font-mono text-stone-700">
                    {sub.enteredCount} / {sub.totalStudents}
                  </td>
                  <td className="p-3 text-center font-semibold text-stone-800">
                    {sub.averageMark !== null ? sub.averageMark.toFixed(1) : '-'}
                  </td>
                  <td className="p-3 text-center font-semibold text-emerald-700">
                    {sub.averagePercentage !== null ? `${sub.averagePercentage.toFixed(1)}%` : '-'}
                  </td>
                  <td className="p-3 text-center font-medium text-emerald-700">{sub.passCount}</td>
                  <td className="p-3 text-center font-medium text-rose-600">{sub.failCount}</td>
                  <td className="p-3 text-center font-bold text-stone-900">
                    {sub.passRate !== null ? `${sub.passRate.toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: Top Achievers & Students Requiring Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Achievers */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-stone-900 text-sm">Top Achievers</h3>
            </div>
            <span className="text-xs text-stone-400">Class Leaders</span>
          </div>

          {topStudents.length === 0 ? (
            <p className="text-xs text-stone-400 italic text-center py-6">
              No ranked students available yet.
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {topStudents.map((st) => (
                <div key={st.studentId} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-800 font-bold text-xs flex items-center justify-center">
                      #{st.position}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-stone-900">{st.fullName}</p>
                      <p className="text-[10px] text-stone-400 font-mono">{st.admissionNo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-700">{st.overallPercentage.toFixed(2)}%</p>
                    <p className="text-[10px] text-stone-500">GPA: {st.gpa.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students Requiring Attention */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-stone-900 text-sm">Students Requiring Attention</h3>
            </div>
            <span className="text-xs text-rose-600 font-medium">{studentsRequiringAttention.length}</span>
          </div>

          {studentsRequiringAttention.length === 0 ? (
            <p className="text-xs text-emerald-600 font-medium text-center py-6">
              Great! All students are meeting the passing criteria.
            </p>
          ) : (
            <div className="divide-y divide-stone-100">
              {studentsRequiringAttention.map((st) => (
                <div key={st.studentId} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-900">{st.fullName}</p>
                    <p className="text-[10px] text-stone-400 font-mono">{st.admissionNo}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      {st.attentionReason}
                    </span>
                    {st.overallPercentage !== null && (
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        Avg: {st.overallPercentage.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
