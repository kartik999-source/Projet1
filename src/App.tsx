import { useMemo, useRef, useState } from 'react';
import {
  MatchResult,
  NocRecord,
  OpeningRequirement,
  StudentProfile,
  WorkspaceTab,
} from './types/domain';
import {
  DEFAULT_OPENING,
  INITIAL_NOCS,
  INITIAL_STUDENTS,
  UP_UNIVERSITIES,
} from './data/upSeedData';
import {
  addWeeksIso,
  calculateNepCredits,
  rankStudentsForOpening,
} from './engine/matchmaker';
import { TopBar } from './components/TopBar';
import { MatchmakerWorkspace } from './components/MatchmakerWorkspace';
import { StudentOnboarding } from './components/StudentOnboarding';
import { TnpGovernancePortal } from './components/TnpGovernancePortal';
import { NocModal } from './components/NocModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('matchmaker');
  const [students, setStudents] = useState<StudentProfile[]>(INITIAL_STUDENTS);
  const [opening, setOpening] = useState<OpeningRequirement>(DEFAULT_OPENING);
  const [nocs, setNocs] = useState<NocRecord[]>(INITIAL_NOCS);
  const [activeNocId, setActiveNocId] = useState<string | null>(null);

  const [aiRankings, setAiRankings] = useState<
    Record<string, { score: number; whyShortlisted: string }>
  >({});
  const [aiRankLoading, setAiRankLoading] = useState(false);
  const [aiRankError, setAiRankError] = useState<string | null>(null);

  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const matches = useMemo(
    () => rankStudentsForOpening(students, opening, UP_UNIVERSITIES, aiRankings),
    [students, opening, aiRankings]
  );

  const verifiedStudentsCount = students.filter((s) => s.verifiedByTnP).length;
  const activeOpeningsCount = 4; // Active UP campus partner openings including current role
  const aiMatchesCount = matches.filter((m) => m.hardFilterPassed).length;

  const handleUpdateOpening = (next: OpeningRequirement) => {
    setOpening(next);
    setAiRankings({});
    setAiRankError(null);
  };

  const handleAiRankShortlist = async () => {
    const shortlisted = matches.filter((m) => m.hardFilterPassed);
    if (shortlisted.length === 0) return;
    setAiRankLoading(true);
    setAiRankError(null);
    try {
      const res = await fetch('/api/ai/rank-shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening,
          candidates: shortlisted.map((m) => ({
            id: m.student.id,
            name: m.student.name,
            universityName: m.student.universityName,
            year: m.student.year,
            skills: m.student.skills,
            projectsSummary: m.student.projectsSummary,
            availableFrom: m.student.availableFrom,
            availableTo: m.student.availableTo,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini semantic ranking failed.');
      }
      setAiRankings(data.rankingsById || {});
    } catch (err) {
      setAiRankError(
        err instanceof Error ? err.message : 'Unable to reach Gemini AI ranker.'
      );
    } finally {
      setAiRankLoading(false);
    }
  };

  const handleShortlistAndGenerateNoc = (match: MatchResult) => {
    const existing = nocs.find(
      (n) => n.studentId === match.student.id && n.roleTitle === opening.roleTitle
    );
    if (existing) {
      setActiveNocId(existing.id);
      return;
    }

    const prefix = match.university.shortName.split(' ')[0].toUpperCase();
    const newNoc: NocRecord = {
      id: `noc-${Date.now()}`,
      referenceId: `${prefix}-NOC-2027-${String(nocs.length + 101).padStart(4, '0')}`,
      studentId: match.student.id,
      companyName: opening.companyName.split(' (')[0],
      roleTitle: opening.roleTitle,
      startDate: opening.startDate,
      endDate: addWeeksIso(opening.startDate, opening.durationWeeks),
      durationWeeks: opening.durationWeeks,
      stipendMonthly: opening.stipendMonthly,
      ppoEligible: opening.ppoAvailable && match.student.wantsPpo,
      nepCredits: calculateNepCredits(opening.durationWeeks),
      status: 'pending_tnp',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setNocs((prev) => [newNoc, ...prev]);
    setActiveNocId(newNoc.id);
  };

  const handleAddStudent = (newStudent: StudentProfile) => {
    setStudents((prev) => [newStudent, ...prev]);
  };

  const handleToggleVerification = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, verifiedByTnP: !s.verifiedByTnP } : s
      )
    );
  };

  const handleBulkVerifyAll = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, verifiedByTnP: true })));
  };

  const handleApproveNoc = (nocId: string) => {
    setNocs((prev) =>
      prev.map((n) => (n.id === nocId ? { ...n, status: 'approved' } : n))
    );
  };

  const handleSelectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleNewOpeningFocus = () => {
    setActiveTab('matchmaker');
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.setTimeout(() => {
      promptTextareaRef.current?.focus();
    }, 50);
  };

  const activeNoc = nocs.find((n) => n.id === activeNocId) ?? null;
  const activeNocStudent = activeNoc
    ? students.find((s) => s.id === activeNoc.studentId) ?? null
    : null;
  const activeNocUniversity = activeNocStudent
    ? UP_UNIVERSITIES.find((u) => u.id === activeNocStudent.universityId) ??
      UP_UNIVERSITIES[0]
    : null;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA]">
      <TopBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onPrimaryAction={handleNewOpeningFocus}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-7 space-y-6">
        {/* Compact Ecosystem Live Stats Strip */}
        <div
          aria-label="Platform ecosystem metrics"
          className="flex flex-wrap items-center justify-between gap-4 border-b border-[#27272A] pb-4 no-print"
        >
          <p className="text-xs sm:text-sm text-[#A1A1AA]">
            Unified Year 2+ Uttar Pradesh Campus Internship &amp; AI Matchmaking Engine
          </p>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#A1A1AA]">Verified UP Students:</span>
              <span
                data-testid="stat-verified-students"
                className="font-mono font-semibold text-[#22C55E] tabular-nums"
              >
                {verifiedStudentsCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#A1A1AA]">Active Openings:</span>
              <span className="font-mono font-semibold text-[#FAFAFA] tabular-nums">
                {activeOpeningsCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#A1A1AA]">AI Matches Made:</span>
              <span
                data-testid="stat-ai-matches"
                className="font-mono font-semibold text-[#FB923C] tabular-nums"
              >
                {aiMatchesCount}
              </span>
            </div>
          </div>
        </div>

        {activeTab === 'matchmaker' && (
          <MatchmakerWorkspace
            opening={opening}
            onUpdateOpening={handleUpdateOpening}
            matches={matches}
            nocs={nocs}
            onShortlistAndGenerateNoc={handleShortlistAndGenerateNoc}
            onAiRankShortlist={handleAiRankShortlist}
            aiRankLoading={aiRankLoading}
            aiRankError={aiRankError}
            promptTextareaRef={promptTextareaRef}
          />
        )}

        {activeTab === 'onboarding' && (
          <StudentOnboarding
            students={students}
            universities={UP_UNIVERSITIES}
            onAddStudent={handleAddStudent}
            onJumpToMatchmaker={() => handleSelectTab('matchmaker')}
          />
        )}

        {activeTab === 'tnp' && (
          <TnpGovernancePortal
            students={students}
            universities={UP_UNIVERSITIES}
            nocs={nocs}
            openingDurationWeeks={opening.durationWeeks}
            onToggleVerification={handleToggleVerification}
            onBulkVerifyAll={handleBulkVerifyAll}
            onApproveNoc={handleApproveNoc}
            onPreviewNoc={(id) => setActiveNocId(id)}
          />
        )}
      </main>

      <NocModal
        noc={activeNoc}
        student={activeNocStudent}
        university={activeNocUniversity}
        onApproveNoc={handleApproveNoc}
        onClose={() => setActiveNocId(null)}
      />
    </div>
  );
}
