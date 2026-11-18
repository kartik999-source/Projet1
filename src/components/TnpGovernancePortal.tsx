import React, { useState } from 'react';
import { CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import { InvitationRecord, StudentProfile, UPUniversity } from '../types/domain';

interface TnpGovernancePortalProps {
  students: StudentProfile[];
  universities: UPUniversity[];
  invitations: InvitationRecord[];
  onToggleStudentVerification: (studentId: string) => void;
  onBulkVerifyAll: () => void;
  onIssueAndPreviewNoc: (invitationId: string) => void;
}

export const TnpGovernancePortal: React.FC<TnpGovernancePortalProps> = ({
  students,
  universities,
  invitations,
  onToggleStudentVerification,
  onBulkVerifyAll,
  onIssueAndPreviewNoc,
}) => {
  const [selectedUniId, setSelectedUniId] = useState<string>('all');

  const filteredStudents =
    selectedUniId === 'all'
      ? students
      : students.filter((s) => s.universityId === selectedUniId);

  const pendingCount = students.filter((s) => !s.verifiedByTnP).length;
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const uniMap = new Map(universities.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-blue-700">
            Training &amp; Placement Cell · HOD Governance Console
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Bulk Academic Verification &amp; NEP-2020 NOC Ledger
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Verify Year 2+ student academic standing once across UP universities to unlock
            instant recruiter trust and issue one-click NOCs mapped to NEP-2020 credits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by UP university"
            value={selectedUniId}
            onChange={(e) => setSelectedUniId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All UP Campuses ({universities.length})</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.shortName} ({u.city})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onBulkVerifyAll}
            disabled={pendingCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {pendingCount > 0
              ? `Bulk Verify Pending (${pendingCount})`
              : 'All Students Verified'}
          </button>
        </div>
      </div>

      {/* Campus Enrollment & Standing Roster */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. UP Student Academic Standing Roster
          </h2>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {filteredStudents.filter((s) => s.verifiedByTnP).length} /{' '}
            {filteredStudents.length} verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Student &amp; Roll No</th>
                <th className="px-4 py-3">University</th>
                <th className="px-4 py-3">Year / Branch</th>
                <th className="px-4 py-3 text-right">CGPA</th>
                <th className="px-4 py-3">Free Window</th>
                <th className="px-4 py-3">Standing</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((stu) => {
                const uni = uniMap.get(stu.universityId);
                return (
                  <tr key={stu.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{stu.name}</div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {stu.rollNumber} · {stu.blindCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {uni?.shortName ?? stu.universityName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      Year {stu.yearOfStudy} · {stu.branch}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                      {stu.cgpa.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600">
                      {stu.availabilityStart.slice(5)} → {stu.availabilityEnd.slice(5)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          stu.verifiedByTnP ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {stu.verifiedByTnP ? 'Verified' : 'Pending Review'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleStudentVerification(stu.id)}
                        className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          stu.verifiedByTnP
                            ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            : 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'
                        }`}
                      >
                        {stu.verifiedByTnP ? 'Revoke' : 'Verify Student'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* One-Click NOC & NEP-2020 Credit Alignment Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              02. One-Click NOC &amp; NEP-2020 Credit Alignment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Maps internship hours (35 hrs/week) to UGC/NEP-2020 academic credits (40
              notional hours = 1 credit).
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {invitations.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-4 py-3">Company &amp; Role</th>
                <th className="px-4 py-3">Corridor</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">NEP-2020 Credits</th>
                <th className="px-4 py-3">NOC Status</th>
                <th className="px-5 py-3 text-right">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv) => {
                const stu = studentMap.get(inv.studentId);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">
                        {stu?.name ?? inv.studentId}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stu?.universityName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{inv.companyName}</div>
                      <div className="text-xs text-slate-500">{inv.roleTitle}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600">
                      {inv.startDate.slice(5)} → {inv.endDate.slice(5)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                      {inv.durationWeeks} wks ({inv.durationWeeks * 35}h)
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-blue-700">
                      {inv.nepCredits} Cr
                    </td>
                    <td className="px-4 py-3">
                      {inv.status === 'noc_issued' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 font-mono">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {inv.nocReferenceId}
                        </span>
                      ) : inv.status === 'accepted' ? (
                        <span className="text-xs font-medium text-blue-700">
                          Ready to Issue
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Awaiting Student</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onIssueAndPreviewNoc(inv.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <FileCheck2 className="h-3.5 w-3.5 text-blue-700" />
                        {inv.status === 'noc_issued' ? 'Preview NOC' : 'Issue NOC'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
