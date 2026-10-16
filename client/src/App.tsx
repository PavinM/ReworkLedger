import { useEffect, useState, type ReactNode } from 'react'
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
  Menu,
  MoreHorizontal,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Timer,
  X,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './App.css'

type IconComponent = typeof LayoutDashboard
type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
type DefectStatus = 'Investigating' | 'In review' | 'Resolved'

type NavItem = { label: string; icon: IconComponent; badge?: string }
type Defect = {
  id: string
  module: string
  summary: string
  severity: Severity
  assignee: string
  discovered: string
  status: DefectStatus
}
type Approval = {
  employee: string
  initials: string
  defect: string
  hours: string
  adjustment: string
  status: 'Awaiting review' | 'Manager review'
}

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

const trendData = [
  { date: 'May 06', hours: 8, target: 12 },
  { date: 'May 07', hours: 14, target: 12 },
  { date: 'May 08', hours: 11, target: 12 },
  { date: 'May 09', hours: 19, target: 15 },
  { date: 'May 10', hours: 16, target: 15 },
  { date: 'May 11', hours: 23, target: 16 },
  { date: 'May 12', hours: 21, target: 17 },
  { date: 'May 13', hours: 27, target: 18 },
  { date: 'May 14', hours: 24, target: 18 },
  { date: 'May 15', hours: 31, target: 18 },
  { date: 'May 16', hours: 28, target: 19 },
  { date: 'May 17', hours: 34, target: 19 },
]

const defects: Defect[] = [
  { id: 'DF-1048', module: 'Invoice engine', summary: 'Tax rounding in export', severity: 'Critical', assignee: 'JM', discovered: '2h ago', status: 'Investigating' },
  { id: 'DF-1047', module: 'Mobile workspace', summary: 'Filter state resets', severity: 'High', assignee: 'AK', discovered: '5h ago', status: 'In review' },
  { id: 'DF-1046', module: 'Project archive', summary: 'Missing empty state', severity: 'Medium', assignee: 'RS', discovered: 'Yesterday', status: 'In review' },
  { id: 'DF-1045', module: 'Weekly summary', summary: 'Timezone offset', severity: 'Low', assignee: 'TL', discovered: 'Yesterday', status: 'Resolved' },
]

const approvals: Approval[] = [
  { employee: 'Jordan Mitchell', initials: 'JM', defect: 'DF-1048 · Invoice engine', hours: '8.5h', adjustment: '$382.50', status: 'Awaiting review' },
  { employee: 'Avery Kim', initials: 'AK', defect: 'DF-1047 · Mobile workspace', hours: '5.0h', adjustment: '$275.00', status: 'Manager review' },
  { employee: 'Riley Singh', initials: 'RS', defect: 'DF-1046 · Project archive', hours: '3.5h', adjustment: '$157.50', status: 'Awaiting review' },
]

const modules = [
  { name: 'Invoice engine', defects: 9, hours: '38.5h', severity: 'Critical', trend: '+24%', width: 88 },
  { name: 'Mobile workspace', defects: 7, hours: '26.0h', severity: 'High', trend: '+11%', width: 69 },
  { name: 'Project archive', defects: 5, hours: '18.5h', severity: 'Medium', trend: '-8%', width: 51 },
  { name: 'Weekly summary', defects: 3, hours: '9.0h', severity: 'Low', trend: '-16%', width: 31 },
]

const severityClass: Record<Severity, string> = {
  Critical: 'badge-danger',
  High: 'badge-warning',
  Medium: 'badge-lime',
  Low: 'badge-success',
}

const statusClass: Record<DefectStatus, string> = {
  Investigating: 'status-danger',
  'In review': 'status-warning',
  Resolved: 'status-success',
}

function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activePage, setActivePage] = useState('Overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [project, setProject] = useState('All projects')
  const [period, setPeriod] = useState('May 04 – May 17, 2026')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const reduceMotion = useReducedMotion()

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
            <div className="header-actions"><label className="select-control"><span>Project</span><select value={project} onChange={(event) => setProject(event.target.value)} aria-label="Filter by project"><option>All projects</option><option>Atlas migration</option><option>Core platform</option><option>Mobile workspace</option></select><ChevronDown size={13} /></label><label className="select-control"><span>Date range</span><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Select date range"><option>May 04 – May 17, 2026</option><option>Apr 20 – May 03, 2026</option><option>Q2 2026</option></select><ChevronDown size={13} /></label><button className="export-button" onClick={exportReport}><Download size={14} /> Export</button></div>
          </motion.section>

          <section className="overview-strip" aria-label="Quality overview">
            <OverviewMetric label="Rework hours" value="126.4h" note="Across 18 corrective tasks" icon={Timer} accent="lime" />
            <OverviewMetric label="Open defects" value="24" note="9 high or critical severity" icon={AlertCircle} accent="danger" />
            <OverviewMetric label="Pending approvals" value="8" note="Across 6 team members" icon={ClipboardCheck} accent="amber" />
            <OverviewMetric label="Proposed adjustments" value="$4,280" note="Pending manager review" icon={Zap} accent="neutral" />
          </section>

          <section className="insight-grid">
            <motion.article className="surface analytics-surface" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>
              <SectionHeading title="Rework analytics" subtitle="Corrective hours logged against the weekly threshold." action={<label className="small-select"><select aria-label="Analytics period"><option>Last 14 days</option><option>Last 30 days</option><option>This quarter</option></select><ChevronDown size={12} /></label>} />
              <div className="chart-meta"><span><i className="legend-line legend-accent" /> Rework hours</span><span><i className="legend-line legend-threshold" /> Target threshold</span><strong>34h <small>highest day</small></strong></div>
              <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="limeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C7F36B" stopOpacity=".2" /><stop offset="100%" stopColor="#C7F36B" stopOpacity="0" /></linearGradient></defs><CartesianGrid stroke="rgba(220,235,215,.08)" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#737D74', fontSize: 10 }} interval={2} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#737D74', fontSize: 10 }} tickFormatter={(value) => `${value}h`} /><Tooltip contentStyle={{ background: '#1D241F', border: '1px solid rgba(220,235,215,.16)', borderRadius: 4, color: '#F0F3ED', fontSize: 11 }} labelStyle={{ color: '#A0AAA0' }} formatter={(value, name) => [`${value}h`, name === 'hours' ? 'Rework hours' : 'Target']} /><Area type="monotone" dataKey="target" stroke="#737D74" strokeWidth={1} strokeDasharray="4 4" fill="none" /><Area type="monotone" dataKey="hours" stroke="#C7F36B" strokeWidth={2} fill="url(#limeFill)" activeDot={{ r: 4, fill: '#C7F36B', stroke: '#0B0D0C', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div>
            </motion.article>
            <motion.article className="surface module-surface" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .14 }}><SectionHeading title="Quality signals" subtitle="Modules ranked by repeated defects." action={<button className="plain-action" onClick={() => navigate('Quality intelligence')}>View intelligence <ArrowUpRight size={13} /></button>} /><div className="module-list">{modules.map((module, index) => <div className="module-row" key={module.name}><span className="module-rank">0{index + 1}</span><div className="module-info"><strong>{module.name}</strong><div className="module-bar"><i style={{ width: `${module.width}%` }} /></div></div><span className="module-defects">{module.defects}<small> defects</small></span><span className="module-hours">{module.hours}</span><span className={`module-trend ${module.trend.startsWith('-') ? 'trend-down' : ''}`}>{module.trend}</span></div>)}</div></motion.article>
          </section>

          <section className="surface trace-surface"><SectionHeading title="Rework traceability" subtitle="A complete chain of accountability from delivery to payroll." action={<span className="sample-label">Illustrative sample data</span>} /><div className="trace-line">{[['01', 'Original delivery', 'May 06 · Build 2.4.0', 'success'], ['02', 'Defect discovered', 'May 09 · DF-1048', 'danger'], ['03', 'Corrective work', 'May 11 · 8.5 hours', 'lime'], ['04', 'Manager approval', 'May 15 · Jordan Mitchell', 'amber'], ['05', 'Payroll review', 'Pending · $382.50', 'muted']].map(([step, title, detail, state], index) => <div className="trace-step" key={title}><div className={`trace-marker trace-${state}`}>{state === 'success' ? <Check size={13} /> : step}</div><div><strong>{title}</strong><small>{detail}</small></div>{index < 4 && <div className="trace-connector" />}</div>)}</div></section>

          <section className="lower-grid">
            <article className="surface defects-surface"><SectionHeading title="Recent defects" subtitle="Latest quality events across your workspace." action={<div className="section-actions"><button className="filter-button"><SlidersHorizontal size={13} /> Filter</button><button className="plain-action" onClick={() => navigate('Defects')}>View all <ArrowUpRight size={13} /></button></div>} /><div className="table-scroll"><table><thead><tr><th>Defect</th><th>Module</th><th>Severity</th><th>Assignee</th><th>Discovered</th><th>Status</th><th /></tr></thead><tbody>{defects.map((defect) => <tr key={defect.id}><td><div className="defect-cell"><strong>{defect.id}</strong><span>{defect.summary}</span></div></td><td className="secondary-cell">{defect.module}</td><td><span className={`badge ${severityClass[defect.severity]}`}><i />{defect.severity}</span></td><td><span className="assignee"><span className="avatar avatar-xs">{defect.assignee}</span>{defect.assignee === 'JM' ? 'Jordan' : defect.assignee === 'AK' ? 'Avery' : defect.assignee === 'RS' ? 'Riley' : 'Taylor'}</span></td><td className="secondary-cell">{defect.discovered}</td><td><span className={`status ${statusClass[defect.status]}`}><i />{defect.status}</span></td><td><button className="icon-button" aria-label={`More actions for ${defect.id}`}><MoreHorizontal size={15} /></button></td></tr>)}</tbody></table></div></article>
            <article className="surface approvals-surface"><SectionHeading title="Pending approvals" subtitle="Review before payroll cutoff." action={<button className="plain-action" onClick={() => navigate('Payroll review')}>View all <ArrowUpRight size={13} /></button>} /><div className="approval-list">{approvals.map((approval) => <div className="approval-row" key={approval.employee}><div className="avatar avatar-xs avatar-lime">{approval.initials}</div><div className="approval-copy"><strong>{approval.employee}</strong><small>{approval.defect}</small></div><div className="approval-value"><strong>{approval.adjustment}</strong><small>{approval.hours} corrective</small></div><button className="approval-check" onClick={() => setToast(`${approval.employee}'s review opened`)} aria-label={`Review ${approval.employee}`}><ChevronRight size={14} /></button></div>)}</div><button className="review-all" onClick={() => navigate('Payroll review')}>Open payroll review <ArrowUpRight size={14} /></button></article>
          </section>
          <footer className="page-footer"><span><ShieldCheck size={13} /> Sample data is illustrative, not live payroll data.</span><span>ReworkLedger · v1.0.0</span></footer>
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

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (label: string) => void }) {
  const commands = [...primaryNav, ...intelligenceNav]
  return <motion.div className="command-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="command-palette" initial={{ opacity: 0, y: -12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette"><div className="command-input"><Search size={16} /><input autoFocus placeholder="Jump to a workspace view..." /><kbd>ESC</kbd></div><div className="command-list"><span className="command-label">Navigation</span>{commands.map((item) => { const Icon = item.icon; return <button key={item.label} onClick={() => onNavigate(item.label)}><Icon size={15} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}<ChevronRight size={13} /></button> })}</div><div className="command-footer"><span><Keyboard size={12} /> Navigate with arrow keys</span><span><Command size={11} /> K to toggle</span></div></motion.div></motion.div>
}

export default App
