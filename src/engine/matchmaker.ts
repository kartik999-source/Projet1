import {
  MatchResult,
  OpeningRequirement,
  SkillDistributionDatum,
  StudentProfile,
  UPUniversity,
} from '../types/domain';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addWeeksIso(startIso: string, weeks: number): string {
  const ms = parseIsoDay(startIso) + weeks * 7 * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

export function calculateNepCredits(durationWeeks: number, hoursPerWeek = 35): number {
  // NEP-2020 / AICTE internship norm: ~40 notional hours = 1 academic credit
  if (durationWeeks <= 0) return 0;
  return Math.max(1, Math.round((durationWeeks * hoursPerWeek) / 40));
}

export function computeWindowOverlapDays(
  studentFrom: string,
  studentTo: string,
  reqStart: string,
  reqEnd: string
): number {
  const start = Math.max(parseIsoDay(studentFrom), parseIsoDay(reqStart));
  const end = Math.min(parseIsoDay(studentTo), parseIsoDay(reqEnd));
  if (end < start) return 0;
  return Math.floor((end - start) / MS_PER_DAY) + 1;
}

export function evaluateStageOneConstraints(
  student: StudentProfile,
  opening: OpeningRequirement
): { passed: boolean; reasons: string[]; overlapDays: number; endDate: string } {
  const reasons: string[] = [];
  const endDate = addWeeksIso(opening.startDate, opening.durationWeeks);
  const requiredDays = opening.durationWeeks * 7;

  // 1. Year 2+ eligibility
  if (student.year < 2) {
    reasons.push('Requires Year 2+ enrollment');
  }

  // 2. T&P verification
  if (!student.verifiedByTnP) {
    reasons.push(`Pending T&P Cell verification (${student.universityName})`);
  }

  // 3. Availability window coverage
  const overlapDays = computeWindowOverlapDays(
    student.availableFrom,
    student.availableTo,
    opening.startDate,
    endDate
  );

  if (
    parseIsoDay(student.availableFrom) > parseIsoDay(opening.startDate) ||
    parseIsoDay(student.availableTo) < parseIsoDay(endDate)
  ) {
    reasons.push(
      `Availability (${student.availableFrom.slice(5)} to ${student.availableTo.slice(5)}) does not fully cover ${opening.startDate.slice(5)} to ${endDate.slice(5)}`
    );
  } else if (overlapDays < requiredDays) {
    reasons.push(`Overlap ${overlapDays}d is shorter than ${requiredDays}d requirement`);
  }

  // 4. Stipend minimum constraint
  if (opening.stipendMonthly < student.minStipend) {
    reasons.push(
      `Stipend ₹${opening.stipendMonthly.toLocaleString('en-IN')} is below student floor ₹${student.minStipend.toLocaleString('en-IN')}`
    );
  }

  // 5. PPO requirement constraint
  if (student.wantsPpo && !opening.ppoAvailable) {
    reasons.push('Student requires PPO-eligible track');
  }

  return {
    passed: reasons.length === 0,
    reasons,
    overlapDays,
    endDate,
  };
}

export function scoreStudentDeterministically(
  student: StudentProfile,
  opening: OpeningRequirement,
  overlapDays: number
): { matchedSkills: string[]; matchScore: number; whyShortlisted: string } {
  const stuSkillsLower = student.skills.map((s) => s.trim().toLowerCase());
  const summaryLower = student.projectsSummary.toLowerCase();

  const matchedSkills: string[] = [];
  for (const reqSkill of opening.requiredSkills) {
    const key = reqSkill.trim().toLowerCase();
    if (!key) continue;
    const hit =
      stuSkillsLower.some((s) => s.includes(key) || key.includes(s)) ||
      summaryLower.includes(key);
    if (hit) matchedSkills.push(reqSkill);
  }

  const ratio =
    opening.requiredSkills.length === 0
      ? 1
      : matchedSkills.length / opening.requiredSkills.length;

  const cgpaBonus = Math.min(10, Math.max(0, (student.cgpa - 7.0) * 4));
  const ppoBonus = opening.ppoAvailable && student.wantsPpo ? 6 : 2;
  const durationFit = Math.min(8, Math.round((overlapDays / (opening.durationWeeks * 7)) * 8));

  const matchScore = Math.max(
    45,
    Math.min(99, Math.round(48 + ratio * 34 + cgpaBonus + ppoBonus + durationFit))
  );

  const skillList =
    matchedSkills.length > 0
      ? matchedSkills.slice(0, 3).join(', ')
      : student.skills.slice(0, 2).join(', ');
  const campusDisplay = opening.blindMode
    ? 'verified UP campus'
    : student.universityName;

  const whyShortlisted = `Available for the full ${opening.durationWeeks}-week corridor from ${opening.startDate} (${campusDisplay}); verified ${skillList} experience demonstrated in ${student.projectsSummary.split('.')[0]}.`;

  return { matchedSkills, matchScore, whyShortlisted };
}

export function rankStudentsForOpening(
  students: StudentProfile[],
  opening: OpeningRequirement,
  universities: UPUniversity[],
  aiScoresByStudentId: Record<string, { score: number; whyShortlisted: string }> = {}
): MatchResult[] {
  const uniMap = new Map(universities.map((u) => [u.id, u]));

  const results: MatchResult[] = students.map((student) => {
    const university = uniMap.get(student.universityId) ?? universities[0];
    const stage1 = evaluateStageOneConstraints(student, opening);
    const det = scoreStudentDeterministically(student, opening, stage1.overlapDays);
    const aiOverride = aiScoresByStudentId[student.id];

    return {
      student,
      university,
      hardFilterPassed: stage1.passed,
      disqualificationReasons: stage1.reasons,
      overlapDays: stage1.overlapDays,
      effectiveEndDate: stage1.endDate,
      matchedSkills: det.matchedSkills,
      matchScore: aiOverride ? aiOverride.score : det.matchScore,
      whyShortlisted: aiOverride ? aiOverride.whyShortlisted : det.whyShortlisted,
      aiRanked: Boolean(aiOverride),
    };
  });

  return results.sort((a, b) => {
    if (a.hardFilterPassed !== b.hardFilterPassed) {
      return a.hardFilterPassed ? -1 : 1;
    }
    return b.matchScore - a.matchScore;
  });
}

export function getBlindSafeUniversityLabel(
  student: StudentProfile,
  blindMode: boolean
): string {
  return blindMode ? 'University Hidden — Blind Mode' : student.universityName;
}

export function computeSkillDistribution(
  matches: MatchResult[],
  requiredSkills: string[]
): SkillDistributionDatum[] {
  const cleaned = requiredSkills.map((s) => s.trim()).filter(Boolean);
  return cleaned.map((skill) => {
    const key = skill.toLowerCase();
    let shortlisted = 0;
    let blocked = 0;

    for (const match of matches) {
      const stuSkillsLower = match.student.skills.map((s) => s.trim().toLowerCase());
      const summaryLower = match.student.projectsSummary.toLowerCase();
      const hasSkill =
        stuSkillsLower.some((s) => s.includes(key) || key.includes(s)) ||
        summaryLower.includes(key);

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
