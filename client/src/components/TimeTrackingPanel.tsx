import { useState, type FormEvent } from 'react'
import { Clock3, Send } from 'lucide-react'
import { api, type AuthUser, type Defect, type Task, type TimeEntry } from '../lib/api'

type Props = {
  tasks: Task[]
  defects: Defect[]
  entries: TimeEntry[]
  onChanged: () => void
  onNotify: (message: string) => void
  currentUser: AuthUser
}

export function TimeTrackingPanel({ tasks, defects, entries, onChanged, onNotify, currentUser }: Props) {
  const [taskId, setTaskId] = useState('')
  const [defectId, setDefectId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const eligibleTasks = tasks.filter((task) => task.assigneeId === currentUser.id && (task.status === 'reopened' || task.status === 'under_fix'))
  const eligibleDefects = defects.filter((defect) => defect.status === 'approved' && defect.taskId === taskId)
  const canReview = currentUser.role === 'manager' || currentUser.role === 'admin'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await api.createTimeEntry({
        employeeId: currentUser.id,
        taskId,
        defectId,
        date,
        hours: Number(hours),
        description,
        category: 'corrective_work',
      })
      onNotify('Corrective time entry submitted for review')
      setHours('')
      setDescription('')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to submit time entry')
    } finally {
      setSubmitting(false)
    }

  }

  const review = async (entry: TimeEntry, approvalStatus: 'approved' | 'rejected') => {
    const reviewReason = approvalStatus === 'rejected' ? window.prompt('Reason for rejection') || '' : undefined
    if (approvalStatus === 'rejected' && !reviewReason) return
    try {
      await api.reviewTimeEntry(entry._id, { approvalStatus, reviewedBy: currentUser.id, reviewReason })
      onNotify(`Time entry ${approvalStatus}`)
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to review time entry')
    }
  }

  return <section className="workflow-grid">
    <article className="surface workflow-form"><div className="workflow-title"><div className="metric-icon metric-lime"><Clock3 size={16} /></div><div><h2>Log corrective time</h2><p>Only approved defects can receive corrective work.</p></div></div><form onSubmit={submit}>
      <div className="demo-hint"><span>Logging as</span><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div>
      <label>Reopened task<select required value={taskId} onChange={(event) => { setTaskId(event.target.value); setDefectId('') }}><option value="">Select a reopened or under-fix task</option>{eligibleTasks.map((task) => <option key={task._id} value={task._id}>{task.title}</option>)}</select></label>
      <label>Approved defect<select required value={defectId} onChange={(event) => setDefectId(event.target.value)}><option value="">Select a defect</option>{eligibleDefects.map((defect) => <option key={defect._id} value={defect._id}>{defect.title}</option>)}</select></label>
      <div className="form-row"><label>Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Hours<input required type="number" min="0.01" max="24" step="0.01" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="0.00" /></label></div>
      <label>Description<textarea required minLength={1} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the corrective work" /></label>
      <button className="export-button" disabled={submitting} type="submit"><Send size={14} />{submitting ? 'Submitting…' : 'Submit for approval'}</button>
    </form></article>
    <article className="surface workflow-list"><div className="section-heading"><div><h2>Time entries</h2><p>Approval status is always read from the API.</p></div></div>{entries.length ? entries.map((entry) => <div className="workflow-row" key={entry._id}><div><strong>{entry.hours.toFixed(2)}h · {entry.category.replace('_', ' ')}</strong><small>{new Date(entry.date).toLocaleDateString()} · {entry.description || 'No description'}</small></div><span className={`status status-${entry.approvalStatus === 'approved' ? 'success' : entry.approvalStatus === 'rejected' ? 'danger' : 'warning'}`}><i />{entry.approvalStatus}</span>{canReview && entry.approvalStatus === 'pending' && <div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => review(entry, 'approved')}>Approve</button><button className="icon-button workflow-reject" onClick={() => review(entry, 'rejected')}>Reject</button></div>}</div>) : <div className="empty-data">No time entries returned by the API.</div>}</article>
  </section>
}
