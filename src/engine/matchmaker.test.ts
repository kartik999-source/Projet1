import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addWeeksIso,
  calculateNepCredits,
  computeSkillDistribution,
  evaluateStageOneConstraints,
  getBlindSafeUniversityLabel,
  rankStudentsForOpening,
} from './matchmaker';
import { DEFAULT_OPENING, INITIAL_STUDENTS, UP_UNIVERSITIES } from '../data/upSeedData';

test('calculateNepCredits maps weeks to NEP-2020 credits', () => {
  assert.equal(calculateNepCredits(4), 4);
  assert.equal(calculateNepCredits(8), 7);
  assert.equal(calculateNepCredits(12), 11);
  assert.equal(calculateNepCredits(0), 0);
});

test('addWeeksIso computes exact end date for 8-week sprint', () => {
  assert.equal(addWeeksIso('2027-05-15', 8), '2027-07-10');
});

test('evaluateStageOneConstraints enforces T&P verified, availability, stipend, and PPO constraints', () => {
  const kabir = INITIAL_STUDENTS.find((s) => s.id === 'stu-kabir')!;
  const unverifiedCheck = evaluateStageOneConstraints(kabir, DEFAULT_OPENING);
  assert.equal(unverifiedCheck.passed, false);
  assert.ok(unverifiedCheck.reasons[0].includes('Pending T&P Cell verification'));

  // HBTU Priya is free May 26 -> fails May 15 start date
  const priya = INITIAL_STUDENTS.find((s) => s.id === 'stu-priya')!;
  const dateCheck = evaluateStageOneConstraints(priya, DEFAULT_OPENING);
  assert.equal(dateCheck.passed, false);
  assert.ok(dateCheck.reasons[0].includes('Availability'));

  // Aarav wants PPO -> fails when ppoAvailable is false
  const aarav = INITIAL_STUDENTS.find((s) => s.id === 'stu-aarav')!;
  const ppoCheck = evaluateStageOneConstraints(aarav, {
    ...DEFAULT_OPENING,
    ppoAvailable: false,
  });
  assert.equal(ppoCheck.passed, false);
  assert.ok(ppoCheck.reasons.some((r) => r.includes('PPO')));
});

test('rankStudentsForOpening updates shortlist dynamically with stipend slider', () => {
  const lowStipend = rankStudentsForOpening(
    INITIAL_STUDENTS,
    { ...DEFAULT_OPENING, stipendMonthly: 4000 },
    UP_UNIVERSITIES
  );
  assert.equal(lowStipend.filter((m) => m.hardFilterPassed).length, 0);

  const fairStipend = rankStudentsForOpening(
    INITIAL_STUDENTS,
    { ...DEFAULT_OPENING, stipendMonthly: 10000 },
    UP_UNIVERSITIES
  );
  // Aarav (8k), Diya (6k), Rohan (10k), Ananya (5k) pass! Priya (May 26) & Kabir (Unverified) blocked.
  assert.equal(fairStipend.filter((m) => m.hardFilterPassed).length, 4);
});

test('getBlindSafeUniversityLabel returns University Hidden — Blind Mode when ON', () => {
  const aarav = INITIAL_STUDENTS[0];
  assert.equal(getBlindSafeUniversityLabel(aarav, false), 'IET Lucknow');
  assert.equal(
    getBlindSafeUniversityLabel(aarav, true),
    'University Hidden — Blind Mode'
  );
});

test('computeSkillDistribution counts shortlisted vs blocked students per required skill', () => {
  const ranked = rankStudentsForOpening(
    INITIAL_STUDENTS,
    DEFAULT_OPENING,
    UP_UNIVERSITIES
  );
  const dist = computeSkillDistribution(ranked, DEFAULT_OPENING.requiredSkills);
  const pythonItem = dist.find((d) => d.skill === 'Python')!;
  assert.equal(pythonItem.shortlisted, 4);
  assert.equal(pythonItem.blocked, 2);
  assert.equal(pythonItem.total, 6);
});
