import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  EyeOff,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  CompanyRequirement,
  InvitationRecord,
  MatchResult,
  UPUniversity,
  WorkMode,
} from '../types/domain';
import { DEMO_PRESETS } from '../data/upSeedData';
import { calculateNepCredits, getDisplayCandidateIdentity } from '../engine/matchmaker';
import { SkillPoolChart } from './SkillPoolChart';

interface MatchmakerWorkspaceProps {
  requirement: CompanyRequirement;
  onUpdateRequirement: (next: CompanyRequirement) => void;
  matches: MatchResult[];
  universities: UPUniversity[];
  invitations: InvitationRecord[];
  onSendInvitation: (
    match: MatchResult,
    type: '2-week-sprint' | 'internship-offer'
  ) => void;
  onAiExplainMatches: () => Promise<void>;
  aiExplainLoading: boolean;
  aiExplainError: string | null;
  promptTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const TERM_WINDOWS = [
  {
    id: 'summer-early',
    label: 'May 15 – Aug 15 (Summer)',
    startDate: '2027-05-15',
    endDate: '2027-08-15',
  },
  {
    id: 'summer-late',
    label: 'Jun 01 – Aug 15 (Post-AKTU/HBTU)',
    startDate: '2027-06-01',
    endDate: '2027-08-15',
  },
  {
    id: 'sprint-june',
    label: 'Jun 07 – Jun 21 (2-Week Sprint)',
    startDate: '2027-06-07',
    endDate: '2027-06-21',
  },
  {
    id: 'winter-break',
    label: 'Dec 20 – Jan 18 (Winter Break)',
    startDate: '2026-12-20',
    endDate: '2027-01-18',
  },
];

const UP_CITIES = ['Lucknow', 'Kanpur', 'Noida', 'Gorakhpur', 'Prayagraj', 'Jhansi'];

export const MatchmakerWorkspace: React.FC<MatchmakerWorkspaceProps> = ({
  requirement,
  onUpdateRequirement,
  matches,
  universities,
  invitations,
  onSendInvitation,
  onAiExplainMatches,
  aiExplainLoading,
  aiExplainError,
  promptTextareaRef,
}) => {
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessNote, setParseSuccessNote] = useState<string | null>(null);
  const [showFiltered, setShowFiltered] = useState(true);
  const [skillInput, setSkillInput] = useState(requirement.requiredSkills.join(', '));
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

  const passedMatches = matches.filter((m) => m.hardFilterPassed);
  const filteredOutMatches = matches.filter((m) => !m.hardFilterPassed);

  const handleParseRequirement = async () => {
    setParseLoading(true);
    setParseError(null);
    setParseSuccessNote(null);
    try {
      const res = await fetch('/api/ai/parse-requirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: requirement.naturalPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to parse requirement.');
      }
      const p = data.parsed;
      const validMode: WorkMode =
        p.mode === 'Hybrid' || p.mode === 'On-site' ? p.mode : 'Remote';
      const skillsArray = Array.isArray(p.requiredSkills) ? p.requiredSkills : requirement.requiredSkills;

      setSkillInput(skillsArray.join(', '));
      onUpdateRequirement({
        ...requirement,
        companyName: p.companyName || requirement.companyName,
        roleTitle: p.roleTitle || requirement.roleTitle,
        startDate: p.startDate || requirement.startDate,
        endDate: p.endDate || requirement.endDate,
        durationMonths: typeof p.durationMonths === 'number' ? p.durationMonths : requirement.durationMonths,
        isEvaluationSprint: Boolean(p.isEvaluationSprint),
        stipendMonthly: typeof p.stipendMonthly === 'number' ? p.stipendMonthly : requirement.stipendMonthly,
        ppoAvailable: typeof p.ppoAvailable === 'boolean' ? p.ppoAvailable : requirement.ppoAvailable,
        ppoRequiredByRole: Boolean(p.ppoRequiredByRole),
        mode: validMode,
        city: p.city || requirement.city,
        requiredSkills: skillsArray,
      });
      setParseSuccessNote('Constraints extracted into live filters via Gemini.');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'AI parsing request failed.');
    } finally {
      setParseLoading(false);
    }
  };

  const applyPreset = (presetReq: CompanyRequirement) => {
    setSkillInput(presetReq.requiredSkills.join(', '));
    setParseError(null);
    setParseSuccessNote(null);
    onUpdateRequirement({
      ...presetReq,
      blindMode: requirement.blindMode,
      requireTnPVerified: requirement.requireTnPVerified,
    });
  };

  const handleDurationChange = (months: number) => {
    const start = new Date(`${requirement.startDate}T00:00:00Z`);
    const days = Math.round(months * 30);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    onUpdateRequirement({
      ...requirement,
      isEvaluationSprint: false,
      durationMonths: months,
      endDate: end.toISOString().slice(0, 10),
    });
  };

  const handleToggleSprint = (enabled: boolean) => {
    const start = new Date(`${requirement.startDate}T00:00:00Z`);
    const days = enabled ? 14 : Math.round((requirement.durationMonths < 1 ? 3 : requirement.durationMonths) * 30);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    onUpdateRequirement({
      ...requirement,
      isEvaluationSprint: enabled,
      durationMonths: enabled ? 0.5 : requirement.durationMonths < 1 ? 3 : requirement.durationMonths,
      endDate: end.toISOString().slice(0, 10),
    });
  };

  const handleTermSelect = (windowId: string) => {
    const found = TERM_WINDOWS.find((w) => w.id === windowId);
    if (!found) return;
    const isSprint = windowId === 'sprint-june';
    const diffDays = Math.round(
      (Date.parse(found.endDate) - Date.parse(found.startDate)) / (24 * 60 * 60 * 1000)
    );
    const months = isSprint ? 0.5 : Math.max(1, Math.round(diffDays / 30));
    onUpdateRequirement({
      ...requirement,
      startDate: found.startDate,
      endDate: found.endDate,
      durationMonths: months,
      isEvaluationSprint: isSprint,
    });
  };

  const activeInvitationForStudent = (studentId: string) =>
    invitations.find(
      (inv) =>
        inv.studentId === studentId &&
        inv.companyName === requirement.companyName.split(' (')[0]
    ) || invitations.find((inv) => inv.studentId === studentId && inv.roleTitle === requirement.roleTitle);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-5">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-blue-700">
            Uttar Pradesh Campus Matchmaker · Constraint-First Shortlisting
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1 balance-text">
            Eliminate cold campus searches across UP universities
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Post a role or adjust live stipend, duration, and PPO sliders on the left to
            synchronously filter Year 2+ students by exact academic calendar overlap and verified
            proof-of-work on the right.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onUpdateRequirement({
                ...requirement,
                blindMode: !requirement.blindMode,
              })
            }
            aria-pressed={requirement.blindMode}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              requirement.blindMode
                ? 'border-blue-700 bg-blue-50 text-blue-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {requirement.blindMode ? 'Blind Mode: On' : 'Blind Mode: Off'}
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateRequirement({
                ...requirement,
                requireTnPVerified: !requirement.requireTnPVerified,
              })
            }
            aria-pressed={requirement.requireTnPVerified}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              requirement.requireTnPVerified
                ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {requirement.requireTnPVerified ? 'T&P Verified Only' : 'Include Unverified'}
          </button>
        </div>
      </div>

      {/* Split-Screen Hackathon Demo Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: Requirement Composer & Live "What-If" Sliders */}
        <section
          aria-label="Company Requirement and Constraint Sliders"
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-700" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                01. Requirement &amp; Live Constraints
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">
              {requirement.isEvaluationSprint
                ? '2-Wk Sprint'
                : `${requirement.durationMonths}m Term`}
            </span>
          </div>

          {/* Quick Hackathon Presets */}
          <div>
            <span className="block text-xs font-medium text-slate-600 mb-2">
              Quick Demo Scenarios
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_PRESETS.map((preset) => {
                const isSelected = requirement.id === preset.requirement.id;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.requirement)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Natural-Language Requirement Composer */}
          <div className="space-y-2.5 pt-1 border-t border-slate-100">
            <label
              htmlFor="nl-requirement-input"
              className="block text-xs font-medium text-slate-700"
            >
              Natural-Language Role Description
            </label>
            <textarea
              ref={promptTextareaRef}
              id="nl-requirement-input"
              rows={3}
              value={requirement.naturalPrompt}
              onChange={(e) =>
                onUpdateRequirement({ ...requirement, naturalPrompt: e.target.value })
              }
              placeholder="e.g., 3 months starting May 15, ₹10k stipend, FastAPI + PostgreSQL backend intern with PPO potential..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleParseRequirement}
                disabled={parseLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {parseLoading ? 'Parsing with Gemini...' : 'Parse with Gemini AI'}
              </button>

              {parseSuccessNote && (
                <span className="text-xs font-medium text-emerald-700">
                  {parseSuccessNote}
                </span>
              )}
            </div>

            {parseError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Live "What-If" Sliders */}
          <div className="space-y-4 pt-3 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="req-company-name"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Company
                </label>
                <input
                  id="req-company-name"
                  type="text"
                  value={requirement.companyName}
                  onChange={(e) =>
                    onUpdateRequirement({ ...requirement, companyName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="req-role-title"
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Role Title
                </label>
                <input
                  id="req-role-title"
                  type="text"
                  value={requirement.roleTitle}
                  onChange={(e) =>
                    onUpdateRequirement({ ...requirement, roleTitle: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Track Type Toggle: Full Internship vs 2-Week Evaluation Sprint */}
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1.5">
                Engagement Track
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleToggleSprint(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    !requirement.isEvaluationSprint
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Internship (1–6m)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSprint(true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    requirement.isEvaluationSprint
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2-Wk Evaluation Sprint
                </button>
              </div>
            </div>

            {/* Monthly Stipend Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="stipend-slider" className="font-medium text-slate-700">
                  Monthly Stipend Offered
                </label>
                <span className="font-mono font-semibold text-blue-700 tabular-nums">
                  ₹{requirement.stipendMonthly.toLocaleString('en-IN')}/mo
                </span>
              </div>
              <input
                id="stipend-slider"
                type="range"
                min={0}
                max={30000}
                step={1000}
                value={requirement.stipendMonthly}
                onChange={(e) =>
                  onUpdateRequirement({
                    ...requirement,
                    stipendMonthly: Number(e.target.value),
                  })
                }
                className="w-full accent-blue-700 cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums mt-0.5">
                <span>₹0 (Unpaid)</span>
                <span>₹10k</span>
                <span>₹20k</span>
                <span>₹30k</span>
              </div>
            </div>

            {/* Duration Slider */}
            {!requirement.isEvaluationSprint && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="duration-slider" className="font-medium text-slate-700">
                    Internship Duration
                  </label>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {requirement.durationMonths}{' '}
                    {requirement.durationMonths === 1 ? 'month' : 'months'} (
                    {calculateNepCredits(Math.round(requirement.durationMonths * 4))} NEP credits)
                  </span>
                </div>
                <input
                  id="duration-slider"
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={Math.max(1, Math.round(requirement.durationMonths))}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  className="w-full accent-blue-700 cursor-pointer"
                />
                <div className="flex justify-between font-mono text-[11px] text-slate-400 tabular-nums mt-0.5">
                  <span>1m</span>
                  <span>2m</span>
                  <span>3m</span>
                  <span>4m</span>
                  <span>5m</span>
                  <span>6m</span>
                </div>
              </div>
            )}

            {/* Calendar Window Selector */}
            <div>
              <label
                htmlFor="term-window-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Academic Calendar Corridor
              </label>
              <select
                id="term-window-select"
                value={
                  TERM_WINDOWS.find(
                    (w) =>
                      w.startDate === requirement.startDate &&
                      w.endDate === requirement.endDate
                  )?.id || 'custom'
                }
                onChange={(e) => handleTermSelect(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {TERM_WINDOWS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
                <option value="custom">
                  Custom: {requirement.startDate} to {requirement.endDate}
                </option>
              </select>
            </div>

            {/* PPO & Work Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  PPO Conversion Track
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRequirement({
                        ...requirement,
                        ppoAvailable: true,
                      })
                    }
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      requirement.ppoAvailable
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    PPO: Yes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateRequirement({
                        ...requirement,
                        ppoAvailable: false,
                        ppoRequiredByRole: false,
                      })
                    }
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      !requirement.ppoAvailable
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    PPO: No
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="work-mode-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Mode &amp; Hub City
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="work-mode-select"
                    value={requirement.mode}
                    onChange={(e) =>
                      onUpdateRequirement({
                        ...requirement,
                        mode: e.target.value as WorkMode,
                      })
                    }
                    className="w-1/2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                  <select
                    aria-label="UP hub city"
                    value={requirement.city}
                    onChange={(e) =>
                      onUpdateRequirement({
                        ...requirement,
                        city: e.target.value,
                      })
                    }
                    className="w-1/2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {UP_CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Required Stack Input */}
            <div>
              <label
                htmlFor="required-skills-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Required Stack (comma-separated)
              </label>
              <input
                id="required-skills-input"
                type="text"
                value={skillInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSkillInput(val);
                  onUpdateRequirement({
                    ...requirement,
                    requiredSkills: val
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* RIGHT PANE: Real-Time Shortlist & UP University Calendar Matrix */}
        <section
          aria-label="Live AI Shortlist and UP Calendar Alignment"
          className="lg:col-span-7 space-y-4"
        >
          {/* Shortlist Summary & AI Explain Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  02. Live Ranked Shortlist
                </h2>
                <span
                  data-testid="matched-count"
                  className="font-mono text-xs font-semibold text-blue-700 tabular-nums"
                >
                  {passedMatches.length} of {matches.length} matched
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Window {requirement.startDate} → {requirement.endDate} · ₹
                {requirement.stipendMonthly.toLocaleString('en-IN')}/mo · {requirement.mode}
              </p>
            </div>

            <button
              type="button"
              onClick={onAiExplainMatches}
              disabled={aiExplainLoading || passedMatches.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-700" />
              {aiExplainLoading ? 'Scoring Vectors...' : 'Enrich Shortlist with Gemini'}
            </button>
          </div>

          {aiExplainError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
              <span>{aiExplainError}</span>
            </div>
          )}

          {/* UP University Exam Calendar Sync Strip */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-3.5">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>UP University Exam Blackout Sync</span>
              </div>
              <span className="text-xs text-slate-500">
                {requirement.blindMode ? 'Campus names redacted in candidate cards' : '6 UP campuses synced'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {universities.map((uni) => {
                const reqStart = Date.parse(requirement.startDate);
                const reqEnd = Date.parse(requirement.endDate);
                const exStart = Date.parse(uni.examBlackoutStart);
                const exEnd = Date.parse(uni.examBlackoutEnd);
                const hasOverlap = Math.min(reqEnd, exEnd) >= Math.max(reqStart, exStart);
                return (
                  <div
                    key={uni.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium text-slate-800 truncate">
                      {uni.shortName}
                    </span>
                    <span
                      className={`font-mono text-[11px] tabular-nums whitespace-nowrap shrink-0 ${
                        hasOverlap ? 'text-amber-700 font-medium' : 'text-emerald-700'
                      }`}
                    >
                      {hasOverlap
                        ? `Exams ${uni.examBlackoutEnd.slice(5)}`
                        : 'Clear'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tech Stack Candidate Pool Health Bar Chart */}
          <SkillPoolChart
            matches={matches}
            requiredSkills={requirement.requiredSkills}
          />

          {/* Matched Candidate Cards or Empty State */}
          {passedMatches.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                No UP students satisfy all Stage 1 hard constraints
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Your current stipend floor, start date exam blackout, or verification lock
                excluded {filteredOutMatches.length} candidates.
              </p>
              <div className="pt-1 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateRequirement({
                      ...requirement,
                      stipendMonthly: 12000,
                      isEvaluationSprint: true,
                      durationMonths: 0.5,
                      endDate: '2027-06-14',
                      startDate: '2027-06-01',
                    })
                  }
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  Switch to Jun 1 · 2-Week Sprint (₹12k)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(DEMO_PRESETS[0].requirement)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Reset to Baseline Preset
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="shortlist-results">
              {passedMatches.map((match) => {
                const { student, university } = match;
                const identity = getDisplayCandidateIdentity(
                  student,
                  requirement.blindMode
                );
                const existingInvite = activeInvitationForStudent(student.id);
                const avatarBroken = failedAvatars[student.id];

                return (
                  <article
                    key={student.id}
                    data-testid={`candidate-card-${student.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        {identity.isRedacted || avatarBroken ? (
                          <div
                            aria-hidden="true"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-semibold text-slate-700"
                          >
                            {student.blindCode.slice(-3)}
                          </div>
                        ) : (
                          <img
                            src={student.avatarUrl}
                            alt={`${student.name} portrait`}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedAvatars((prev) => ({ ...prev, [student.id]: true }))
                            }
                            className="h-11 w-11 shrink-0 rounded-lg object-cover bg-slate-100"
                          />
                        )}

                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                            {identity.displayName}
                          </h3>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                            <span>{identity.institutionLine}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              CGPA {student.cgpa.toFixed(1)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                student.verifiedByTnP
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-amber-700 font-medium'
                              }
                            >
                              {student.verifiedByTnP
                                ? 'Verified by T&P Cell'
                                : 'T&P Verification Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-baseline sm:items-end justify-between shrink-0">
                        <span className="font-mono text-lg font-bold text-blue-700 tabular-nums">
                          {match.totalScore}% Match
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {match.aiEnriched ? 'Gemini Vector + Rubric' : 'Constraint + Stack'}
                        </span>
                      </div>
                    </div>

                    {/* 2-line "Why Shortlisted" Explainability Block */}
                    <div className="mt-3.5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 leading-relaxed">
                      <span className="font-medium text-slate-900">Why Shortlisted: </span>
                      {match.whyShortlisted}
                    </div>

                    {/* Clean Unboxed Proof & Overlap Metadata */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                      <span className="font-mono tabular-nums text-slate-800">
                        Overlap: {match.calendarOverlap.overlapDays}d (
                        {match.calendarOverlap.effectiveStart?.slice(5)} →{' '}
                        {match.calendarOverlap.effectiveEnd?.slice(5)})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Stack:{' '}
                        <strong className="font-medium text-slate-800">
                          {match.matchedSkills.length > 0
                            ? match.matchedSkills.join(', ')
                            : student.skills.slice(0, 3).join(', ')}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        GitHub: {student.projects[0]?.title} (
                        <span className="font-mono tabular-nums">
                          {student.projects[0]?.verifiedCommits ?? 0} commits
                        </span>
                        )
                      </span>
                      {student.microTestScore !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-emerald-700 font-medium">
                            Micro-Test {student.microTestScore}/100
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        Floor ₹{student.minStipend.toLocaleString('en-IN')}/mo ·{' '}
                        {student.wantsPpo ? 'PPO-Seeking' : 'Summer Only'} ·{' '}
                        {university.nepCreditHoursPerCredit}h/credit NEP-2020
                      </div>

                      {existingInvite ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <Check className="h-4 w-4" />
                          <span>
                            {existingInvite.status === 'noc_issued'
                              ? 'NOC Issued'
                              : existingInvite.status === 'accepted'
                              ? 'Accepted by Student'
                              : existingInvite.type === '2-week-sprint'
                              ? '2-Wk Sprint Invited'
                              : 'Offer Sent'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSendInvitation(match, '2-week-sprint')}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            Invite to 2-Wk Sprint
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendInvitation(match, 'internship-offer')}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            Shortlist &amp; Offer
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Stage 1 Filtered Out Disclosure */}
          {filteredOutMatches.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                aria-expanded={showFiltered}
                onClick={() => setShowFiltered((prev) => !prev)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <span>
                  Excluded by Stage 1 Hard Constraints ({filteredOutMatches.length})
                </span>
                {showFiltered ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>
              {showFiltered && (
                <div className="divide-y divide-slate-100 border-t border-slate-100 px-5">
                  {filteredOutMatches.map((m) => {
                    const idInfo = getDisplayCandidateIdentity(
                      m.student,
                      requirement.blindMode
                    );
                    return (
                      <div
                        key={m.student.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 text-xs"
                      >
                        <div>
                          <span className="font-medium text-slate-800">
                            {idInfo.displayName}
                          </span>
                          <span className="text-slate-500">
                            {' '}
                            · {requirement.blindMode ? m.student.branch : m.university.shortName}
                          </span>
                        </div>
                        <div className="text-amber-800 font-medium">
                          {m.disqualificationReasons[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
