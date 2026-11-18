export type WorkspaceTab = 'matchmaker' | 'onboarding' | 'tnp';

export interface UPUniversity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  affiliation: string;
  examBlackoutStart: string;
  examBlackoutEnd: string;
  tnpOfficerName: string;
  tnpOfficerEmail: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  universityId: string;
  universityName: string;
  city: string;
  year: number; // 2, 3, 4
  branch: string;
  rollNumber: string;
  cgpa: number;
  verifiedByTnP: boolean;
  availableFrom: string; // ISO YYYY-MM-DD
  availableTo: string;   // ISO YYYY-MM-DD
  minStipend: number; // INR / month (0 to 25000)
  wantsPpo: boolean;
  skills: string[];
  projectsSummary: string;
  githubHandle: string;
  avatarUrl: string;
  naturalBio: string;
}

export interface OpeningRequirement {
  id: string;
  companyName: string;
  roleTitle: string;
  naturalPrompt: string;
  requiredSkills: string[];
  startDate: string; // ISO YYYY-MM-DD
  durationWeeks: number; // 4 to 16 weeks
  stipendMonthly: number; // 0 to 25000 INR
  ppoAvailable: boolean;
  blindMode: boolean;
  mode: 'Remote' | 'Hybrid' | 'On-site';
  city: string;
}

export interface MatchResult {
  student: StudentProfile;
  university: UPUniversity;
  hardFilterPassed: boolean;
  disqualificationReasons: string[];
  overlapDays: number;
  effectiveEndDate: string;
  matchedSkills: string[];
  matchScore: number; // 0-100
  whyShortlisted: string;
  aiRanked: boolean;
}

export interface NocRecord {
  id: string;
  referenceId: string;
  studentId: string;
  companyName: string;
  roleTitle: string;
  startDate: string;
  endDate: string;
  durationWeeks: number;
  stipendMonthly: number;
  ppoEligible: boolean;
  nepCredits: number;
  status: 'pending_tnp' | 'approved';
  createdAt: string;
}

export interface SkillDistributionDatum {
  skill: string;
  shortlisted: number;
  blocked: number;
  total: number;
}
