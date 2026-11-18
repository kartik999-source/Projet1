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
      className="rounded-xl border border-[#27272A] bg-[#121216] px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#F97316]" />
          <h3 className="text-xs font-semibold text-[#FAFAFA]">
            Tech Stack Pool Health
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#A1A1AA]">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-xs bg-[#F97316]"
            />
            Shortlisted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-xs bg-[#3F3F46]"
            />
            Blocked by Stage 1
          </span>
          <span className="font-mono text-[#A1A1AA] tabular-nums">
            Peak {maxSkillCoverage}/{totalPool} students
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg bg-[#1C1C22] text-xs text-[#A1A1AA]">
          Select or add skills on the left to inspect candidate pool distribution.
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
                stroke="#27272A"
              />
              <XAxis
                dataKey="skill"
                tick={{ fill: '#A1A1AA', fontSize: 12 }}
                axisLine={{ stroke: '#27272A' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, Math.max(totalPool, 1)]}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#1C1C22' }}
                contentStyle={{
                  backgroundColor: '#121216',
                  borderColor: '#27272A',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  color: '#FAFAFA',
                }}
                labelStyle={{ color: '#FAFAFA', fontWeight: 600 }}
                formatter={(value, name) => [
                  `${value} student${Number(value) === 1 ? '' : 's'}`,
                  name === 'shortlisted' ? 'Shortlisted' : 'Blocked by Stage 1',
                ]}
              />
              <Bar
                dataKey="shortlisted"
                stackId="pool"
                fill="#F97316"
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="blocked"
                stackId="pool"
                fill="#3F3F46"
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
