import { lazy, Suspense, useEffect, useState, type ReactNode, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Command,
  FileClock,
  FolderKanban,
  Gauge,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Timer,
  X,
  Zap,
  ScanSearch,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { api, type AuditLog, type AuthUser, type Defect as ApiDefect, type ManagedUser, type PayrollAdjustment, type Project, type Task, type TimeEntry } from './lib/api'
import { TimeTrackingPanel } from './components/TimeTrackingPanel'
import { PayrollReviewPanel } from './components/PayrollReviewPanel'
import { AuditPanel, DefectsPanel, ProjectsTasksPanel } from './components/WorkflowPanels'
import { AnalysisPanel } from './components/AnalysisPanel'
import { MarketingPage } from './components/MarketingPage'
import type { ReworkPoint } from './components/ReworkChart'
import './App.css'

const ReworkChart = lazy(() => import('./components/ReworkChart'))

type IconComponent = typeof LayoutDashboard
type LoginRole = AuthUser['role']
type NavItem = { label: string; icon: IconComponent; badge?: string }
const roleLabels: Record<LoginRole, string> = { employee: 'Employee', manager: 'Manager', admin: 'Administrator' }
const primaryNav: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Defects', icon: AlertCircle },
]

const intelligenceNav: NavItem[] = [
  { label: 'Code analysis', icon: ScanSearch },
  { label: 'Salary adjustments', icon: FileClock },
  { label: 'Quality intelligence', icon: Gauge },
  { label: 'Audit trail', icon: ShieldCheck },
]

function navigationForRole(role: LoginRole): NavItem[] {
  if (role === 'employee') {
    return [
      primaryNav[0],
      primaryNav[1],
      intelligenceNav[0],
      primaryNav[2],
      intelligenceNav[1],
    ]
  }
  if (role === 'manager') {
    return [...primaryNav, intelligenceNav[0], intelligenceNav[1], intelligenceNav[2], intelligenceNav[3]]
  }
  return [...primaryNav, ...intelligenceNav]
}

const severityClass: Record<ApiDefect['severity'], string> = {
  critical: 'badge-danger',
  high: 'badge-warning',
  medium: 'badge-lime',
  low: 'badge-success',
}

const statusClass: Record<ApiDefect['status'], string> = {
  reported: 'status-danger',
  under_review: 'status-warning',
  approved: 'status-success',
  exempted: 'status-warning',
  resolved: 'status-success',
}

type AnalyticsRange = '14' | '30' | 'quarter'

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date {
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (datePart) return new Date(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3]))
  return new Date(value)
}

function analyticsRangeStart(range: AnalyticsRange, now = new Date()): Date {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return range === 'quarter'
    ? new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1)
    : new Date(end.getFullYear(), end.getMonth(), end.getDate() - (Number(range) - 1))
}

function isInAnalyticsRange(value: string, range: AnalyticsRange, now = new Date()): boolean {
  const date = parseLocalDate(value)
  if (!Number.isFinite(date.getTime())) return false
  const key = localDateKey(date)
  const todayKey = localDateKey(now)
  return key >= localDateKey(analyticsRangeStart(range, now)) && key <= todayKey
}

function buildReworkChartData(entries: TimeEntry[], range: AnalyticsRange, now = new Date()): ReworkPoint[] {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = analyticsRangeStart(range, now)
  const hoursByDate = new Map<string, number>()
  for (const entry of entries) {
    if (entry.category !== 'corrective_work') continue
    const entryDate = parseLocalDate(entry.date)
    if (!Number.isFinite(entryDate.getTime())) continue
    const key = localDateKey(entryDate)
    if (key < localDateKey(start) || key > localDateKey(end)) continue
    hoursByDate.set(key, (hoursByDate.get(key) ?? 0) + entry.hours)
  }

  const points: ReworkPoint[] = []
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const key = localDateKey(date)
    points.push({
      date: key,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      hours: hoursByDate.get(key) ?? 0,
      average: 0,
    })
  }
  const average = points.length ? points.reduce((total, point) => total + point.hours, 0) / points.length : 0
  return points.map((point) => ({ ...point, average }))
}

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginRole, setLoginRole] = useState<LoginRole>('employee')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activePage, setActivePage] = useState('Overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [project, setProject] = useState('All projects')
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('14')
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [liveDefects, setLiveDefects] = useState<ApiDefect[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [payrollAdjustments, setPayrollAdjustments] = useState<PayrollAdjustment[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (api.getToken()) {
      fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/auth/me`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      }).then((response) => response.ok ? response.json() : Promise.reject(new Error('Session expired')))
        .then((payload: { data: { user: AuthUser } }) => setAuthUser(payload.data.user))
        .catch(() => api.logout())
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!authUser) return undefined
    const controller = new AbortController()
    const selectedProject = project === 'All projects' ? undefined : project
    const payrollRequest = api.listPayroll(controller.signal)
    const auditRequest = authUser.role === 'employee' ? Promise.resolve<AuditLog[]>([]) : api.listAudit(controller.signal)
    Promise.all([
      api.listProjects(controller.signal),
      api.listTasks(selectedProject, controller.signal),
      api.listDefects(selectedProject, controller.signal),
      api.listTimeEntries(undefined, controller.signal),
      payrollRequest,
      auditRequest,
    ]).then(([nextProjects, nextTasks, nextDefects, nextTimeEntries, nextPayroll, nextAudit]) => {
      setDataError('')
      setProjects(nextProjects)
      setTasks(nextTasks)
      setLiveDefects(nextDefects)
      setTimeEntries(nextTimeEntries)
      setPayrollAdjustments(nextPayroll ?? [])
      setAuditLogs(nextAudit ?? [])
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setDataError(error instanceof Error ? error.message : 'Unable to load workspace data')
    }).finally(() => {
      if (!controller.signal.aborted) setDataLoading(false)
    })
    return () => controller.abort()
  }, [authUser, project, refreshToken])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activePage])

  useEffect(() => {
    if (!authUser) return undefined
    let frame = 0
    const updateBackdrop = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--workspace-scroll-shift', `${Math.round(window.scrollY * -0.12)}px`)
      })
    }
    updateBackdrop()
    window.addEventListener('scroll', updateBackdrop, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateBackdrop)
      cancelAnimationFrame(frame)
      document.documentElement.style.removeProperty('--workspace-scroll-shift')
    }
  }, [authUser])

  const navigate = (label: string) => {
    setActivePage(label)
    setMobileNavOpen(false)
  }

  const retryData = () => setRefreshToken((value) => value + 1)
  const logout = () => {
    api.logout()
    setAuthUser(null)
    setShowProfile(false)
    setToast('')
    setProjects([])
    setTasks([])
    setLiveDefects([])
    setTimeEntries([])
    setPayrollAdjustments([])
    setAuditLogs([])
  }
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      setAuthUser(await api.login(loginEmail, loginPassword, loginRole))
      setActivePage('Overview')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in')
    } finally {
      setLoggingIn(false)
    }
  }
  const rangeDefects = liveDefects.filter((defect) => isInAnalyticsRange(defect.createdAt, analyticsRange))
  const projectTaskIds = new Set(tasks.filter((task) => project === 'All projects' || task.projectId === project).map((task) => task._id))
  const rangeTimeEntries = timeEntries.filter((entry) =>
    projectTaskIds.has(entry.taskId) && isInAnalyticsRange(entry.date, analyticsRange))
  const projectNames = new Map(projects.map((item) => [item._id, item.name]))
  const qualityGroups = rangeDefects.reduce((groups, defect) => {
    const existing = groups.get(defect.projectId) ?? {
      projectId: defect.projectId,
      name: projectNames.get(defect.projectId) ?? `Project ${defect.projectId.slice(-8)}`,
      defects: 0,
      openDefects: 0,
      correctiveHours: 0,
    }
    existing.defects += 1
    if (!['resolved', 'exempted'].includes(defect.status)) existing.openDefects += 1
    groups.set(defect.projectId, existing)
    return groups
  }, new Map<string, { projectId: string; name: string; defects: number; openDefects: number; correctiveHours: number }>())
  const projectByTaskId = new Map(tasks.map((task) => [task._id, task.projectId]))
  for (const entry of rangeTimeEntries) {
    if (entry.category !== 'corrective_work' || entry.approvalStatus !== 'approved') continue
    const projectId = projectByTaskId.get(entry.taskId)
    const group = projectId ? qualityGroups.get(projectId) : undefined
    if (group) group.correctiveHours += entry.hours
  }
  const maxProjectDefects = Math.max(0, ...Array.from(qualityGroups.values(), (group) => group.defects))
  const qualitySignals = Array.from(qualityGroups.values())
    .sort((left, right) => right.defects - left.defects || left.name.localeCompare(right.name))
    .slice(0, 5)
    .map((group) => ({ ...group, width: maxProjectDefects ? (group.defects / maxProjectDefects) * 100 : 0 }))
  const reworkChartData = buildReworkChartData(rangeTimeEntries, analyticsRange)
  const reworkTotal = reworkChartData.reduce((total, point) => total + point.hours, 0)
  const pendingReviewCount = timeEntries.filter((entry) => entry.approvalStatus === 'pending').length
    + payrollAdjustments.filter((adjustment) => adjustment.status === 'pending_review').length
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const profileInitials = authUser ? authUser.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() : ''
  const profileRole = authUser ? roleLabels[authUser.role] : ''
  const visibleNavigation = authUser ? navigationForRole(authUser.role) : []

  if (!authUser && !showLogin) return <MarketingPage onLogin={() => {
    setLoginError('')
    setShowLogin(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }} />

  if (!authUser) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submitLogin}>
        <button type="button" className="auth-back-link" onClick={() => { setLoginError(''); setShowLogin(false) }}>← Back to ReworkLedger</button>
        <div className="brand-lockup"><div className="brand-mark"><span>R</span></div><span className="brand-name">Rework<span>Ledger</span></span></div>
        <div className="auth-intro"><span className="eyebrow">SECURE WORKSPACE</span><h1>Sign in to ReworkLedger</h1><p>Use your organization account to continue.</p></div>
        <fieldset className="role-picker">
          <legend>Sign in as</legend>
          <div className="role-options">
            {([
              { role: 'employee', label: 'Employee', description: 'Track assigned work and report progress.', icon: ClipboardCheck },
              { role: 'manager', label: 'Manager', description: 'Manage projects, reviews, and quality.', icon: Gauge },
              { role: 'admin', label: 'Administrator', description: 'Manage workspace users and settings.', icon: ShieldCheck },
            ] as const).map(({ role, label, description, icon: RoleIcon }) => (
              <button
                key={role}
                type="button"
                className={`role-option${loginRole === role ? ' role-option-selected' : ''}`}
                aria-pressed={loginRole === role}
                onClick={() => setLoginRole(role)}
              >
                <span className="role-icon"><RoleIcon size={16} /></span>
                <span className="role-copy"><strong>{label}</strong><small>{description}</small></span>
                <span className="role-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>
        <label>Email<input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required /></label>
        {loginError && <div className="inline-error">{loginError}</div>}
        <button className="primary-button auth-submit" disabled={loggingIn}>{loggingIn ? 'Signing in…' : 'Sign in'}</button>
        <small className="auth-footnote">Your role is verified by the server after authentication.</small>
      </form>
    </main>
  )

  return (
    <div className={`app-shell theme-light role-${authUser.role}`}>
      <div key={activePage} className="workspace-backdrop page-transition" aria-hidden="true" />
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation"><Menu size={19} /></button>
            <div className="brand-lockup"><div className="brand-mark"><span>R</span></div><span className="brand-name">Rework<span>Ledger</span></span></div>
            <nav className={`top-nav ${mobileNavOpen ? 'top-nav-open' : ''}`} aria-label="Application navigation">
              {visibleNavigation.map((item) => <NavButton key={item.label} item={item} active={activePage === item.label} expanded onClick={() => navigate(item.label)} />)}
            </nav>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setCommandOpen(true)} aria-label="Search workspace" title="Search workspace"><Search size={18} /></button>
            <div className="popover-wrap"><button className="icon-button notification-button" onClick={() => setShowNotifications(!showNotifications)} aria-expanded={showNotifications} aria-label={`Notifications${pendingReviewCount ? `, ${pendingReviewCount} pending reviews` : ''}`}><Bell size={17} />{pendingReviewCount > 0 && <span className="notification-dot" />}</button>{showNotifications && <Popover title="Pending reviews"><p>{pendingReviewCount ? `${pendingReviewCount} time or salary review${pendingReviewCount === 1 ? '' : 's'} are waiting.` : 'There are no pending reviews.'}</p>{pendingReviewCount > 0 && <button onClick={() => { navigate('Salary adjustments'); setShowNotifications(false) }}>Review pending items</button>}</Popover>}</div>
            <div className="popover-wrap"><button className="top-profile" onClick={() => setShowProfile(!showProfile)} aria-expanded={showProfile}><span className="avatar avatar-lime">{profileInitials}</span><span className="profile-name">{authUser.name}</span><ChevronDown size={13} /></button>{showProfile && <Popover title={authUser.name}><p>{profileRole} · {authUser.email}</p><button onClick={() => { setActivePage('Settings'); setShowProfile(false) }}>Open account settings</button></Popover>}</div>
            <button className="logout-button topbar-logout" onClick={logout}><LogOut size={13} /><span>Log out</span></button>
          </div>
        </header>

        <div className="page-content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activePage}
              className="page-view"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
              transition={reduceMotion ? { duration: 0 } : { duration: .28, ease: 'easeOut' }}
            >
          {activePage === 'Overview' && <><motion.section className="page-heading" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
            <div><span className="eyebrow">{todayLabel}</span><h1>Welcome, {authUser.name}</h1><p>Here is your live quality and corrective-work overview.</p></div>
            <div className="header-actions"><label className="select-control"><span>Project</span><select value={project} onChange={(event) => setProject(event.target.value)} aria-label="Filter by project"><option>All projects</option>{projects.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select><ChevronDown size={13} /></label><label className="select-control"><span>Date range</span><select value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value as AnalyticsRange)} aria-label="Filter dashboard by date range"><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="quarter">This quarter</option></select><ChevronDown size={13} /></label></div>
          </motion.section>

          <section className="overview-strip" aria-label="Quality overview">
            <OverviewMetric label="Completed projects" value={dataLoading ? '…' : String(projects.filter((item) => item.status === 'completed').length)} note="Accepted project deliveries" icon={Timer} accent="lime" />
            <OverviewMetric label="Open defects" value={dataLoading ? '…' : String(liveDefects.filter((defect) => !['resolved', 'exempted'].includes(defect.status)).length)} note="Live from defect API" icon={AlertCircle} accent="danger" />
            <OverviewMetric label="Projects" value={dataLoading ? '…' : String(projects.length)} note="Live from project API" icon={ClipboardCheck} accent="amber" />
            <OverviewMetric label="Salary adjustments" value={dataLoading ? '…' : String(payrollAdjustments.length)} note="Automatic next-month changes" icon={Zap} accent="neutral" />
          </section>

          {dataError && <div className="api-error" role="alert"><span>Unable to load live workspace data: {dataError}</span><button onClick={retryData}>Retry</button></div>}

          <section className="insight-grid">
            <motion.article className="surface analytics-surface" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>
              <SectionHeading title="Rework analytics" subtitle="Daily corrective hours recorded in time tracking." action={<label className="small-select"><select aria-label="Analytics period" value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value as AnalyticsRange)}><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="quarter">This quarter</option></select><ChevronDown size={12} /></label>} />
              <div className="chart-meta"><span><i className="legend-line legend-accent" /> Rework hours</span><span><i className="legend-line legend-threshold" /> Period average</span><strong>{reworkTotal.toFixed(2)}h <small>total</small></strong></div>
              <div className="chart-container" role="img" aria-label={`Daily corrective hours chart, ${reworkTotal.toFixed(2)} hours total`}>
                {dataLoading
                  ? <EmptyData loading message="Loading corrective time entries." />
                  : <Suspense fallback={<EmptyData loading message="Loading chart…" />}><ReworkChart data={reworkChartData} /></Suspense>}
              </div>
              {!dataLoading && reworkTotal === 0 && <p className="chart-empty-note">No corrective work entries in this date range.</p>}
            </motion.article>
            <motion.article className="surface module-surface" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .14 }}>
              <SectionHeading title="Quality signals" subtitle="Projects ranked by defects, with approved rework hours and open issues." action={<button className="plain-action" onClick={() => navigate('Quality intelligence')}>View intelligence <ArrowUpRight size={13} /></button>} />
              <div className="module-list">
                {qualitySignals.length ? qualitySignals.map((signal, index) => <div className="module-row" key={signal.projectId}>
                  <span className="module-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div className="module-info"><strong title={signal.name}>{signal.name}</strong><div className="module-bar"><i style={{ width: `${signal.width}%` }} /></div></div>
                  <span className="module-defects">{signal.defects}<small> defects</small></span>
                  <span className="module-hours" title="Approved corrective work">{signal.correctiveHours.toFixed(1)}h</span>
                  <span className={`module-trend ${signal.openDefects ? '' : 'trend-down'}`}>{signal.openDefects} open</span>
                </div>) : <EmptyData loading={dataLoading} message="No defect signals available yet." />}
              </div>
            </motion.article>
          </section>

          <section className="lower-grid">
            <article className="surface defects-surface"><SectionHeading title="Recent defects" subtitle={`Latest defects · ${analyticsRange === 'quarter' ? 'this quarter' : `last ${analyticsRange} days`}.`} action={<button className="plain-action" onClick={() => navigate('Defects')}>View all <ArrowUpRight size={13} /></button>} /><div className="table-scroll"><table><thead><tr><th scope="col">Defect</th><th scope="col">Project</th><th scope="col">Severity</th><th scope="col">Task</th><th scope="col">Discovered</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{rangeDefects.length ? rangeDefects.slice(0, 5).map((defect) => <tr key={defect._id}><td><div className="defect-cell"><strong>{defect._id.slice(-8)}</strong><span>{defect.title}</span></div></td><td className="secondary-cell">{defect.projectId.slice(-8)}</td><td><span className={`badge ${severityClass[defect.severity]}`}><i />{defect.severity}</span></td><td><span className="secondary-cell">{defect.taskId.slice(-8)}</span></td><td className="secondary-cell">{new Date(defect.createdAt).toLocaleDateString()}</td><td><span className={`status ${statusClass[defect.status]}`}><i />{defect.status.replace('_', ' ')}</span></td><td><button className="icon-button" aria-label={`More actions for ${defect._id}`}><MoreHorizontal size={15} /></button></td></tr>) : <tr><td colSpan={7}><EmptyData loading={dataLoading} message="No defects found in this date range." /></td></tr>}</tbody></table></div></article>
            <article className="surface approvals-surface"><SectionHeading title="Corrective time & salary" subtitle="Corrective work and its review status for this date range." action={<button className="plain-action" onClick={() => navigate('Salary adjustments')}>View adjustments <ArrowUpRight size={13} /></button>} /><div className="approval-list">{rangeTimeEntries.filter((entry) => entry.category === 'corrective_work').slice(0, 3).map((entry) => <div className="approval-row" key={entry._id}><div className="avatar avatar-xs avatar-lime">{entry.employeeId.slice(-2).toUpperCase()}</div><div className="approval-copy"><strong>{entry.hours.toFixed(2)}h corrective work</strong><small>{entry.approvalStatus} · defect {entry.defectId?.slice(-8) ?? '—'}</small></div><span className={`status ${entry.approvalStatus === 'approved' ? 'status-success' : entry.approvalStatus === 'rejected' ? 'status-danger' : 'status-warning'}`}><i />{entry.approvalStatus}</span></div>)}{!rangeTimeEntries.some((entry) => entry.category === 'corrective_work') && <EmptyData loading={dataLoading} message="No corrective time entries in this date range." />}</div></article>
          </section>
          </>}
          {activePage === 'Time tracking' && <TimeTrackingPanel tasks={tasks} defects={liveDefects} entries={timeEntries} onChanged={retryData} onNotify={setToast} currentUser={authUser} />}
          {activePage === 'Projects' && <ProjectsTasksPanel projects={projects} tasks={tasks} defects={liveDefects} currentUser={authUser} onChanged={retryData} onNotify={setToast} />}
          {activePage === 'Code analysis' && <AnalysisPanel tasks={tasks} currentUser={authUser} onNotify={setToast} />}
          {activePage === 'Defects' && <DefectsPanel tasks={tasks} defects={liveDefects} projects={projects} adjustments={payrollAdjustments} currentUser={authUser} onChanged={retryData} onNotify={setToast} />}
          {activePage === 'Audit trail' && <AuditPanel logs={auditLogs} />}
          {activePage === 'Quality intelligence' && <QualityPanel defects={liveDefects} entries={timeEntries} tasks={tasks} projects={projects} adjustments={payrollAdjustments} />}
          {activePage === 'Settings' && <SettingsPanel currentUser={authUser} onLogout={logout} onProfileUpdated={setAuthUser} showToast={setToast} />}
          {activePage === 'Salary adjustments' && (authUser.role === 'manager' || authUser.role === 'admin') && <PayrollReviewPanel adjustments={payrollAdjustments} currentUser={authUser} onChanged={retryData} onNotify={setToast} />}
          {activePage === 'Salary adjustments' && authUser.role === 'employee' && <EmployeePayrollView adjustments={payrollAdjustments} onChanged={retryData} onNotify={setToast} />}
            </motion.div>
          </AnimatePresence>
          <footer className="page-footer"><span><ShieldCheck size={13} /> Evidence-based workflow with manager review.</span><span>ReworkLedger · v1.0.0</span></footer>
        </div>
      </main>

      <AnimatePresence>{commandOpen && <CommandPalette commands={visibleNavigation} onClose={() => setCommandOpen(false)} onNavigate={(label) => { navigate(label); setCommandOpen(false) }} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}><Check size={14} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={13} /></button></motion.div>}</AnimatePresence>
    </div>
  )
}

function NavButton({ item, active, expanded, onClick }: { item: NavItem; active: boolean; expanded: boolean; onClick: () => void }) {
  const Icon = item.icon
  const reduceMotion = useReducedMotion()
  return <button className={`nav-item ${active ? 'nav-item-active' : ''}`} onClick={onClick} title={item.label} aria-current={active ? 'page' : undefined}>
    {active && <motion.span
      className="nav-active-indicator"
      layoutId="active-navigation-indicator"
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 34, mass: .72 }}
      aria-hidden="true"
    />}
    <Icon size={16} /><span>{expanded && item.label}</span>{expanded && item.badge && <em>{item.badge}</em>}
  </button>
}

function OverviewMetric({ label, value, note, icon: Icon, accent }: { label: string; value: string; note: string; icon: IconComponent; accent: string }) {
  return <div className="overview-metric"><div className={`metric-icon metric-${accent}`}><Icon size={16} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>
}

function Popover({ title, children }: { title: string; children: ReactNode }) {
  return <div className="popover" role="status"><strong>{title}</strong>{children}</div>
}

function EmptyData({ loading, message }: { loading: boolean; message: string }) {
  return <div className="empty-data" aria-live="polite">{loading ? 'Loading live data…' : message}</div>
}

function EmployeePayrollView({ adjustments, onChanged, onNotify }: { adjustments: PayrollAdjustment[]; onChanged: () => void; onNotify: (message: string) => void }) {
  const [disputeReasons, setDisputeReasons] = useState<Record<string, string>>({})
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const submitDispute = async (adjustment: PayrollAdjustment) => {
    const reason = disputeReasons[adjustment._id]?.trim()
    if (!reason) return
    setDisputingId(adjustment._id)
    try {
      await api.submitPayrollDispute(adjustment._id, reason)
      onNotify('Payroll deduction dispute submitted for manager review')
      onChanged()
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Unable to submit payroll dispute')
    } finally {
      setDisputingId(null)
    }
  }
  return <section className="workflow-grid workflow-grid-single"><article className="surface workflow-list employee-payroll-view"><div className="section-heading"><div><h2>My salary adjustments</h2><p>Advance notice for proposed payroll changes, with the task, module, hours, and calculation behind each line. Pending amounts are not deducted until approved.</p></div></div>{adjustments.length ? <div className="employee-payroll-list">{adjustments.map((adjustment) => <article className="employee-payroll-card" key={adjustment._id}>
    <header className="employee-payroll-card-header">
      <div className="employee-payroll-card-total">
        <span>{adjustment.adjustmentType === 'debit' ? 'Deduction' : adjustment.adjustmentType === 'credit' ? 'Credit' : 'Adjustment'}</span>
        <strong>{adjustment.adjustmentType === 'debit' ? '-' : adjustment.adjustmentType === 'credit' ? '+' : ''}{adjustment.currency} {adjustment.proposedAmount.toFixed(2)}</strong>
      </div>
      <span className={`status ${adjustment.status === 'pending_review' ? 'status-warning' : adjustment.adjustmentType === 'debit' ? 'status-danger' : 'status-success'}`}><i />{adjustment.status.replaceAll('_', ' ')}</span>
    </header>
    <div className="employee-payroll-metrics">
      <div><small>Base salary</small><strong>{adjustment.currency} {(adjustment.baseSalary ?? 50000).toFixed(2)}</strong></div>
      <div><small>Projected net</small><strong>{adjustment.currency} {(adjustment.nextMonthSalary ?? 50000).toFixed(2)}</strong></div>
      <div><small>Corrective hours</small><strong>{adjustment.eligibleCorrectiveHours.toFixed(2)}h</strong></div>
      <div><small>Payroll period</small><strong>{new Date(adjustment.periodStart).toLocaleDateString()} – {new Date(adjustment.periodEnd).toLocaleDateString()}</strong></div>
    </div>
    {adjustment.calculationBreakdown.length > 0 && <div className="employee-payroll-breakdown"><h3>Calculation details</h3>{adjustment.calculationBreakdown.map((line) => <div className="employee-payroll-line" key={line.timeEntryId}>
      <div><strong>{line.taskTitle ?? `Task ${line.taskId.slice(-8)}`}</strong><span>{line.module ?? line.defectTitle ?? `Defect ${line.defectId.slice(-8)}`}</span></div>
      <p>{line.hours.toFixed(2)}h × {adjustment.currency} {line.hourlyRate.toFixed(2)} = <strong>{adjustment.currency} {line.amount.toFixed(2)}</strong></p>
    </div>)}</div>}
    {adjustment.disputeStatus === 'pending' && <p className="employee-payroll-note"><strong>Dispute under review</strong>{adjustment.disputeReason}</p>}
    {(adjustment.disputeStatus === 'accepted' || adjustment.disputeStatus === 'denied') && <p className="employee-payroll-note"><strong>Dispute {adjustment.disputeStatus}</strong>{adjustment.disputeResolution}</p>}
    {adjustment.status === 'pending_review' && adjustment.adjustmentType === 'debit' && (!adjustment.disputeStatus || adjustment.disputeStatus === 'none') && <div className="employee-payroll-note"><label htmlFor={`dispute-${adjustment._id}`}>Dispute this proposed deduction<textarea id={`dispute-${adjustment._id}`} value={disputeReasons[adjustment._id] ?? ''} onChange={(event) => setDisputeReasons((current) => ({ ...current, [adjustment._id]: event.target.value }))} maxLength={2000} placeholder="Explain why this deduction should be reviewed" /></label><button className="export-button" disabled={disputingId === adjustment._id || !disputeReasons[adjustment._id]?.trim()} onClick={() => void submitDispute(adjustment)}>{disputingId === adjustment._id ? 'Submitting…' : 'Submit dispute'}</button></div>}
    {adjustment.reviewReason && <p className="employee-payroll-note"><strong>Review note</strong>{adjustment.reviewReason}</p>}
  </article>)}</div> : <EmptyData loading={false} message="No payroll proposals are available for your profile." />}</article></section>
}

function QualityPanel({ defects, entries, tasks, projects, adjustments }: { defects: ApiDefect[]; entries: TimeEntry[]; tasks: Task[]; projects: Project[]; adjustments: PayrollAdjustment[] }) {
  const correctiveHours = entries.filter((entry) => entry.category === 'corrective_work').reduce((sum, entry) => sum + entry.hours, 0)
  const approvedHours = entries.filter((entry) => entry.category === 'corrective_work' && entry.approvalStatus === 'approved').reduce((sum, entry) => sum + entry.hours, 0)
  const causes = defects.reduce<Record<string, number>>((result, defect) => ({ ...result, [defect.cause]: (result[defect.cause] ?? 0) + 1 }), {})
  const taskById = new Map(tasks.map((task) => [task._id, task]))
  const projectById = new Map(projects.map((project) => [project._id, project.name]))
  const defectHours = entries.filter((entry) => entry.category === 'corrective_work').reduce((result, entry) => {
    if (entry.defectId) result.set(entry.defectId, (result.get(entry.defectId) ?? 0) + entry.hours)
    return result
  }, new Map<string, number>())
  const deliveryCount = (task: Task) => task.deliveryHistory?.length || (task.originalCompletedAt || task.currentCompletedAt ? 1 : 0)
  const reopenCount = (task: Task) => {
    const recordedReopens = task.statusHistory?.filter((item) => item.toStatus === 'reopened').length ?? 0
    return recordedReopens || (task.status === 'reopened' ? 1 : 0)
  }
  const deliveredCount = tasks.reduce((total, task) => total + deliveryCount(task), 0)
  const reopenedCount = tasks.reduce((total, task) => total + reopenCount(task), 0)
  const reopenRate = deliveredCount ? reopenedCount / deliveredCount * 100 : 0
  const resolvedDefects = defects.filter((defect) => defect.status === 'resolved' && defect.resolutionSubmittedAt)
  const averageFixHours = resolvedDefects.length
    ? resolvedDefects.reduce((sum, defect) => sum + Math.max(0, new Date(defect.resolutionSubmittedAt!).getTime() - new Date(defect.createdAt).getTime()) / 3_600_000, 0) / resolvedDefects.length
    : 0
  const fixDurationHours = (defect: ApiDefect) => defect.status === 'resolved' && defect.resolutionSubmittedAt
    ? Math.max(0, new Date(defect.resolutionSubmittedAt).getTime() - new Date(defect.createdAt).getTime()) / 3_600_000
    : undefined
  const moduleMetrics = defects.reduce((result, defect) => {
    const module = defect.module || 'Unspecified module'
    const metric = result.get(module) ?? { defects: 0, hours: 0, fixHours: 0, fixed: 0 }
    metric.defects += 1
    metric.hours += defectHours.get(defect._id) ?? 0
    const duration = fixDurationHours(defect)
    if (duration !== undefined) {
      metric.fixHours += duration
      metric.fixed += 1
    }
    result.set(module, metric)
    return result
  }, new Map<string, { defects: number; hours: number; fixHours: number; fixed: number }>())
  const projectMetrics = tasks.reduce((result, task) => {
    const name = projectById.get(task.projectId) ?? `Project ${task.projectId.slice(-8)}`
    const metric = result.get(name) ?? { deliveries: 0, reopened: 0, defects: 0, hours: 0 }
    metric.deliveries += deliveryCount(task)
    metric.reopened += reopenCount(task)
    result.set(name, metric)
    return result
  }, new Map<string, { deliveries: number; reopened: number; defects: number; hours: number }>())
  defects.forEach((defect) => {
    const task = taskById.get(defect.taskId)
    const projectId = task?.projectId ?? defect.projectId
    const name = projectById.get(projectId) ?? `Project ${projectId.slice(-8)}`
    const metric = projectMetrics.get(name) ?? { deliveries: 0, reopened: 0, defects: 0, hours: 0 }
    metric.defects += 1
    metric.hours += defectHours.get(defect._id) ?? 0
    projectMetrics.set(name, metric)
  })
  const employeeMetrics = new Map<string, { deliveries: number; reopened: number; hours: number; defects: Set<string> }>()
  const getEmployeeMetric = (name: string) => {
    const metric = employeeMetrics.get(name) ?? { deliveries: 0, reopened: 0, hours: 0, defects: new Set<string>() }
    employeeMetrics.set(name, metric)
    return metric
  }
  tasks.forEach((task) => {
    const deliveries = task.deliveryHistory ?? []
    if (deliveries.length) {
      deliveries.forEach((delivery) => delivery.contributors.forEach((contributor) => {
        getEmployeeMetric(contributor.name).deliveries += 1
      }))
    } else if (task.originalCompletedAt || task.currentCompletedAt) {
      getEmployeeMetric(task.assigneeName).deliveries += 1
    }
    const taskReopens = reopenCount(task)
    if (taskReopens) {
      const owners = deliveries[0]?.contributors.map((contributor) => contributor.name) ?? [task.assigneeName]
      owners.forEach((owner) => { getEmployeeMetric(owner).reopened += taskReopens })
    }
  })
  defects.forEach((defect) => {
    const task = taskById.get(defect.taskId)
    const owner = defect.originalAssigneeName ?? task?.assigneeName
    if (!owner) return
    const metric = getEmployeeMetric(owner)
    metric.defects.add(defect._id)
  })
  entries.filter((entry) => entry.category === 'corrective_work').forEach((entry) => {
    const task = taskById.get(entry.taskId)
    const owner = entry.employeeName ?? task?.assigneeName
    if (!owner) return
    const metric = getEmployeeMetric(owner)
    metric.hours += entry.hours
    if (entry.defectId) metric.defects.add(entry.defectId)
  })
  const monthlyPayroll = adjustments.reduce((result, adjustment) => {
    const month = new Date(adjustment.periodStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    const metric = result.get(month) ?? { pending: 0, savings: 0, currency: adjustment.currency }
    if (adjustment.status === 'pending_review') metric.pending += adjustment.proposedAmount
    if (adjustment.status === 'approved' && adjustment.adjustmentType === 'debit') metric.savings += adjustment.proposedAmount
    result.set(month, metric)
    return result
  }, new Map<string, { pending: number; savings: number; currency: string }>())
  return <section className="workflow-grid workflow-grid-single"><article className="surface workflow-list"><div className="section-heading"><div><h2>Quality intelligence</h2><p>Delivery quality, reopened work, corrective effort, and payroll impact from current records.</p></div></div><div className="overview-strip"><OverviewMetric label="Total defects" value={String(defects.length)} note="Current workspace" icon={AlertCircle} accent="danger" /><OverviewMetric label="Corrective hours" value={`${correctiveHours.toFixed(2)}h`} note="All submitted entries" icon={Timer} accent="amber" /><OverviewMetric label="Approved hours" value={`${approvedHours.toFixed(2)}h`} note="Reviewed entries" icon={Check} accent="lime" /><OverviewMetric label="Reopen rate" value={`${reopenRate.toFixed(1)}%`} note={`${reopenedCount} reopen events across ${deliveredCount} deliveries`} icon={AlertCircle} accent="danger" /><OverviewMetric label="Average fix time" value={`${averageFixHours.toFixed(1)}h`} note="Report to fix submission" icon={Timer} accent="amber" /></div><h3>Rework by module</h3>{Array.from(moduleMetrics, ([module, metric]) => <div className="workflow-row" key={module}><strong>{module}</strong><span>{metric.defects} defects · {metric.hours.toFixed(2)}h · avg fix {metric.fixed ? `${(metric.fixHours / metric.fixed).toFixed(1)}h` : 'n/a'}</span></div>)}<h3>Rework by project</h3>{Array.from(projectMetrics, ([name, metric]) => <div className="workflow-row" key={name}><strong>{name}</strong><span>{metric.defects} defects · {metric.hours.toFixed(2)}h · reopen rate {metric.deliveries ? `${(metric.reopened / metric.deliveries * 100).toFixed(1)}%` : 'n/a'}</span></div>)}<h3>Rework by employee</h3>{Array.from(employeeMetrics, ([name, metric]) => <div className="workflow-row" key={name}><strong>{name}</strong><span>{metric.defects.size} defects · {metric.hours.toFixed(2)}h · reopen rate {metric.deliveries ? `${(metric.reopened / metric.deliveries * 100).toFixed(1)}%` : 'n/a'}</span></div>)}<h3>Defects by cause</h3>{Object.entries(causes).map(([cause, count]) => <div className="workflow-row" key={cause}><strong>{cause.replaceAll('_', ' ')}</strong><span className="status status-warning"><i />{count}</span></div>)}<h3>Monthly payroll review</h3>{Array.from(monthlyPayroll, ([month, metric]) => <div className="workflow-row" key={month}><strong>{month}</strong><span>{metric.currency} {metric.savings.toFixed(2)} approved savings · {metric.currency} {metric.pending.toFixed(2)} pending</span></div>)}</article></section>
}

function SettingsPanel({ currentUser, onLogout, onProfileUpdated, showToast }: { currentUser: AuthUser; onLogout: () => void; onProfileUpdated: (user: AuthUser) => void; showToast: (message: string) => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(currentUser.role === 'admin')
  const [creating, setCreating] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: currentUser.name, email: currentUser.email, currentPassword: '', newPassword: '', confirmPassword: '' })
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' as 'employee' | 'manager', hourlyRate: '1000', baseSalary: '50000', payrollCurrency: 'INR' })
  const [savingPayrollId, setSavingPayrollId] = useState<string | null>(null)

  useEffect(() => {
    if (currentUser.role !== 'admin') return
    api.listUsers().then(setUsers).catch((error) => showToast(error instanceof Error ? error.message : 'Unable to load users')).finally(() => setLoadingUsers(false))
  }, [currentUser.role, showToast])

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (profileForm.newPassword !== profileForm.confirmPassword) {
      showToast('New password and confirmation do not match')
      return
    }
    setSavingProfile(true)
    try {
      const result = await api.updateOwnProfile({
        name: profileForm.name,
        email: profileForm.email,
        currentPassword: profileForm.currentPassword,
        ...(profileForm.newPassword ? { newPassword: profileForm.newPassword } : {}),
      })
      onProfileUpdated(result.user)
      setProfileForm({ name: result.user.name, email: result.user.email, currentPassword: '', newPassword: '', confirmPassword: '' })
      showToast('Profile updated successfully')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    try {
      const result = await api.createStaff({
        ...form,
        hourlyRate: Number(form.hourlyRate),
        baseSalary: Number(form.baseSalary),
        payrollCurrency: form.payrollCurrency,
      })
      setUsers((current) => [{
        ...result.user,
        active: true,
        hourlyRate: Number(form.hourlyRate),
        baseSalary: Number(form.baseSalary),
        payrollCurrency: form.payrollCurrency.toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, ...current])
      setForm({ name: '', email: '', password: '', role: 'employee', hourlyRate: '1000', baseSalary: '50000', payrollCurrency: 'INR' })
      showToast(`${roleLabels[result.user.role]} account created`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create account')
    } finally {
      setCreating(false)
    }
  }

  const changeUserStatus = async (user: ManagedUser) => {
    try {
      const result = await api.updateUserStatus(user.id, !user.active)
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item))
      showToast(`${user.name} is now ${result.user.active ? 'active' : 'inactive'}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update account')
    }
  }

  const savePayrollSettings = async (user: ManagedUser) => {
    setSavingPayrollId(user.id)
    try {
      const result = await api.updateUserPayrollSettings(user.id, {
        hourlyRate: user.hourlyRate,
        baseSalary: user.baseSalary,
        payrollCurrency: user.payrollCurrency,
      })
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item))
      showToast(`Payroll settings updated for ${user.name}`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update payroll settings')
    } finally {
      setSavingPayrollId(null)
    }
  }

  return <section className="workflow-grid">
    <article className="surface workflow-form">
      <div className="section-heading"><div><h2>Account settings</h2><p>Your authenticated profile and server-enforced role.</p></div></div>
      <div className="demo-hint"><span>Access role</span><strong>{roleLabels[currentUser.role]}</strong></div>
      <form className="workflow-form profile-edit-form" onSubmit={updateProfile}>
        <label>Username<input required maxLength={160} value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label>
        <label>Email<input required type="email" maxLength={320} value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} /></label>
        <label>Current password<input required type="password" autoComplete="current-password" value={profileForm.currentPassword} onChange={(event) => setProfileForm({ ...profileForm, currentPassword: event.target.value })} /></label>
        <label>New password <span className="field-hint">(leave blank to keep current)</span><input minLength={6} type="password" autoComplete="new-password" value={profileForm.newPassword} onChange={(event) => setProfileForm({ ...profileForm, newPassword: event.target.value })} /></label>
        {profileForm.newPassword && <label>Confirm new password<input required minLength={6} type="password" autoComplete="new-password" value={profileForm.confirmPassword} onChange={(event) => setProfileForm({ ...profileForm, confirmPassword: event.target.value })} /></label>}
        <button className="export-button" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
      </form>
      <div className="account-identity">
        <label>User ID<input readOnly value={currentUser.id} /></label>
        <button className="logout-button" onClick={onLogout}><LogOut size={13} /> Log out</button>
      </div>
    </article>
    {currentUser.role === 'admin' && <article className="surface workflow-list">
      <div className="section-heading"><div><h2>People and access</h2><p>Only administrators can create organization accounts. Roles cannot be assigned from the employee or manager workspace.</p></div></div>
      <form className="workflow-form compact-form" onSubmit={createUser}>
        <div className="form-row"><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>
        <div className="form-row"><label>Temporary password<input required minLength={6} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as 'employee' | 'manager' })}><option value="employee">Employee</option><option value="manager">Manager</option></select></label></div>
        <div className="form-row"><label>Hourly rate<input required type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })} /></label><label>Base monthly salary<input required type="number" min="0" step="0.01" value={form.baseSalary} onChange={(event) => setForm({ ...form, baseSalary: event.target.value })} /></label><label>Currency<input required minLength={3} maxLength={3} value={form.payrollCurrency} onChange={(event) => setForm({ ...form, payrollCurrency: event.target.value.toUpperCase() })} /></label></div>
        <button className="export-button" disabled={creating}>{creating ? 'Creating…' : 'Add account'}</button>
      </form>
      <h3>Organization accounts</h3>
      {loadingUsers ? <p className="empty-state">Loading accounts…</p> : users.map((user) => <div className="workflow-row" key={user.id}><div className="project-delivery-content"><strong>{user.name}</strong><small>{user.email} · {roleLabels[user.role]}</small><div className="form-row"><label>Hourly rate<input type="number" min="0" step="0.01" value={user.hourlyRate} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, hourlyRate: Number(event.target.value) } : item))} /></label><label>Base salary<input type="number" min="0" step="0.01" value={user.baseSalary} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, baseSalary: Number(event.target.value) } : item))} /></label><label>Currency<input minLength={3} maxLength={3} value={user.payrollCurrency} onChange={(event) => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, payrollCurrency: event.target.value.toUpperCase() } : item))} /></label><button className="icon-button" disabled={savingPayrollId === user.id} onClick={() => void savePayrollSettings(user)}>{savingPayrollId === user.id ? 'Saving…' : 'Save payroll settings'}</button></div></div><div className="workflow-actions"><span className={`status ${user.active ? 'status-success' : 'status-danger'}`}><i />{user.active ? 'Active' : 'Inactive'}</span>{user.id !== currentUser.id && <button className="icon-button" onClick={() => changeUserStatus(user)}>{user.active ? 'Deactivate' : 'Activate'}</button>}</div></div>)}
    </article>}
  </section>
}

function CommandPalette({ commands, onClose, onNavigate }: { commands: NavItem[]; onClose: () => void; onNavigate: (label: string) => void }) {
  return <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="command-palette" initial={{ opacity: 0, y: -12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette"><div className="command-input"><Search size={16} /><input autoFocus placeholder="Jump to a workspace view..." /><kbd>ESC</kbd></div><div className="command-list"><span className="command-label">Navigation</span>{commands.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => onNavigate(item.label)}><Icon size={15} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}<ChevronRight size={13} /></button> })}</div><div className="command-footer"><span><Keyboard size={12} /> Navigate with arrow keys</span><span><Command size={11} /> K to toggle</span></div></motion.div></motion.div>
}

export default App
