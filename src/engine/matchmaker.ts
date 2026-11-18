import {
  CalendarOverlapResult,
  CompanyRequirement,
  MatchResult,
  StudentProfile,
  UPUniversity,
} from '../types/domain';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatIsoDay(utcMs: number): string {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

export function calculateNepCredits(durationWeeks: number, hoursPerWeek = 35): number {
  // NEP-2020 / AICTE internship guideline: ~40 notional hours = 1 academic credit
  // Standard full-time summer/sprint internship ~35-40 hrs/week
  if (durationWeeks <= 0) return 0;
  const totalHours = durationWeeks * hoursPerWeek;
  return Math.max(1, Math.round(totalHours / 40));
}

export function computeCalendarOverlap(
  studentStart: string,
  studentEnd: string,
  reqStart: string,
  reqEnd: string,
  requiredDays: number,
  university?: UPUniversity
): CalendarOverlapResult {
  const sStart = parseIsoDay(studentStart);
  const sEnd = parseIsoDay(studentEnd);
  const rStart = parseIsoDay(reqStart);
  const rEnd = parseIsoDay(reqEnd);

  const overlapStartMs = Math.max(sStart, rStart);
  const overlapEndMs = Math.min(sEnd, rEnd);

  if (overlapEndMs < overlapStartMs) {
    return {
      overlapDays: 0,
      effectiveStart: null,
      effectiveEnd: null,
      examConflictDays: 0,
      examConflictNote: university
        ? `${university.shortName} availability ends before or starts after requirement window.`
        : 'No calendar overlap.',
      sufficientForDuration: false,
    };
  }

  const rawOverlapDays = Math.floor((overlapEndMs - overlapStartMs) / MS_PER_DAY) + 1;

  let examConflictDays = 0;
  let examConflictNote: string | null = null;

  if (university) {
    const exStart = parseIsoDay(university.examBlackoutStart);
    const exEnd = parseIsoDay(university.examBlackoutEnd);
    const conflictStart = Math.max(rStart, exStart);
    const conflictEnd = Math.min(rEnd, exEnd);
    if (conflictEnd >= conflictStart) {
      examConflictDays = Math.floor((conflictEnd - conflictStart) / MS_PER_DAY) + 1;
      examConflictNote = `${university.shortName} End-Sem exams (${university.examBlackoutStart.slice(5)} to ${university.examBlackoutEnd.slice(5)}) overlap ${examConflictDays}d of requested start.`;
    }
  }

  // Effective usable days within student's declared free window
  const usableDays = rawOverlapDays;
  // Allow 7-day buffer tolerance for multi-month terms, exact 14d for 2-week sprints
  const tolerance = requiredDays <= 21 ? 2 : 7;
  const sufficientForDuration = usableDays + tolerance >= requiredDays;

  return {
    overlapDays: usableDays,
    effectiveStart: formatIsoDay(overlapStartMs),
    effectiveEnd: formatIsoDay(overlapEndMs),
    examConflictDays,
    examConflictNote,
    sufficientForDuration,
  };
}

export function evaluateHardConstraints(
  student: StudentProfile,
  requirement: CompanyRequirement,
  university?: UPUniversity
): { passed: boolean; reasons: string[]; overlap: CalendarOverlapResult } {
  const reasons: string[] = [];

  // 1. Year 2+ Gate
  if (student.yearOfStudy < 2) {
    reasons.push('Must be Year 2+ enrolled student');
  }

  // 2. T&P Cell Trust Verification Gate
  if (requirement.requireTnPVerified && !student.verifiedByTnP) {
    reasons.push(`Pending T&P verification from ${university?.shortName ?? student.universityName}`);
  }

  // 3. Calendar & Duration Hard Filter
  const requiredDays = requirement.isEvaluationSprint
    ? 14
    : Math.max(14, Math.round(requirement.durationMonths * 30));

  const overlap = computeCalendarOverlap(
    student.availabilityStart,
    student.availabilityEnd,
    requirement.startDate,
    requirement.endDate,
    requiredDays,
    university
  );

  if (!overlap.sufficientForDuration) {
    if (overlap.examConflictNote) {
      reasons.push(overlap.examConflictNote);
    } else {
      reasons.push(
        `Calendar window overlap (${overlap.overlapDays}d) is shorter than ${requiredDays}d requirement`
      );
    }
  }

  if (!requirement.isEvaluationSprint && student.maxDurationMonths + 0.25 < requirement.durationMonths) {
    reasons.push(
      `Student max term (${student.maxDurationMonths}m) < requested ${requirement.durationMonths}m`
    );
  }

  if (requirement.isEvaluationSprint && !student.openToSprint) {
    reasons.push('Student opted out of 2-week evaluation sprints');
  }

  // 4. Stipend Hard Filter (Evaluation sprints allow flexible stipend floor at 50%)
  const effectiveFloor = requirement.isEvaluationSprint
    ? Math.round(student.minStipend * 0.5)
    : student.minStipend;

  if (requirement.stipendMonthly < effectiveFloor) {
    reasons.push(
      `Offered ₹${requirement.stipendMonthly.toLocaleString('en-IN')}/mo below student floor ₹${effectiveFloor.toLocaleString('en-IN')}`
    );
  }

  // 5. PPO Alignment Filter
  if (requirement.ppoRequiredByRole && !student.wantsPpo) {
    reasons.push('Role requires PPO-track availability');
  }

  // 6. Work Mode & UP City Proximity Filter
  if (requirement.mode !== 'Remote') {
    const modeAllowed = student.preferredModes.includes(requirement.mode);
    const sameCity = student.city.toLowerCase() === requirement.city.toLowerCase();
    const canRelocateHybrid = requirement.mode === 'Hybrid' && student.preferredModes.includes('Hybrid');
    if (!modeAllowed) {
      reasons.push(`Prefers ${student.preferredModes.join('/')} (role is ${requirement.mode})`);
    } else if (requirement.mode === 'On-site' && !sameCity) {
      reasons.push(`On-site in ${requirement.city} conflicts with campus location (${student.city})`);
    } else if (!sameCity && !canRelocateHybrid) {
      reasons.push(`Hybrid location mismatch (${requirement.city} vs ${student.city})`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    overlap,
  };
}

export function computeSkillAndSemanticScore(
  student: StudentProfile,
  requirement: CompanyRequirement,
  overlap: CalendarOverlapResult,
  embeddingSimilarity?: number
): {
  matchedSkills: string[];
  skillMatchRatio: number;
  semanticScore: number;
  proofOfWorkScore: number;
  totalScore: number;
} {
  const reqSkillsLower = requirement.requiredSkills.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const stuSkillsLower = student.skills.map((s) => s.trim().toLowerCase());
  const projectStackLower = student.projects.flatMap((p) => p.stack.map((s) => s.toLowerCase()));

  const matchedSkills: string[] = [];
  for (const req of requirement.requiredSkills) {
    const key = req.trim().toLowerCase();
    const inSkills = stuSkillsLower.some((s) => s.includes(key) || key.includes(s));
    const inProjects = projectStackLower.some((s) => s.includes(key) || key.includes(s));
    if (inSkills || inProjects) {
      matchedSkills.push(req);
    }
  }

  const skillMatchRatio =
    reqSkillsLower.length === 0 ? 1 : matchedSkills.length / reqSkillsLower.length;

  // Proof-of-work score from verified GitHub commits + domain micro-test
  const totalCommits = student.projects.reduce((acc, p) => acc + p.verifiedCommits, 0);
  const repoSignal = Math.min(100, 45 + totalCommits * 0.55);
  const microTestSignal = student.microTestScore ?? 65;
  const proofOfWorkScore = Math.round(repoSignal * 0.45 + microTestSignal * 0.55);

  // Semantic alignment: use Gemini embedding cosine similarity if provided, otherwise project-text lexical overlap
  let semanticScore = Math.round(skillMatchRatio * 75 + (student.wantsPpo && requirement.ppoAvailable ? 15 : 8));
  if (typeof embeddingSimilarity === 'number' && !Number.isNaN(embeddingSimilarity)) {
    // Gemini embeddings typically fall in ~0.55 - 0.90 for relevant tech text
    const normalized = Math.max(0, Math.min(1, (embeddingSimilarity - 0.45) / 0.4));
    semanticScore = Math.round(normalized * 100);
  }

  const requiredDays = requirement.isEvaluationSprint
    ? 14
    : Math.max(14, Math.round(requirement.durationMonths * 30));
  const overlapFit = Math.min(1, overlap.overlapDays / requiredDays);
  const ppoBonus = requirement.ppoAvailable && student.wantsPpo ? 5 : 0;

  const rawTotal =
    skillMatchRatio * 42 +
    (semanticScore / 100) * 24 +
    (proofOfWorkScore / 100) * 22 +
    overlapFit * 7 +
    ppoBonus;

  const totalScore = Math.max(35, Math.min(99, Math.round(rawTotal)));

  return {
    matchedSkills,
    skillMatchRatio,
    semanticScore,
    proofOfWorkScore,
    totalScore,
  };
}

export function buildDeterministicExplanation(
  student: StudentProfile,
  requirement: CompanyRequirement,
  overlap: CalendarOverlapResult,
  matchedSkills: string[],
  university?: UPUniversity
): string {
  const weeks = Math.max(2, Math.round(overlap.overlapDays / 7));
  const skillText =
    matchedSkills.length > 0
      ? matchedSkills.slice(0, 3).join('/')
      : student.skills.slice(0, 2).join('/');
  const topProject = student.projects[0]?.title ?? 'GitHub portfolio';
  const microText =
    student.microTestScore !== null
      ? ` + ${student.microTestScore}% micro-test`
      : '';
  const campusLabel = requirement.blindMode
    ? `Candidate ${student.blindCode}`
    : university?.shortName ?? student.universityName;

  if (requirement.isEvaluationSprint) {
    return `Clean ${weeks}-week sprint runway (${overlap.effectiveStart ?? student.availabilityStart}); ${topProject} (${skillText}${microText}) fits rapid evaluation.`;
  }
  return `Available ${weeks} wks (${overlap.effectiveStart ?? student.availabilityStart} to ${overlap.effectiveEnd ?? student.availabilityEnd}) aligned with ${campusLabel} schedule; ${topProject} verifies ${skillText}${microText}.`;
}

export function rankCandidates(
  students: StudentProfile[],
  requirement: CompanyRequirement,
  universities: UPUniversity[],
  embeddingScoresByStudentId: Record<string, number> = {},
  aiExplanationsByStudentId: Record<string, string> = {}
): MatchResult[] {
  const uniMap = new Map(universities.map((u) => [u.id, u]));

  const results: MatchResult[] = students.map((student) => {
    const university = uniMap.get(student.universityId) ?? universities[0];
    const hardCheck = evaluateHardConstraints(student, requirement, university);
    const scores = computeSkillAndSemanticScore(
      student,
      requirement,
      hardCheck.overlap,
      embeddingScoresByStudentId[student.id]
    );

    const aiReason = aiExplanationsByStudentId[student.id];
    const whyShortlisted =
      aiReason ||
      buildDeterministicExplanation(
        student,
        requirement,
        hardCheck.overlap,
        scores.matchedSkills,
        university
      );

    return {
      student,
      university,
      hardFilterPassed: hardCheck.passed,
      disqualificationReasons: hardCheck.reasons,
      calendarOverlap: hardCheck.overlap,
      skillMatchRatio: scores.skillMatchRatio,
      matchedSkills: scores.matchedSkills,
      semanticScore: scores.semanticScore,
      proofOfWorkScore: scores.proofOfWorkScore,
      totalScore: scores.totalScore,
      whyShortlisted,
      aiEnriched: Boolean(aiReason),
    };
  });

  return results.sort((a, b) => {
    if (a.hardFilterPassed !== b.hardFilterPassed) {
      return a.hardFilterPassed ? -1 : 1;
    }
    return b.totalScore - a.totalScore;
  });
}

export function getDisplayCandidateIdentity(
  student: StudentProfile,
  blindMode: boolean
): {
  displayName: string;
  institutionLine: string;
  isRedacted: boolean;
} {
  if (blindMode) {
    return {
      displayName: `Candidate ${student.blindCode}`,
      institutionLine: `Year ${student.yearOfStudy} · ${student.branch} · UP Verified Campus (Redacted)`,
      isRedacted: true,
    };
  }
  return {
    displayName: student.name,
    institutionLine: `${student.universityName} · ${student.city} · Year ${student.yearOfStudy}`,
    isRedacted: false,
  };
}

export interface SkillDistributionDatum {
  skill: string;
  shortlisted: number;
  blocked: number;
  total: number;
}

export function computeSkillDistribution(
  matches: MatchResult[],
  requiredSkills: string[]
): SkillDistributionDatum[] {
  const cleanedSkills = requiredSkills
    .map((s) => s.trim())
    .filter(Boolean);

  return cleanedSkills.map((skill) => {
    const key = skill.toLowerCase();
    let shortlisted = 0;
    let blocked = 0;

    for (const match of matches) {
      const stuSkillsLower = match.student.skills.map((s) => s.trim().toLowerCase());
      const projectStackLower = match.student.projects.flatMap((p) =>
        p.stack.map((s) => s.trim().toLowerCase())
      );
      const hasSkill =
        stuSkillsLower.some((s) => s.includes(key) || key.includes(s)) ||
        projectStackLower.some((s) => s.includes(key) || key.includes(s));

      if (hasSkill) {
        if (match.hardFilterPassed) {
          shortlisted += 1;
        } else {
          blocked += 1;
        }
      }
    }

    return {
      skill,
      shortlisted,
      blocked,
      total: shortlisted + blocked,
    };
  });
}

