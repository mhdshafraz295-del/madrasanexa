import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { MonthlyTrendPoint } from '../../services/expense-analysis.service';

interface ExpenseTrendChartProps {
  trend: MonthlyTrendPoint[];
  currency?: string;
}

export const ExpenseTrendChart: React.FC<ExpenseTrendChartProps> = ({ trend, currency = 'LKR' }) => {
  const data = trend.map((t) => ({
    label: t.label,
    amount: Number(t.total),
  }));

  const allZero = data.every((d) => d.amount === 0);

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E7E9EE] shadow-xs">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#0F172A]">Last 6 Months Expense Trend</h3>
        <p className="text-xs text-[#7C8A9A]">Authoritative monthly active expenditure trajectory</p>
      </div>

      {allZero ? (
        <div className="h-64 flex flex-col items-center justify-center text-[#7C8A9A] text-xs">
          <p>No operational expense data recorded over the last 6 months.</p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EE" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={{ stroke: '#E7E9EE' }} />
              <YAxis
                tick={{ fontSize: 10, fill: '#7C8A9A' }}
                axisLine={{ stroke: '#E7E9EE' }}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <Tooltip
                formatter={(val: any) => [`${currency} ${Number(val).toLocaleString('en-US')}`, 'Total Expense']}
                labelStyle={{ fontWeight: 'bold', color: '#0F172A' }}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E7E9EE',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="amount" fill="#0F172A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
export default ExpenseTrendChart;
