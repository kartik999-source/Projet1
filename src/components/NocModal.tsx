import React from 'react';
import { Printer, X } from 'lucide-react';
import { InvitationRecord, StudentProfile, UPUniversity } from '../types/domain';

interface NocModalProps {
  invitation: InvitationRecord | null;
  student: StudentProfile | null;
  university: UPUniversity | null;
  onClose: () => void;
}

export const NocModal: React.FC<NocModalProps> = ({
  invitation,
  student,
  university,
  onClose,
}) => {
  if (!invitation || !student || !university) return null;

  const totalHours = invitation.durationWeeks * 35;
  const refId =
    invitation.nocReferenceId ||
    `${university.id.toUpperCase().slice(0, 4)}-NOC-2027-${invitation.id.slice(-3)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="noc-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 no-print">
          <div>
            <p className="text-xs font-medium text-slate-500">
              NEP-2020 &amp; T&amp;P Cell Governance Document
            </p>
            <h2
              id="noc-modal-title"
              className="font-display text-xl font-semibold text-slate-900 mt-0.5"
            >
              University No-Objection Certificate
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close NOC preview"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-5 text-sm text-slate-800">
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
              <div>Ref: {refId}</div>
              <div>Date: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>

          <p className="leading-relaxed text-slate-700">
            This is to certify that <strong className="text-slate-900">{student.name}</strong>{' '}
            (Roll No. <span className="font-mono">{student.rollNumber}</span>), currently
            enrolled in <strong className="text-slate-900">Year {student.yearOfStudy} · {student.branch}</strong>{' '}
            (CGPA <span className="font-mono tabular-nums">{student.cgpa.toFixed(1)}</span>), is
            in verified academic standing and has no scheduled university examinations during the
            approved internship tenure below.
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs sm:text-sm">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <th className="bg-slate-50 px-4 py-2.5 font-medium text-slate-600 w-44">
                    Host Organization
                  </th>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {invitation.companyName} ({invitation.mode} · {invitation.city})
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2.5 font-medium text-slate-600">
                    Role &amp; Track
                  </th>
                  <td className="px-4 py-2.5 text-slate-900">
                    {invitation.roleTitle} ·{' '}
                    {invitation.type === '2-week-sprint'
                      ? '2-Week Evaluation Sprint'
                      : 'Full Internship'}
                    {invitation.ppoEligible ? ' · PPO Eligible' : ''}
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2.5 font-medium text-slate-600">
                    Approved Corridor
                  </th>
                  <td className="px-4 py-2.5 font-mono text-slate-900 tabular-nums">
                    {invitation.startDate} to {invitation.endDate} ({invitation.durationWeeks} weeks)
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2.5 font-medium text-slate-600">
                    Exam Blackout Check
                  </th>
                  <td className="px-4 py-2.5 text-emerald-700 font-medium">
                    Cleared — Zero conflict with {university.shortName} End-Sem ({university.examBlackoutStart} to {university.examBlackoutEnd})
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2.5 font-medium text-slate-600">
                    NEP-2020 Credit Map
                  </th>
                  <td className="px-4 py-2.5 font-mono text-slate-900 tabular-nums">
                    {invitation.nepCredits} Academic Credits ({totalHours} notional hrs @ {university.nepCreditHoursPerCredit} hrs/credit)
                  </td>
                </tr>
                <tr>
                  <th className="bg-slate-50 px-4 py-2.5 font-medium text-slate-600">
                    Stipend Terms
                  </th>
                  <td className="px-4 py-2.5 font-mono text-slate-900 tabular-nums">
                    ₹{invitation.stipendMonthly.toLocaleString('en-IN')} / month
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4 pt-3">
            <div className="text-xs text-slate-500">
              Digitally authorized via SetuMatch Campus Governance Ledger.
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

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 no-print">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap shrink-0"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
