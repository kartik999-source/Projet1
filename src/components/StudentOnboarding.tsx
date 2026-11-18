import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { StudentProfile, UPUniversity } from '../types/domain';

interface StudentOnboardingProps {
  students: StudentProfile[];
  universities: UPUniversity[];
  onAddStudent: (student: StudentProfile) => void;
  onJumpToMatchmaker: () => void;
}

const SAMPLE_INTRO =
  "I'm Kartik, a 2nd-year CS student at MJPRU Bareilly, available May 1 to July 31, skilled in Python, FastAPI, and React, looking for at least ₹8,000 stipend with PPO potential";

export const StudentOnboarding: React.FC<StudentOnboardingProps> = ({
  students,
  universities,
  onAddStudent,
  onJumpToMatchmaker,
}) => {
  const [introText, setIntroText] = useState(SAMPLE_INTRO);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [extractedStudent, setExtractedStudent] = useState<StudentProfile | null>(null);
  const [joinedConfirmation, setJoinedConfirmation] = useState<string | null>(null);

  const buildStudentFromParsed = (p: {
    name?: string;
    university?: string;
    city?: string;
    year?: number;
    branch?: string;
    skills?: string[];
    available_from?: string;
    available_to?: string;
    min_stipend?: number;
    wants_ppo?: boolean;
    projectsSummary?: string;
  }): StudentProfile => {
    const uniText = (p.university || 'MJPRU Bareilly').toLowerCase();
    const matchedUni =
      universities.find(
        (u) =>
          uniText.includes(u.shortName.toLowerCase()) ||
          uniText.includes(u.city.toLowerCase()) ||
          u.id.includes(uniText.split(' ')[0])
      ) ?? universities[0];

    const name = (p.name || 'New UP Student').trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return {
      id: `stu-${slug}-${Date.now()}`,
      name,
      universityId: matchedUni.id,
      universityName: p.university || matchedUni.shortName,
      city: p.city || matchedUni.city,
      year: Math.max(2, Math.min(4, Number(p.year) || 2)),
      branch: p.branch || 'B.Tech CSE',
      rollNumber: `25${matchedUni.id.slice(0, 3).toUpperCase()}${Math.floor(100 + Math.random() * 899)}`,
      cgpa: 8.5,
      verifiedByTnP: true,
      availableFrom: p.available_from || '2027-05-01',
      availableTo: p.available_to || '2027-07-31',
      minStipend: Math.max(0, Number(p.min_stipend) || 0),
      wantsPpo: Boolean(p.wants_ppo),
      skills:
        Array.isArray(p.skills) && p.skills.length > 0
          ? p.skills
          : ['Python', 'FastAPI', 'React'],
      projectsSummary:
        p.projectsSummary ||
        `Built full-stack academic and campus automation projects using ${(p.skills || ['Python', 'React']).slice(0, 3).join(', ')}.`,
      githubHandle: `${slug}-up`,
      avatarUrl: '/src/assets/images/avatar_rohan_ai_1794977203595.jpg',
      naturalBio: introText.trim(),
    };
  };

  const handleParseAndJoin = async () => {
    setParsing(true);
    setParseError(null);
    setJoinedConfirmation(null);
    try {
      const res = await fetch('/api/ai/parse-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: introText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to parse student introduction.');
      }
      const studentObj = buildStudentFromParsed(data.parsed);
      setExtractedStudent(studentObj);
      onAddStudent(studentObj);
      setJoinedConfirmation(
        `${studentObj.name} (${studentObj.universityName}) parsed and added to the live UP-InternAI talent pool.`
      );
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Profile extraction failed.'
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Natural-Language Profile Builder */}
      <section className="lg:col-span-6 rounded-xl border border-[#27272A] bg-[#121216] p-6 space-y-5">
        <div>
          <p className="text-xs font-medium text-[#FB923C]">
            View B · Conversational Student Onboarding
          </p>
          <h1 className="font-display text-2xl font-bold text-[#FAFAFA] mt-1">
            Natural-Language Profile Builder
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1.5 leading-relaxed">
            Write a single paragraph covering your name, UP university, year, skills,
            free dates, minimum stipend, and PPO interest. Gemini extracts structured JSON
            and places you straight into the live recruiter shortlist.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="student-onboarding-bio"
              className="text-xs font-medium text-[#A1A1AA]"
            >
              Student Introduction Paragraph
            </label>
            <button
              type="button"
              onClick={() => setIntroText(SAMPLE_INTRO)}
              className="text-xs font-medium text-[#FB923C] hover:underline"
            >
              Load Sample (Kartik · MJPRU)
            </button>
          </div>
          <textarea
            id="student-onboarding-bio"
            rows={5}
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            placeholder="Describe your university, year, skills, availability window, stipend floor, and PPO preference..."
            className="w-full rounded-lg border border-[#27272A] bg-[#1C1C22] px-4 py-3 text-sm text-[#FAFAFA] placeholder:text-[#71717A] focus:border-[#F97316] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleParseAndJoin}
            disabled={parsing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-bold text-[#09090B] transition-colors hover:bg-[#FB923C] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            {parsing ? 'Parsing Profile...' : 'Parse & Join Talent Pool'}
          </button>

          {joinedConfirmation && (
            <button
              type="button"
              onClick={onJumpToMatchmaker}
              className="rounded-lg border border-[#27272A] bg-[#1C1C22] px-4 py-2.5 text-xs font-semibold text-[#FAFAFA] hover:border-[#F97316]/50 whitespace-nowrap shrink-0"
            >
              View in Recruiter Matchmaker →
            </button>
          )}
        </div>

        {parseError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <span>{parseError}</span>
          </div>
        )}

        {joinedConfirmation && (
          <div className="flex items-start gap-2 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-xs text-[#22C55E]">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{joinedConfirmation}</span>
          </div>
        )}

        {/* Structured JSON Preview Card */}
        {extractedStudent && (
          <div className="rounded-xl border border-[#27272A] bg-[#1C1C22] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-[#FAFAFA]">
                Extracted Structured Candidate Card
              </h2>
              <span className="rounded-md bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                Live in Pool
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#71717A]">Name</span>
                <div className="font-semibold text-[#FAFAFA] mt-0.5">
                  {extractedStudent.name}
                </div>
              </div>
              <div>
                <span className="text-[#71717A]">University &amp; Year</span>
                <div className="font-semibold text-[#FAFAFA] mt-0.5">
                  {extractedStudent.universityName} · Year {extractedStudent.year}
                </div>
              </div>
              <div>
                <span className="text-[#71717A]">Availability Window</span>
                <div className="font-mono text-[#FB923C] tabular-nums mt-0.5">
                  {extractedStudent.availableFrom} → {extractedStudent.availableTo}
                </div>
              </div>
              <div>
                <span className="text-[#71717A]">Stipend &amp; PPO</span>
                <div className="font-mono text-[#FAFAFA] tabular-nums mt-0.5">
                  Min ₹{extractedStudent.minStipend.toLocaleString('en-IN')} ·{' '}
                  {extractedStudent.wantsPpo ? 'PPO Seeking' : 'Internship Only'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {extractedStudent.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded border border-[#F97316]/30 bg-[#F97316]/15 px-2 py-0.5 text-[11px] font-medium text-[#FB923C]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Right: Live UP Talent Pool Directory */}
      <section className="lg:col-span-6 rounded-xl border border-[#27272A] bg-[#121216] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#F97316]" />
            <h2 className="font-display text-base font-semibold text-[#FAFAFA]">
              Active UP Talent Pool ({students.length} Students)
            </h2>
          </div>
          <span className="font-mono text-xs text-[#A1A1AA] tabular-nums">
            Synced Live
          </span>
        </div>

        <div className="space-y-3">
          {students.map((stu) => (
            <div
              key={stu.id}
              className="rounded-lg border border-[#27272A] bg-[#1C1C22] p-4 transition-all duration-200 hover:border-orange-500/50 hover:shadow-[0_0_24px_rgba(249,115,22,0.12)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#FAFAFA]">
                      {stu.name}
                    </h3>
                    {stu.verifiedByTnP && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                        <ShieldCheck className="h-3 w-3" />
                        T&amp;P Verified
                      </span>
                    )}
                    {stu.wantsPpo && (
                      <span className="rounded bg-[#22C55E]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22C55E]">
                        PPO Eligible
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    {stu.universityName} · Year {stu.year} {stu.branch}
                  </p>
                </div>

                <div className="text-right font-mono text-xs tabular-nums">
                  <div className="text-[#FB923C]">
                    ₹{stu.minStipend.toLocaleString('en-IN')}+/mo
                  </div>
                  <div className="text-[#71717A] text-[11px]">
                    {stu.availableFrom.slice(5)} → {stu.availableTo.slice(5)}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {stu.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-[#27272A] bg-[#121216] px-2 py-0.5 text-[11px] text-[#A1A1AA]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
