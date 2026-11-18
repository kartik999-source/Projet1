import React from 'react';
import { Award, CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import { SprintPipelineRecord, StudentProfile } from '../types/domain';

interface SprintPpoTrackerProps {
  sprints: SprintPipelineRecord[];
  students: StudentProfile[];
  onToggleMilestone: (sprintId: string, week: number) => void;
  onRateMilestone: (sprintId: string, week: number, rating: number) => void;
  onUpdateMilestoneNote: (sprintId: string, week: number, note: string) => void;
  onPromoteOrConvertPpo: (
    sprintId: string,
    nextStatus: SprintPipelineRecord['ppoStatus']
  ) => void;
}

export const SprintPpoTracker: React.FC<SprintPpoTrackerProps> = ({
  sprints,
  students,
  onToggleMilestone,
  onRateMilestone,
  onUpdateMilestoneNote,
  onPromoteOrConvertPpo,
}) => {
  const studentMap = new Map(students.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-blue-700">
          Sprint-to-PPO Micro-Internship Pipeline
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1">
          2-Week Evaluation Sprints &amp; Bi-Weekly PPO Milestone Tracker
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          De-risk hiring Year 2 students with scoped 2-week paid evaluation sprints, then
          track bi-weekly mentor feedback to make data-backed PPO conversion decisions.
        </p>
      </div>

      {sprints.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No active sprints yet. Invite a candidate to a 2-Week Sprint or PPO internship
          from the Matchmaker view.
        </div>
      ) : (
        <div className="space-y-5">
          {sprints.map((sprint) => {
            const student = studentMap.get(sprint.studentId);
            const completedCount = sprint.milestones.filter((m) => m.completed).length;
            const rated = sprint.milestones.filter((m) => m.mentorRating !== null);
            const avgRating =
              rated.length > 0
                ? (
                    rated.reduce((sum, m) => sum + (m.mentorRating ?? 0), 0) /
                    rated.length
                  ).toFixed(1)
                : '—';

            const statusLabel =
              sprint.ppoStatus === 'ppo_extended'
                ? 'PPO Offer Extended'
                : sprint.ppoStatus === 'sprint_passed'
                ? 'Sprint Passed · Upgraded to Summer Track'
                : sprint.ppoStatus === 'ppo_track'
                ? 'PPO Conversion Track Active'
                : '2-Week Evaluation Sprint Active';

            return (
              <section
                key={sprint.id}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-blue-700">{statusLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {sprint.startDate} → {sprint.endDate}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        ₹{sprint.stipendMonthly.toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-semibold text-slate-900 mt-1">
                      {student?.name ?? sprint.studentId} — {sprint.roleTitle}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {sprint.companyName} · {student?.universityName} · Year{' '}
                      {student?.yearOfStudy}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Milestones</div>
                      <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {completedCount}/{sprint.milestones.length}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Mentor Avg</div>
                      <div className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                        {avgRating}/5.0
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bi-Weekly Milestones */}
                <div className="space-y-3">
                  {sprint.milestones.map((ms) => (
                    <div
                      key={ms.week}
                      className="rounded-lg bg-slate-50 p-4 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleMilestone(sprint.id, ms.week)}
                          className="flex items-start gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                        >
                          {ms.completed ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                          )}
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {ms.title.startsWith('Week')
                                ? ms.title
                                : `Week ${ms.week}: ${ms.title}`}
                            </div>
                            <div className="text-xs text-slate-600">{ms.deliverable}</div>
                          </div>
                        </button>

                        {/* 1-5 Mentor Rubric */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-slate-500 mr-1">Rubric:</span>
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              aria-label={`Rate week ${ms.week} ${score} out of 5`}
                              onClick={() => onRateMilestone(sprint.id, ms.week, score)}
                              className={`h-7 w-7 rounded font-mono text-xs font-medium transition-colors tabular-nums ${
                                ms.mentorRating === score
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        aria-label={`Mentor feedback for week ${ms.week}`}
                        value={ms.mentorNote}
                        onChange={(e) =>
                          onUpdateMilestoneNote(sprint.id, ms.week, e.target.value)
                        }
                        placeholder="Add mentor feedback..."
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Progression Action Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    {sprint.ppoEligible
                      ? 'Bi-weekly rubric feeds directly into end-of-term PPO conversion decision.'
                      : 'Evaluation sprint record'}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {sprint.trackType === '2-week-sprint' &&
                      sprint.ppoStatus === 'sprint_active' && (
                        <button
                          type="button"
                          onClick={() =>
                            onPromoteOrConvertPpo(sprint.id, 'sprint_passed')
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Pass Sprint &amp; Unlock Summer Internship
                        </button>
                      )}

                    {sprint.ppoEligible && sprint.ppoStatus !== 'ppo_extended' && (
                      <button
                        type="button"
                        onClick={() =>
                          onPromoteOrConvertPpo(sprint.id, 'ppo_extended')
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
                      >
                        <Award className="h-3.5 w-3.5" />
                        Extend PPO Conversion Offer
                      </button>
                    )}

                    {sprint.ppoStatus === 'ppo_extended' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <Award className="h-4 w-4" />
                        PPO Offer Extended
                      </span>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
