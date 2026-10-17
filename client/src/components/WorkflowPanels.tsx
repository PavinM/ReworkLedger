import { useEffect, useState, type FormEvent } from 'react'
import { Sparkles, X } from 'lucide-react'
import { api, type AuditLog, type AuthUser, type Defect, type DirectoryEmployee, type PayrollAdjustment, type Project, type Task } from '../lib/api'

type Notice = (message: string) => void
type DefectAssessment = {
  cause: Defect['cause']
  severity: Defect['severity']
  confidence: number
  estimatedHours: number
  rationale: string
  model: string
}
type DefectTimer = { elapsedMs: number; startedAt?: number }

function readDefectTimers(userId: string): Record<string, DefectTimer> {
  const key = `reworkledger.defect-timers:${userId}`
  const stored = window.localStorage.getItem(key)
  if (!stored) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    window.localStorage.removeItem(key)
    return {}
  }
  if (!isRecord(parsed)) return {}

  return Object.fromEntries(Object.entries(parsed).flatMap(([defectId, timer]) => {
    if (!isRecord(timer)
      || typeof timer.elapsedMs !== 'number'
      || !Number.isFinite(timer.elapsedMs)
      || timer.elapsedMs < 0
      || (timer.startedAt !== undefined && (typeof timer.startedAt !== 'number' || !Number.isFinite(timer.startedAt)))) return []
    return [[defectId, {
      elapsedMs: timer.elapsedMs,
      startedAt: typeof timer.startedAt === 'number' ? timer.startedAt : undefined,
    }]]
  }))
}

function formatTimerDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const ollamaUrl = 'http://localhost:11434'
const preferredOllamaModel = 'qwen2.5-coder:3b'

async function assessDefectLocally(input: { module: string; title: string; description: string; instructions: string }): Promise<DefectAssessment> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 90000)
  try {
    const tagsResponse = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal })
    if (!tagsResponse.ok) throw new Error(`Ollama model list request failed (${tagsResponse.status})`)
    const tagsPayload: unknown = await tagsResponse.json()
    if (!isRecord(tagsPayload) || !Array.isArray(tagsPayload.models)) throw new Error('Ollama returned an invalid model list')
    const models = tagsPayload.models.filter((model): model is { name: string } => isRecord(model) && typeof model.name === 'string')
    const selectedModel = models.find((model) => model.name === preferredOllamaModel) ?? models[0]
    if (!selectedModel) throw new Error('No local Ollama model is installed')

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: selectedModel.name,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'system',
            content: 'Triage the supplied software defect. Return only a JSON object with cause (one of code_defect, requirement_change, external_dependency, other), severity (one of low, medium, high, critical), confidence (integer 0-100), estimatedHours (number 0.25-24), and rationale (one concise sentence). Be conservative; label uncertainty as other/low confidence. Do not provide code or claim facts not in the report.',
          },
          { role: 'user', content: JSON.stringify(input) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Ollama assessment failed (${response.status})`)
    const payload: unknown = await response.json()
    if (!isRecord(payload) || !isRecord(payload.message) || typeof payload.message.content !== 'string') {
      throw new Error('Ollama returned an invalid assessment response')
    }
    const result: unknown = JSON.parse(payload.message.content)
    if (!isRecord(result)
      || !isCause(result.cause)
      || !isSeverity(result.severity)
      || typeof result.confidence !== 'number'
      || !Number.isFinite(result.confidence)
      || result.confidence < 0
      || result.confidence > 100
      || typeof result.estimatedHours !== 'number'
      || !Number.isFinite(result.estimatedHours)
      || result.estimatedHours < 0.25
      || result.estimatedHours > 24
      || typeof result.rationale !== 'string'
      || !result.rationale.trim()) {
      throw new Error('Ollama assessment did not match the expected fields')
    }
    return {
      cause: result.cause,
      severity: result.severity,
      confidence: result.confidence,
      estimatedHours: result.estimatedHours,
      rationale: result.rationale.trim(),
      model: selectedModel.name,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Local Ollama assessment timed out. Check that Ollama is running and retry.', { cause: error })
    }
    if (error instanceof TypeError) {
      throw new Error('Cannot reach local Ollama. Start Ollama and check its browser access settings.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCause(value: unknown): value is Defect['cause'] {
  return value === 'code_defect' || value === 'requirement_change' || value === 'external_dependency' || value === 'other'
}

function isSeverity(value: unknown): value is Defect['severity'] {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

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
  const [taskCommittedAt, setTaskCommittedAt] = useState('')
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
      await api.createTask({ projectId: taskProject, title: taskTitle, assigneeId: taskAssignee, assigneeName: taskAssigneeName, createdBy: currentUser.id, committedAt: taskCommittedAt || undefined })
      setTaskTitle(''); setTaskCommittedAt(''); onNotify('Task created'); onChanged()
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
    <label><span>Compilation status</span><select value={task.status} onChange={(event) => updateStatus(task, event.target.value as Task['status'])}>{employeeStatusOptions(task).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
    <textarea value={progress[task._id] ?? task.progressDescription ?? ''} onChange={(event) => setProgress((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Describe compilation progress, tests, and current result" />
    <div className="workflow-actions"><button className="icon-button" onClick={() => void saveProgress(task)}>Save progress</button>{task.status === 'completed' && task.reviewStatus !== 'submitted' && <button className="icon-button workflow-approve" onClick={() => void submitReview(task)}>Submit for review</button>}</div>
  </div>
  const taskLifecycle = (task: Task) => <details className="task-lifecycle-history">
    <summary>Lifecycle history · {task.statusHistory?.length ?? 0} changes</summary>
    <small>Committed by {task.committedAt ? new Date(task.committedAt).toLocaleDateString() : 'not specified'}</small>
    {task.originalCompletedAt && <small>First completed {new Date(task.originalCompletedAt).toLocaleString()}</small>}
    {task.currentCompletedAt && <small>Most recently completed {new Date(task.currentCompletedAt).toLocaleString()}</small>}
    <ol>{task.statusHistory?.map((item, index) => <li key={`${item.changedAt}-${index}`}><strong>{item.fromStatus ? `${item.fromStatus.replaceAll('_', ' ')} → ` : ''}{item.toStatus.replaceAll('_', ' ')}</strong><span>{new Date(item.changedAt).toLocaleString()} · {item.changedByName ?? `User ${item.changedBy.slice(-8)}`}{item.reason ? ` · ${item.reason}` : ''}</span></li>)}</ol>
    {task.deliveryHistory?.map((delivery) => <small key={delivery._id}>Delivery v{delivery.version} · {new Date(delivery.deliveredAt).toLocaleDateString()} · accepted by {delivery.acceptedByName ?? `User ${delivery.acceptedBy.slice(-8)}`} · contributors: {delivery.contributors.map((contributor) => contributor.name).join(', ') || 'not recorded'}</small>)}
  </details>
  const review = async (task: Task, reviewStatus: 'changes_requested' | 'accepted') => {
    const reason = reviewReason[task._id]?.trim()
    if (reviewStatus === 'changes_requested' && !reason) { onNotify('Add a reason when requesting changes'); return }
    try { await api.reviewTask(task._id, reviewStatus, reason); onNotify(reviewStatus === 'accepted' ? 'Project work accepted' : 'Changes requested'); onChanged() }
    catch (error) { onNotify(error instanceof Error ? error.message : 'Unable to review task') }
  }

  return <section className={`workflow-grid ${focus === 'tasks' ? 'workflow-grid-single' : ''}`}>
    {focus === 'projects' && <article className="surface workflow-form"><div className="section-heading"><div><h2>{isEmployee ? 'Assigned projects' : 'Create a new project'}</h2><p>{isEmployee ? 'Open the assigned repository and update compilation status before manager review.' : 'Assign repository work with a deadline and employee owner.'}</p></div></div>{canManage && <form onSubmit={createProject}><label>Project name<input required value={projectName} onChange={(event) => setProjectName(event.target.value)} /></label><label>GitHub repository URL<input type="url" value={projectGithub} onChange={(event) => setProjectGithub(event.target.value)} placeholder="https://github.com/org/repository" /></label><label>Description<textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} /></label><div className="form-row"><label>Deadline<input type="date" value={projectDeadline} onChange={(event) => setProjectDeadline(event.target.value)} /></label><label>Employee<select required value={projectEmployee} onChange={(event) => setProjectEmployee(event.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.email}</option>)}</select></label></div><button className="export-button" type="submit">Create and assign project</button></form>}    <div className="workflow-list">{projects.map((project) => { const projectTasks = tasks.filter((task) => task.projectId === project._id); const projectDefects = defects.filter((defect) => defect.projectId === project._id); return <div className="workflow-row project-delivery-row" key={project._id}><div className="project-delivery-content"><div className="project-summary"><strong>{project.name}</strong><small>{project.description || 'No description'} · deadline {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'not set'}</small>{project.githubUrl && <a className="project-link" href={project.githubUrl} target="_blank" rel="noreferrer">Open GitHub repository</a>}</div>{isEmployee && projectTasks.filter((task) => task.assigneeId === currentUser.id).map((task) => <div className="project-task-card" key={task._id}>{employeeDelivery(task)}</div>)}{isEmployee && projectDefects.map((defect) => <div className="delivery-review project-defect-card" key={defect._id}><strong className="project-defect-kicker">Debug assignment · {defect.module}</strong><span className="project-defect-title">{defect.title}</span><small>{defect.severity} severity · {defect.status.replaceAll('_', ' ')}</small>{defect.description && <p>{defect.description}</p>}<small className="project-debug-instructions"><strong>Debug instructions</strong>{defect.debugInstructions || 'None provided.'}</small></div>)}{canManage && projectTasks.map((task) => <div className="delivery-review project-task-review" key={task._id}><small><strong>{task.assigneeName}</strong><span>{task.status.replaceAll('_', ' ')} · review: {(task.reviewStatus ?? 'not_submitted').replaceAll('_', ' ')}</span></small>{task.reviewStatus === 'submitted' && <><input value={reviewReason[task._id] ?? ''} onChange={(event) => setReviewReason((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Evidence-based review reason" /><div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => void review(task, 'accepted')}>Accept compilation</button><button className="icon-button workflow-reject" onClick={() => void review(task, 'changes_requested')}>Request changes</button></div></>}</div>)}</div><span className={`status ${project.status === 'completed' ? 'status-success' : 'status-warning'}`}><i />{project.status}</span></div> })}</div></article>}
    {focus === 'tasks' && <article className="surface workflow-list"><div className="section-heading"><div><h2>Project delivery records</h2><p>Internal delivery records support progress, review, defects, and salary calculations.</p></div></div>{canManage && <form onSubmit={createTask}><label>Project<select required value={taskProject} onChange={(event) => setTaskProject(event.target.value)}><option value="">Select project</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label><label>Delivery title<input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /></label><div className="form-row"><label>Committed delivery date<input type="date" value={taskCommittedAt} onChange={(event) => setTaskCommittedAt(event.target.value)} /></label><label>Employee<select required value={taskAssignee} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); setTaskAssignee(event.target.value); setTaskAssigneeName(employee?.name ?? '') }}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>Employee name<input required value={taskAssigneeName} readOnly /></label></div><button className="export-button" type="submit">Create delivery record</button></form>}{tasks.map((task) => { const reviewStatus = task.reviewStatus ?? 'not_submitted'; return <div className="workflow-row task-workflow-row" key={task._id}><div><strong>{task.title}</strong><small>{task.assigneeName} · {task.status} · review: {reviewStatus.replaceAll('_', ' ')}</small>{taskLifecycle(task)}{(isEmployee && task.assigneeId === currentUser.id) && <><textarea value={progress[task._id] ?? task.progressDescription ?? ''} onChange={(event) => setProgress((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Describe current progress and expected behavior" /><div className="workflow-actions"><button className="icon-button" onClick={() => void saveProgress(task)}>Save progress</button>{task.status === 'completed' && reviewStatus !== 'submitted' && <button className="icon-button workflow-approve" onClick={() => void submitReview(task)}>Submit for project review</button>}</div></>}{canManage && reviewStatus === 'submitted' && <><input value={reviewReason[task._id] ?? ''} onChange={(event) => setReviewReason((current) => ({ ...current, [task._id]: event.target.value }))} placeholder="Optional acceptance note or required change reason" /><div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => void review(task, 'accepted')}>Accept project</button><button className="icon-button workflow-reject" onClick={() => void review(task, 'changes_requested')}>Request changes</button></div></>}</div>{canManage && <select value={task.status} onChange={(event) => updateStatus(task, event.target.value as Task['status'])}><option value={task.status}>{task.status}</option>{['assigned', 'in_progress', 'completed', 'reopened', 'under_fix', 'closed'].filter((status) => status !== task.status).map((status) => <option key={status} value={status}>{status}</option>)}</select>}</div> })}</article>}
  </section>
}

export function DefectsPanel({ tasks, defects, projects, adjustments, currentUser, onChanged, onNotify }: {
  tasks: Task[]
  defects: Defect[]
  projects: Project[]
  adjustments: PayrollAdjustment[]
  currentUser: AuthUser
  onChanged: () => void
  onNotify: Notice
}) {
  const [taskId, setTaskId] = useState('')
  const [module, setModule] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [debugInstructions, setDebugInstructions] = useState('')
  const [resolution, setResolution] = useState<Record<string, { description: string; evidence: string }>>({})
  const [timers, setTimers] = useState<Record<string, DefectTimer>>(() => readDefectTimers(currentUser.id))
  const [timerClock, setTimerClock] = useState(Date.now())
  const [verifiedHours, setVerifiedHours] = useState<Record<string, string>>({})
  const [assessments, setAssessments] = useState<Record<string, DefectAssessment>>({})
  const [assessmentErrors, setAssessmentErrors] = useState<Record<string, string>>({})
  const [assessing, setAssessing] = useState<string | null>(null)
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null)
  const [severity, setSeverity] = useState<Defect['severity']>('medium')
  const [cause, setCause] = useState<Defect['cause']>('code_defect')
  const canReview = currentUser.role === 'manager' || currentUser.role === 'admin'
  const clearNewAssessment = () => setAssessments((current) => {
    const next = { ...current }
    delete next.new
    return next
  })
  useEffect(() => {
    const storageKey = `reworkledger.defect-timers:${currentUser.id}`
    if (Object.keys(timers).length) window.localStorage.setItem(storageKey, JSON.stringify(timers))
    else window.localStorage.removeItem(storageKey)
  }, [currentUser.id, timers])

  useEffect(() => {
    if (!Object.values(timers).some((timer) => timer.startedAt !== undefined)) return
    const interval = window.setInterval(() => setTimerClock(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [timers])

  const elapsedTimerMs = (defectId: string) => {
    const timer = timers[defectId]
    return timer ? timer.elapsedMs + (timer.startedAt === undefined ? 0 : Math.max(0, timerClock - timer.startedAt)) : 0
  }
  const trackedTimerHours = (defectId: string) => Math.round((elapsedTimerMs(defectId) / 3600000) * 100) / 100
  const estimatedOverrunHours = (defect: Defect) => defect.estimatedResolutionHours === undefined
    ? 0
    : Math.max(0, Math.round((trackedTimerHours(defect._id) - defect.estimatedResolutionHours) * 100) / 100)
  const updateResolution = (defectId: string, field: 'description' | 'evidence', value: string) => {
    setResolution((current) => ({
      ...current,
      [defectId]: {
        description: current[defectId]?.description ?? '',
        evidence: current[defectId]?.evidence ?? '',
        [field]: value,
      },
    }))
  }
  const toggleDefectTimer = (defectId: string) => {
    const activeTimer = Object.entries(timers).find(([, timer]) => timer.startedAt !== undefined)
    if (activeTimer && activeTimer[0] !== defectId) {
      onNotify('Stop the running defect timer before starting another one')
      return
    }
    const timer = timers[defectId] ?? { elapsedMs: 0 }
    if (timer.startedAt !== undefined) {
      const elapsedMs = timer.elapsedMs + Math.max(0, Date.now() - timer.startedAt)
      setTimers((current) => ({ ...current, [defectId]: { elapsedMs } }))
      setTimerClock(Date.now())
    } else {
      setTimers((current) => ({ ...current, [defectId]: { ...timer, startedAt: Date.now() } }))
      setTimerClock(Date.now())
    }
  }
  const report = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const estimate = assessments.new
      await api.reportDefect({
        taskId,
        module,
        title,
        description,
        debugInstructions,
        severity,
        cause,
        reportedBy: currentUser.id,
        estimatedResolutionHours: estimate?.estimatedHours,
        estimateModel: estimate?.model,
      })
      setModule('')
      setTitle('')
      setDescription('')
      setDebugInstructions('')
      clearNewAssessment()
      onNotify('Debug assignment sent to employee')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to send debug assignment')
    }
  }
  const submitResolution = async (defect: Defect) => {
    const value = resolution[defect._id]
    if (timers[defect._id]?.startedAt !== undefined) { onNotify('Stop the timer before submitting the fix'); return }
    const hours = trackedTimerHours(defect._id)
    if (!value?.description.trim() || !value.evidence.trim() || hours <= 0) { onNotify('Add the fix summary, verification evidence, and track time with the timer'); return }
    if (hours > 24) { onNotify('Tracked time cannot exceed 24 hours for one defect fix'); return }
    try {
      await api.submitDefectResolution(defect._id, { resolutionDescription: value.description, resolutionEvidence: value.evidence, resolutionHours: hours })
      setTimers((current) => {
        const next = { ...current }
        delete next[defect._id]
        return next
      })
      onNotify('Fix submitted to manager for acceptance')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to submit fix')
    }
  }
  const acceptResolution = async (defect: Defect) => {
    try {
      await api.acceptDefectResolution(defect._id)
      onNotify(defect.estimatedResolutionHours !== undefined
        && defect.resolutionHours !== undefined
        && defect.resolutionHours > defect.estimatedResolutionHours
        ? 'Fix accepted; overrun salary deduction is pending payroll approval'
        : 'Employee fix accepted; defect resolved')
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
  const runAssessment = async (key: string, input: { module: string; title: string; description: string; instructions: string }) => {
    if (!input.description.trim()) {
      setAssessmentErrors((current) => ({ ...current, [key]: 'Add a failure description before running an assessment.' }))
      return
    }
    setAssessing(key)
    setAssessmentErrors((current) => ({ ...current, [key]: '' }))
    try {
      const result = await assessDefectLocally(input)
      setAssessments((current) => ({ ...current, [key]: result }))
    } catch (error) {
      setAssessmentErrors((current) => ({ ...current, [key]: error instanceof Error ? error.message : 'Unable to assess this defect locally' }))
    } finally {
      setAssessing(null)
    }
  }
  const applyAssessmentToForm = (assessment: DefectAssessment) => {
    setCause(assessment.cause)
    setSeverity(assessment.severity)
  }
  const selectedDefect = defects.find((defect) => defect._id === selectedDefectId) ?? null
  return <section className={`workflow-grid ${canReview ? '' : 'workflow-grid-single'}`}>
    {canReview && <article className="surface workflow-form">
      <>
        <div className="section-heading"><div><h2>Assign project debug work</h2><p>Select the failed module and send debugging instructions to the assigned employee.</p></div></div>
        <form onSubmit={report}>
          <label>Completed project<select required value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Select project</option>{tasks.filter((task) => task.status === 'completed' || task.status === 'closed').map((task) => <option key={task._id} value={task._id}>{task.title.replace(/ delivery$/, '')}</option>)}</select></label>
          <label>Failed module<input required value={module} onChange={(event) => { setModule(event.target.value); clearNewAssessment() }} /></label>
          <label>Failure title<input required value={title} onChange={(event) => { setTitle(event.target.value); clearNewAssessment() }} /></label>
          <label>Failure description<textarea required value={description} onChange={(event) => { setDescription(event.target.value); clearNewAssessment() }} /></label>
          <label>Debug instructions for employee<textarea required value={debugInstructions} onChange={(event) => { setDebugInstructions(event.target.value); clearNewAssessment() }} /></label>
          <div className="form-row">
            <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value as Defect['severity'])}>{['low', 'medium', 'high', 'critical'].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Cause<select value={cause} onChange={(event) => setCause(event.target.value as Defect['cause'])}>{['code_defect', 'requirement_change', 'external_dependency', 'other'].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
          <button className="local-ai-button" type="button" disabled={assessing === 'new'} onClick={() => void runAssessment('new', { module, title, description, instructions: debugInstructions })}>
            <Sparkles size={14} />{assessing === 'new' ? 'Assessing with local Ollama…' : 'Assess with local Ollama'}
          </button>
          {assessmentErrors.new && <p className="local-ai-error" role="alert">{assessmentErrors.new}</p>}
          {assessments.new && <AssessmentCard assessment={assessments.new} onApply={() => applyAssessmentToForm(assessments.new)} />}
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
          <div className="defect-heading-actions"><span className={`status ${defect.status === 'resolved' ? 'status-success' : defect.status === 'exempted' ? 'status-danger' : defect.status === 'under_review' ? 'status-warning' : 'status-danger'}`}><i />{defect.status.replaceAll('_', ' ')}</span><button className="defect-details-button" type="button" onClick={() => setSelectedDefectId(defect._id)}>Details</button></div>
        </div>
        <p>{defect.description}</p>
        <div className="defect-debug-instructions"><strong>Debug instructions</strong><p>{defect.debugInstructions || 'No additional instructions.'}</p></div>
          {!canReview && defect.status !== 'resolved' && defect.status !== 'exempted' && <>
            {defect.resolutionDescription && <div className="defect-resolution"><strong>Fix submitted</strong><p>{defect.resolutionDescription}</p><small>Evidence</small><p>{defect.resolutionEvidence}</p><span className="status status-warning"><i />Waiting for manager acceptance</span></div>}
            {!defect.resolutionDescription && <div className="delivery-review">
              <label>Fix summary<textarea value={resolution[defect._id]?.description ?? ''} onChange={(event) => updateResolution(defect._id, 'description', event.target.value)} placeholder="Describe the code change or fix you made" /></label>
              <label>Verification evidence<textarea value={resolution[defect._id]?.evidence ?? ''} onChange={(event) => updateResolution(defect._id, 'evidence', event.target.value)} placeholder="Tests, commit reference, logs, or screenshots" /></label>
              <div className="defect-timer" aria-live="polite">
                <div><small>TIME SPENT</small><strong>{formatTimerDuration(elapsedTimerMs(defect._id))}</strong><span>{trackedTimerHours(defect._id) > 0 ? `${trackedTimerHours(defect._id).toFixed(2)} hours tracked` : 'Timer is saved on this device'}</span></div>
                <button className="icon-button" type="button" onClick={() => toggleDefectTimer(defect._id)}>{timers[defect._id]?.startedAt !== undefined ? 'Pause timer' : 'Start timer'}</button>
              </div>
              {defect.estimatedResolutionHours !== undefined
                ? <p className="defect-timer-note">AI estimate: {defect.estimatedResolutionHours.toFixed(2)}h · {estimatedOverrunHours(defect).toFixed(2)}h over estimate · proposed deduction at ₹1,000/h: ₹{(estimatedOverrunHours(defect) * 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} (manager approval required)</p>
                : <p className="defect-timer-note">No AI estimate was saved for this assignment; an overrun deduction will not be calculated.</p>}
              <button className="export-button" disabled={timers[defect._id]?.startedAt !== undefined} onClick={() => void submitResolution(defect)}>Submit fix for manager acceptance</button>
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
    {selectedDefect && <DefectDetailsModal
      defect={selectedDefect}
      task={tasks.find((task) => task._id === selectedDefect.taskId)}
      project={projects.find((project) => project._id === tasks.find((task) => task._id === selectedDefect.taskId)?.projectId)}
      adjustments={adjustments}
      assessment={assessments[selectedDefect._id]}
      assessmentError={assessmentErrors[selectedDefect._id]}
      assessing={assessing === selectedDefect._id}
      onClose={() => setSelectedDefectId(null)}
      onAnalyze={() => void runAssessment(selectedDefect._id, {
        module: selectedDefect.module,
        title: selectedDefect.title,
        description: selectedDefect.description ?? '',
        instructions: selectedDefect.debugInstructions ?? '',
      })}
    />}
  </section>
}

function AssessmentCard({ assessment, onApply }: { assessment: DefectAssessment; onApply?: () => void }) {
  return <section className="local-ai-result" aria-label="Local AI suggestion">
    <div className="local-ai-heading"><div><Sparkles size={14} /><strong>Local AI assessment</strong></div><span>Suggestion · manager review required</span></div>
    <div className="local-ai-metrics">
      <div><small>Suggested cause</small><strong>{assessment.cause.replaceAll('_', ' ')}</strong></div>
      <div><small>Suggested severity</small><strong>{assessment.severity}</strong></div>
      <div><small>Confidence</small><strong>{Math.round(assessment.confidence)}%</strong></div>
      <div><small>Repair estimate</small><strong>{assessment.estimatedHours.toFixed(1)}h</strong></div>
    </div>
    <p>{assessment.rationale}</p>
    <small className="local-ai-model">Generated locally by {assessment.model}; cause and severity remain manager-controlled.</small>
    {onApply && <button type="button" className="local-ai-apply" onClick={onApply}>Use cause and severity suggestions</button>}
  </section>
}

function DefectDetailsModal({ defect, task, project, adjustments, assessment, assessmentError, assessing, onClose, onAnalyze }: {
  defect: Defect
  task?: Task
  project?: Project
  adjustments: PayrollAdjustment[]
  assessment?: DefectAssessment
  assessmentError?: string
  assessing: boolean
  onClose: () => void
  onAnalyze: () => void
}) {
  const defectAdjustments = adjustments.flatMap((adjustment) => {
    const entries = adjustment.calculationBreakdown.filter((entry) => entry.defectId === defect._id)
    if (!entries.length) return []
    const amount = entries.reduce((total, entry) => total + Math.abs(entry.amount), 0)
    return [{ adjustment, entries, amount }]
  })
  const salaryImpact = defectAdjustments.reduce((total, item) => total + (item.adjustment.adjustmentType === 'debit' ? -item.amount : item.adjustment.adjustmentType === 'credit' ? item.amount : 0), 0)
  const trackedHours = defect.resolutionHours
  const expectedHours = defect.estimatedResolutionHours ?? assessment?.estimatedHours
  const progress = trackedHours && expectedHours ? Math.min(100, Math.round(trackedHours / expectedHours * 100)) : null
  const timeline = [
    { label: 'Bug found', date: defect.foundAt ?? defect.createdAt },
    ...(defect.resolutionSubmittedAt ? [{ label: 'Employee fix submitted', date: defect.resolutionSubmittedAt }] : []),
    ...(defect.status === 'resolved' ? [{ label: 'Defect resolved', date: defect.updatedAt }] : []),
  ]
  return <div className="defect-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="defect-details-modal" role="dialog" aria-modal="true" aria-labelledby="defect-detail-title">
      <header className="defect-details-header">
        <div><div className="defect-detail-kicker">{defect._id.slice(-8)} · {project?.name ?? 'Project'} · {defect.originalAssigneeName ?? task?.assigneeName ?? 'Assigned employee'}</div><h2 id="defect-detail-title">{defect.title}</h2><small>{defect.module || 'Project module'} · {defect.severity} · {defect.status.replaceAll('_', ' ')}</small></div>
        <button className="icon-button" type="button" aria-label="Close defect details" onClick={onClose}><X size={17} /></button>
      </header>
      <div className="defect-details-body">
        <div className="defect-details-main">
          <section className="defect-detail-task"><small>ORIGINAL PROJECT DELIVERY</small><strong>{task?.deliveryHistory?.find((delivery) => delivery._id === defect.deliveryId)?.taskTitle ?? task?.title ?? 'Delivery details unavailable'}</strong><span>{task ? `${task.status.replaceAll('_', ' ')} · originally delivered by ${defect.originalAssigneeName ?? task.assigneeName}` : 'No matching delivery record was returned.'}</span>{task?.deliveryHistory?.find((delivery) => delivery._id === defect.deliveryId) && <span>Delivery version {task.deliveryHistory.find((delivery) => delivery._id === defect.deliveryId)?.version} · accepted {new Date(task.deliveryHistory.find((delivery) => delivery._id === defect.deliveryId)!.deliveredAt).toLocaleDateString()}</span>}{task?.originalCompletedAt && <span>Completed {new Date(task.originalCompletedAt).toLocaleDateString()}</span>}</section>
          <section className="defect-detail-section"><small>DESCRIPTION</small><p>{defect.description || 'No failure description was provided.'}</p></section>
          <section className="defect-detail-section"><small>DEBUG INSTRUCTIONS</small><p>{defect.debugInstructions || 'No additional instructions.'}</p></section>
          <section className="defect-detail-section"><small>LIFECYCLE</small><ol className="defect-lifecycle">{timeline.map((item) => <li key={item.label}><strong>{item.label}</strong><span>{new Date(item.date).toLocaleString()}</span></li>)}{!defect.resolutionSubmittedAt && defect.status !== 'resolved' && <li className="defect-lifecycle-pending"><strong>Waiting for employee fix</strong><span>{defect.status.replaceAll('_', ' ')}</span></li>}</ol></section>
          {defect.resolutionDescription && <section className="defect-detail-section defect-detail-fix"><small>EMPLOYEE FIX SUMMARY</small><p>{defect.resolutionDescription}</p>{defect.resolutionEvidence && <><small>VERIFICATION EVIDENCE</small><p>{defect.resolutionEvidence}</p></>}</section>}
        </div>
        <aside className="defect-details-aside">
          <section className="defect-detail-ai">
            <div className="defect-detail-ai-title"><Sparkles size={14} /><strong>Local AI assessment</strong></div>
            <p>{defect.estimatedResolutionHours !== undefined
              ? `Saved estimate: ${defect.estimatedResolutionHours.toFixed(2)}h${defect.estimateModel ? ` · ${defect.estimateModel}` : ''}. Any deduction for tracked time above this estimate remains pending manager approval.`
              : 'Optional suggestions from Ollama on this device; these do not change the defect or replace manager review.'}</p>
            <button className="local-ai-button" type="button" disabled={assessing} onClick={onAnalyze}><Sparkles size={13} />{assessing ? 'Assessing locally…' : assessment ? 'Run assessment again' : 'Assess with local Ollama'}</button>
            {assessmentError && <p className="local-ai-error" role="alert">{assessmentError}</p>}
            {assessment && <AssessmentCard assessment={assessment} />}
          </section>
          <section className="defect-detail-stat-grid">
            <div><small>TRACKED TIME</small><strong>{trackedHours ? `${trackedHours.toFixed(2)}h` : '—'}</strong><span>Employee-reported resolution time</span></div>
            <div><small>REPAIR PROGRESS</small><strong>{progress === null ? '—' : `${progress}%`}</strong><div className="defect-progress"><i style={{ width: `${progress ?? 0}%` }} /></div><span>{expectedHours && trackedHours ? `${trackedHours.toFixed(1)}h tracked vs ${expectedHours.toFixed(1)}h estimate` : expectedHours ? `Estimate ${expectedHours.toFixed(1)}h` : 'No saved estimate to compare'}</span></div>
          </section>
          <section className="defect-detail-cost">
            <div><span>Company rework cost</span><strong>{defectAdjustments.length ? `${defectAdjustments[0].adjustment.currency} ${defectAdjustments.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'Not recorded'}</strong></div>
            <div><span>Related salary adjustment</span><strong>{defectAdjustments.length ? `${defectAdjustments[0].adjustment.currency} ${Math.abs(salaryImpact).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${salaryImpact < 0 ? 'deduction' : salaryImpact > 0 ? 'credit' : ''}` : 'Not recorded'}</strong></div>
            {defectAdjustments.map(({ adjustment }) => <small key={adjustment._id}>{adjustment.status.replaceAll('_', ' ')} · {adjustment.adjustmentType} · payroll period {new Date(adjustment.periodStart).toLocaleDateString()}–{new Date(adjustment.periodEnd).toLocaleDateString()}</small>)}
            {defectAdjustments.some(({ adjustment }) => (adjustment.overrunPenalty ?? 0) > 0) && <small>Overrun deduction: ₹{defectAdjustments.reduce((sum, item) => sum + (item.adjustment.overrunPenalty ?? 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} for {defectAdjustments.reduce((sum, item) => sum + (item.adjustment.overrunHours ?? 0), 0).toFixed(2)} excess hours · manager approval required</small>}
            <small>Salary changes remain subject to the existing manager approval workflow.</small>
          </section>
          {defect.reviewReason && <section className="defect-detail-cost"><small>MANAGER REVIEW NOTE</small><p>{defect.reviewReason}</p></section>}
        </aside>
      </div>
    </section>
  </div>
}

export function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return <section className="workflow-grid"><article className="surface workflow-list"><div className="section-heading"><div><h2>Audit trail</h2><p>Recent approval and payroll events from the database.</p></div></div>{logs.length ? logs.map((log) => <div className="workflow-row" key={log._id}><div><strong>{log.action}</strong><small>{log.entityType} · {log.entityId} · {new Date(log.timestamp).toLocaleString()}</small></div><span className="status status-success"><i />recorded</span></div>) : <div className="empty-data">No audit events returned by the API.</div>}</article></section>
}
