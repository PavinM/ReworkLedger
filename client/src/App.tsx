import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileClock,
  FolderKanban,
  Gauge,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Shield,
  UserRound,
  BriefcaseBusiness,
  SlidersHorizontal,
  Sun,
  Timer,
  X,
  Zap,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { api, type AuthUser, type Defect as ApiDefect, type PayrollAdjustment, type Project, type Task, type TimeEntry } from './lib/api'
import { TimeTrackingPanel } from './components/TimeTrackingPanel'
import { PayrollReviewPanel } from './components/PayrollReviewPanel'
import './App.css'

type IconComponent = typeof LayoutDashboard
type LoginRole = AuthUser['role']
type NavItem = { label: string; icon: IconComponent; badge?: string }
const loginRoles: Array<{ role: LoginRole; label: string; description: string; icon: typeof UserRound; email: string }> = [
  { role: 'employee', label: 'Employee', description: 'Log work and follow corrective tasks.', icon: UserRound, email: 'employee.demo@reworkledger.local' },
  { role: 'manager', label: 'Manager', description: 'Review quality signals and approvals.', icon: BriefcaseBusiness, email: 'manager.demo@reworkledger.local' },
  { role: 'admin', label: 'Administrator', description: 'Manage workspace controls and access.', icon: Shield, email: 'admin.demo@reworkledger.local' },
]
const primaryNav: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Tasks', icon: ClipboardCheck },
  { label: 'Defects', icon: AlertCircle, badge: '12' },
  { label: 'Time tracking', icon: Timer },
]

const intelligenceNav: NavItem[] = [
  { label: 'Payroll review', icon: FileClock, badge: '4' },
  { label: 'Quality intelligence', icon: Gauge },
  { label: 'Audit trail', icon: ShieldCheck },
  { label: 'Settings', icon: Settings },
]

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

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [selectedRole, setSelectedRole] = useState<LoginRole>('manager')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activePage, setActivePage] = useState('Overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [project, setProject] = useState('All projects')
  const [period, setPeriod] = useState('May 04 – May 17, 2026')
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [liveDefects, setLiveDefects] = useState<ApiDefect[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [payrollAdjustments, setPayrollAdjustments] = useState<PayrollAdjustment[]>([])
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
    Promise.all([
      api.listProjects(controller.signal),
      api.listTasks(selectedProject, controller.signal),
      api.listDefects(selectedProject, controller.signal),
      api.listTimeEntries(undefined, controller.signal),
      payrollRequest,
    ]).then(([nextProjects, nextTasks, nextDefects, nextTimeEntries, nextPayroll]) => {
      setDataError('')
      setProjects(nextProjects)
      setTasks(nextTasks)
      setLiveDefects(nextDefects)
      setTimeEntries(nextTimeEntries)
      setPayrollAdjustments(nextPayroll ?? [])
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

  const navigate = (label: string) => {
    setActivePage(label)
    setMobileNavOpen(false)
  }

  const exportReport = () => {
    setToast('Illustrative report prepared for export')
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
  }
  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      setAuthUser(await api.login(loginEmail, loginPassword))
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in')
    } finally {
      setLoggingIn(false)
    }
  }
  const selectLoginRole = (role: LoginRole) => {
    const account = loginRoles.find((item) => item.role === role)
    setSelectedRole(role)
    if (account) {
      setLoginEmail(account.email)
      setLoginPassword('DemoReworkLedger!2026')
    }
    setLoginError('')
  }
  const liveModules = Array.from(liveDefects.reduce((groups, defect) => {
    const existing = groups.get(defect.projectId) ?? { name: defect.projectId.slice(-8), defects: 0 }
    groups.set(defect.projectId, { ...existing, defects: existing.defects + 1 })
    return groups
  }, new Map<string, { name: string; defects: number }>()).values())
    .map((module, index) => ({ ...module, width: Math.max(20, 100 - index * 18) }))

  if (!authUser) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submitLogin}>
        <div className="brand-lockup"><div className="brand-mark"><span>R</span></div><span className="brand-name">Rework<span>Ledger</span></span></div>
        <div className="auth-intro"><span className="eyebrow">SECURE WORKSPACE</span><h1>Sign in to ReworkLedger</h1><p>Choose your workspace role to continue with the right level of access.</p></div>
        <fieldset className="role-picker">
          <legend>Continue as</legend>
          <div className="role-options">
            {loginRoles.map(({ role, label, description, icon: RoleIcon }) => (
              <button key={role} type="button" className={`role-option ${selectedRole === role ? 'role-option-selected' : ''}`} onClick={() => selectLoginRole(role)} aria-pressed={selectedRole === role}>
                <span className="role-icon"><RoleIcon size={16} /></span>
                <span className="role-copy"><strong>{label}</strong><small>{description}</small></span>
                <span className="role-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="demo-hint"><ShieldCheck size={14} /><span>Local demo access · {loginRoles.find((item) => item.role === selectedRole)?.label}</span></div>
        <label>Email<input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required /></label>
        {loginError && <div className="inline-error">{loginError}</div>}
        <button className="primary-button auth-submit" disabled={loggingIn}>{loggingIn ? 'Signing in…' : `Sign in as ${loginRoles.find((item) => item.role === selectedRole)?.label}`}</button>
        <small className="auth-footnote">Your role is verified by the server after authentication.</small>
      </form>
    </main>
  )

  return (
    <div className={`app-shell theme-${theme}`}>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label="Toggle navigation"><Menu size={19} /></button>
            <div className="brand-lockup"><div className="brand-mark"><span>R</span></div><span className="brand-name">Rework<span>Ledger</span></span></div>
            <button className="workspace-chip" aria-label="Select workspace"><span className="workspace-icon">AC</span><span>Acme Corporation</span><ChevronDown size={13} /></button>
            <nav className={`top-nav ${mobileNavOpen ? 'top-nav-open' : ''}`} aria-label="Application navigation">
              {[...primaryNav, ...intelligenceNav].map((item) => <NavButton key={item.label} item={item} active={activePage === item.label} expanded onClick={() => navigate(item.label)} />)}
            </nav>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Search workspace</span><kbd><Command size={10} /> K</kbd></button>
            <button className="period-pill" onClick={() => setToast('Payroll period: May 04 – May 17, 2026')}><Clock3 size={14} /><span>May 04 – May 17</span></button>
            <button className="theme-toggle icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <div className="popover-wrap"><button className="icon-button notification-button" onClick={() => setShowNotifications(!showNotifications)} aria-expanded={showNotifications} aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></button>{showNotifications && <Popover title="Notifications"><p>4 payroll reviews are waiting for your attention.</p><button onClick={() => setShowNotifications(false)}>Mark as read</button></Popover>}</div>
            <div className="popover-wrap"><button className="top-profile" onClick={() => setShowProfile(!showProfile)} aria-expanded={showProfile}><span className="avatar avatar-lime">MS</span><span className="profile-name">Morgan Silva</span><ChevronDown size={13} /></button>{showProfile && <Popover title="Morgan Silva"><p>Administrator · Acme Corporation</p><button onClick={() => setShowProfile(false)}>Open account settings</button></Popover>}</div>
          </div>
        </header>

        <div className="page-content">
          <motion.section className="page-heading" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
            <div><span className="eyebrow">MONDAY · MAY 18, 2026</span><h1>Engineering Intelligence</h1><p>Understand quality, corrective work, and accountability.</p></div>
            <div className="header-actions"><label className="select-control"><span>Project</span><select value={project} onChange={(event) => setProject(event.target.value)} aria-label="Filter by project"><option>All projects</option>{projects.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select><ChevronDown size={13} /></label><label className="select-control"><span>Date range</span><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Select date range"><option>May 04 – May 17, 2026</option><option>Apr 20 – May 03, 2026</option><option>Q2 2026</option></select><ChevronDown size={13} /></label><button className="export-button" onClick={exportReport}><Download size={14} /> Export</button></div>
          </motion.section>

          <section className="overview-strip" aria-label="Quality overview">
            <OverviewMetric label="Completed tasks" value={dataLoading ? '…' : String(tasks.filter((task) => task.status === 'completed').length)} note="Live from task API" icon={Timer} accent="lime" />
            <OverviewMetric label="Open defects" value={dataLoading ? '…' : String(liveDefects.filter((defect) => !['resolved', 'exempted'].includes(defect.status)).length)} note="Live from defect API" icon={AlertCircle} accent="danger" />
            <OverviewMetric label="Projects" value={dataLoading ? '…' : String(projects.length)} note="Live from project API" icon={ClipboardCheck} accent="amber" />
            <OverviewMetric label="Payroll review" value={dataLoading ? '…' : String(payrollAdjustments.filter((item) => item.status === 'pending_review').length)} note="Live proposed adjustments" icon={Zap} accent="neutral" />
          </section>

          {dataError && <div className="api-error" role="alert"><span>Unable to load live workspace data: {dataError}</span><button onClick={retryData}>Retry</button></div>}

          <section className="insight-grid">
            <motion.article className="surface analytics-surface" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>
              <SectionHeading title="Rework analytics" subtitle="Corrective hours logged against the weekly threshold." action={<label className="small-select"><select aria-label="Analytics period"><option>Last 14 days</option><option>Last 30 days</option><option>This quarter</option></select><ChevronDown size={12} /></label>} />
              <div className="chart-meta"><span><i className="legend-line legend-accent" /> Rework hours</span><span><i className="legend-line legend-threshold" /> Target threshold</span><strong>34h <small>highest day</small></strong></div>
              <div className="chart-container"><EmptyData loading={dataLoading} message="Corrective time tracking is not available from the current API." /></div>
            </motion.article>
            <motion.article className="surface module-surface" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .14 }}><SectionHeading title="Quality signals" subtitle="Projects ranked by reported defects." action={<button className="plain-action" onClick={() => navigate('Quality intelligence')}>View intelligence <ArrowUpRight size={13} /></button>} /><div className="module-list">{liveModules.length ? liveModules.map((module, index) => <div className="module-row" key={module.name}><span className="module-rank">0{index + 1}</span><div className="module-info"><strong>{module.name}</strong><div className="module-bar"><i style={{ width: `${module.width}%` }} /></div></div><span className="module-defects">{module.defects}<small> defects</small></span><span className="module-hours">—</span><span className="module-trend">Live</span></div>) : <EmptyData loading={dataLoading} message="No defect signals available yet." />}</div></motion.article>
          </section>

          <section className="surface trace-surface"><SectionHeading title="Rework traceability" subtitle="A complete chain of accountability from delivery to payroll." action={<span className="sample-label">Illustrative sample data</span>} /><div className="trace-line">{[['01', 'Original delivery', 'May 06 · Build 2.4.0', 'success'], ['02', 'Defect discovered', 'May 09 · DF-1048', 'danger'], ['03', 'Corrective work', 'May 11 · 8.5 hours', 'lime'], ['04', 'Manager approval', 'May 15 · Jordan Mitchell', 'amber'], ['05', 'Payroll review', 'Pending · $382.50', 'muted']].map(([step, title, detail, state], index) => <div className="trace-step" key={title}><div className={`trace-marker trace-${state}`}>{state === 'success' ? <Check size={13} /> : step}</div><div><strong>{title}</strong><small>{detail}</small></div>{index < 4 && <div className="trace-connector" />}</div>)}</div></section>

          <section className="lower-grid">
            <article className="surface defects-surface"><SectionHeading title="Recent defects" subtitle="Latest quality events from the defect API." action={<div className="section-actions"><button className="filter-button"><SlidersHorizontal size={13} /> Filter</button><button className="plain-action" onClick={() => navigate('Defects')}>View all <ArrowUpRight size={13} /></button></div>} /><div className="table-scroll"><table><thead><tr><th>Defect</th><th>Project</th><th>Severity</th><th>Task</th><th>Discovered</th><th>Status</th><th /></tr></thead><tbody>{liveDefects.length ? liveDefects.map((defect) => <tr key={defect._id}><td><div className="defect-cell"><strong>{defect._id.slice(-8)}</strong><span>{defect.title}</span></div></td><td className="secondary-cell">{defect.projectId.slice(-8)}</td><td><span className={`badge ${severityClass[defect.severity]}`}><i />{defect.severity}</span></td><td><span className="secondary-cell">{defect.taskId.slice(-8)}</span></td><td className="secondary-cell">{new Date(defect.createdAt).toLocaleDateString()}</td><td><span className={`status ${statusClass[defect.status]}`}><i />{defect.status.replace('_', ' ')}</span></td><td><button className="icon-button" aria-label={`More actions for ${defect._id}`}><MoreHorizontal size={15} /></button></td></tr>) : <tr><td colSpan={7}><EmptyData loading={dataLoading} message="No defects returned by the API." /></td></tr>}</tbody></table></div></article>
            <article className="surface approvals-surface"><SectionHeading title="Corrective time & payroll" subtitle="Live approved entries and proposed adjustments." action={<button className="plain-action" onClick={() => navigate('Payroll review')}>View review <ArrowUpRight size={13} /></button>} /><div className="approval-list">{timeEntries.filter((entry) => entry.category === 'corrective_work').slice(0, 3).map((entry) => <div className="approval-row" key={entry._id}><div className="avatar avatar-xs avatar-lime">{entry.employeeId.slice(-2).toUpperCase()}</div><div className="approval-copy"><strong>{entry.hours.toFixed(2)}h corrective work</strong><small>{entry.approvalStatus} · defect {entry.defectId?.slice(-8) ?? '—'}</small></div><span className={`status ${entry.approvalStatus === 'approved' ? 'status-success' : entry.approvalStatus === 'rejected' ? 'status-danger' : 'status-warning'}`}><i />{entry.approvalStatus}</span></div>)}{!timeEntries.some((entry) => entry.category === 'corrective_work') && <EmptyData loading={dataLoading} message="No corrective time entries returned by the API." />}</div></article>
          </section>
          {activePage === 'Time tracking' && <TimeTrackingPanel tasks={tasks} defects={liveDefects} entries={timeEntries} onChanged={retryData} onNotify={setToast} currentUser={authUser} />}
          {activePage === 'Payroll review' && (authUser.role === 'manager' || authUser.role === 'admin') && <PayrollReviewPanel adjustments={payrollAdjustments} onChanged={retryData} onNotify={setToast} currentUser={authUser} />}
          {activePage === 'Payroll review' && authUser.role === 'employee' && <EmployeePayrollView adjustments={payrollAdjustments} />}
          <footer className="page-footer"><span><ShieldCheck size={13} /> Sample data is illustrative, not live payroll data.</span><span>ReworkLedger · v1.0.0</span><button className="logout-button" onClick={logout}><LogOut size={13} /> Log out</button></footer>
        </div>
      </main>

      <AnimatePresence>{commandOpen && <CommandPalette onClose={() => setCommandOpen(false)} onNavigate={(label) => { navigate(label); setCommandOpen(false) }} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}><Check size={14} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={13} /></button></motion.div>}</AnimatePresence>
    </div>
  )
}

function NavButton({ item, active, expanded, onClick }: { item: NavItem; active: boolean; expanded: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button className={`nav-item ${active ? 'nav-item-active' : ''}`} onClick={onClick} title={!expanded ? item.label : undefined}><Icon size={16} /><span>{expanded && item.label}</span>{expanded && item.badge && <em>{item.badge}</em>}</button>
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

function EmployeePayrollView({ adjustments }: { adjustments: PayrollAdjustment[] }) {
  return <section className="workflow-grid"><article className="surface workflow-list employee-payroll-view"><div className="section-heading"><div><h2>My proposed payroll adjustments</h2><p>Read-only payroll proposals for your authenticated profile.</p></div></div>{adjustments.length ? adjustments.map((adjustment) => <div className="workflow-row" key={adjustment._id}><div><strong>{adjustment.currency} {adjustment.proposedAmount.toFixed(2)} · {adjustment.eligibleCorrectiveHours.toFixed(2)}h corrective work</strong><small>{new Date(adjustment.periodStart).toLocaleDateString()} – {new Date(adjustment.periodEnd).toLocaleDateString()}</small></div><span className={`status ${adjustment.status === 'approved' ? 'status-success' : adjustment.status === 'rejected' ? 'status-danger' : 'status-warning'}`}><i />{adjustment.status.replace('_', ' ')}</span></div>) : <EmptyData loading={false} message="No payroll proposals are available for your profile." />}</article></section>
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (label: string) => void }) {
  const commands = [...primaryNav, ...intelligenceNav]
  return <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="command-palette" initial={{ opacity: 0, y: -12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette"><div className="command-input"><Search size={16} /><input autoFocus placeholder="Jump to a workspace view..." /><kbd>ESC</kbd></div><div className="command-list"><span className="command-label">Navigation</span>{commands.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => onNavigate(item.label)}><Icon size={15} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}<ChevronRight size={13} /></button> })}</div><div className="command-footer"><span><Keyboard size={12} /> Navigate with arrow keys</span><span><Command size={11} /> K to toggle</span></div></motion.div></motion.div>
}

export default App
