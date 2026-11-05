import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { CategoryComparisonItem } from '../../services/expense-analysis.service';

interface BudgetVsActualChartProps {
  comparison: CategoryComparisonItem[];
  currency?: string;
}

export const BudgetVsActualChart: React.FC<BudgetVsActualChartProps> = ({ comparison, currency = 'LKR' }) => {
  // Only display categories with either a budget or actual spend
  const data = comparison
    .filter((c) => Number(c.currentTotal) > 0 || (c.budget && Number(c.budget) > 0))
    .slice(0, 8) // Limit to top 8 for clean visual display
    .map((c) => ({
      name: c.categoryName.length > 12 ? `${c.categoryName.substring(0, 10)}...` : c.categoryName,
      fullName: c.categoryName,
      Actual: Number(c.currentTotal),
      Budget: c.budget ? Number(c.budget) : 0,
    }));

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#E7E9EE] shadow-xs">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#0F172A]">Category Budget vs Actual Spend</h3>
        <p className="text-xs text-[#7C8A9A]">Actual expenditure vs budgeted ceiling per active category</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EE" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7C8A9A' }} axisLine={{ stroke: '#E7E9EE' }} />
            <YAxis
              tick={{ fontSize: 10, fill: '#7C8A9A' }}
              axisLine={{ stroke: '#E7E9EE' }}
              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
            />
            <Tooltip
              formatter={(val: any) => [`${currency} ${Number(val).toLocaleString('en-US')}`]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.fullName || '')}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E7E9EE',
                fontSize: '12px',
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
            />
            <Bar dataKey="Actual" fill="#0F172A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Budget" fill="#37C6A3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
export default BudgetVsActualChart;
