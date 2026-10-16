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
  const pendingAdjustments = adjustments.filter((adjustment) => adjustment.status === 'pending_review')
  const deductionAdjustments = adjustments.filter((adjustment) => adjustment.status === 'approved' && adjustment.adjustmentType === 'debit')
  const totalsByCurrency = (items: PayrollAdjustment[]) => items.reduce((totals, adjustment) => {
    totals.set(adjustment.currency, (totals.get(adjustment.currency) ?? 0) + adjustment.proposedAmount)
    return totals
  }, new Map<string, number>())
  const pendingTotals = totalsByCurrency(pendingAdjustments)
  const deductionTotals = totalsByCurrency(deductionAdjustments)
  const pendingCount = pendingAdjustments.length

  const review = async (adjustment: PayrollAdjustment, status: 'approved' | 'rejected') => {
    const reviewReason = window.prompt(`Reason for ${status === 'approved' ? 'approving' : 'rejecting'} this salary adjustment`)?.trim()
    if (!reviewReason) return
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

  return <section className="workflow-grid workflow-grid-single"><article className="surface workflow-list payroll-review-panel"><div className="section-heading"><div><h2>Automatic salary adjustments</h2><p>Proposals are reviewed before payroll. Approved code-defect deductions are shown separately from other cause credits.</p></div></div><div className="payroll-summary-grid"><div className="payroll-summary-card"><span>Pending proposals</span>{pendingTotals.size ? Array.from(pendingTotals, ([currency, amount]) => <strong key={currency}>{currency} {amount.toFixed(2)}</strong>) : <strong>None</strong>}<small>{pendingCount} awaiting review</small></div><div className="payroll-summary-card"><span>Approved deductions</span>{deductionTotals.size ? Array.from(deductionTotals, ([currency, amount]) => <strong key={currency}>{currency} {amount.toFixed(2)}</strong>) : <strong>None</strong>}<small>For payroll-period adjustments</small></div></div>{adjustments.length ? <div className="payroll-adjustment-list">{adjustments.map((adjustment) => {
    const baseSalary = adjustment.baseSalary ?? 50000
    const nextMonthSalary = adjustment.nextMonthSalary ?? baseSalary
    const adjustmentType = adjustment.adjustmentType ?? 'none'
    return <article className="payroll-adjustment-card" key={adjustment._id}>
      <div className="payroll-adjustment-header">
        <div className="payroll-adjustment-copy">
          <strong>{adjustment.employeeName ?? 'Employee'}</strong>
          <span className="payroll-adjustment-amount">{adjustmentType === 'debit' ? '-' : adjustmentType === 'credit' ? '+' : ''}{adjustment.currency} {adjustment.proposedAmount.toFixed(2)}</span>
        </div>
        <span className={`status ${adjustmentType === 'debit' ? 'status-danger' : adjustmentType === 'credit' ? 'status-success' : 'status-warning'}`}><i />{adjustment.status.replaceAll('_', ' ')}</span>
      </div>
      <div className="payroll-adjustment-meta">
        <span><b>Projected salary</b>{adjustment.currency} {nextMonthSalary.toFixed(2)}</span>
        <span><b>Base salary</b>{adjustment.currency} {baseSalary.toFixed(2)}</span>
        <span><b>Corrective time</b>{adjustment.eligibleCorrectiveHours.toFixed(2)}h</span>
        <span><b>Period</b>{new Date(adjustment.periodStart).toLocaleDateString()} – {new Date(adjustment.periodEnd).toLocaleDateString()}</span>
      </div>
      {(adjustment.overrunPenalty ?? 0) > 0 && <p className="payroll-adjustment-note">Overrun proposal: {adjustment.currency} {(adjustment.overrunPenalty ?? 0).toFixed(2)} for {(adjustment.overrunHours ?? 0).toFixed(2)}h above the AI estimate.</p>}
      {adjustment.calculationBreakdown.length > 0 && <div className="payroll-breakdown"><h3>Calculation details</h3>{adjustment.calculationBreakdown.map((line) => <div className="payroll-breakdown-line" key={line.timeEntryId}><div><strong>{line.taskTitle ?? `Task ${line.taskId.slice(-8)}`}</strong><span>{line.module ?? line.defectTitle ?? `Defect ${line.defectId.slice(-8)}`} · {line.cause?.replaceAll('_', ' ') ?? 'corrective work'}</span></div><span className="payroll-line-total">{line.hours.toFixed(2)}h × {adjustment.currency} {line.hourlyRate.toFixed(2)} = <strong>{adjustment.currency} {line.amount.toFixed(2)}</strong></span></div>)}</div>}
      {adjustment.reviewReason && <p className="payroll-adjustment-note">Review note: {adjustment.reviewReason}</p>}
        {adjustment.status === 'pending_review' && <div className="workflow-actions">
          <button className="icon-button workflow-approve" disabled={reviewingId === adjustment._id} onClick={() => void review(adjustment, 'approved')}>{reviewingId === adjustment._id ? 'Reviewing…' : 'Approve adjustment'}</button>
          <button className="icon-button workflow-reject" disabled={reviewingId === adjustment._id} onClick={() => void review(adjustment, 'rejected')}>Reject</button>
        </div>}
    </article>
  })}</div> : <div className="empty-data">No automatic salary adjustments yet. They appear after a manager approves corrective work.</div>}</article></section>
}
