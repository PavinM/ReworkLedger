import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type AnalysisFinding, type AnalysisScan, type AuthUser, type Defect, type Task } from '../lib/api'

type Notice = (message: string) => void
const severities: AnalysisFinding['severity'][] = ['critical', 'high', 'medium', 'low']

export function AnalysisPanel({ tasks, currentUser, onNotify }: { tasks: Task[]; currentUser: AuthUser; onNotify: Notice }) {
  const [taskId, setTaskId] = useState(tasks[0]?._id ?? '')
  const [scan, setScan] = useState<AnalysisScan | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [versionRef, setVersionRef] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [filter, setFilter] = useState<'all' | AnalysisFinding['severity']>('all')
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({})
  const [cause, setCause] = useState<Defect['cause']>('code_defect')
  const [loading, setLoading] = useState(false)
  const canReview = currentUser.role === 'manager' || currentUser.role === 'admin'

  const loadScans = useCallback(async () => {
    if (!taskId) return
    try {
      const scans = await api.listAnalysisScans(taskId)
      setScan(scans[0] ?? null)
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to load analysis reports')
    }
  }, [onNotify, taskId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadScans() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadScans])
  useEffect(() => {
    if (!scan || (scan.status !== 'queued' && scan.status !== 'running')) return undefined
    const timer = window.setInterval(() => { void loadScans() }, 1500)
    return () => window.clearInterval(timer)
  }, [loadScans, scan])

  const analyze = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) {
      onNotify('Choose a ZIP file before starting analysis')
      return
    }
    setLoading(true)
    try {
      setScan(await api.uploadAnalysis(taskId, { project: file, versionRef, expectedBehavior }))
      onNotify('Analysis queued. The report will update when scanning completes.')
      setFile(null)
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to analyze project')
    } finally {
      setLoading(false)
    }
  }

  const review = async (finding: AnalysisFinding, status: AnalysisFinding['status']) => {
    const reason = reviewReason[finding._id]?.trim()
    if (!reason) {
      onNotify('Add a review reason before deciding a finding')
      return
    }
    try {
      const updated = await api.reviewAnalysisFinding(scan!._id, finding._id, { status, reviewReason: reason })
      setScan(updated)
      onNotify('Finding review saved')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to review finding')
    }
  }

  const createDefect = async (finding: AnalysisFinding) => {
    try {
      await api.createDefectFromFinding(scan!._id, finding._id, cause)
      await loadScans()
      onNotify('Confirmed finding linked to a new defect')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to create defect')
    }
  }

  const findings = scan?.findings.filter((finding) => filter === 'all' || finding.severity === filter) ?? []
  return <section className="workflow-grid workflow-grid-single">
    <article className="surface workflow-form">
      <div className="section-heading"><div><h2>Analyze project</h2><p>Static checks identify potential issues; a Team Lead must verify every finding.</p></div></div>
      <form onSubmit={analyze}>
        <label>Task<select required value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Select task</option>{tasks.map((task) => <option key={task._id} value={task._id}>{task.title} · {task.assigneeName}</option>)}</select></label>
        <label>Project ZIP<input required type="file" accept=".zip,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <label>Version or commit reference<input value={versionRef} onChange={(event) => setVersionRef(event.target.value)} placeholder="e.g. v1.2.0 or abc123" /></label>
        <label>Expected behavior<textarea value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} placeholder="What should this task do?" /></label>
        <button className="export-button" type="submit" disabled={loading || !taskId}>{loading ? 'Uploading…' : 'Analyze project'}</button>
      </form>
    </article>
    <article className="surface workflow-list">
      <div className="section-heading"><div><h2>Code analysis report</h2><p>{scan ? `${scan.sourceName} · ${scan.filesAnalyzed} source files · ${scan.totalFindings} findings` : 'Select a task to view its scan history.'}</p></div><select aria-label="Filter findings by severity" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All severities</option>{severities.map((severity) => <option key={severity}>{severity}</option>)}</select></div>
      {scan?.status === 'queued' || scan?.status === 'running' ? <div className="empty-data">Scan {scan.status}. Static analysis is running without executing uploaded code.</div> : null}
      {scan?.status === 'failed' ? <div className="empty-data">Analysis failed: {scan.errorMessage ?? 'Unknown error'}</div> : null}
      {scan?.status === 'completed' && !findings.length ? <div className="empty-data">No findings matched this filter. This does not guarantee the project is bug-free.</div> : null}
      {scan?.status === 'completed' && findings.map((finding) => <div className="analysis-finding" key={finding._id}>
        <div className="analysis-finding-header"><strong>{finding.title}</strong><span className={`status status-${finding.severity === 'critical' || finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'success'}`}><i />{finding.severity}</span></div>
        <small>{finding.tool} · {finding.filePath}:{finding.line} · {finding.status.replaceAll('_', ' ')}</small>
        <p>{finding.description}</p>
        <code>{finding.evidence}</code>
        <small>Suggested investigation: {finding.suggestion}</small>
        {canReview && finding.status === 'needs_review' && <div className="analysis-review"><input value={reviewReason[finding._id] ?? ''} onChange={(event) => setReviewReason((current) => ({ ...current, [finding._id]: event.target.value }))} placeholder="Evidence-based review reason" /><div className="workflow-actions"><button className="icon-button workflow-approve" onClick={() => void review(finding, 'confirmed_bug')}>Confirm bug</button><button className="icon-button" onClick={() => void review(finding, 'false_positive')}>False positive</button><button className="icon-button" onClick={() => void review(finding, 'needs_information')}>Needs info</button><button className="icon-button" onClick={() => void review(finding, 'accepted_risk')}>Accepted risk</button></div></div>}
        {canReview && finding.status === 'confirmed_bug' && !finding.defectId && <div className="analysis-review"><select aria-label="Defect cause" value={cause} onChange={(event) => setCause(event.target.value as Defect['cause'])}><option value="code_defect">Implementation error</option><option value="requirement_change">Changed requirements</option><option value="external_dependency">External dependency</option><option value="other">Environment or other</option></select><button className="export-button" onClick={() => void createDefect(finding)}>Create defect</button></div>}
        {finding.defectId && <small className="analysis-linked">Linked defect: {finding.defectId}</small>}
      </div>)}
      {!scan && <div className="empty-data">Upload a ZIP to create the first report. Previous scans remain available for comparison.</div>}
    </article>
  </section>
}
