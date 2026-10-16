import { useState } from 'react'
import { api, type AuthUser, type PayrollAdjustment } from '../lib/api'

type Props = {
  adjustments: PayrollAdjustment[]
  currentUser: AuthUser
  onChanged: () => void
  onNotify: (message: string) => void
}

export function PayrollReviewPanel({ adjustments, currentUser, onChanged, onNotify }: Props) {
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const review = async (adjustment: PayrollAdjustment, status: 'approved' | 'rejected') => {
    const reviewReason = status === 'rejected' ? window.prompt('Reason for rejecting this salary adjustment')?.trim() : undefined
    if (status === 'rejected' && !reviewReason) return
    setReviewingId(adjustment._id)
    try {
      await api.reviewPayroll(adjustment._id, { status, reviewedBy: currentUser.id, reviewReason })
      onNotify(status === 'approved' ? 'Salary deduction approved' : 'Salary adjustment rejected')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to review salary adjustment')
    } finally {
      setReviewingId(null)
    }
  }

  return <section className="workflow-grid workflow-grid-single"><article className="surface workflow-list"><div className="section-heading"><div><h2>Automatic salary adjustments</h2><p>Natural or technical causes add pay; implementation errors subtract pay. Deductions for time above a saved AI estimate remain pending until manager approval.</p></div></div>{adjustments.length ? adjustments.map((adjustment) => {
    const baseSalary = adjustment.baseSalary ?? 50000
    const nextMonthSalary = adjustment.nextMonthSalary ?? baseSalary
    const adjustmentType = adjustment.adjustmentType ?? 'none'
    return <div className="workflow-row" key={adjustment._id}>
      <div>
        <strong>{adjustment.employeeName ?? 'Employee'} · {adjustmentType === 'debit' ? '-' : adjustmentType === 'credit' ? '+' : ''}{adjustment.currency} {adjustment.proposedAmount.toFixed(2)} · {adjustment.status === 'pending_review' ? 'proposed' : 'next month'} {adjustment.currency} {nextMonthSalary.toFixed(2)}</strong>
        <small>Base {adjustment.currency} {baseSalary.toFixed(2)} · {adjustment.eligibleCorrectiveHours.toFixed(2)}h · {new Date(adjustment.periodStart).toLocaleDateString()} – {new Date(adjustment.periodEnd).toLocaleDateString()} · {adjustment.status}</small>
        {(adjustment.overrunPenalty ?? 0) > 0 && <small>Overrun deduction: {adjustment.currency} {(adjustment.overrunPenalty ?? 0).toFixed(2)} for {(adjustment.overrunHours ?? 0).toFixed(2)}h above the AI estimate</small>}
        {adjustment.status === 'pending_review' && <div className="workflow-actions">
          <button className="icon-button workflow-approve" disabled={reviewingId === adjustment._id} onClick={() => void review(adjustment, 'approved')}>{reviewingId === adjustment._id ? 'Reviewing…' : 'Approve deduction'}</button>
          <button className="icon-button workflow-reject" disabled={reviewingId === adjustment._id} onClick={() => void review(adjustment, 'rejected')}>Reject</button>
        </div>}
      </div>
      <span className={`status ${adjustmentType === 'debit' ? 'status-danger' : adjustmentType === 'credit' ? 'status-success' : 'status-warning'}`}><i />{adjustmentType}</span>
    </div>
  }) : <div className="empty-data">No automatic salary adjustments yet. They appear after a manager approves corrective work.</div>}</article></section>
}
