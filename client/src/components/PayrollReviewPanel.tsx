import { useState, type FormEvent } from 'react'
import { Calculator, Check, X } from 'lucide-react'
import { api, type AuthUser, type PayrollAdjustment } from '../lib/api'

type Props = {
  adjustments: PayrollAdjustment[]
  onChanged: () => void
  onNotify: (message: string) => void
  currentUser: AuthUser
}

export function PayrollReviewPanel({ adjustments, onChanged, onNotify, currentUser }: Props) {
  const [employeeId, setEmployeeId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [rate, setRate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const calculate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await api.calculatePayroll({ employeeId, periodStart, periodEnd, currency, configuredHourlyRate: Number(rate) })
      onNotify('Proposed payroll adjustment created')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to calculate payroll adjustment')
    } finally {
      setSubmitting(false)
    }
  }

  const review = async (adjustment: PayrollAdjustment, status: 'approved' | 'rejected') => {
    if (!window.confirm(`Confirm ${status} for ${adjustment.currency} ${adjustment.proposedAmount.toFixed(2)}?`)) return
    const reviewReason = status === 'rejected' ? window.prompt('Reason for rejection') || '' : undefined
    try {
      await api.reviewPayroll(adjustment._id, { status, reviewedBy: currentUser.id, reviewReason })
      onNotify(`Payroll adjustment ${status}`)
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to review payroll adjustment')
    }
  }

  return <section className="workflow-grid"><article className="surface workflow-form"><div className="workflow-title"><div className="metric-icon metric-amber"><Calculator size={16} /></div><div><h2>Calculate proposal</h2><p>Server calculates only approved, eligible corrective entries.</p></div></div><form onSubmit={calculate}>
    <label>Employee ID<input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="Employee MongoDB ObjectId" /></label>
    <div className="form-row"><label>Period start<input required type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label><label>Period end<input required type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label></div>
    <div className="form-row"><label>Currency<input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label><label>Hourly rate<input required min="0" step="0.01" type="number" value={rate} onChange={(event) => setRate(event.target.value)} /></label></div>
    <button className="export-button" disabled={submitting} type="submit"><Calculator size={14} />{submitting ? 'Calculating…' : 'Create proposal'}</button>
  </form></article><article className="surface workflow-list"><div className="section-heading"><div><h2>Proposed adjustments</h2><p>No amount is approved until the backend confirms review.</p></div></div>{adjustments.length ? adjustments.map((adjustment) => <div className="workflow-row" key={adjustment._id}><div><strong>{adjustment.currency} {adjustment.proposedAmount.toFixed(2)} · {adjustment.eligibleCorrectiveHours.toFixed(2)}h</strong><small>{new Date(adjustment.periodStart).toLocaleDateString()} – {new Date(adjustment.periodEnd).toLocaleDateString()} · {adjustment.status}</small></div>{adjustment.status === 'pending_review' && <div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => review(adjustment, 'approved')} aria-label="Approve adjustment"><Check size={15} /></button><button className="icon-button workflow-reject" onClick={() => review(adjustment, 'rejected')} aria-label="Reject adjustment"><X size={15} /></button></div>}</div>) : <div className="empty-data">No payroll adjustments returned by the API.</div>}</article></section>
}
