const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const TOKEN_KEY = 'reworkledger.auth.token'

export type Project = {
  _id: string
  name: string
  description?: string
  githubUrl?: string
  deadline?: string
  assignedEmployeeId?: string
  status: 'active' | 'completed' | 'archived'
  managerId: string
  createdAt: string
  updatedAt: string
}

export type Task = {
  _id: string
  projectId: string
  title: string
  module: string
  description?: string
  debugInstructions?: string
  resolutionDescription?: string
  resolutionEvidence?: string
  progressDescription?: string
  reviewStatus: 'not_submitted' | 'submitted' | 'changes_requested' | 'accepted'
  reviewReason?: string
  reviewedBy?: string
  assigneeId: string
  assigneeName: string
  status: 'assigned' | 'in_progress' | 'completed' | 'reopened' | 'under_fix' | 'closed'
  originalCompletedAt?: string
  currentCompletedAt?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type Defect = {
  _id: string
  taskId: string
  projectId: string
  analysisScanId?: string
  analysisFindingId?: string
  title: string
  module: string
  description?: string
  debugInstructions?: string
  resolutionDescription?: string
  resolutionEvidence?: string
  resolutionHours?: number
  resolutionSubmittedAt?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  cause: 'code_defect' | 'requirement_change' | 'external_dependency' | 'other'
  status: 'reported' | 'under_review' | 'approved' | 'exempted' | 'resolved'
  reportedBy: string
  reviewedBy?: string
  reviewReason?: string
  createdAt: string
  updatedAt: string
}

export type TimeEntry = {
  _id: string
  taskId: string
  defectId?: string
  employeeId: string
  date: string
  hours: number
  description?: string
  category: 'regular_work' | 'corrective_work'
  approvalStatus: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
  reviewReason?: string
  payrollAdjustmentId?: string
  createdAt: string
  updatedAt: string
}

export type PayrollAdjustment = {
  _id: string
  employeeId: string
  periodStart: string
  periodEnd: string
  currency: string
  approvedTimeEntryIds: string[]
  eligibleCorrectiveHours: number
  configuredHourlyRate: number
  proposedAmount: number
  baseSalary: number
  nextMonthSalary: number
  adjustmentType: 'credit' | 'debit' | 'none'
  calculationBreakdown: Array<{
    timeEntryId: string
    taskId: string
    defectId: string
    date: string
    hours: number
    hourlyRate: number
    amount: number
  }>
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'voided'
  reviewedBy?: string
  reviewedAt?: string
  reviewReason?: string
  createdAt: string
  updatedAt: string
}

export type AuthUser = { id: string; name: string; email: string; role: 'employee' | 'manager' | 'admin' }
export type DirectoryEmployee = { id: string; name: string; email: string }
export type ManagedUser = { id: string; name: string; email: string; role: AuthUser['role']; active: boolean; createdAt: string; updatedAt: string }
export type AnalysisFinding = {
  _id: string
  ruleId: string
  tool: string
  title: string
  description: string
  filePath: string
  line: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'needs_review' | 'confirmed_bug' | 'false_positive' | 'needs_information' | 'accepted_risk'
  evidence: string
  suggestion: string
  reviewedBy?: string
  reviewReason?: string
  defectId?: string
}
export type AnalysisScan = {
  _id: string
  taskId: string
  projectId: string
  uploadedBy: string
  sourceName: string
  versionRef?: string
  expectedBehavior?: string
  description?: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  errorMessage?: string
  filesAnalyzed: number
  totalFindings: number
  findings: AnalysisFinding[]
  createdAt: string
  updatedAt: string
}
export type AuditLog = {
  _id: string
  actorId?: string
  entityType: 'TimeEntry' | 'PayrollAdjustment'
  entityId: string
  action: string
  timestamp: string
  before?: unknown
  after?: unknown
  reason?: string
}

type ApiEnvelope<T> = { data: T }

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isErrorPayload(payload) ? payload.error.message : `Request failed (${response.status})`
    throw new ApiError(response.status, message)
  }
  if (!isDataEnvelope<T>(payload)) throw new ApiError(response.status, 'The API returned an invalid response')
  return payload.data
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = window.localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isErrorPayload(payload) ? payload.error.message : `Request failed (${response.status})`
    throw new ApiError(response.status, message)
  }
  if (!isDataEnvelope<T>(payload)) throw new ApiError(response.status, 'The API returned an invalid response')
  return payload.data
}

function isErrorPayload(payload: unknown): payload is { error: { message: string } } {
  return typeof payload === 'object' && payload !== null && 'error' in payload
    && typeof payload.error === 'object' && payload.error !== null && 'message' in payload.error
    && typeof payload.error.message === 'string'
}

function isDataEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return typeof payload === 'object' && payload !== null && 'data' in payload
}

export const api = {
  getToken: () => window.localStorage.getItem(TOKEN_KEY),
  login: async (email: string, password: string) => {
    const data = await request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    window.localStorage.setItem(TOKEN_KEY, data.token)
    return data.user
  },
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  updateOwnProfile: (payload: { currentPassword: string; name?: string; email?: string; newPassword?: string }) => request<{ user: AuthUser }>('/api/auth/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  listUsers: () => request<ManagedUser[]>('/api/auth/users'),
  createStaff: (payload: { name: string; email: string; password: string; role: 'employee' | 'manager' }) => request<{ user: AuthUser }>('/api/auth/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateUserStatus: (userId: string, active: boolean) => request<{ user: ManagedUser }>(`/api/auth/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  }),
  logout: () => window.localStorage.removeItem(TOKEN_KEY),
  listProjects: (signal?: AbortSignal) => request<Project[]>('/api/projects', { signal }),
  listEmployees: () => request<DirectoryEmployee[]>('/api/projects/employees'),
  createProject: (payload: { name: string; description?: string; status?: Project['status']; managerId: string; githubUrl?: string; deadline?: string; assignedEmployeeId?: string }) => request<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  listTasks: (projectId?: string, signal?: AbortSignal) => request<Task[]>(`/api/tasks${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, { signal }),
  createTask: (payload: { projectId: string; title: string; description?: string; assigneeId: string; assigneeName: string; createdBy: string }) => request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateTaskStatus: (taskId: string, status: Task['status']) => request<Task>(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  updateTaskProgress: (taskId: string, progressDescription: string) => request<Task>(`/api/tasks/${taskId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ progressDescription }),
  }),
  submitTaskForReview: (taskId: string) => request<Task>(`/api/tasks/${taskId}/submit-review`, { method: 'POST' }),
  reviewTask: (taskId: string, reviewStatus: 'changes_requested' | 'accepted', reviewReason: string) => request<Task>(`/api/tasks/${taskId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ reviewStatus, reviewReason }),
  }),
  listDefects: (projectId?: string, signal?: AbortSignal) => request<Defect[]>(`/api/defects${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, { signal }),
  reportDefect: (payload: Pick<Defect, 'taskId' | 'module' | 'title' | 'description' | 'debugInstructions' | 'severity' | 'cause' | 'reportedBy'>) => request<Defect>('/api/defects', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  reviewDefect: (defectId: string, payload: Pick<Defect, 'status' | 'reviewedBy' | 'reviewReason'>) => request<Defect>(`/api/defects/${defectId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  submitDefectResolution: (defectId: string, payload: { resolutionDescription: string; resolutionEvidence: string; resolutionHours: number }) => request<Defect>(`/api/defects/${defectId}/resolve`, { method: 'PATCH', body: JSON.stringify(payload) }),
  acceptDefectResolution: (defectId: string, reviewReason?: string) => request<Defect>(`/api/defects/${defectId}/accept-resolution`, { method: 'PATCH', body: JSON.stringify({ reviewReason }) }),
  recordResolvedDefectHours: (defectId: string, payload: { hours: number; reviewReason: string }) => request<{ defect: Defect; adjustment: PayrollAdjustment }>(`/api/defects/${defectId}/resolution-hours`, { method: 'PATCH', body: JSON.stringify(payload) }),
  listAnalysisScans: (taskId: string, signal?: AbortSignal) => request<AnalysisScan[]>(`/api/analysis/tasks/${taskId}/scans`, { signal }),
  uploadAnalysis: (taskId: string, payload: { project: File; versionRef?: string; expectedBehavior?: string; description?: string }) => {
    const formData = new FormData()
    formData.append('project', payload.project)
    if (payload.versionRef) formData.append('versionRef', payload.versionRef)
    if (payload.expectedBehavior) formData.append('expectedBehavior', payload.expectedBehavior)
    if (payload.description) formData.append('description', payload.description)
    return upload<AnalysisScan>(`/api/analysis/tasks/${taskId}/scans`, formData)
  },
  reviewAnalysisFinding: (scanId: string, findingId: string, payload: { status: AnalysisFinding['status']; reviewReason: string }) => request<AnalysisScan>(`/api/analysis/scans/${scanId}/findings/${findingId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  createDefectFromFinding: (scanId: string, findingId: string, cause: Defect['cause']) => request<Defect>(`/api/analysis/scans/${scanId}/findings/${findingId}/defect`, {
    method: 'POST',
    body: JSON.stringify({ cause }),
  }),
  listTimeEntries: (filters?: { employeeId?: string; taskId?: string; defectId?: string; approvalStatus?: TimeEntry['approvalStatus']; startDate?: string; endDate?: string }, signal?: AbortSignal) => {
    const query = new URLSearchParams(Object.entries(filters ?? {}).filter(([, value]) => value !== undefined) as Array<[string, string]>).toString()
    return request<TimeEntry[]>(`/api/time-entries${query ? `?${query}` : ''}`, { signal })
  },
  createTimeEntry: (payload: Pick<TimeEntry, 'taskId' | 'defectId' | 'employeeId' | 'date' | 'hours' | 'description' | 'category'>) => request<TimeEntry>('/api/time-entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  reviewTimeEntry: (entryId: string, payload: Pick<TimeEntry, 'approvalStatus' | 'reviewedBy' | 'reviewReason'>) => request<TimeEntry>(`/api/time-entries/${entryId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  listPayroll: (signal?: AbortSignal) => request<PayrollAdjustment[]>('/api/payroll', { signal }),
  listAudit: (signal?: AbortSignal) => request<AuditLog[]>('/api/audit-logs', { signal }),
  calculatePayroll: (payload: { employeeId: string; periodStart: string; periodEnd: string; currency: string; configuredHourlyRate: number; baseSalary: number }) => request<PayrollAdjustment>('/api/payroll/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  reviewPayroll: (adjustmentId: string, payload: { status: 'approved' | 'rejected'; reviewedBy: string; reviewReason?: string }) => request<PayrollAdjustment>(`/api/payroll/${adjustmentId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
}
