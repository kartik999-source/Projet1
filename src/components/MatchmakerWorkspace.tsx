import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  FileCheck2,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  MatchResult,
  NocRecord,
  OpeningRequirement,
} from '../types/domain';
import {
  addWeeksIso,
  calculateNepCredits,
  getBlindSafeUniversityLabel,
} from '../engine/matchmaker';
import { SkillPoolChart } from './SkillPoolChart';

interface MatchmakerWorkspaceProps {
  opening: OpeningRequirement;
  onUpdateOpening: (next: OpeningRequirement) => void;
  matches: MatchResult[];
  nocs: NocRecord[];
  onShortlistAndGenerateNoc: (match: MatchResult) => void;
  onAiRankShortlist: () => Promise<void>;
  aiRankLoading: boolean;
  aiRankError: string | null;
  promptTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const SUGGESTED_SKILLS = [
  'Python',
  'FastAPI',
  'React',
  'SQL',
  'Machine Learning',
  'TypeScript',
  'Docker',
];

export const MatchmakerWorkspace: React.FC<MatchmakerWorkspaceProps> = ({
  opening,
  onUpdateOpening,
  matches,
  nocs,
  onShortlistAndGenerateNoc,
  onAiRankShortlist,
  aiRankLoading,
  aiRankError,
  promptTextareaRef,
}) => {
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [autoFillSuccess, setAutoFillSuccess] = useState<string | null>(null);
  const [newSkillText, setNewSkillText] = useState('');
  const [showExcluded, setShowExcluded] = useState(true);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  const shortlisted = matches.filter((m) => m.hardFilterPassed);
  const excluded = matches.filter((m) => !m.hardFilterPassed);
  const computedEndDate = addWeeksIso(opening.startDate, opening.durationWeeks);

  const handleAutoFillGemini = async () => {
    setAutoFillLoading(true);
    setAutoFillError(null);
    setAutoFillSuccess(null);
    try {
      const res = await fetch('/api/ai/parse-requirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: opening.naturalPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Auto-fill request failed.');
      }
      const p = data.parsed;
      const clampedWeeks = Math.max(4, Math.min(16, Number(p.durationWeeks) || 8));
      const clampedStipend = Math.max(0, Math.min(25000, Number(p.stipendMonthly) || 0));

      onUpdateOpening({
        ...opening,
        companyName: p.companyName || opening.companyName,
        roleTitle: p.roleTitle || opening.roleTitle,
        requiredSkills:
          Array.isArray(p.requiredSkills) && p.requiredSkills.length > 0
            ? p.requiredSkills
            : opening.requiredSkills,
        startDate: p.startDate || opening.startDate,
        durationWeeks: clampedWeeks,
        stipendMonthly: clampedStipend,
        ppoAvailable:
          typeof p.ppoAvailable === 'boolean' ? p.ppoAvailable : opening.ppoAvailable,
        mode:
          p.mode === 'Hybrid' || p.mode === 'On-site' ? p.mode : 'Remote',
        city: p.city || opening.city,
      });
      setAutoFillSuccess('Filters populated via Gemini AI.');
    } catch (err) {
      setAutoFillError(
        err instanceof Error ? err.message : 'Unable to parse prompt with Gemini.'
      );
    } finally {
      setAutoFillLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    const exists = opening.requiredSkills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );
    const nextSkills = exists
      ? opening.requiredSkills.filter((s) => s.toLowerCase() !== skill.toLowerCase())
      : [...opening.requiredSkills, skill];
    onUpdateOpening({ ...opening, requiredSkills: nextSkills });
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newSkillText.trim();
    if (!cleaned) return;
    if (
      !opening.requiredSkills.some(
        (s) => s.toLowerCase() === cleaned.toLowerCase()
      )
    ) {
      onUpdateOpening({
        ...opening,
        requiredSkills: [...opening.requiredSkills, cleaned],
      });
    }
    setNewSkillText('');
  };

  const existingNocForStudent = (studentId: string) =>
    nocs.find((n) => n.studentId === studentId && n.roleTitle === opening.roleTitle);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT PANEL: Live "What-If" Constraint Controls */}
      <section
        aria-label="Live What-If Constraint Controls"
        className="lg:col-span-5 rounded-xl border border-[#27272A] bg-[#121216] p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#F97316]" />
            <h2 className="font-display text-base font-semibold text-[#FAFAFA]">
              Live &ldquo;What-If&rdquo; Constraint Controls
            </h2>
          </div>
          <span className="font-mono text-xs text-[#FB923C] tabular-nums whitespace-nowrap shrink-0">
            {opening.durationWeeks}w · ₹{opening.stipendMonthly.toLocaleString('en-IN')}
          </span>
        </div>

        {/* AI Natural-Language Role Parser */}
        <div className="space-y-2.5 border-b border-[#27272A] pb-5">
          <label
            htmlFor="nl-role-parser"
            className="block text-xs font-medium text-[#A1A1AA]"
          >
            AI Natural-Language Role Parser
          </label>
          <textarea
            ref={promptTextareaRef}
            id="nl-role-parser"
            rows={3}
            value={opening.naturalPrompt}
            onChange={(e) =>
              onUpdateOpening({ ...opening, naturalPrompt: e.target.value })
            }
            placeholder='e.g., "Need a 2nd-year Python/FastAPI intern for 8 weeks starting May 15, ₹10,000 stipend, PPO available"'
            className="w-full rounded-lg border border-[#27272A] bg-[#1C1C22] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder:text-[#71717A] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAutoFillGemini}
              disabled={autoFillLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-xs font-bold text-[#09090B] transition-colors hover:bg-[#FB923C] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {autoFillLoading ? 'Auto-Filling...' : 'Auto-Fill with Gemini'}
            </button>

            {autoFillSuccess && (
              <span className="text-xs font-medium text-[#22C55E]">
                {autoFillSuccess}
              </span>
            )}
          </div>

          {autoFillError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{autoFillError}</span>
            </div>
          )}
        </div>

        {/* Role Title & Company */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="role-title-input"
              className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
            >
              Role Title
            </label>
            <input
              id="role-title-input"
              type="text"
              value={opening.roleTitle}
              onChange={(e) =>
                onUpdateOpening({ ...opening, roleTitle: e.target.value })
              }
              className="w-full rounded-lg border border-[#27272A] bg-[#1C1C22] px-3 py-2 text-sm text-[#FAFAFA] focus:border-[#F97316] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="company-name-input"
              className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
            >
              Company Name
            </label>
            <input
              id="company-name-input"
              type="text"
              value={opening.companyName}
              onChange={(e) =>
                onUpdateOpening({ ...opening, companyName: e.target.value })
              }
              className="w-full rounded-lg border border-[#27272A] bg-[#1C1C22] px-3 py-2 text-sm text-[#FAFAFA] focus:border-[#F97316] focus:outline-none"
            />
          </div>
        </div>

        {/* Required Skills Tags */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#A1A1AA]">
              Required Skills Tags
            </span>
            <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
              {opening.requiredSkills.length} active
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_SKILLS.map((skill) => {
              const active = opening.requiredSkills.some(
                (s) => s.toLowerCase() === skill.toLowerCase()
              );
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#F97316]/60 bg-[#F97316]/15 text-[#FB923C]'
                      : 'border-[#27272A] bg-[#1C1C22] text-[#A1A1AA] hover:text-[#FAFAFA]'
                  }`}
                >
                  {skill}
                  {active && <X className="h-3 w-3" />}
                </button>
              );
            })}
            {opening.requiredSkills
              .filter(
                (s) =>
                  !SUGGESTED_SKILLS.some(
                    (std) => std.toLowerCase() === s.toLowerCase()
                  )
              )
              .map((customSkill) => (
                <button
                  key={customSkill}
                  type="button"
                  onClick={() => toggleSkill(customSkill)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#F97316]/60 bg-[#F97316]/15 px-2.5 py-1 text-xs font-medium text-[#FB923C] whitespace-nowrap shrink-0"
                >
                  {customSkill}
                  <X className="h-3 w-3" />
                </button>
              ))}
          </div>

          <form onSubmit={handleAddCustomSkill} className="flex gap-2">
            <input
              type="text"
              aria-label="Add custom required skill"
              value={newSkillText}
              onChange={(e) => setNewSkillText(e.target.value)}
              placeholder="Add skill (e.g. PostgreSQL, TensorFlow)"
              className="flex-1 rounded-lg border border-[#27272A] bg-[#1C1C22] px-3 py-1.5 text-xs text-[#FAFAFA] placeholder:text-[#71717A] focus:border-[#F97316] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-[#27272A] bg-[#1C1C22] px-3 py-1.5 text-xs font-medium text-[#FAFAFA] hover:border-[#F97316]/50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </form>
        </div>

        {/* Start Date & Duration Slider (4 to 16 weeks) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#27272A]">
          <div>
            <label
              htmlFor="opening-start-date"
              className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
            >
              Start Date
            </label>
            <input
              id="opening-start-date"
              type="date"
              value={opening.startDate}
              onChange={(e) =>
                onUpdateOpening({ ...opening, startDate: e.target.value })
              }
              className="w-full rounded-lg border border-[#27272A] bg-[#1C1C22] px-3 py-2 font-mono text-xs text-[#FAFAFA] tabular-nums focus:border-[#F97316] focus:outline-none"
            />
            <div className="mt-1 font-mono text-[11px] text-[#71717A] tabular-nums">
              Ends {computedEndDate}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="duration-weeks-slider" className="font-medium text-[#A1A1AA]">
                Duration
              </label>
              <span className="font-mono font-semibold text-[#FB923C] tabular-nums">
                {opening.durationWeeks} weeks
              </span>
            </div>
            <input
              id="duration-weeks-slider"
              type="range"
              min={4}
              max={16}
              step={1}
              value={opening.durationWeeks}
              onChange={(e) =>
                onUpdateOpening({
                  ...opening,
                  durationWeeks: Number(e.target.value),
                })
              }
              className="w-full accent-[#F97316] cursor-pointer"
            />
            <div className="flex justify-between font-mono text-[11px] text-[#71717A] tabular-nums mt-0.5">
              <span>4 wks</span>
              <span>{calculateNepCredits(opening.durationWeeks)} NEP Cr</span>
              <span>16 wks</span>
            </div>
          </div>
        </div>

        {/* Monthly Stipend Slider (₹0 Unpaid to ₹25,000) */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="monthly-stipend-slider" className="font-medium text-[#A1A1AA]">
              Monthly Stipend
            </label>
            <span className="font-mono font-semibold text-[#FB923C] tabular-nums">
              {opening.stipendMonthly === 0
                ? '₹0 (Unpaid)'
                : `₹${opening.stipendMonthly.toLocaleString('en-IN')}/mo`}
            </span>
          </div>
          <input
            id="monthly-stipend-slider"
            type="range"
            min={0}
            max={25000}
            step={1000}
            value={opening.stipendMonthly}
            onChange={(e) =>
              onUpdateOpening({
                ...opening,
                stipendMonthly: Number(e.target.value),
              })
            }
            className="w-full accent-[#F97316] cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[11px] text-[#71717A] tabular-nums mt-0.5">
            <span>₹0 Unpaid</span>
            <span>₹10,000</span>
            <span>₹25,000</span>
          </div>
        </div>

        {/* PPO Available Toggle & Blind College Mode Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#27272A]">
          <div>
            <span className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              PPO Available
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#1C1C22] p-1 border border-[#27272A]">
              <button
                type="button"
                onClick={() => onUpdateOpening({ ...opening, ppoAvailable: true })}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  opening.ppoAvailable
                    ? 'bg-[#F97316] text-[#09090B]'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onUpdateOpening({ ...opening, ppoAvailable: false })}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  !opening.ppoAvailable
                    ? 'bg-[#27272A] text-[#FAFAFA]'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                }`}
              >
                No
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Blind College Mode
            </span>
            <button
              type="button"
              aria-pressed={opening.blindMode}
              onClick={() =>
                onUpdateOpening({ ...opening, blindMode: !opening.blindMode })
              }
              className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                opening.blindMode
                  ? 'border-[#F97316] bg-[#F97316]/15 text-[#FB923C]'
                  : 'border-[#27272A] bg-[#1C1C22] text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              {opening.blindMode ? 'Blind Mode: ON' : 'Blind Mode: OFF'}
            </button>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL: Real-Time Ranked Shortlist */}
      <section
        aria-label="Real-Time Ranked Shortlist"
        className="lg:col-span-7 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#27272A] bg-[#121216] px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-base font-semibold text-[#FAFAFA]">
                Real-Time Ranked Shortlist
              </h2>
              <span
                data-testid="matched-count"
                className="rounded-md bg-[#F97316]/15 px-2 py-0.5 font-mono text-xs font-semibold text-[#FB923C] tabular-nums"
              >
                {shortlisted.length} of {matches.length} matched
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] font-mono tabular-nums mt-1">
              {opening.startDate} → {computedEndDate} ({opening.durationWeeks} wks) ·{' '}
              {opening.stipendMonthly === 0
                ? 'Unpaid'
                : `₹${opening.stipendMonthly.toLocaleString('en-IN')}/mo`}{' '}
              · {opening.ppoAvailable ? 'PPO Track' : 'No PPO'}
            </p>
          </div>

          <button
            type="button"
            onClick={onAiRankShortlist}
            disabled={aiRankLoading || shortlisted.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-[#F97316]/50 bg-[#1C1C22] px-3.5 py-2 text-xs font-semibold text-[#FB923C] transition-colors hover:bg-[#F97316]/15 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiRankLoading ? 'Ranking via Gemini...' : 'Rank with Gemini AI'}
          </button>
        </div>

        {aiRankError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <span>{aiRankError}</span>
          </div>
        )}

        {/* Recharts Tech Stack Pool Health Chart */}
        <SkillPoolChart
          matches={matches}
          requiredSkills={opening.requiredSkills}
        />

        {/* Shortlisted Student Cards or Empty State */}
        {shortlisted.length === 0 ? (
          <div className="rounded-xl border border-[#27272A] bg-[#121216] p-8 text-center space-y-3">
            <h3 className="font-display text-base font-semibold text-[#FAFAFA]">
              No candidates satisfy all Stage 1 hard constraints
            </h3>
            <p className="text-sm text-[#A1A1AA] max-w-md mx-auto">
              Adjust the stipend slider, PPO toggle, or start date to match available Year 2+
              students across UP universities.
            </p>
            <button
              type="button"
              onClick={() =>
                onUpdateOpening({
                  ...opening,
                  stipendMonthly: 10000,
                  ppoAvailable: true,
                  startDate: '2027-05-15',
                  durationWeeks: 8,
                })
              }
              className="rounded-lg bg-[#F97316] px-4 py-2 text-xs font-bold text-[#09090B] hover:bg-[#FB923C] whitespace-nowrap shrink-0"
            >
              Reset to Baseline Filters (8 wks · ₹10k · PPO)
            </button>
          </div>
        ) : (
          <div className="space-y-3" data-testid="shortlist-results">
            {shortlisted.map((match) => {
              const { student } = match;
              const uniLabel = getBlindSafeUniversityLabel(student, opening.blindMode);
              const existingNoc = existingNocForStudent(student.id);
              const avatarBroken = failedAvatars[student.id];

              return (
                <article
                  key={student.id}
                  data-testid={`candidate-card-${student.id}`}
                  className="rounded-xl border border-[#27272A] bg-[#121216] p-5 transition-all duration-200 hover:border-orange-500/50 hover:shadow-[0_0_24px_rgba(249,115,22,0.12)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {opening.blindMode || avatarBroken ? (
                        <div
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#27272A] bg-[#1C1C22] font-mono text-xs font-semibold text-[#FB923C]"
                        >
                          {student.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </div>
                      ) : (
                        <img
                          src={student.avatarUrl}
                          alt={`${student.name} portrait`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedAvatars((prev) => ({ ...prev, [student.id]: true }))
                          }
                          className="h-11 w-11 shrink-0 rounded-lg object-cover border border-[#27272A] bg-[#1C1C22]"
                        />
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-base font-semibold text-[#FAFAFA] truncate">
                            {student.name}
                          </h3>
                          {student.verifiedByTnP && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22C55E] whitespace-nowrap shrink-0">
                              <ShieldCheck className="h-3 w-3" />
                              T&amp;P Verified
                            </span>
                          )}
                          {student.wantsPpo && opening.ppoAvailable && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22C55E] whitespace-nowrap shrink-0">
                              PPO Eligible
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-[#A1A1AA]">
                          <span
                            className={
                              opening.blindMode ? 'text-[#FB923C] font-medium' : ''
                            }
                          >
                            {uniLabel}
                          </span>
                          {' · '}
                          Year {student.year} {student.branch}
                          {' · '}
                          <span className="font-mono tabular-nums">
                            CGPA {student.cgpa.toFixed(1)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                      <span className="rounded-md bg-[#F97316]/15 px-2.5 py-1 font-mono text-xs font-bold text-[#FB923C] tabular-nums whitespace-nowrap shrink-0">
                        {match.matchScore}% Match
                      </span>
                      <span className="font-mono text-[11px] text-[#71717A] tabular-nums">
                        {match.aiRanked ? 'Gemini AI Ranked' : 'Constraint + Stack'}
                      </span>
                    </div>
                  </div>

                  {/* Skills & Projects Summary */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    {student.skills.map((skill) => {
                      const isMatch = match.matchedSkills.some(
                        (m) => m.toLowerCase() === skill.toLowerCase()
                      );
                      return (
                        <span
                          key={skill}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            isMatch
                              ? 'bg-[#F97316]/15 text-[#FB923C] border border-[#F97316]/30'
                              : 'bg-[#1C1C22] text-[#A1A1AA] border border-[#27272A]'
                          }`}
                        >
                          {skill}
                        </span>
                      );
                    })}
                  </div>

                  <p className="mt-2.5 text-xs text-[#A1A1AA] leading-relaxed">
                    <span className="font-medium text-[#FAFAFA]">Projects: </span>
                    {student.projectsSummary}
                  </p>

                  {/* 1-Sentence "Why Shortlisted" Callout */}
                  <div className="mt-3 rounded-lg border border-[#27272A] bg-[#1C1C22] px-3.5 py-2.5 text-xs text-[#FAFAFA] leading-relaxed">
                    <span className="font-semibold text-[#FB923C]">Why Shortlisted: </span>
                    {match.whyShortlisted}
                  </div>

                  {/* Footer Metadata & Action */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#27272A] pt-3">
                    <div className="font-mono text-[11px] text-[#A1A1AA] tabular-nums">
                      Free {student.availableFrom.slice(5)} → {student.availableTo.slice(5)} ·
                      Floor ₹{student.minStipend.toLocaleString('en-IN')}/mo ·{' '}
                      {calculateNepCredits(opening.durationWeeks)} NEP Credits
                    </div>

                    <button
                      type="button"
                      onClick={() => onShortlistAndGenerateNoc(match)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-4 py-2 text-xs font-bold text-[#09090B] transition-colors hover:bg-[#FB923C] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                    >
                      {existingNoc ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          View Generated NOC
                        </>
                      ) : (
                        <>
                          <FileCheck2 className="h-3.5 w-3.5" />
                          Shortlist &amp; Generate NOC
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Excluded by Stage 1 Constraints */}
        {excluded.length > 0 && (
          <div className="rounded-xl border border-[#27272A] bg-[#121216]">
            <button
              type="button"
              aria-expanded={showExcluded}
              onClick={() => setShowExcluded((prev) => !prev)}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA]"
            >
              <span>
                Filtered Out by Stage 1 Hard Constraints ({excluded.length})
              </span>
              {showExcluded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showExcluded && (
              <div className="divide-y divide-[#27272A] border-t border-[#27272A] px-5">
                {excluded.map((m) => (
                  <div
                    key={m.student.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-xs"
                  >
                    <div>
                      <span className="font-medium text-[#FAFAFA]">
                        {m.student.name}
                      </span>
                      <span className="text-[#A1A1AA]">
                        {' '}
                        ·{' '}
                        {getBlindSafeUniversityLabel(m.student, opening.blindMode)}
                      </span>
                    </div>
                    <span className="text-[#FB923C] font-medium">
                      {m.disqualificationReasons[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
