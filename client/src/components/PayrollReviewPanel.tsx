import type { PayrollAdjustment } from '../lib/api'

type Props = {
  adjustments: PayrollAdjustment[]
}

export function PayrollReviewPanel({ adjustments }: Props) {
  return <section className="workflow-grid workflow-grid-single"><article className="surface workflow-list"><div className="section-heading"><div><h2>Automatic salary adjustments</h2><p>Approved corrective time is applied automatically to next month: natural or technical causes add pay, while implementation errors subtract pay. Base salary is 50,000.</p></div></div>{adjustments.length ? adjustments.map((adjustment) => { const baseSalary = adjustment.baseSalary ?? 50000; const nextMonthSalary = adjustment.nextMonthSalary ?? baseSalary; const adjustmentType = adjustment.adjustmentType ?? 'none'; return <div className="workflow-row" key={adjustment._id}><div><strong>{adjustmentType === 'debit' ? '-' : adjustmentType === 'credit' ? '+' : ''}{adjustment.currency} {adjustment.proposedAmount.toFixed(2)} · next month {adjustment.currency} {nextMonthSalary.toFixed(2)}</strong><small>Base {adjustment.currency} {baseSalary.toFixed(2)} · {adjustment.eligibleCorrectiveHours.toFixed(2)}h · {new Date(adjustment.periodStart).toLocaleDateString()} – {new Date(adjustment.periodEnd).toLocaleDateString()} · {adjustment.status}</small></div><span className={`status ${adjustmentType === 'debit' ? 'status-danger' : adjustmentType === 'credit' ? 'status-success' : 'status-warning'}`}><i />{adjustmentType}</span></div> }) : <div className="empty-data">No automatic salary adjustments yet. They appear after a manager approves corrective time.</div>}</article></section>
}
