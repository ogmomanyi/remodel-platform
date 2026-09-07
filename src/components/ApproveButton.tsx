"use client";

import { useState } from 'react';
import { approveProposal } from '@/app/actions';

interface Props {
  projectCode: string;
  initialStatus: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export function ApproveButton({ projectCode, initialStatus, approvedBy, approvedAt }: Props) {
  const [isPending, setIsPending] = useState(false);
  const isApproved = initialStatus === 'approved';

  async function handleApprove() {
    setIsPending(true);
    try {
      await approveProposal(projectCode);
    } catch (error) {
      alert("Failed to approve. Please try again.");
      console.error(error);
    } finally {
      setIsPending(false);
    }
  }

  if (isApproved) {
    return (
      <div className="mt-12 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
        <h3 className="text-lg font-bold text-green-800 flex items-center justify-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Proposal Approved
        </h3>
        <p className="text-sm text-green-700 mt-2">
          Digitally signed by <strong>{approvedBy}</strong> on {new Date(approvedAt!).toLocaleDateString()}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-12 p-8 bg-gray-50 border border-gray-200 rounded-lg text-center shadow-sm">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to proceed?</h3>
      <p className="text-gray-600 mb-6 text-sm max-w-md mx-auto">
        By clicking approve, you authorize our team to procure materials and schedule the subcontractors for your project.
      </p>
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="bg-black text-white px-8 py-3 rounded font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isPending ? 'Processing...' : 'Digitally Approve Proposal'}
      </button>
    </div>
  );
}
