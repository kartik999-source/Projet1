import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { MatchResult } from '../types/domain';
import { computeSkillDistribution } from '../engine/matchmaker';

interface SkillPoolChartProps {
  matches: MatchResult[];
  requiredSkills: string[];
}

export const SkillPoolChart: React.FC<SkillPoolChartProps> = ({
  matches,
  requiredSkills,
}) => {
  const data = useMemo(
    () => computeSkillDistribution(matches, requiredSkills),
    [matches, requiredSkills]
  );

  const totalPool = matches.length;
  const maxSkillCoverage = data.reduce((max, item) => Math.max(max, item.total), 0);

  return (
    <div
      data-testid="skill-pool-chart"
      className="rounded-xl border border-slate-200 bg-white px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-blue-700" />
          <h3 className="text-xs font-medium text-slate-800">
            Tech Stack Pool Health
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-xs bg-blue-700"
            />
            Shortlisted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-300"
            />
            Blocked by Stage 1
          </span>
          <span className="font-mono text-slate-500 tabular-nums">
            Peak {maxSkillCoverage}/{totalPool} students
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-500">
          Add comma-separated skills in Required Stack to visualize candidate pool coverage.
        </div>
      ) : (
        <div className="h-44 w-full" aria-label="Student skill match distribution bar chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 6, right: 8, left: -24, bottom: 2 }}
              barCategoryGap="24%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E2E8F0"
              />
              <XAxis
                dataKey="skill"
                tick={{ fill: '#475569', fontSize: 12 }}
                axisLine={{ stroke: '#CBD5E1' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, Math.max(totalPool, 1)]}
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#F8FAFC' }}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.08)',
                }}
                formatter={(value, name) => [
                  `${value} student${Number(value) === 1 ? '' : 's'}`,
                  name === 'shortlisted' ? 'Shortlisted' : 'Blocked by Stage 1',
                ]}
              />
              <Bar
                dataKey="shortlisted"
                stackId="pool"
                fill="#1D4ED8"
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="blocked"
                stackId="pool"
                fill="#CBD5E1"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
