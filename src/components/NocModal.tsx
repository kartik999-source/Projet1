import React from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { NocRecord, StudentProfile, UPUniversity } from '../types/domain';

interface NocModalProps {
  noc: NocRecord | null;
  student: StudentProfile | null;
  university: UPUniversity | null;
  onApproveNoc?: (nocId: string) => void;
  onClose: () => void;
}

export const NocModal: React.FC<NocModalProps> = ({
  noc,
  student,
  university,
  onApproveNoc,
  onClose,
}) => {
  if (!noc || !student || !university) return null;

  const totalHours = noc.durationWeeks * 35;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="noc-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl border border-[#27272A] bg-[#121216] p-6 sm:p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#27272A] pb-4 no-print">
          <div>
            <p className="text-xs font-medium text-[#FB923C]">
              NEP-2020 &amp; University T&amp;P Cell Governance
            </p>
            <h2
              id="noc-modal-title"
              className="font-display text-xl font-semibold text-[#FAFAFA] mt-0.5"
            >
              University No-Objection Certificate (NOC)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close NOC preview"
            className="rounded-lg p-2 text-[#A1A1AA] hover:bg-[#1C1C22] hover:text-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Formal Document Sheet */}
        <div className="mt-5 rounded-lg bg-white p-6 text-slate-900 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                {university.name}
              </h3>
              <p className="text-xs text-slate-600">
                Office of Training &amp; Placement · {university.city}, Uttar Pradesh ({university.affiliation})
              </p>
            </div>
            <div className="text-right font-mono text-xs text-slate-600 tabular-nums">
              <div>Ref: {noc.referenceId}</div>
              <div>Date: {noc.createdAt}</div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-700">
            This certifies that <strong>{student.name}</strong> (Roll No.{' '}
            <span className="font-mono">{student.rollNumber}</span>), enrolled in{' '}
            <strong>
              Year {student.year} · {student.branch}
            </strong>{' '}
            (CGPA <span className="font-mono tabular-nums">{student.cgpa.toFixed(1)}</span>), is
            in verified academic standing and is granted No-Objection to pursue the following
            internship under NEP-2020 academic credit alignment.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs sm:text-sm">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <th className="bg-slate-50 px-4 py-2 font-medium text-slate-600 w-44">
                    Host Organization
                  </th>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {noc.companyName}
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2 font-medium text-slate-600">
                    Role &amp; PPO Terms
                  </th>
                  <td className="px-4 py-2 text-slate-900">
                    {noc.roleTitle} ·{' '}
                    {noc.ppoEligible ? 'PPO Eligible Track' : 'Fixed-Term Internship'}
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2 font-medium text-slate-600">
                    Approved Tenure
                  </th>
                  <td className="px-4 py-2 font-mono text-slate-900 tabular-nums">
                    {noc.startDate} to {noc.endDate} ({noc.durationWeeks} weeks)
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2 font-medium text-slate-600">
                    NEP-2020 Credit Map
                  </th>
                  <td className="px-4 py-2 font-mono text-slate-900 tabular-nums">
                    {noc.nepCredits} Academic Credits ({totalHours} notional hrs @ 40 hrs/credit)
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2 font-medium text-slate-600">
                    Monthly Stipend
                  </th>
                  <td className="px-4 py-2 font-mono text-slate-900 tabular-nums">
                    ₹{noc.stipendMonthly.toLocaleString('en-IN')} / month
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
            <div className="text-xs font-medium text-slate-600">
              Status:{' '}
              <span
                className={
                  noc.status === 'approved' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'
                }
              >
                {noc.status === 'approved'
                  ? 'Approved by T&P Officer'
                  : 'Generated — Pending T&P Sign-Off'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">
                {university.tnpOfficerName}
              </div>
              <div className="text-xs text-slate-500">
                Training &amp; Placement Officer · {university.tnpOfficerEmail}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 no-print">
          {noc.status !== 'approved' && onApproveNoc && (
            <button
              type="button"
              onClick={() => onApproveNoc(noc.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/15 px-4 py-2 text-xs sm:text-sm font-semibold text-[#22C55E] hover:bg-[#22C55E]/25 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve NOC (T&amp;P)
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#27272A] bg-[#1C1C22] px-4 py-2 text-xs sm:text-sm font-medium text-[#FAFAFA] hover:bg-[#27272A] whitespace-nowrap shrink-0"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-xs sm:text-sm font-bold text-[#09090B] hover:bg-[#FB923C] whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
