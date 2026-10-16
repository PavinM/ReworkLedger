import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileClock,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Timer,
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
import { motion } from 'framer-motion'
import './App.css'

type Icon = typeof LayoutDashboard

type NavItem = {
  label: string
  icon: Icon
  badge?: string
}

type Defect = {
  id: string
  title: string
  project: string
  owner: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: 'Investigating' | 'In review' | 'Resolved'
  date: string
}

type Approval = {
  initials: string
  name: string
  role: string
  hours: string
  amount: string
  color: string
}

const navigation: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Tasks', icon: ClipboardCheck },
  { label: 'Defects', icon: AlertCircle, badge: '12' },
  { label: 'Time Tracking', icon: Timer },
]

const reviewNavigation: NavItem[] = [
  { label: 'Payroll Review', icon: FileClock, badge: '4' },
  { label: 'Analytics', icon: Activity },
  { label: 'Audit Logs', icon: ShieldCheck },
  { label: 'Settings', icon: Settings },
]

const chartData = [
  { day: 'May 06', hours: 8, target: 12 },
  { day: 'May 07', hours: 14, target: 12 },
  { day: 'May 08', hours: 11, target: 12 },
  { day: 'May 09', hours: 19, target: 15 },
  { day: 'May 10', hours: 16, target: 15 },
  { day: 'May 11', hours: 23, target: 16 },
  { day: 'May 12', hours: 21, target: 17 },
  { day: 'May 13', hours: 27, target: 18 },
  { day: 'May 14', hours: 24, target: 18 },
  { day: 'May 15', hours: 31, target: 18 },
  { day: 'May 16', hours: 28, target: 19 },
  { day: 'May 17', hours: 34, target: 19 },
]

const defects: Defect[] = [
  { id: 'DF-1048', title: 'Invoice export rounds tax incorrectly', project: 'Atlas Migration', owner: 'JM', severity: 'Critical', status: 'Investigating', date: '2h ago' },
  { id: 'DF-1047', title: 'Mobile filter state resets on refresh', project: 'Mobile App 2.0', owner: 'AK', severity: 'High', status: 'In review', date: '5h ago' },
  { id: 'DF-1046', title: 'Missing empty state on archived projects', project: 'Core Platform', owner: 'RS', severity: 'Medium', status: 'In review', date: 'Yesterday' },
  { id: 'DF-1045', title: 'Timezone offset on weekly summary', project: 'Atlas Migration', owner: 'TL', severity: 'Low', status: 'Resolved', date: 'Yesterday' },
]

const approvals: Approval[] = [
  { initials: 'JM', name: 'Jordan Mitchell', role: 'Senior Engineer', hours: '8.5h rework', amount: '$382.50', color: '#9c8cff' },
  { initials: 'AK', name: 'Avery Kim', role: 'Product Designer', hours: '5.0h rework', amount: '$275.00', color: '#40c5a8' },
  { initials: 'RS', name: 'Riley Singh', role: 'QA Specialist', hours: '3.5h rework', amount: '$157.50', color: '#e9b86b' },
]

const severityClass: Record<Defect['severity'], string> = {
  Critical: 'severity-critical',
  High: 'severity-high',
  Medium: 'severity-medium',
  Low: 'severity-low',
}

const statusClass: Record<Defect['status'], string> = {
  Investigating: 'status-investigating',
  'In review': 'status-review',
  Resolved: 'status-resolved',
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activePage, setActivePage] = useState('Overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [range, setRange] = useState('Last 14 days')

  const handleNavClick = (label: string) => {
    setActivePage(label)
    setMobileNavOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'} ${mobileNavOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><span>R</span></div>
          {sidebarOpen && <span className="brand-name">Rework<span>Ledger</span></span>}
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"><PanelLeftClose size={17} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-icon">AC</div>
          {sidebarOpen && <><div className="workspace-copy"><strong>Acme Corporation</strong><span>Enterprise workspace</span></div><ChevronDown size={15} /></>}
        </div>

        <nav className="nav-groups" aria-label="Application navigation">
          <span className="nav-label">{sidebarOpen ? 'Workspace' : 'Menu'}</span>
          {navigation.map((item) => <NavButton key={item.label} item={item} active={activePage === item.label} expanded={sidebarOpen} onClick={() => handleNavClick(item.label)} />)}
          <span className="nav-label nav-label-spaced">{sidebarOpen ? 'Manage' : ''}</span>
          {reviewNavigation.map((item) => <NavButton key={item.label} item={item} active={activePage === item.label} expanded={sidebarOpen} onClick={() => handleNavClick(item.label)} />)}
        </nav>

        <div className="sidebar-bottom">
          {sidebarOpen && <div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={14} /></div><strong>Unlock more insights</strong><p>Get advanced rework analytics with Pro.</p><button>Explore Pro <ArrowUpRight size={13} /></button></div>}
          <div className="profile-mini"><div className="avatar avatar-purple">MS</div>{sidebarOpen && <div className="profile-copy"><strong>Morgan Silva</strong><span>Admin</span></div>}{sidebarOpen && <MoreHorizontal size={17} />}</div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-overlay" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && <button className="icon-button desktop-expand" onClick={() => setSidebarOpen(true)} aria-label="Expand sidebar"><PanelLeftOpen size={18} /></button>}
            <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input aria-label="Search" placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
            <div className="action-popover-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
              {showNotifications && <div className="popover notification-popover"><strong>Notifications</strong><p>You have 4 approvals waiting for review.</p><button onClick={() => setShowNotifications(false)}>Mark all as read</button></div>}
            </div>
            <div className="action-popover-wrap">
              <button className="top-profile" onClick={() => setShowProfile(!showProfile)}><div className="avatar avatar-purple">MS</div><span>Morgan Silva</span><ChevronDown size={14} /></button>
              {showProfile && <div className="popover profile-popover"><strong>Morgan Silva</strong><p>Admin · Acme Corporation</p><button onClick={() => setShowProfile(false)}>Account settings</button></div>}
            </div>
          </div>
        </header>

        <div className="page-content">
          <motion.div className="page-heading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div><div className="eyebrow"><span className="live-dot" /> Monday, May 18, 2026</div><h1>Good morning, Morgan <span>✦</span></h1><p>Here’s what’s happening across your workspace today.</p></div>
            <button className="date-button"><Clock3 size={15} /> This week <ChevronDown size={14} /></button>
          </motion.div>

          <section className="kpi-grid" aria-label="Key performance indicators">
            <KpiCard label="Rework Hours" value="126.4h" change="+18.2%" detail="vs. previous period" icon={Timer} positive={false} color="purple" />
            <KpiCard label="Open Defects" value="24" change="-12.5%" detail="vs. previous period" icon={AlertCircle} positive color="orange" />
            <KpiCard label="Pending Approvals" value="8" change="+3" detail="since last Monday" icon={ClipboardCheck} positive={false} color="teal" />
            <KpiCard label="Proposed Adjustments" value="$4,280" change="+24.8%" detail="vs. previous period" icon={Zap} positive={false} color="yellow" />
          </section>

          <section className="dashboard-grid">
            <motion.div className="panel trend-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
              <div className="panel-heading"><div><h2>Rework trend</h2><p>Hours logged against target over time</p></div><div className="select-wrap"><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Select date range"><option>Last 14 days</option><option>Last 30 days</option><option>This quarter</option></select><ChevronDown size={14} /></div></div>
              <div className="chart-legend"><span><i className="legend-dot legend-purple" /> Rework hours</span><span><i className="legend-dot legend-muted" /> Target threshold</span><strong>34.0h <small>peak</small></strong></div>
              <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 4, left: -25, bottom: 0 }}><defs><linearGradient id="reworkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9c8cff" stopOpacity={0.28} /><stop offset="100%" stopColor="#9c8cff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#282b38" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#777b8e', fontSize: 11 }} interval={2} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#777b8e', fontSize: 11 }} tickFormatter={(value) => `${value}h`} /><Tooltip contentStyle={{ background: '#20222d', border: '1px solid #383b4a', borderRadius: 8, color: '#f4f3f7', fontSize: 12 }} labelStyle={{ color: '#a3a5b5' }} formatter={(value, name) => [`${value}h`, name === 'hours' ? 'Rework hours' : 'Target']} /><Area type="monotone" dataKey="target" stroke="#666a7b" strokeWidth={1.5} strokeDasharray="5 5" fill="none" /><Area type="monotone" dataKey="hours" stroke="#9c8cff" strokeWidth={2.5} fill="url(#reworkFill)" activeDot={{ r: 5, fill: '#9c8cff', stroke: '#191a21', strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div>
            </motion.div>

            <motion.div className="panel approvals-panel" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}>
              <div className="panel-heading"><div><h2>Pending approvals</h2><p>Review before payroll cutoff</p></div><button className="text-button" onClick={() => handleNavClick('Payroll Review')}>View all <ArrowUpRight size={14} /></button></div>
              <div className="approval-list">{approvals.length ? approvals.map((approval) => <ApprovalRow key={approval.name} approval={approval} />) : <EmptyState label="No pending approvals" />}</div>
              <button className="review-button" onClick={() => handleNavClick('Payroll Review')}>Review all approvals <ArrowRightIcon /></button>
            </motion.div>
          </section>

          <section className="panel defects-panel">
            <div className="panel-heading"><div><h2>Recent defects</h2><p>Latest issues reported across your projects</p></div><div className="table-actions"><button className="filter-button"><SlidersHorizontal size={14} /> Filter</button><button className="text-button" onClick={() => handleNavClick('Defects')}>View all <ArrowUpRight size={14} /></button></div></div>
            {defects.length ? <div className="table-scroll"><table><thead><tr><th>Defect</th><th>Project</th><th>Owner</th><th>Severity</th><th>Status</th><th>Reported</th><th /></tr></thead><tbody>{defects.map((defect) => <tr key={defect.id}><td><div className="defect-title"><span>{defect.id}</span><strong>{defect.title}</strong></div></td><td className="muted-cell">{defect.project}</td><td><div className="avatar avatar-small">{defect.owner}</div></td><td><span className={`badge ${severityClass[defect.severity]}`}><i />{defect.severity}</span></td><td><span className={`badge ${statusClass[defect.status]}`}><i />{defect.status}</span></td><td className="muted-cell">{defect.date}</td><td><button className="icon-button"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div> : <EmptyState label="No defects reported" /> }
          </section>

          <footer className="page-footer"><span><ShieldCheck size={14} /> All sample data is illustrative</span><span>ReworkLedger <span className="footer-separator">·</span> v1.0.0</span></footer>
        </div>
      </main>
    </div>
  )
}

function NavButton({ item, active, expanded, onClick }: { item: NavItem; active: boolean; expanded: boolean; onClick: () => void }) {
  const IconComponent = item.icon
  return <button className={`nav-item ${active ? 'nav-item-active' : ''}`} onClick={onClick} title={!expanded ? item.label : undefined}><IconComponent size={17} /><span>{expanded && item.label}</span>{expanded && item.badge && <em>{item.badge}</em>}</button>
}

function KpiCard({ label, value, change, detail, icon: IconComponent, positive, color }: { label: string; value: string; change: string; detail: string; icon: Icon; positive: boolean; color: string }) {
  return <motion.div className="kpi-card" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}><div className={`kpi-icon kpi-${color}`}><IconComponent size={17} /></div><div className="kpi-label">{label}<MoreHorizontal size={15} /></div><strong className="kpi-value">{value}</strong><div className="kpi-change"><span className={positive ? 'change-positive' : 'change-negative'}>{positive ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{change}</span><span>{detail}</span></div></motion.div>
}

function ApprovalRow({ approval }: { approval: Approval }) {
  return <div className="approval-row"><div className="avatar" style={{ background: `${approval.color}25`, color: approval.color }}>{approval.initials}</div><div className="approval-copy"><strong>{approval.name}</strong><span>{approval.role}</span></div><div className="approval-amount"><strong>{approval.amount}</strong><span>{approval.hours}</span></div><button className="icon-button"><ChevronRight size={16} /></button></div>
}

function EmptyState({ label }: { label: string }) {
  return <div className="empty-state"><Tag size={18} /><span>{label}</span></div>
}

function ArrowRightIcon() {
  return <ArrowUpRight size={15} />
}

export default App
