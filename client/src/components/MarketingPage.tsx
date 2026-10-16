import { ArrowDown, ArrowRight, BarChart3, Bug, Check, Code2, Layers3, ShieldCheck, Sparkles } from 'lucide-react'

const contacts = [
  { name: 'Kishore B', role: 'AI/ML', phone: '+9443459175', href: 'tel:+9443459175' },
  { name: 'Pavin M', role: 'Development', phone: '+91 9361355077', href: 'tel:+919361355077' },
  { name: 'Jagadeesan G', role: 'Development', phone: '+91 9363563975', href: 'tel:+919363563975' },
  { name: 'Gokul Shandar K', role: 'Development', phone: '+91 9363430930', href: 'tel:+919363430930' },
]

const services = [
  {
    icon: Layers3,
    number: '01',
    title: 'Project delivery',
    description: 'Keep projects, tasks, ownership, and progress together, so teams know what is moving and what needs attention.',
  },
  {
    icon: Bug,
    number: '02',
    title: 'Defect & rework tracking',
    description: 'Record issues with clear debug instructions, follow corrective work, and keep the review process accountable.',
  },
  {
    icon: Code2,
    number: '03',
    title: 'Code analysis',
    description: 'Combine static checks with optional local AI suggestions. Findings stay reviewable before they become assignments.',
  },
  {
    icon: BarChart3,
    number: '04',
    title: 'Quality insights',
    description: 'Turn delivery and rework activity into practical signals that help teams improve their next release.',
  },
]

export function MarketingPage({ onLogin }: { onLogin: () => void }) {
  return <main className="marketing-page">
    <header className="marketing-nav">
      <a className="marketing-brand" href="#home" aria-label="ReworkLedger home">
        <span className="brand-mark"><span>R</span></span>
        <span className="brand-name">Rework<span>Ledger</span></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#home">Home</a>
        <a href="#services">Services</a>
        <a href="#about">About Us</a>
        <a href="#contact">Contact Us</a>
      </nav>
      <button className="marketing-login" onClick={onLogin}>Login <ArrowRight size={15} /></button>
    </header>

    <section className="marketing-hero" id="home">
      <div className="marketing-hero-copy">
        <span className="marketing-eyebrow"><span /> A clearer way to deliver quality</span>
        <h1>Build better work.<br /><em>Learn from every</em> rework.</h1>
        <p>ReworkLedger brings project delivery, defect tracking, code analysis, and quality insights into one workspace built for teams that want to keep improving.</p>
        <div className="marketing-hero-actions">
          <button className="marketing-primary" onClick={onLogin}>Explore the workspace <ArrowRight size={16} /></button>
          <a className="marketing-secondary" href="#services">Discover what you can do <ArrowDown size={15} /></a>
        </div>
        <div className="marketing-proof"><span><Check size={14} /> One connected workflow</span><span><Check size={14} /> Human-reviewed insights</span></div>
      </div>

      <div className="marketing-demo" aria-label="Animated illustrative preview of the ReworkLedger dashboard">
        <div className="demo-glow" />
        <div className="demo-window">
          <div className="demo-window-top"><div className="demo-dots"><i /><i /><i /></div><span>REWORKLEDGER · QUALITY OVERVIEW</span><span className="demo-window-mark">R</span></div>
          <div className="demo-window-content">
            <div className="demo-sidebar"><span className="demo-side-logo">R</span><i className="active" /><i /><i /><i /><i /></div>
            <div className="demo-dashboard">
              <div className="demo-greeting"><div><small>WORKSPACE OVERVIEW</small><strong>Quality at a glance</strong></div><span>Last 14 days⌄</span></div>
              <div className="demo-metrics">
                <div><small>ACTIVE PROJECTS</small><strong>04</strong><span>Delivery in progress</span></div>
                <div><small>OPEN DEFECTS</small><strong>08</strong><span>Across your projects</span></div>
                <div><small>REWORK HOURS</small><strong>12.5</strong><span>Corrective work logged</span></div>
              </div>
              <div className="demo-chart-card">
                <div className="demo-chart-heading"><span><small>REWORK TREND</small><strong>Time spent improving</strong></span><span className="demo-chart-key"><i /> Corrective work</span></div>
                <div className="demo-chart">
                  <div className="demo-chart-grid"><i /><i /><i /><i /></div>
                  <svg viewBox="0 0 520 130" preserveAspectRatio="none" aria-hidden="true">
                    <defs><linearGradient id="demo-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b88f69" stopOpacity=".24" /><stop offset="100%" stopColor="#b88f69" stopOpacity="0" /></linearGradient></defs>
                    <path className="demo-chart-area" d="M0 103 C42 98 42 74 86 79 S130 105 173 83 S215 64 260 72 S303 35 346 49 S390 68 433 37 S480 42 520 14 L520 130 L0 130 Z" />
                    <path className="demo-chart-line" d="M0 103 C42 98 42 74 86 79 S130 105 173 83 S215 64 260 72 S303 35 346 49 S390 68 433 37 S480 42 520 14" />
                    <circle cx="433" cy="37" r="4" /><circle cx="520" cy="14" r="4" />
                  </svg>
                  <div className="demo-chart-labels"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>
                </div>
              </div>
              <div className="demo-bottom-cards">
                <div><small>QUALITY SIGNAL</small><span><b className="demo-signal-dot" /> API integration</span><i><b /></i><small>3 tracked defects · 2 resolved</small></div>
                <div className="demo-analysis-card"><span className="demo-analysis-icon"><Sparkles size={14} /></span><span><small>CODE ANALYSIS</small><strong>Review findings before assigning</strong></span><ArrowRight size={14} /></div>
              </div>
            </div>
          </div>
        </div>
        <div className="demo-float demo-float-top"><span className="demo-float-icon"><ShieldCheck size={16} /></span><span><small>REVIEWED</small><strong>Human in the loop</strong></span><Check size={14} /></div>
        <div className="demo-float demo-float-bottom"><span className="demo-float-icon demo-float-bug"><Bug size={16} /></span><span><small>DEBUG ASSIGNMENT</small><strong>Sent to the right owner</strong></span><ArrowRight size={14} /></div>
        <span className="demo-caption">Illustrative product preview</span>
      </div>
    </section>

    <div className="marketing-ribbon" aria-label="ReworkLedger capabilities">
      <span>PROJECT DELIVERY</span><i /><span>DEFECT MANAGEMENT</span><i /><span>CODE ANALYSIS</span><i /><span>QUALITY INTELLIGENCE</span>
    </div>

    <section className="marketing-services marketing-section" id="services">
      <div className="marketing-section-intro"><span className="marketing-eyebrow">THE WORKSPACE</span><h2>Everything connected.<br /><em>Nothing lost in handoffs.</em></h2><p>From the first task to the final review, ReworkLedger helps teams keep the context that makes quality work possible.</p></div>
      <div className="marketing-service-grid">{services.map(({ icon: Icon, number, title, description }) => <article className="marketing-service-card" key={number}>
        <div className="service-card-top"><span className="service-icon"><Icon size={19} /></span><span>{number}</span></div>
        <h3>{title}</h3><p>{description}</p><a href="#about" aria-label={`Learn more about ${title}`}>Learn more <ArrowRight size={14} /></a>
      </article>)}</div>
    </section>

    <section className="marketing-about marketing-section" id="about">
      <div className="about-mark" aria-hidden="true"><span>R</span><i /><i /><i /></div>
      <div className="about-copy"><span className="marketing-eyebrow">ABOUT LOGICBRUTUES</span><h2>Technology should solve<br /><em>problems that matter.</em></h2><p>LogicBrutues is built to find solutions to real-world problems. We believe useful software should make complex work clearer, connect people with the information they need, and help teams learn from what happens along the way.</p><p>ReworkLedger is one expression of that belief: a practical workspace for tracking delivery, understanding defects, and improving quality together.</p><button className="about-link" onClick={onLogin}>See ReworkLedger in action <ArrowRight size={15} /></button></div>
    </section>

    <section className="marketing-cta">
      <div><span className="marketing-eyebrow">MAKE THE NEXT CYCLE BETTER</span><h2>Turn rework into a reason<br />to <em>improve.</em></h2></div>
      <button className="marketing-primary" onClick={onLogin}>Go to your workspace <ArrowRight size={16} /></button>
      <div className="cta-decoration"><i /><i /><i /><i /><i /></div>
    </section>

    <footer className="marketing-footer" id="contact">
      <div className="footer-main">
        <div className="footer-brand-block"><a className="marketing-brand" href="#home"><span className="brand-mark"><span>R</span></span><span className="brand-name">Rework<span>Ledger</span></span></a><p>A thoughtful workspace for teams building better software and better ways of working.</p></div>
        <div className="footer-links"><strong>Explore</strong><a href="#home">Home</a><a href="#services">Services</a><a href="#about">About Us</a><button onClick={onLogin}>Login <ArrowRight size={13} /></button></div>
        <div className="footer-contact"><strong>Contact Us</strong><p>Connect with the team behind ReworkLedger.</p><div className="contact-grid">{contacts.map(({ name, role, phone, href }) => <a className="contact-card" href={href} key={name}><span><b>{name}</b><small>{role}</small></span><span>{phone}</span></a>)}</div></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} LogicBrutues · ReworkLedger</span><a href="#home">Back to top ↑</a></div>
    </footer>
  </main>
}
