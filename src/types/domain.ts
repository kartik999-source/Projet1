export type WorkMode = 'Remote' | 'Hybrid' | 'On-site';

export type WorkspaceTab = 'matchmaker' | 'student' | 'tnp' | 'sprint';

export interface UPUniversity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  affiliation: string;
  examBlackoutStart: string; // ISO YYYY-MM-DD
  examBlackoutEnd: string;   // ISO YYYY-MM-DD
  summerBreakStart: string;
  summerBreakEnd: string;
  winterBreakStart: string;
  winterBreakEnd: string;
  tnpOfficerName: string;
  tnpOfficerEmail: string;
  nepCreditHoursPerCredit: number; // e.g., 40 hours per credit per NEP-2020
}

export interface StudentProject {
  title: string;
  stack: string[];
  repoUrl: string;
  summary: string;
  verifiedCommits: number;
}

export interface StudentProfile {
  id: string;
  blindCode: string; // e.g., "UP-Y2-409"
  name: string;
  avatarUrl: string;
  universityId: string;
  universityName: string;
  city: string;
  yearOfStudy: number; // 2, 3, 4
  branch: string;
  rollNumber: string;
  cgpa: number;
  verifiedByTnP: boolean;
  availabilityStart: string; // ISO YYYY-MM-DD
  availabilityEnd: string;   // ISO YYYY-MM-DD
  maxDurationMonths: number;
  minStipend: number; // INR / month
  wantsPpo: boolean;
  openToSprint: boolean;
  preferredModes: WorkMode[];
  skills: string[];
  githubHandle: string;
  projects: StudentProject[];
  microTestScore: number | null; // 0-100
  microTestDomain: string | null;
  naturalBio: string;
  nepCreditsEarned: number;
}

export interface CompanyRequirement {
  id: string;
  companyName: string;
  roleTitle: string;
  naturalPrompt: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
  durationMonths: number; // 0.5 for 2-week sprint, 1-6 for internships
  isEvaluationSprint: boolean;
  stipendMonthly: number; // INR / month
  ppoAvailable: boolean;
  ppoRequiredByRole: boolean;
  mode: WorkMode;
  city: string;
  requiredSkills: string[];
  requireTnPVerified: boolean;
  blindMode: boolean;
}

export interface CalendarOverlapResult {
  overlapDays: number;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  examConflictDays: number;
  examConflictNote: string | null;
  sufficientForDuration: boolean;
}

export interface MatchResult {
  student: StudentProfile;
  university: UPUniversity;
  hardFilterPassed: boolean;
  disqualificationReasons: string[];
  calendarOverlap: CalendarOverlapResult;
  skillMatchRatio: number;
  matchedSkills: string[];
  semanticScore: number; // 0-100
  proofOfWorkScore: number; // 0-100
  totalScore: number; // 0-100
  whyShortlisted: string;
  aiEnriched?: boolean;
}

export interface InvitationRecord {
  id: string;
  studentId: string;
  companyName: string;
  roleTitle: string;
  type: '2-week-sprint' | 'internship-offer';
  startDate: string;
  endDate: string;
  durationWeeks: number;
  stipendMonthly: number;
  ppoEligible: boolean;
  mode: WorkMode;
  city: string;
  matchScore: number;
  whyShortlisted: string;
  status: 'invited' | 'accepted' | 'noc_issued' | 'declined';
  nepCredits: number;
  nocReferenceId?: string;
  createdAt: string;
}

export interface SprintMilestone {
  week: number;
  title: string;
  deliverable: string;
  completed: boolean;
  mentorRating: number | null; // 1-5
  mentorNote: string;
}

export interface SprintPipelineRecord {
  id: string;
  studentId: string;
  companyName: string;
  roleTitle: string;
  trackType: '2-week-sprint' | 'ppo-internship';
  startDate: string;
  endDate: string;
  stipendMonthly: number;
  ppoEligible: boolean;
  ppoStatus: 'sprint_active' | 'sprint_passed' | 'ppo_track' | 'ppo_extended';
  milestones: SprintMilestone[];
}

export interface MicroTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
