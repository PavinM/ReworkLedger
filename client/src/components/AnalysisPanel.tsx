import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, type AnalysisFinding, type AnalysisScan, type AuthUser, type Defect, type Task } from '../lib/api'

type Notice = (message: string) => void
const severities: AnalysisFinding['severity'][] = ['critical', 'high', 'medium', 'low']
const causes: Array<{ value: Defect['cause']; label: string }> = [
  { value: 'code_defect', label: 'Code defect' },
  { value: 'requirement_change', label: 'Changed requirements' },
  { value: 'external_dependency', label: 'External dependency' },
  { value: 'other', label: 'Other' },
]

export function AnalysisPanel({ tasks, currentUser, onNotify }: { tasks: Task[]; currentUser: AuthUser; onNotify: Notice }) {
  const [taskId, setTaskId] = useState(tasks[0]?._id ?? '')
  const [scan, setScan] = useState<AnalysisScan | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [versionRef, setVersionRef] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [filter, setFilter] = useState<'all' | AnalysisFinding['severity']>('all')
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({})
  const [findingCauses, setFindingCauses] = useState<Record<string, Defect['cause']>>({})
  const [debugInstructions, setDebugInstructions] = useState<Record<string, string>>({})
  const [submittingFinding, setSubmittingFinding] = useState<string | null>(null)
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
    const instructions = (debugInstructions[finding._id] ?? finding.suggestion).trim()
    if (!instructions) {
      onNotify('Add debug instructions before sending the assignment')
      return
    }
    setSubmittingFinding(finding._id)
    try {
      await api.createDefectFromFinding(scan!._id, finding._id, findingCauses[finding._id] ?? finding.suggestedCause ?? 'code_defect', instructions)
      await loadScans()
      onNotify('Debug assignment sent to the employee')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to create defect')
    } finally {
      setSubmittingFinding(null)
    }
  }

  const confirmAndSend = async (finding: AnalysisFinding) => {
    const reason = reviewReason[finding._id]?.trim()
    if (!reason) {
      onNotify('Add a review reason before confirming and assigning this finding')
      return
    }
    const task = tasks.find((item) => item._id === scan?.taskId)
    if (!task || !['completed', 'closed'].includes(task.status)) {
      onNotify('The task must be completed before sending a debug assignment')
      return
    }
    const instructions = (debugInstructions[finding._id] ?? finding.suggestion).trim()
    if (!instructions) {
      onNotify('Add debug instructions before sending the assignment')
      return
    }
    if (!scan) return
    setSubmittingFinding(finding._id)
    try {
      const reviewedScan = await api.reviewAnalysisFinding(scan._id, finding._id, { status: 'confirmed_bug', reviewReason: reason })
      setScan(reviewedScan)
      await api.createDefectFromFinding(
        reviewedScan._id,
        finding._id,
        findingCauses[finding._id] ?? finding.suggestedCause ?? 'code_defect',
        instructions,
      )
      await loadScans()
      onNotify('Finding confirmed and debug assignment sent to the employee')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to send debug assignment')
    } finally {
      setSubmittingFinding(null)
    }
  }

  const allFindings = scan?.findings ?? []
  const findings = allFindings.filter((finding) => filter === 'all' || finding.severity === filter)
  const severityCounts = severities.reduce<Record<AnalysisFinding['severity'], number>>((counts, severity) => ({
    ...counts,
    [severity]: allFindings.filter((finding) => finding.severity === severity).length,
  }), { critical: 0, high: 0, medium: 0, low: 0 })
  const causeCounts = causes.reduce<Record<Defect['cause'], number>>((counts, cause) => ({
    ...counts,
    [cause.value]: allFindings.filter((finding) => (finding.suggestedCause ?? 'other') === cause.value).length,
  }), { code_defect: 0, requirement_change: 0, external_dependency: 0, other: 0 })
  const findingsByFile = Array.from(findings.reduce((groups, finding) => {
    const fileFindings = groups.get(finding.filePath) ?? []
    fileFindings.push(finding)
    groups.set(finding.filePath, fileFindings)
    return groups
  }, new Map<string, AnalysisFinding[]>()).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, fileFindings]) => [filePath, fileFindings.sort((left, right) => left.line - right.line)] as const)
  const scanTask = tasks.find((task) => task._id === scan?.taskId)
  const canSendAssignment = Boolean(scanTask && ['completed', 'closed'].includes(scanTask.status))
  return <section className="workflow-grid">
    <article className="surface workflow-form">
      <div className="section-heading"><div><h2>Analyze project</h2><p>Static checks identify potential issues; a Team Lead must verify every finding.</p></div></div>
      <p className="analysis-privacy-note">Local AI suggestions are generated on your configured local Ollama service. Uploaded code is never executed; AI findings always require human review.</p>
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
      {scan && <div className="analysis-scan-meta">
        <span className="analysis-scan-pill">Static checks · {scan.findings.filter((finding) => (finding.source ?? 'static') === 'static').length}</span>
        <span className={`analysis-scan-pill ${scan.aiStatus === 'failed' ? 'analysis-scan-warning' : ''}`}>Local AI · {scan.aiStatus ?? 'not recorded'}</span>
        {scan.aiStatus === 'completed' && <span className="analysis-scan-detail">Reviewed {scan.aiFilesAnalyzed ?? 0} of {scan.filesAnalyzed} files{(scan.aiFilesSkipped ?? 0) > 0 ? ` · ${scan.aiFilesSkipped} skipped by safety limit` : ''}{(scan.aiRejectedFindings ?? 0) > 0 ? ` · ${scan.aiRejectedFindings} unverified outputs discarded` : ''}</span>}
      </div>}
      {scan?.status === 'queued' || scan?.status === 'running' ? <div className="empty-data">Scan {scan.status}. Static checks run first; local AI then reviews bounded source chunks without executing uploaded code.</div> : null}
      {scan?.status === 'failed' ? <div className="empty-data">Analysis failed: {scan.errorMessage ?? 'Unknown error'}</div> : null}
      {scan?.aiStatus === 'failed' && <div className="analysis-ai-warning" role="status">Local AI review failed: {scan.aiError ?? 'The local model did not complete.'} Static findings are still available.</div>}
      {scan?.aiStatus === 'skipped' && scan.status === 'completed' && <div className="analysis-scan-detail">Local AI review is disabled; the static report is complete.</div>}
      {scan?.status === 'completed' && !findings.length ? <div className="empty-data">No findings matched this filter. This does not guarantee the project is bug-free.</div> : null}
      {scan?.status === 'completed' && allFindings.length > 0 && <div className="analysis-summary" aria-label="Finding severity summary">
        {severities.map((severity) => <span key={severity} className={`analysis-summary-item analysis-summary-${severity}`}>{severity}<strong>{severityCounts[severity]}</strong></span>)}
      </div>}
      {scan?.status === 'completed' && allFindings.length > 0 && <section className="analysis-cause-summary" aria-label="Predicted cause summary">
        <h3>Predicted cause</h3>
        <div className="analysis-summary">
          {causes.map((cause) => <span key={cause.value} className="analysis-summary-item">{cause.label}<strong>{causeCounts[cause.value]}</strong></span>)}
        </div>
        <small>Cause categories are suggestions and should be verified during review.</small>
      </section>}
      {scan?.status === 'completed' && findingsByFile.map(([filePath, fileFindings]) => <section className="analysis-file-group" key={filePath}>
        <h3>{filePath}<span>{fileFindings.length} finding{fileFindings.length === 1 ? '' : 's'}</span></h3>
        {fileFindings.map((finding) => <div className="analysis-finding" key={finding._id}>
          <div className="analysis-finding-header"><strong>{finding.title}</strong><span className={`status status-${finding.severity === 'critical' || finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'success'}`}><i />{finding.severity}</span></div>
          <div className="analysis-finding-meta"><small>{finding.filePath}:{finding.line} · {finding.status.replaceAll('_', ' ')}</small><span className={`analysis-origin analysis-origin-${finding.source ?? 'static'}`}>{finding.source === 'local_ai' ? 'Local AI suggestion' : 'Static rule'}</span>{finding.confidence !== undefined && <span className="analysis-confidence">Confidence {finding.confidence}/10</span>}</div>
          <small className="analysis-suggested-cause">Probable cause: {causes.find(({ value }) => value === finding.suggestedCause)?.label ?? 'Other'}</small>
          <p>{finding.description}</p>
          <code>{finding.evidence}</code>
          <small>Suggested investigation: {finding.suggestion}</small>
          {canReview && finding.status === 'needs_review' && <div className="analysis-review">
            <input value={reviewReason[finding._id] ?? ''} onChange={(event) => setReviewReason((current) => ({ ...current, [finding._id]: event.target.value }))} placeholder="Evidence-based review reason" />
            <div className="workflow-actions"><button className="icon-button workflow-approve" disabled={submittingFinding === finding._id} onClick={() => void review(finding, 'confirmed_bug')}>Confirm bug</button><button className="icon-button" disabled={submittingFinding === finding._id} onClick={() => void review(finding, 'false_positive')}>False positive</button><button className="icon-button" disabled={submittingFinding === finding._id} onClick={() => void review(finding, 'needs_information')}>Needs info</button><button className="icon-button" disabled={submittingFinding === finding._id} onClick={() => void review(finding, 'accepted_risk')}>Accepted risk</button></div>
            <div className="analysis-direct-assignment">
              <h4>Direct debug assignment</h4>
              <label>Cause of error<select aria-label={`Cause of error for ${finding.title}`} value={findingCauses[finding._id] ?? finding.suggestedCause ?? 'code_defect'} onChange={(event) => setFindingCauses((current) => ({ ...current, [finding._id]: event.target.value as Defect['cause'] }))}>{causes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Debug instructions for {scanTask?.assigneeName ?? 'the assigned employee'}<textarea value={debugInstructions[finding._id] ?? finding.suggestion} onChange={(event) => setDebugInstructions((current) => ({ ...current, [finding._id]: event.target.value }))} maxLength={4000} rows={3} /></label>
              <button className="export-button" disabled={submittingFinding === finding._id || !canSendAssignment} onClick={() => void confirmAndSend(finding)}>{submittingFinding === finding._id ? 'Sending assignment…' : 'Confirm and send debug assignment'}</button>
              {!canSendAssignment && <small>The associated task must be completed before a debug assignment can be sent.</small>}
            </div>
          </div>}
          {canReview && finding.status === 'confirmed_bug' && !finding.defectId && <div className="analysis-review analysis-create-defect">
            <label>Cause of error<select aria-label={`Cause of error for ${finding.title}`} value={findingCauses[finding._id] ?? finding.suggestedCause ?? 'code_defect'} onChange={(event) => setFindingCauses((current) => ({ ...current, [finding._id]: event.target.value as Defect['cause'] }))}>{causes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Debug instructions for {scanTask?.assigneeName ?? 'the assigned employee'}<textarea value={debugInstructions[finding._id] ?? finding.suggestion} onChange={(event) => setDebugInstructions((current) => ({ ...current, [finding._id]: event.target.value }))} maxLength={4000} rows={3} /></label>
            <button className="export-button" disabled={submittingFinding === finding._id} onClick={() => void createDefect(finding)}>{submittingFinding === finding._id ? 'Sending assignment…' : 'Send debug assignment'}</button>
          </div>}
          {finding.defectId && <small className="analysis-linked">Linked defect: {finding.defectId}</small>}
        </div>)}
      </section>)}
      {!scan && <div className="empty-data">Upload a ZIP to create the first report. Previous scans remain available for comparison.</div>}
    </article>
  </section>
}
