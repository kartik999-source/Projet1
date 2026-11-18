import React, { useState } from 'react';
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import {
  InvitationRecord,
  MicroTestQuestion,
  StudentProfile,
  UPUniversity,
} from '../types/domain';

interface StudentPortalProps {
  students: StudentProfile[];
  selectedStudentId: string;
  onSelectStudentId: (id: string) => void;
  onUpdateStudent: (updated: StudentProfile) => void;
  universities: UPUniversity[];
  invitations: InvitationRecord[];
  onAcceptAndGenerateNoc: (invitationId: string) => void;
  onPreviewNoc: (invitationId: string) => void;
}

const STANDARD_STACK_QUESTIONS: MicroTestQuestion[] = [
  {
    id: 'q1',
    question:
      'In FastAPI with async SQLAlchemy/PostgreSQL, why should CPU-bound or blocking sync DB drivers be avoided inside async def route handlers?',
    options: [
      'They block the single uvicorn asyncio event loop, stalling concurrent requests',
      'FastAPI automatically spawns a separate OS process per request',
      'PostgreSQL rejects async TCP sockets on port 5432',
      'Pydantic validation fails on async coroutines',
    ],
    correctIndex: 0,
    explanation:
      'Blocking I/O inside an async def route halts the event loop for all concurrent coroutines; use async drivers (asyncpg) or sync def threadpools.',
  },
  {
    id: 'q2',
    question:
      'When indexing 50,000 student skill embeddings in PostgreSQL with pgvector, which index type speeds up approximate cosine similarity queries?',
    options: [
      'B-Tree index on text column',
      'HNSW or IVFFlat index with vector_cosine_ops',
      'Hash index on JSONB array',
      'Full-text GIN index on raw bio',
    ],
    correctIndex: 1,
    explanation:
      'pgvector supports HNSW and IVFFlat approximate nearest-neighbor indexes with vector_cosine_ops (<=> operator).',
  },
  {
    id: 'q3',
    question:
      'Your UP campus team ships a 2-week evaluation sprint API. What HTTP status code is most appropriate when an offer acceptance triggers idempotent NOC creation on first submission?',
    options: [
      '201 Created with Location / resource payload',
      '304 Not Modified',
      '409 Conflict always',
      '503 Service Unavailable',
    ],
    correctIndex: 0,
    explanation:
      '201 Created signals a newly provisioned resource (the NOC ledger entry) with its identifier returned in the response.',
  },
];

export const StudentPortal: React.FC<StudentPortalProps> = ({
  students,
  selectedStudentId,
  onSelectStudentId,
  onUpdateStudent,
  universities,
  invitations,
  onAcceptAndGenerateNoc,
  onPreviewNoc,
}) => {
  const student = students.find((s) => s.id === selectedStudentId) ?? students[0];
  const university =
    universities.find((u) => u.id === student.universityId) ?? universities[0];
  const studentInvites = invitations.filter((inv) => inv.studentId === student.id);

  const [bioDraft, setBioDraft] = useState(student.naturalBio);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);

  const [testQuestions, setTestQuestions] = useState<MicroTestQuestion[] | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSubmittedScore, setTestSubmittedScore] = useState<number | null>(null);

  const handleStudentSwitch = (id: string) => {
    onSelectStudentId(id);
    const next = students.find((s) => s.id === id);
    if (next) {
      setBioDraft(next.naturalBio);
      setParseError(null);
      setParseSuccess(null);
      setTestQuestions(null);
      setTestSubmittedScore(null);
      setSelectedAnswers({});
    }
  };

  const handleParseProfile = async () => {
    setParseLoading(true);
    setParseError(null);
    setParseSuccess(null);
    try {
      const res = await fetch('/api/ai/parse-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to parse profile.');
      }
      const p = data.parsed;
      const matchedUni =
        universities.find((u) => u.id === p.universityId) ?? university;

      onUpdateStudent({
        ...student,
        naturalBio: bioDraft,
        yearOfStudy: typeof p.yearOfStudy === 'number' ? p.yearOfStudy : student.yearOfStudy,
        branch: p.branch || student.branch,
        universityId: matchedUni.id,
        universityName: matchedUni.shortName,
        city: matchedUni.city,
        availabilityStart: p.availabilityStart || student.availabilityStart,
        availabilityEnd: p.availabilityEnd || student.availabilityEnd,
        maxDurationMonths:
          typeof p.maxDurationMonths === 'number'
            ? p.maxDurationMonths
            : student.maxDurationMonths,
        minStipend: typeof p.minStipend === 'number' ? p.minStipend : student.minStipend,
        wantsPpo: typeof p.wantsPpo === 'boolean' ? p.wantsPpo : student.wantsPpo,
        openToSprint:
          typeof p.openToSprint === 'boolean' ? p.openToSprint : student.openToSprint,
        skills: Array.isArray(p.skills) && p.skills.length > 0 ? p.skills : student.skills,
      });
      setParseSuccess('Structured JSON profile updated & synced with Matchmaker.');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Profile parsing failed.');
    } finally {
      setParseLoading(false);
    }
  };

  const handleGenerateAiTest = async () => {
    setTestLoading(true);
    setTestError(null);
    setTestSubmittedScore(null);
    setSelectedAnswers({});
    try {
      const res = await fetch('/api/ai/micro-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: student.branch,
          skills: student.skills,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Micro-test generation failed.');
      }
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error('No questions returned from Gemini.');
      }
      setTestQuestions(data.questions);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Unable to generate AI micro-test.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleLaunchStandardTest = () => {
    setTestError(null);
    setTestSubmittedScore(null);
    setSelectedAnswers({});
    setTestQuestions(STANDARD_STACK_QUESTIONS);
  };

  const handleSubmitMicroTest = () => {
    if (!testQuestions || testQuestions.length === 0) return;
    let correct = 0;
    for (const q of testQuestions) {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correct += 1;
      }
    }
    const score = Math.round((correct / testQuestions.length) * 100);
    setTestSubmittedScore(score);
    onUpdateStudent({
      ...student,
      microTestScore: score,
      microTestDomain: student.skills.slice(0, 2).join(' & ') || 'Core Engineering',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-blue-700">
            Student Profile &amp; Verification Hub
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Natural-Language Calendar Sync &amp; Proof-of-Work
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <label htmlFor="student-switcher" className="text-xs font-medium text-slate-600">
            Active Student
          </label>
          <select
            id="student-switcher"
            value={student.id}
            onChange={(e) => handleStudentSwitch(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.universityName})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Natural Language Bio Parser & Exam Calendar */}
        <div className="lg:col-span-6 space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900">
                01. Natural-Language Availability Parser
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {student.blindCode}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Skip multi-page forms. Describe your year, free window after semester exams,
              minimum stipend, and PPO goals in plain English.
            </p>

            <div>
              <label
                htmlFor="student-bio-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Student Availability Statement
              </label>
              <textarea
                id="student-bio-input"
                rows={3}
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleParseProfile}
                disabled={parseLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {parseLoading ? 'Extracting JSON...' : 'Parse Profile with Gemini AI'}
              </button>

              {parseSuccess && (
                <span className="text-xs font-medium text-emerald-700">
                  {parseSuccess}
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

            {/* Structured JSON Snapshot + Direct Editable Dates/Stipend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label
                  htmlFor="stu-avail-start"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Free From
                </label>
                <input
                  id="stu-avail-start"
                  type="date"
                  value={student.availabilityStart}
                  onChange={(e) =>
                    onUpdateStudent({ ...student, availabilityStart: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="stu-avail-end"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Free Until
                </label>
                <input
                  id="stu-avail-end"
                  type="date"
                  value={student.availabilityEnd}
                  onChange={(e) =>
                    onUpdateStudent({ ...student, availabilityEnd: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="stu-min-stipend"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Min Stipend (₹)
                </label>
                <input
                  id="stu-min-stipend"
                  type="number"
                  step={1000}
                  value={student.minStipend}
                  onChange={(e) =>
                    onUpdateStudent({
                      ...student,
                      minStipend: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums"
                />
              </div>
              <div>
                <span className="block text-[11px] font-medium text-slate-500 mb-1">
                  PPO Track
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStudent({ ...student, wantsPpo: !student.wantsPpo })
                  }
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100"
                >
                  {student.wantsPpo ? 'PPO Seeking' : 'Internship Only'}
                </button>
              </div>
            </div>
          </section>

          {/* UP University Academic Calendar Sync */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  02. {university.shortName} Academic Calendar
                </h2>
              </div>
              <span
                className={`text-xs font-medium ${
                  student.verifiedByTnP ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {student.verifiedByTnP ? 'T&P Verified Standing' : 'Verification Pending'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="rounded-lg bg-amber-50/70 px-3 py-2.5">
                <div className="text-amber-900 font-medium">Exam Blackout</div>
                <div className="font-mono text-amber-800 mt-1 tabular-nums">
                  {university.examBlackoutStart} → {university.examBlackoutEnd}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50/70 px-3 py-2.5">
                <div className="text-emerald-900 font-medium">Summer Corridor</div>
                <div className="font-mono text-emerald-800 mt-1 tabular-nums">
                  {university.summerBreakStart} → {university.summerBreakEnd}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                <div className="text-slate-700 font-medium">Winter Corridor</div>
                <div className="font-mono text-slate-800 mt-1 tabular-nums">
                  {university.winterBreakStart} → {university.winterBreakEnd}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Proof-of-Work Micro-Test & Incoming Invitations */}
        <div className="lg:col-span-6 space-y-5">
          {/* Incoming Shortlists & Offers */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900">
                03. Company Shortlists &amp; One-Click NOC
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {studentInvites.length} active
              </span>
            </div>

            {studentInvites.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-5 text-center text-xs text-slate-600">
                No company invitations yet. Head to Matchmaker and invite{' '}
                <strong>{student.name}</strong> to a 2-week sprint or summer role.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {studentInvites.map((inv) => (
                  <div key={inv.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {inv.companyName} · {inv.roleTitle}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          {inv.type === '2-week-sprint' ? '2-Wk Sprint' : 'Internship'} ·{' '}
                          {inv.startDate} → {inv.endDate} · ₹
                          {inv.stipendMonthly.toLocaleString('en-IN')}/mo · {inv.nepCredits}{' '}
                          NEP Credits
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                        {inv.matchScore}% Match
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{inv.whyShortlisted}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span
                        className={`text-xs font-medium ${
                          inv.status === 'noc_issued'
                            ? 'text-emerald-700'
                            : inv.status === 'accepted'
                            ? 'text-blue-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {inv.status === 'noc_issued'
                          ? `NOC Issued (${inv.nocReferenceId})`
                          : inv.status === 'accepted'
                          ? 'Accepted · NOC Ready'
                          : 'Awaiting Student Response'}
                      </span>

                      <div className="flex items-center gap-2">
                        {inv.status === 'invited' ? (
                          <button
                            type="button"
                            onClick={() => onAcceptAndGenerateNoc(inv.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
                          >
                            <FileCheck2 className="h-3.5 w-3.5" />
                            Accept &amp; Generate NOC
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPreviewNoc(inv.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <FileCheck2 className="h-3.5 w-3.5 text-blue-700" />
                            View Official NOC
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Proof-of-Work & 10-Min AI Domain Micro-Test */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-blue-700" />
                <h2 className="font-display text-base font-semibold text-slate-900">
                  04. Proof-of-Work &amp; Domain Micro-Test
                </h2>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                {student.microTestScore !== null
                  ? `Verified Score: ${student.microTestScore}/100`
                  : 'Unverified'}
              </span>
            </div>

            {/* Verified GitHub Repositories */}
            <div className="space-y-2">
              {student.projects.map((proj) => (
                <div
                  key={proj.title}
                  className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      {proj.title}{' '}
                      <span className="font-normal text-slate-500">
                        · {proj.stack.join(', ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{proj.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                      {proj.verifiedCommits} commits
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleGenerateAiTest}
                disabled={testLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {testLoading ? 'Generating via Gemini...' : 'Generate AI Micro-Test'}
              </button>
              <button
                type="button"
                onClick={handleLaunchStandardTest}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Run Standard Stack Assessment
              </button>
            </div>

            {testError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{testError}</span>
              </div>
            )}

            {testQuestions && (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                {testQuestions.map((q, idx) => (
                  <div key={q.id} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-900">
                      Q{idx + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const checked = selectedAnswers[q.id] === optIdx;
                        return (
                          <label
                            key={optIdx}
                            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'border-blue-600 bg-blue-50 text-slate-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`microtest-${q.id}`}
                              checked={checked}
                              onChange={() =>
                                setSelectedAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: optIdx,
                                }))
                              }
                              className="mt-0.5 accent-blue-700"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                    {testSubmittedScore !== null && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50 rounded px-2.5 py-1.5">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitMicroTest}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    Submit &amp; Verify Proof Score
                  </button>
                  {testSubmittedScore !== null && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 font-mono tabular-nums">
                      <CheckCircle2 className="h-4 w-4" />
                      Score Recorded: {testSubmittedScore}/100
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
