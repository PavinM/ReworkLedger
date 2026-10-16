const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const TOKEN_KEY = 'reworkledger.auth.token'

export type Project = {
  _id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  managerId: string
  createdAt: string
  updatedAt: string
}

export type Task = {
  _id: string
  projectId: string
  title: string
  description?: string
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
  title: string
  description?: string
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
  logout: () => window.localStorage.removeItem(TOKEN_KEY),
  listProjects: (signal?: AbortSignal) => request<Project[]>('/api/projects', { signal }),
  listTasks: (projectId?: string, signal?: AbortSignal) => request<Task[]>(`/api/tasks${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, { signal }),
  updateTaskStatus: (taskId: string, status: Task['status']) => request<Task>(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  listDefects: (projectId?: string, signal?: AbortSignal) => request<Defect[]>(`/api/defects${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`, { signal }),
  reportDefect: (payload: Pick<Defect, 'taskId' | 'title' | 'description' | 'severity' | 'cause' | 'reportedBy'>) => request<Defect>('/api/defects', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  reviewDefect: (defectId: string, payload: Pick<Defect, 'status' | 'reviewedBy' | 'reviewReason'>) => request<Defect>(`/api/defects/${defectId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
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
  calculatePayroll: (payload: { employeeId: string; periodStart: string; periodEnd: string; currency: string; configuredHourlyRate: number }) => request<PayrollAdjustment>('/api/payroll/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  reviewPayroll: (adjustmentId: string, payload: { status: 'approved' | 'rejected'; reviewedBy: string; reviewReason?: string }) => request<PayrollAdjustment>(`/api/payroll/${adjustmentId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
}
