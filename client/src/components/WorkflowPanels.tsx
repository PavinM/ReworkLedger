import { useEffect, useState, type FormEvent } from 'react'
import { api, type AuditLog, type AuthUser, type Defect, type DirectoryEmployee, type Project, type Task } from '../lib/api'

type Notice = (message: string) => void

export function ProjectsTasksPanel({ projects, tasks, defects, currentUser, onChanged, onNotify, focus = 'projects' }: {
  projects: Project[]
  tasks: Task[]
  defects: Defect[]
  currentUser: AuthUser
  onChanged: () => void
  onNotify: Notice
  focus?: 'projects' | 'tasks'
}) {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectGithub, setProjectGithub] = useState('')
  const [projectDeadline, setProjectDeadline] = useState('')
  const [projectEmployee, setProjectEmployee] = useState('')
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskProject, setTaskProject] = useState(projects[0]?._id ?? '')
  const [taskAssignee, setTaskAssignee] = useState(currentUser.id)
  const [taskAssigneeName, setTaskAssigneeName] = useState(currentUser.name)
  const [progress, setProgress] = useState<Record<string, string>>({})
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({})
  const canManage = currentUser.role === 'manager' || currentUser.role === 'admin'
  const isEmployee = currentUser.role === 'employee'

  useEffect(() => {
    if (!canManage) return
    api.listEmployees().then(setEmployees).catch(() => undefined)
  }, [canManage])

  const createProject = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.createProject({ name: projectName, description: projectDescription, githubUrl: projectGithub || undefined, deadline: projectDeadline || undefined, assignedEmployeeId: projectEmployee || undefined, managerId: currentUser.id })
      setProjectName(''); setProjectDescription(''); setProjectGithub(''); setProjectDeadline(''); setProjectEmployee(''); onNotify('Project created and assigned'); onChanged()
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to create project') }
  }
  const createTask = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.createTask({ projectId: taskProject, title: taskTitle, assigneeId: taskAssignee, assigneeName: taskAssigneeName, createdBy: currentUser.id })
      setTaskTitle(''); onNotify('Task created'); onChanged()
    } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to create task') }
  }
  const updateStatus = async (task: Task, status: Task['status']) => {
    try { await api.updateTaskStatus(task._id, status); onNotify('Task status updated'); onChanged() }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to update task') }
  }
  const saveProgress = async (task: Task) => {
    try { await api.updateTaskProgress(task._id, progress[task._id] ?? task.progressDescription ?? ''); onNotify('Progress updated'); onChanged() }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to update progress') }
  }
  const submitReview = async (task: Task) => {
    try { await api.submitTaskForReview(task._id); onNotify('Task submitted for manager review'); onChanged() }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to submit task') }
  }
  const employeeStatusOptions = (task: Task) => {
    if (task.status === 'assigned') return ['assigned', 'in_progress']
    if (task.status === 'in_progress') return ['in_progress', 'completed']
    if (task.status === 'under_fix') return ['under_fix', 'completed']
    return [task.status]
  }
  const employeeDelivery = (task: Task) => <div className="delivery-controls">
    <label>Compilation status<select value={task.status} onChange={(event) => updateStatus(task, event.target.value as Task['status'])}>{employeeStatusOptions(task).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
    <textarea value={progress[task._id] ?? task.progressDescription ?? ''} onChange={(event) => setProgress((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Describe compilation progress, tests, and current result" />
    <div className="workflow-actions"><button className="icon-button" onClick={() => void saveProgress(task)}>Save progress</button>{task.status === 'completed' && task.reviewStatus !== 'submitted' && <button className="icon-button workflow-approve" onClick={() => void submitReview(task)}>Submit for review</button>}</div>
  </div>
  const review = async (task: Task, reviewStatus: 'changes_requested' | 'accepted') => {
    const reason = reviewReason[task._id]?.trim()
    if (reviewStatus === 'changes_requested' && !reason) { onNotify('Add a reason when requesting changes'); return }
    try { await api.reviewTask(task._id, reviewStatus, reason); onNotify(reviewStatus === 'accepted' ? 'Project work accepted' : 'Changes requested'); onChanged() }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to review task') }
  }

  return <section className={`workflow-grid ${focus === 'tasks' ? 'workflow-grid-single' : ''}`}>
    {focus === 'projects' && <article className="surface workflow-form"><div className="section-heading"><div><h2>{isEmployee ? 'Assigned projects' : 'Create a new project'}</h2><p>{isEmployee ? 'Open the assigned repository and update compilation status before manager review.' : 'Assign repository work with a deadline and employee owner.'}</p></div></div>{canManage && <form onSubmit={createProject}><label>Project name<input required value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label><label>GitHub repository URL<input type="url" value={projectGithub} onChange={(event) => setProjectGithub(event.target.value)} placeholder="https://github.com/org/repository" /></label><label>Description<textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} /></label><div className="form-row"><label>Deadline<input type="date" value={projectDeadline} onChange={(event) => setProjectDeadline(event.target.value)} /></label><label>Employee<select required value={projectEmployee} onChange={(event) => setProjectEmployee(event.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.email}</option>)}</select></label></div><button className="export-button" type="submit">Create and assign project</button></form>}    <div className="workflow-list">{projects.map((project) => { const projectTasks = tasks.filter((task) => task.projectId === project._id); const projectDefects = defects.filter((defect) => defect.projectId === project._id); return <div className="workflow-row project-delivery-row" key={project._id}><div><strong>{project.name}</strong><small>{project.description || 'No description'} · deadline {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'not set'}</small>{project.githubUrl && <a className="project-link" href={project.githubUrl} target="_blank" rel="noreferrer">Open GitHub repository</a>}{isEmployee && projectTasks.filter((task) => task.assigneeId === currentUser.id).map((task) => <div key={task._id}>{employeeDelivery(task)}</div>)}{isEmployee && projectDefects.map((defect) => <div className="delivery-review" key={defect._id}><strong>Debug required: {defect.module}</strong><small>{defect.title} · {defect.severity} · {defect.status}</small><p>{defect.description}</p><small>Debug instructions: {defect.debugInstructions}</small></div>)}{canManage && projectTasks.map((task) => <div className="delivery-review" key={task._id}><small>{task.assigneeName} · {task.status} · review: {(task.reviewStatus ?? 'not_submitted').replaceAll('_', ' ')}</small>{task.reviewStatus === 'submitted' && <><input value={reviewReason[task._id] ?? ''} onChange={(event) => setReviewReason((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Evidence-based review reason" /><div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => void review(task, 'accepted')}>Accept compilation</button><button className="icon-button workflow-reject" onClick={() => void review(task, 'changes_requested')}>Request changes</button></div></>}</div>)}</div><span className={`status ${project.status === 'completed' ? 'status-success' : 'status-warning'}`}><i />{project.status}</span></div> })}</div></article>}
    {focus === 'tasks' && <article className="surface workflow-list"><div className="section-heading"><div><h2>Project delivery records</h2><p>Internal delivery records support progress, review, defects, and salary calculations.</p></div></div>{canManage && <form onSubmit={createTask}><label>Project<select required value={taskProject} onChange={(event) => setTaskProject(event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label><label>Delivery title<input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /></label><div className="form-row"><label>Employee<select required value={taskAssignee} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); setTaskAssignee(event.target.value); setTaskAssigneeName(employee?.name ?? '') }}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>Employee name<input required value={taskAssigneeName} readOnly /></label></div><button className="export-button" type="submit">Create delivery record</button></form>}{tasks.map((task) => { const reviewStatus = task.reviewStatus ?? 'not_submitted'; return <div className="workflow-row task-workflow-row" key={task._id}><div><strong>{task.title}</strong><small>{task.assigneeName} · {task.status} · review: {reviewStatus.replaceAll('_', ' ')}</small>{(isEmployee && task.assigneeId === currentUser.id) && <><textarea value={progress[task._id] ?? task.progressDescription ?? ''} onChange={(event) => setProgress((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Describe current progress and expected behavior" /><div className="workflow-actions"><button className="icon-button" onClick={() => void saveProgress(task)}>Save progress</button>{task.status === 'completed' && reviewStatus !== 'submitted' && <button className="icon-button workflow-approve" onClick={() => void submitReview(task)}>Submit for project review</button>}</div></>}{canManage && reviewStatus === 'submitted' && <><input value={reviewReason[task._id] ?? ''} onChange={(event) => setReviewReason((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Optional acceptance note or required change reason" /><div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => void review(task, 'accepted')}>Accept project</button><button className="icon-button workflow-reject" onClick={() => void review(task, 'changes_requested')}>Request changes</button></div></>}</div>{canManage && <select value={task.status} onChange={(event) => updateStatus(task, event.target.value as Task['status'])}><option value={task.status}>{task.status}</option>{['assigned', 'in_progress', 'completed', 'reopened', 'under_fix', 'closed'].filter((status) => status !== task.status).map((status) => <option key={status} value={status}>{status}</option>)}</select>}</div> })}</article>}
  </section>
}

export function DefectsPanel({ tasks, defects, currentUser, onChanged, onNotify }: { tasks: Task[]; defects: Defect[]; currentUser: AuthUser; onChanged: () => void; onNotify: Notice }) {
  const [taskId, setTaskId] = useState('')
  const [module, setModule] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [debugInstructions, setDebugInstructions] = useState('')
  const [resolution, setResolution] = useState<Record<string, { description: string; evidence: string; hours: string }>>({})
  const [verifiedHours, setVerifiedHours] = useState<Record<string, string>>({})
  const [severity, setSeverity] = useState<Defect['severity']>('medium')
  const [cause, setCause] = useState<Defect['cause']>('code_defect')
  const canReview = currentUser.role === 'manager' || currentUser.role === 'admin'
  const report = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.reportDefect({ taskId, module, title, description, debugInstructions, severity, cause, reportedBy: currentUser.id })
      setModule('')
      setTitle('')
      setDescription('')
      setDebugInstructions('')
      onNotify('Debug assignment sent to employee')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to send debug assignment')
    }
  }
  const submitResolution = async (defect: Defect) => {
    const value = resolution[defect._id]
    if (!value?.description.trim() || !value.evidence.trim() || !value.hours || Number(value.hours) <= 0) { onNotify('Add the fix summary, verification evidence, and hours spent'); return }
    try {
      await api.submitDefectResolution(defect._id, { resolutionDescription: value.description, resolutionEvidence: value.evidence, resolutionHours: Number(value.hours) })
      onNotify('Fix submitted to manager for acceptance')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to submit fix')
    }
  }
  const acceptResolution = async (defect: Defect) => {
    try {
      await api.acceptDefectResolution(defect._id)
      onNotify('Employee fix accepted; defect resolved')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to accept fix')
    }
  }
  const backfillHours = async (defect: Defect) => {
    const hours = Number(verifiedHours[defect._id])
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) { onNotify('Enter verified corrective time between 0.01 and 24 hours'); return }
    const reviewReason = window.prompt('Explain how these hours were verified')?.trim()
    if (!reviewReason) return
    try {
      await api.recordResolvedDefectHours(defect._id, { hours, reviewReason })
      onNotify('Salary adjustment recorded for next month')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to record salary adjustment')
    }
  }
  return <section className={`workflow-grid ${canReview ? '' : 'workflow-grid-single'}`}>
    {canReview && <article className="surface workflow-form">
      <>
        <div className="section-heading"><div><h2>Assign project debug work</h2><p>Select the failed module and send debugging instructions to the assigned employee.</p></div></div>
        <form onSubmit={report}>
          <label>Completed project<select required value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Select project</option>{tasks.filter((task) => task.status === 'completed' || task.status === 'closed').map((task) => <option key={task._id} value={task._id}>{task.title.replace(/ delivery$/, '')}</option>)}</select></label>
          <label>Failed module<input required value={module} onChange={(event) => setModule(event.target.value)} /></label>
          <label>Failure title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Failure description<textarea required value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label>Debug instructions for employee<textarea required value={debugInstructions} onChange={(event) => setDebugInstructions(event.target.value)} /></label>
          <div className="form-row">
            <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as Defect['severity'])}>{['low', 'medium', 'high', 'critical'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Cause<select value={cause} onChange={(event) => setCause(event.target.value as Defect['cause'])}>{['code_defect', 'requirement_change', 'external_dependency', 'other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
          <button className="export-button" type="submit">Send debug assignment</button>
        </form>
      </>
    </article>}
    <article className="surface workflow-list">
      <div className="section-heading"><div><h2>{canReview ? 'Project defect register' : 'Assigned debug work'}</h2><p>{canReview ? 'Employees submit fixes; managers accept or return them.' : 'Investigate each assigned issue, record your fix, and submit it for review.'}</p></div></div>
      <div className="defect-card-list">
      {defects.map((defect) => <article className="defect-card" key={defect._id}>
        <div className="defect-card-heading">
          <div><strong>{defect.module || 'Project module'}: {defect.title}</strong><small>{defect.severity} · {defect.cause.replaceAll('_', ' ')}</small></div>
          <span className={`status ${defect.status === 'resolved' ? 'status-success' : defect.status === 'exempted' ? 'status-danger' : defect.status === 'under_review' ? 'status-warning' : 'status-danger'}`}><i />{defect.status.replaceAll('_', ' ')}</span>
        </div>
        <p>{defect.description}</p>
        <div className="defect-debug-instructions"><strong>Debug instructions</strong><p>{defect.debugInstructions || 'No additional instructions.'}</p></div>
          {!canReview && defect.status !== 'resolved' && defect.status !== 'exempted' && <>
            {defect.resolutionDescription && <div className="defect-resolution"><strong>Fix submitted</strong><p>{defect.resolutionDescription}</p><small>Evidence</small><p>{defect.resolutionEvidence}</p><span className="status status-warning"><i />Waiting for manager acceptance</span></div>}
            {!defect.resolutionDescription && <div className="delivery-review">
              <label>Fix summary<textarea value={resolution[defect._id]?.description ?? ''} onChange={(event) => setResolution((current) => ({ ...current, [defect._id]: { description: event.target.value, evidence: current[defect._id]?.evidence ?? '', hours: current[defect._id]?.hours ?? '' } }))} placeholder="Describe the code change or fix you made" /></label>
              <label>Verification evidence<textarea value={resolution[defect._id]?.evidence ?? ''} onChange={(event) => setResolution((current) => ({ ...current, [defect._id]: { description: current[defect._id]?.description ?? '', evidence: event.target.value, hours: current[defect._id]?.hours ?? '' } }))} placeholder="Tests, commit reference, logs, or screenshots" /></label>
              <label>Time spent (hours)<input type="number" min="0.01" max="24" step="0.25" value={resolution[defect._id]?.hours ?? ''} onChange={(event) => setResolution((current) => ({ ...current, [defect._id]: { description: current[defect._id]?.description ?? '', evidence: current[defect._id]?.evidence ?? '', hours: event.target.value } }))} placeholder="For example, 2.5" /></label>
              <button className="export-button" onClick={() => void submitResolution(defect)}>Submit fix for manager acceptance</button>
            </div>}
          </>}
          {canReview && defect.resolutionDescription && <div className="defect-resolution"><strong>Employee fix to review</strong><p>{defect.resolutionDescription}</p><small>Verification evidence</small><p>{defect.resolutionEvidence}</p>{defect.resolutionHours && <small>Employee time reported: {defect.resolutionHours}h</small>}</div>}
          {canReview && defect.status === 'under_review' && <button className="export-button" onClick={() => void acceptResolution(defect)}>Accept fix and resolve</button>}
          {canReview && defect.status === 'resolved' && !defect.resolutionHours && <div className="delivery-review"><strong>Salary hours not recorded</strong><p>This defect was resolved before hours were captured. Enter manager-verified hours to create its next-month adjustment.</p><label>Verified hours<input type="number" min="0.01" max="24" step="0.25" value={verifiedHours[defect._id] ?? ''} onChange={(event) => setVerifiedHours((current) => ({ ...current, [defect._id]: event.target.value }))} /></label><button className="export-button" onClick={() => void backfillHours(defect)}>Record hours and salary adjustment</button></div>}
          {canReview && defect.status === 'reported' && <button className="icon-button workflow-reject" onClick={() => void (async () => { const reason = window.prompt('Reason for exempting this defect') || ''; if (!reason) return; try { await api.reviewDefect(defect._id, { status: 'exempted', reviewedBy: currentUser.id, reviewReason: reason }); onNotify('Defect exempted'); onChanged() } catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to exempt defect') } })()}>Exempt defect</button>}
      </article>)}
      </div>
      {!defects.length && <div className="empty-data">No debug assignments for this project.</div>}
    </article>
  </section>
}

export function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return <section className="workflow-grid"><article className="surface workflow-list"><div className="section-heading"><div><h2>Audit trail</h2><p>Recent approval and payroll events from the database.</p></div></div>{logs.length ? logs.map((log) => <div className="workflow-row" key={log._id}><div><strong>{log.action}</strong><small>{log.entityType} · {log.entityId} · {new Date(log.timestamp).toLocaleString()}</small></div><span className="status status-success"><i />recorded</span></div>) : <div className="empty-data">No audit events returned by the API.</div>}</article></section>
}
