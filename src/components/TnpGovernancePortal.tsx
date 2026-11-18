import React, { useState } from 'react';
import { CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';
import { NocRecord, StudentProfile, UPUniversity } from '../types/domain';
import { calculateNepCredits } from '../engine/matchmaker';

interface TnpGovernancePortalProps {
  students: StudentProfile[];
  universities: UPUniversity[];
  nocs: NocRecord[];
  openingDurationWeeks: number;
  onToggleVerification: (studentId: string) => void;
  onBulkVerifyAll: () => void;
  onApproveNoc: (nocId: string) => void;
  onPreviewNoc: (nocId: string) => void;
}

export const TnpGovernancePortal: React.FC<TnpGovernancePortalProps> = ({
  students,
  universities,
  nocs,
  openingDurationWeeks,
  onToggleVerification,
  onBulkVerifyAll,
  onApproveNoc,
  onPreviewNoc,
}) => {
  const [selectedUniId, setSelectedUniId] = useState<string>('all');

  const filteredStudents =
    selectedUniId === 'all'
      ? students
      : students.filter((s) => s.universityId === selectedUniId);

  const pendingVerificationCount = students.filter((s) => !s.verifiedByTnP).length;
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const nepCreditsPreview = calculateNepCredits(openingDurationWeeks);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[#27272A] pb-5">
        <div>
          <p className="text-xs font-medium text-[#FB923C]">
            View C · University T&amp;P Cell Portal
          </p>
          <h1 className="font-display text-2xl font-bold text-[#FAFAFA] mt-1">
            UP Campus Verification, NEP-2020 Credits &amp; NOC Approvals
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Verify student enrollment across MJPRU Bareilly, IET Lucknow, MMMUT
            Gorakhpur, HBTU Kanpur, KNIT Sultanpur, GLA Mathura, and AKTU, and approve
            university NOCs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by UP university"
            value={selectedUniId}
            onChange={(e) => setSelectedUniId(e.target.value)}
            className="rounded-lg border border-[#27272A] bg-[#1C1C22] px-3 py-2 text-xs font-medium text-[#FAFAFA] focus:border-[#F97316] focus:outline-none"
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
            disabled={pendingVerificationCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F97316] px-4 py-2 text-xs font-bold text-[#09090B] transition-colors hover:bg-[#FB923C] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {pendingVerificationCount > 0
              ? `Verify All Pending (${pendingVerificationCount})`
              : 'All Students Verified'}
          </button>
        </div>
      </div>

      {/* Table 1: Student Verification & NEP-2020 Credit Eligibility */}
      <section className="rounded-xl border border-[#27272A] bg-[#121216] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A]">
          <h2 className="font-display text-base font-semibold text-[#FAFAFA]">
            01. Student Verification &amp; NEP-2020 Credit Eligibility
          </h2>
          <span className="font-mono text-xs text-[#A1A1AA] tabular-nums">
            {filteredStudents.filter((s) => s.verifiedByTnP).length} /{' '}
            {filteredStudents.length} verified
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#1C1C22] text-xs font-medium text-[#A1A1AA] border-b border-[#27272A]">
              <tr>
                <th className="px-5 py-3">Student &amp; Roll No</th>
                <th className="px-4 py-3">UP University</th>
                <th className="px-4 py-3">Year / Branch</th>
                <th className="px-4 py-3 text-right">CGPA</th>
                <th className="px-4 py-3">NEP-2020 Eligibility</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]">
              {filteredStudents.map((stu) => {
                const nepEligible = stu.year >= 2 && stu.cgpa >= 6.0;
                return (
                  <tr key={stu.id} className="hover:bg-[#1C1C22]/70 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#FAFAFA]">{stu.name}</div>
                      <div className="font-mono text-[11px] text-[#71717A] tabular-nums">
                        {stu.rollNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#FAFAFA]">{stu.universityName}</td>
                    <td className="px-4 py-3 text-[#A1A1AA]">
                      Year {stu.year} · {stu.branch}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#FAFAFA]">
                      {stu.cgpa.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {nepEligible ? (
                        <span className="text-[#FB923C]">
                          Eligible · {nepCreditsPreview} Cr ({openingDurationWeeks}w)
                        </span>
                      ) : (
                        <span className="text-[#71717A]">Not Eligible</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stu.verifiedByTnP ? (
                        <span className="inline-flex items-center gap-1 rounded bg-[#22C55E]/15 px-2 py-0.5 text-xs font-semibold text-[#22C55E]">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-[#F97316]/15 px-2 py-0.5 text-xs font-semibold text-[#FB923C]">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleVerification(stu.id)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          stu.verifiedByTnP
                            ? 'border border-[#27272A] bg-[#1C1C22] text-[#A1A1AA] hover:text-[#FAFAFA]'
                            : 'bg-[#F97316] text-[#09090B] hover:bg-[#FB923C]'
                        }`}
                      >
                        {stu.verifiedByTnP ? 'Revoke' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Table 2: Generated NOC Approval Ledger */}
      <section className="rounded-xl border border-[#27272A] bg-[#121216] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A]">
          <h2 className="font-display text-base font-semibold text-[#FAFAFA]">
            02. Student NOC Approval Ledger
          </h2>
          <span className="font-mono text-xs text-[#A1A1AA] tabular-nums">
            {nocs.length} NOCs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#1C1C22] text-xs font-medium text-[#A1A1AA] border-b border-[#27272A]">
              <tr>
                <th className="px-5 py-3">NOC Reference</th>
                <th className="px-4 py-3">Student &amp; Campus</th>
                <th className="px-4 py-3">Company &amp; Role</th>
                <th className="px-4 py-3 text-right">NEP Credits</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]">
              {nocs.map((noc) => {
                const stu = studentMap.get(noc.studentId);
                return (
                  <tr key={noc.id} className="hover:bg-[#1C1C22]/70 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-[#FAFAFA] tabular-nums">
                      {noc.referenceId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#FAFAFA]">
                        {stu?.name ?? noc.studentId}
                      </div>
                      <div className="text-xs text-[#A1A1AA]">
                        {stu?.universityName}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#FAFAFA]">{noc.companyName}</div>
                      <div className="text-xs text-[#A1A1AA]">{noc.roleTitle}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#FB923C] tabular-nums">
                      {noc.nepCredits} Cr ({noc.durationWeeks}w)
                    </td>
                    <td className="px-4 py-3">
                      {noc.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#22C55E]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#FB923C]">
                          Pending T&amp;P Sign-Off
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {noc.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => onApproveNoc(noc.id)}
                            className="rounded-md bg-[#F97316] px-3 py-1 text-xs font-bold text-[#09090B] hover:bg-[#FB923C] whitespace-nowrap shrink-0"
                          >
                            Approve NOC
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPreviewNoc(noc.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#27272A] bg-[#1C1C22] px-3 py-1 text-xs font-medium text-[#FAFAFA] hover:border-[#F97316]/50 whitespace-nowrap shrink-0"
                        >
                          <FileCheck2 className="h-3.5 w-3.5 text-[#FB923C]" />
                          Preview
                        </button>
                      </div>
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
