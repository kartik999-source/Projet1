import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNepCredits,
  computeCalendarOverlap,
  computeSkillDistribution,
  cosineSimilarity,
  evaluateHardConstraints,
  getDisplayCandidateIdentity,
  rankCandidates,
} from './matchmaker';
import { DEFAULT_REQUIREMENT, INITIAL_STUDENTS, UP_UNIVERSITIES } from '../data/upSeedData';

test('calculateNepCredits maps weeks to NEP-2020 academic credits', () => {
  assert.equal(calculateNepCredits(2), 2); // 70 hrs / 40 = 1.75 -> 2 credits
  assert.equal(calculateNepCredits(8), 7); // 280 hrs / 40 = 7 credits
  assert.equal(calculateNepCredits(12), 11); // 420 hrs / 40 = 10.5 -> 11 credits
  assert.equal(calculateNepCredits(0), 0);
});

test('cosineSimilarity computes exact dot-product normalization', () => {
  assert.equal(Math.round(cosineSimilarity([1, 0, 0], [1, 0, 0]) * 100), 100);
  assert.equal(Math.round(cosineSimilarity([1, 0], [0, 1]) * 100), 0);
  assert.equal(cosineSimilarity([], [1, 2]), 0);
});

test('computeCalendarOverlap detects HBTU Kanpur exam conflict for early May start', () => {
  const hbtu = UP_UNIVERSITIES.find((u) => u.id === 'hbtu-kanpur')!;
  const priya = INITIAL_STUDENTS.find((s) => s.id === 'stu-priya')!;
  const overlap = computeCalendarOverlap(
    priya.availabilityStart, // 2027-05-29
    priya.availabilityEnd,   // 2027-08-12
    '2027-05-15',
    '2027-08-15',
    90,
    hbtu
  );
  assert.equal(overlap.sufficientForDuration, false);
  assert.ok(overlap.examConflictDays > 0);
  assert.ok(overlap.examConflictNote?.includes('HBTU Kanpur'));
});

test('evaluateHardConstraints filters out unverified students when requireTnPVerified is true', () => {
  const kabir = INITIAL_STUDENTS.find((s) => s.id === 'stu-kabir')!;
  const uni = UP_UNIVERSITIES.find((u) => u.id === kabir.universityId)!;
  const check = evaluateHardConstraints(kabir, { ...DEFAULT_REQUIREMENT, requireTnPVerified: true }, uni);
  assert.equal(check.passed, false);
  assert.ok(check.reasons.some((r) => r.includes('Pending T&P verification')));

  const checkRelaxed = evaluateHardConstraints(
    kabir,
    { ...DEFAULT_REQUIREMENT, requireTnPVerified: false, stipendMonthly: 12000 },
    uni
  );
  assert.equal(checkRelaxed.passed, true);
});

test('rankCandidates dynamically updates shortlist when stipend slider changes', () => {
  const lowStipendReq = { ...DEFAULT_REQUIREMENT, stipendMonthly: 7000 };
  const lowRanked = rankCandidates(INITIAL_STUDENTS, lowStipendReq, UP_UNIVERSITIES);
  const passedLow = lowRanked.filter((r) => r.hardFilterPassed);
  assert.equal(passedLow.length, 0); // Aarav needs 8k, Ananya/Rohan need 10k

  const fairStipendReq = { ...DEFAULT_REQUIREMENT, stipendMonthly: 12000 };
  const fairRanked = rankCandidates(INITIAL_STUDENTS, fairStipendReq, UP_UNIVERSITIES);
  const passedFair = fairRanked.filter((r) => r.hardFilterPassed);
  assert.ok(passedFair.length >= 3);
  assert.equal(passedFair[0].student.id, 'stu-aarav');
});

test('getDisplayCandidateIdentity redacts name and college when blindMode is active', () => {
  const aarav = INITIAL_STUDENTS[0];
  const visible = getDisplayCandidateIdentity(aarav, false);
  assert.equal(visible.displayName, 'Aarav Srivastava');
  assert.equal(visible.isRedacted, false);

  const blind = getDisplayCandidateIdentity(aarav, true);
  assert.equal(blind.displayName, 'Candidate UP-Y2-104');
  assert.equal(blind.isRedacted, true);
  assert.ok(!blind.institutionLine.includes('IET Lucknow'));
});

test('computeSkillDistribution aggregates shortlisted vs constraint-blocked candidates per required skill', () => {
  const ranked = rankCandidates(INITIAL_STUDENTS, DEFAULT_REQUIREMENT, UP_UNIVERSITIES);
  const dist = computeSkillDistribution(ranked, DEFAULT_REQUIREMENT.requiredSkills);

  assert.equal(dist.length, DEFAULT_REQUIREMENT.requiredSkills.length);
  const pythonDatum = dist.find((d) => d.skill === 'Python')!;
  // Aarav, Rohan, Ananya pass Stage 1 and have Python (3 shortlisted); Priya & Kabir are blocked by exam/T&P (2 blocked)
  assert.equal(pythonDatum.shortlisted, 3);
  assert.equal(pythonDatum.blocked, 2);
  assert.equal(pythonDatum.total, 5);

  const emptyDist = computeSkillDistribution(ranked, []);
  assert.deepEqual(emptyDist, []);
});

