import { useMemo, useRef, useState } from 'react';
import {
  CompanyRequirement,
  InvitationRecord,
  MatchResult,
  SprintPipelineRecord,
  StudentProfile,
  WorkspaceTab,
} from './types/domain';
import {
  DEFAULT_REQUIREMENT,
  INITIAL_INVITATIONS,
  INITIAL_SPRINTS,
  INITIAL_STUDENTS,
  UP_UNIVERSITIES,
} from './data/upSeedData';
import { calculateNepCredits, rankCandidates } from './engine/matchmaker';
import { TopBar } from './components/TopBar';
import { MatchmakerWorkspace } from './components/MatchmakerWorkspace';
import { StudentPortal } from './components/StudentPortal';
import { TnpGovernancePortal } from './components/TnpGovernancePortal';
import { SprintPpoTracker } from './components/SprintPpoTracker';
import { NocModal } from './components/NocModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('matchmaker');
  const [students, setStudents] = useState<StudentProfile[]>(INITIAL_STUDENTS);
  const [requirement, setRequirement] = useState<CompanyRequirement>(DEFAULT_REQUIREMENT);
  const [invitations, setInvitations] = useState<InvitationRecord[]>(INITIAL_INVITATIONS);
  const [sprints, setSprints] = useState<SprintPipelineRecord[]>(INITIAL_SPRINTS);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(INITIAL_STUDENTS[0].id);

  const [embeddingScores, setEmbeddingScores] = useState<Record<string, number>>({});
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);

  const [nocPreviewInvitationId, setNocPreviewInvitationId] = useState<string | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const matches = useMemo(
    () =>
      rankCandidates(
        students,
        requirement,
        UP_UNIVERSITIES,
        embeddingScores,
        aiExplanations
      ),
    [students, requirement, embeddingScores, aiExplanations]
  );

  const handleUpdateRequirement = (next: CompanyRequirement) => {
    setRequirement(next);
    // Clear stale AI explanations when sliders/constraints shift significantly
    setAiExplanations({});
    setAiExplainError(null);
  };

  const handleAiExplainMatches = async () => {
    const shortlisted = matches.filter((m) => m.hardFilterPassed);
    if (shortlisted.length === 0) return;
    setAiExplainLoading(true);
    setAiExplainError(null);
    try {
      const res = await fetch('/api/ai/explain-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          candidates: shortlisted.map((m) => ({
            id: m.student.id,
            blindCode: m.student.blindCode,
            name: m.student.name,
            universityName: m.university.shortName,
            yearOfStudy: m.student.yearOfStudy,
            skills: m.student.skills,
            projects: m.student.projects,
            overlapDays: m.calendarOverlap.overlapDays,
            microTestScore: m.student.microTestScore,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini ranking enrichment failed.');
      }
      setEmbeddingScores(data.embeddingScores || {});
      setAiExplanations(data.explanationsById || {});
    } catch (err) {
      setAiExplainError(
        err instanceof Error ? err.message : 'Unable to reach Gemini match explainer.'
      );
    } finally {
      setAiExplainLoading(false);
    }
  };

  const handleSendInvitation = (
    match: MatchResult,
    type: '2-week-sprint' | 'internship-offer'
  ) => {
    const start = match.calendarOverlap.effectiveStart || requirement.startDate;
    const isSprint = type === '2-week-sprint';
    const durationWeeks = isSprint
      ? 2
      : Math.max(4, Math.round(requirement.durationMonths * 4));
    const endDate = isSprint
      ? new Date(Date.parse(`${start}T00:00:00Z`) + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
      : match.calendarOverlap.effectiveEnd || requirement.endDate;

    const newInvite: InvitationRecord = {
      id: `inv-${Date.now()}`,
      studentId: match.student.id,
      companyName: requirement.companyName.split(' (')[0],
      roleTitle: isSprint
        ? `2-Wk Sprint: ${requirement.roleTitle}`
        : requirement.roleTitle,
      type,
      startDate: start,
      endDate,
      durationWeeks,
      stipendMonthly: requirement.stipendMonthly,
      ppoEligible: requirement.ppoAvailable,
      mode: requirement.mode,
      city: requirement.city,
      matchScore: match.totalScore,
      whyShortlisted: match.whyShortlisted,
      status: 'invited',
      nepCredits: calculateNepCredits(durationWeeks),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setInvitations((prev) => [newInvite, ...prev]);

    // If it's a 2-week sprint, automatically seed a Sprint-to-PPO pipeline tracker entry
    if (isSprint) {
      const sprintEntry: SprintPipelineRecord = {
        id: `spr-${Date.now()}`,
        studentId: match.student.id,
        companyName: newInvite.companyName,
        roleTitle: newInvite.roleTitle,
        trackType: '2-week-sprint',
        startDate: start,
        endDate,
        stipendMonthly: requirement.stipendMonthly,
        ppoEligible: requirement.ppoAvailable,
        ppoStatus: 'sprint_active',
        milestones: [
          {
            week: 1,
            title: 'Week 1: Architecture & Initial PR',
            deliverable: `Core module setup using ${requirement.requiredSkills.slice(0, 2).join(' + ')}`,
            completed: false,
            mentorRating: null,
            mentorNote: '',
          },
          {
            week: 2,
            title: 'Week 2: Evaluation Demo & Summer Gate',
            deliverable: 'Production test suite & live walkthrough for internship upgrade',
            completed: false,
            mentorRating: null,
            mentorNote: '',
          },
        ],
      };
      setSprints((prev) => [sprintEntry, ...prev]);
    }
  };

  const handleUpdateStudent = (updated: StudentProfile) => {
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleToggleStudentVerification = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, verifiedByTnP: !s.verifiedByTnP } : s
      )
    );
  };

  const handleBulkVerifyAll = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, verifiedByTnP: true })));
  };

  const handleAcceptAndGenerateNoc = (invitationId: string) => {
    setInvitations((prev) =>
      prev.map((inv) => {
        if (inv.id !== invitationId) return inv;
        const stu = students.find((s) => s.id === inv.studentId);
        const uni = UP_UNIVERSITIES.find((u) => u.id === stu?.universityId);
        const prefix = (uni?.id || 'UP').toUpperCase().slice(0, 4);
        const refId = inv.nocReferenceId || `${prefix}-NOC-2027-${inv.id.slice(-4)}`;
        return {
          ...inv,
          status: 'noc_issued',
          nocReferenceId: refId,
        };
      })
    );
    setNocPreviewInvitationId(invitationId);
  };

  const handleIssueAndPreviewNoc = (invitationId: string) => {
    handleAcceptAndGenerateNoc(invitationId);
  };

  const handleToggleMilestone = (sprintId: string, week: number) => {
    setSprints((prev) =>
      prev.map((sp) =>
        sp.id === sprintId
          ? {
              ...sp,
              milestones: sp.milestones.map((m) =>
                m.week === week ? { ...m, completed: !m.completed } : m
              ),
            }
          : sp
      )
    );
  };

  const handleRateMilestone = (sprintId: string, week: number, rating: number) => {
    setSprints((prev) =>
      prev.map((sp) =>
        sp.id === sprintId
          ? {
              ...sp,
              milestones: sp.milestones.map((m) =>
                m.week === week ? { ...m, mentorRating: rating } : m
              ),
            }
          : sp
      )
    );
  };

  const handleUpdateMilestoneNote = (sprintId: string, week: number, note: string) => {
    setSprints((prev) =>
      prev.map((sp) =>
        sp.id === sprintId
          ? {
              ...sp,
              milestones: sp.milestones.map((m) =>
                m.week === week ? { ...m, mentorNote: note } : m
              ),
            }
          : sp
      )
    );
  };

  const handlePromoteOrConvertPpo = (
    sprintId: string,
    nextStatus: SprintPipelineRecord['ppoStatus']
  ) => {
    setSprints((prev) =>
      prev.map((sp) => (sp.id === sprintId ? { ...sp, ppoStatus: nextStatus } : sp))
    );
  };

  const handleSelectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleNewRequirementFocus = () => {
    setActiveTab('matchmaker');
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.setTimeout(() => {
      promptTextareaRef.current?.focus();
    }, 50);
  };

  const previewInvitation =
    invitations.find((inv) => inv.id === nocPreviewInvitationId) ?? null;
  const previewStudent = previewInvitation
    ? students.find((s) => s.id === previewInvitation.studentId) ?? null
    : null;
  const previewUniversity = previewStudent
    ? UP_UNIVERSITIES.find((u) => u.id === previewStudent.universityId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onPrimaryAction={handleNewRequirementFocus}
      />

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {activeTab === 'matchmaker' && (
          <MatchmakerWorkspace
            requirement={requirement}
            onUpdateRequirement={handleUpdateRequirement}
            matches={matches}
            universities={UP_UNIVERSITIES}
            invitations={invitations}
            onSendInvitation={handleSendInvitation}
            onAiExplainMatches={handleAiExplainMatches}
            aiExplainLoading={aiExplainLoading}
            aiExplainError={aiExplainError}
            promptTextareaRef={promptTextareaRef}
          />
        )}

        {activeTab === 'student' && (
          <StudentPortal
            students={students}
            selectedStudentId={selectedStudentId}
            onSelectStudentId={setSelectedStudentId}
            onUpdateStudent={handleUpdateStudent}
            universities={UP_UNIVERSITIES}
            invitations={invitations}
            onAcceptAndGenerateNoc={handleAcceptAndGenerateNoc}
            onPreviewNoc={(id) => setNocPreviewInvitationId(id)}
          />
        )}

        {activeTab === 'tnp' && (
          <TnpGovernancePortal
            students={students}
            universities={UP_UNIVERSITIES}
            invitations={invitations}
            onToggleStudentVerification={handleToggleStudentVerification}
            onBulkVerifyAll={handleBulkVerifyAll}
            onIssueAndPreviewNoc={handleIssueAndPreviewNoc}
          />
        )}

        {activeTab === 'sprint' && (
          <SprintPpoTracker
            sprints={sprints}
            students={students}
            onToggleMilestone={handleToggleMilestone}
            onRateMilestone={handleRateMilestone}
            onUpdateMilestoneNote={handleUpdateMilestoneNote}
            onPromoteOrConvertPpo={handlePromoteOrConvertPpo}
          />
        )}
      </main>

      <NocModal
        invitation={previewInvitation}
        student={previewStudent}
        university={previewUniversity}
        onClose={() => setNocPreviewInvitationId(null)}
      />
    </div>
  );
}
