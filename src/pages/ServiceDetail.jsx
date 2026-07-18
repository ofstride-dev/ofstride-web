import { useParams, Link } from 'react-router-dom'
import { ArrowRight, ArrowLeft, CheckCircle2, Users, Search, FileCheck, Landmark, Receipt, Gavel, Monitor, Cpu, Target, Globe, Phone, Mail, Calendar, MessageCircle } from 'lucide-react'

function ServiceDetail() {
  const { slug } = useParams()

  const servicesData = {
    'human-resource-consulting': {
      icon: Users,
      title: 'Human Resource Consulting',
      tagline: 'HR That Predicts. Not Just Reacts.',
      heroDesc: 'AI-driven workforce strategy, org design, and culture building — built for teams that scale.',
      whatYouGet: [
        'Workforce planning that adapts to market shifts',
        'Org structures designed for growth, not just today',
        'Culture frameworks backed by data, not guesswork',
        'Employee engagement strategies with measurable impact'
      ],
      tasksWeHandle: [
        'HR policy drafting', 'Attrition risk analysis', 'Org structure review',
        'Skill-gap assessment', 'Workforce planning', 'Culture surveys',
        'Employee handbook preparation', 'Performance framework design'
      ],
      howAIHelps: [
        { title: 'Predictive Attrition Modelling', desc: 'Know who is at risk before they leave' },
        { title: 'Automated Skill-Gap Analysis', desc: 'Identify training needs in real time' },
        { title: 'AI-Assisted Policy Drafting', desc: 'Compliance-checked, instantly' },
        { title: 'Intelligent Org-Structure Recommendations', desc: 'Optimised for performance' }
      ],
      forWhom: ['Startups scaling fast', 'MSMEs building structure', 'Enterprises optimising talent'],
      outcome: 'A workforce strategy that adapts in real time',
      related: ['executive-search-recruitment', 'payroll-hr-compliance', 'employer-of-record-workforce']
    },
    'executive-search-recruitment': {
      icon: Search,
      title: 'Executive Search & Recruitment',
      tagline: 'Find the Right Leaders. At the Right Time.',
      heroDesc: 'AI-powered talent intelligence across India. The right person, the right role, the right time.',
      whatYouGet: [
        'Leadership hiring with precision and speed',
        'Pan-India talent mapping',
        'Cultural-fit assessment beyond the resume',
        'End-to-end hiring process management'
      ],
      tasksWeHandle: [
        'Job description writing', 'Candidate sourcing', 'Resume screening',
        'Interview coordination', 'Offer management', 'Background verification',
        'Talent market mapping', 'Onboarding support'
      ],
      howAIHelps: [
        { title: 'AI-Candidate Matching', desc: 'Instant shortlisting across databases' },
        { title: 'Automated Resume Parsing', desc: 'Skill scoring without manual sorting' },
        { title: 'Predictive Cultural-Fit Analysis', desc: 'Reduce bad hires significantly' },
        { title: 'Intelligent Interview Scheduling', desc: 'Seamless coordination' }
      ],
      forWhom: ['Companies hiring leadership', 'GCCs building India teams', 'Startups finding co-founders'],
      outcome: '40% faster hiring cycles, better-quality hires',
      related: ['human-resource-consulting', 'employer-of-record-workforce', 'business-strategy-process-improvement']
    },
    'payroll-hr-compliance': {
      icon: FileCheck,
      title: 'Payroll & HR Compliance',
      tagline: 'Compliance, Handled Completely.',
      heroDesc: 'Zero-error payroll, real-time statutory monitoring, and AI-generated filings — across every state.',
      whatYouGet: [
        'Accurate payroll processing, every cycle',
        'Statutory compliance across all Indian states',
        'PF, ESI, PT, and TDS management',
        'Audit-ready documentation'
      ],
      tasksWeHandle: [
        'Monthly payroll runs', 'PF / ESI filings', 'TDS computation',
        'Payslip distribution', 'Full & final settlement', 'Audit preparation',
        'Statutory return submissions', 'Compliance calendar management'
      ],
      howAIHelps: [
        { title: 'Automated Payroll with Anomaly Detection', desc: 'Catch errors before they happen' },
        { title: 'Real-Time Compliance Monitoring', desc: 'Alerts before deadlines' },
        { title: 'AI-Generated Filings', desc: 'Auto-completed, auto-submitted' },
        { title: 'Predictive Audit-Risk Alerts', desc: 'Stay ahead of inspections' }
      ],
      forWhom: ['MSMEs without in-house HR', 'Multi-state employers', 'Fast-growing teams'],
      outcome: '100% statutory compliance, reduced manual effort',
      related: ['human-resource-consulting', 'legal-regulatory-compliance', 'financial-consulting-virtual-cfo']
    },
    'financial-consulting-virtual-cfo': {
      icon: Landmark,
      title: 'Financial Consulting & Virtual CFO',
      tagline: 'CFO Clarity. Without the Full-Time Cost.',
      heroDesc: 'AI-enhanced forecasting, cash-flow intelligence, and investor-ready financial discipline.',
      whatYouGet: [
        'Senior financial leadership on demand',
        'Real-time visibility into cash flow and profitability',
        'Budgeting, MIS, and management reporting',
        'Fundraising readiness and investor presentations'
      ],
      tasksWeHandle: [
        'Cash flow forecasting', 'MIS reporting', 'Budget preparation',
        'P&L analysis', 'Board-ready financials', 'Investor readiness',
        'Cost optimisation review', 'Working capital management'
      ],
      howAIHelps: [
        { title: 'Automated Financial Forecasting', desc: 'Scenario modelling in seconds' },
        { title: 'AI-Driven Cash-Flow Optimisation', desc: 'Alerts before problems arise' },
        { title: 'Intelligent MIS Dashboards', desc: 'Anomalies flagged automatically' },
        { title: 'Predictive Fundraising Readiness', desc: 'Know when you are ready' }
      ],
      forWhom: ['Startups preparing for funding', 'MSMEs needing financial discipline', 'Enterprises optimising costs'],
      outcome: 'Clearer numbers, faster decisions, stronger investor confidence',
      related: ['gst-tax-advisory', 'business-strategy-process-improvement', 'ai-data-science-consulting']
    },
    'gst-tax-advisory': {
      icon: Receipt,
      title: 'GST & Tax Advisory',
      tagline: 'Tax Strategy That Stays Ahead.',
      heroDesc: 'AI tracks every regulatory change. You focus on growth. We handle the complexity.',
      whatYouGet: [
        'GST registration, filing, and reconciliation',
        'Tax planning and optimisation',
        'Litigation support and representation',
        'Regulatory change monitoring'
      ],
      tasksWeHandle: [
        'GST returns filing', 'Tax planning', 'GSTR reconciliation',
        'Advance tax estimates', 'Regulatory change alerts', 'TDS return filing',
        'Input tax credit optimisation', 'Litigation support'
      ],
      howAIHelps: [
        { title: 'Automated GST Reconciliation', desc: 'Mismatch detection in real time' },
        { title: 'AI-Powered Tax-Saving Recommendations', desc: 'Never miss an opportunity' },
        { title: 'Predictive Litigation-Risk Scoring', desc: 'Proactive protection' },
        { title: 'Smart Filing Calendars', desc: 'Auto-reminders, zero missed deadlines' }
      ],
      forWhom: ['Businesses across GST regimes', 'Companies with complex tax structures'],
      outcome: 'Lower tax liability, zero surprises, audit-ready records',
      related: ['financial-consulting-virtual-cfo', 'legal-regulatory-compliance', 'business-strategy-process-improvement']
    },
    'legal-regulatory-compliance': {
      icon: Gavel,
      title: 'Legal & Regulatory Compliance',
      tagline: 'Legal Clarity. Continuous Monitoring. Zero Surprises.',
      heroDesc: 'AI-monitored compliance, smart contract review, and proactive risk flagging — across labour, corporate, and civil law.',
      whatYouGet: [
        'Labour law and industrial dispute advisory',
        'Corporate legal documentation',
        'Civil litigation and arbitration support',
        'Regulatory compliance monitoring'
      ],
      tasksWeHandle: [
        'Contract drafting & review', 'Labour law compliance', 'Corporate documentation',
        'Regulatory monitoring', 'Litigation support', 'Risk assessment',
        'Policy and handbook review', 'NDA and vendor agreement drafting'
      ],
      howAIHelps: [
        { title: 'AI-Powered Contract Review', desc: 'Risk flags in seconds' },
        { title: 'Automated Regulatory Change Alerts', desc: 'Never miss an update' },
        { title: 'Intelligent Case-Law Research', desc: 'Precedent analysis instantly' },
        { title: 'Smart Document Drafting', desc: 'Compliance-checked templates' }
      ],
      forWhom: ['Employers', 'Manufacturers', 'Enterprises with multi-state operations'],
      outcome: 'Faster legal turnaround, reduced exposure, proactive protection',
      related: ['payroll-hr-compliance', 'gst-tax-advisory', 'employer-of-record-workforce']
    },
    'it-consulting-digital-transformation': {
      icon: Monitor,
      title: 'IT Consulting & Digital Transformation',
      tagline: 'Technology That Learns With You.',
      heroDesc: 'Cloud, automation, and AI-integrated systems that adapt as your business grows.',
      whatYouGet: [
        'IT strategy and infrastructure planning',
        'Cloud migration and managed services',
        'Enterprise system implementation',
        'Digital workflow automation'
      ],
      tasksWeHandle: [
        'Infrastructure audit', 'Cloud migration planning', 'System monitoring setup',
        'Workflow automation', 'Digital strategy roadmap', 'Vendor evaluation',
        'Security & compliance review', 'Tech stack optimisation'
      ],
      howAIHelps: [
        { title: 'AI-Driven Infrastructure Optimisation', desc: 'Right-size your stack' },
        { title: 'Automated System Monitoring', desc: 'Predictive maintenance' },
        { title: 'Intelligent Cloud Cost Management', desc: 'Stop overspending' },
        { title: 'Smart Workflow Automation', desc: 'Connect departments seamlessly' }
      ],
      forWhom: ['Companies modernising legacy systems', 'Businesses scaling digitally'],
      outcome: 'Future-ready IT, lower costs, higher uptime',
      related: ['ai-data-science-consulting', 'business-strategy-process-improvement', 'human-resource-consulting']
    },
    'ai-data-science-consulting': {
      icon: Cpu,
      title: 'AI & Data Science Consulting',
      tagline: 'Build Systems That Think.',
      heroDesc: 'Custom AI agents, predictive models, and automation frameworks — we do not just advise, we architect intelligence.',
      whatYouGet: [
        'End-to-end AI strategy and implementation',
        'Custom AI agent development for business workflows',
        'Predictive analytics and machine learning models',
        'Natural language processing and document intelligence'
      ],
      tasksWeHandle: [
        'AI readiness assessment', 'ML model development', 'Process automation design',
        'Data pipeline setup', 'NLP solutions', 'Custom AI agent development',
        'Predictive analytics', 'AI integration into existing systems'
      ],
      howAIHelps: [
        { title: 'Agentic AI Workflows', desc: 'Systems that act, not just analyse' },
        { title: 'Predictive Models', desc: 'Demand, risk, and opportunity forecasting' },
        { title: 'NLP Solutions', desc: 'Customer and document intelligence' },
        { title: 'Self-Improving Systems', desc: 'Models that get smarter with data' }
      ],
      forWhom: ['Any business ready to lead with intelligence — startups, MSMEs, enterprises, GCCs'],
      outcome: 'Competitive edge through autonomous, data-driven operations',
      related: ['business-strategy-process-improvement', 'it-consulting-digital-transformation', 'financial-consulting-virtual-cfo'],
      featured: true
    },
    'business-strategy-process-improvement': {
      icon: Target,
      title: 'Business Strategy & Process Improvement',
      tagline: 'Strategy Built to Execute — With Clarity and Speed',
      heroDesc: 'AI-powered market intelligence, process optimisation, and scenario planning — your roadmap, continuously updated.',
      whatYouGet: [
        'Growth strategy and market entry planning',
        'Operational excellence and process redesign',
        'Innovation consulting and product strategy',
        'Sustainability and ESG advisory'
      ],
      tasksWeHandle: [
        'Market entry planning', 'OKR framework setup', 'Process redesign',
        'Competitor analysis', 'Scenario planning', 'Operational audit',
        'KPI dashboard design', 'Strategic roadmap development'
      ],
      howAIHelps: [
        { title: 'AI-Powered Market Intelligence', desc: 'Real-time insights' },
        { title: 'Automated Process Mapping', desc: 'Bottleneck detection instantly' },
        { title: 'Predictive Performance Dashboards', desc: 'Track what matters' },
        { title: 'Intelligent Scenario Planning', desc: 'Simulate before you commit' }
      ],
      forWhom: ['Companies entering new markets', 'Businesses optimising operations', 'Leadership teams needing clarity'],
      outcome: 'Strategies that execute themselves, processes that improve daily',
      related: ['ai-data-science-consulting', 'financial-consulting-virtual-cfo', 'it-consulting-digital-transformation']
    },
    'employer-of-record-workforce': {
      icon: Globe,
      title: 'Employer of Record (EOR) & Workforce Solutions',
      tagline: 'Hire Anywhere. Comply Everywhere.',
      heroDesc: 'Pan-India workforce expansion with AI-driven onboarding, compliance, and contractor management.',
      whatYouGet: [
        'Hire across India without legal entities',
        'Contract, payroll, and compliance management',
        'Onboarding and offboarding workflows',
        'Workforce scaling on demand'
      ],
      tasksWeHandle: [
        'Entity-free hiring', 'Multi-state compliance', 'Contractor management',
        'Onboarding workflow setup', 'Benefits administration', 'Payroll under EOR',
        'Offboarding & documentation', 'Workforce headcount planning'
      ],
      howAIHelps: [
        { title: 'Automated Multi-State Compliance', desc: 'Always current' },
        { title: 'AI-Driven Contractor Classification', desc: 'Risk scoring built-in' },
        { title: 'Intelligent Onboarding Workflows', desc: 'Document verification automated' },
        { title: 'Predictive Workforce Planning', desc: 'Scale before you need to' }
      ],
      forWhom: ['GCCs', 'Startups hiring remote talent', 'Companies expanding to new cities'],
      outcome: 'Pan-India talent access, zero compliance overhead',
      related: ['human-resource-consulting', 'executive-search-recruitment', 'payroll-hr-compliance']
    }
  }

  const service = servicesData[slug]

  if (!service) {
    return (
      <div className="pt-32 pb-20 text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">Service Not Found</h1>
        <Link to="/services" className="text-secondary hover:underline">
          View all services
        </Link>
      </div>
    )
  }

  const relatedServices = service.related.map(r => servicesData[r]).filter(Boolean)

  return (
    <div className="pt-16 sm:pt-20">
      {/* Hero */}
      <section className="py-14 sm:py-20 lg:py-28 service-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            to="/services" 
            className="inline-flex items-center gap-2 text-muted hover:text-secondary text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All Services
          </Link>

          <div className="max-w-4xl">
            {service.featured && (
              <span className="inline-block bg-secondary text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                FLAGSHIP SERVICE
              </span>
            )}

            <div className="flex items-center gap-4 mb-5 sm:mb-6">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center ${
                service.featured ? 'bg-primary text-white' : 'bg-blue-50 text-secondary'
              }`}>
                <service.icon className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-primary mb-4">
              {service.tagline}
            </h1>
            <p className="text-base sm:text-xl text-text leading-relaxed max-w-2xl">
              {service.heroDesc}
            </p>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20">
            <div>
              <span className="text-secondary text-sm font-semibold uppercase tracking-wider">
                What You Get
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary mt-2 mb-6 sm:mb-8">
                Practical outcomes, delivered.
              </h2>
              <ul className="space-y-4">
                {service.whatYouGet.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                    <span className="text-text leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surface rounded-2xl p-5 sm:p-8 lg:p-10">
              <span className="text-secondary text-sm font-semibold uppercase tracking-wider">
                How AI Helps
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary mt-2 mb-6 sm:mb-8">
                Intelligence built in.
              </h2>
              <div className="space-y-6">
                {service.howAIHelps.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-secondary font-bold text-sm">{i + 1}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">{item.title}</h4>
                      <p className="text-sm text-text">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tasks We Handle */}
      {service.tasksWeHandle && (
        <section className="py-10 sm:py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <span className="text-secondary text-sm font-semibold uppercase tracking-wider">
              Tasks We Handle
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-primary mt-2 mb-5">
              Day-to-day work we take off your plate.
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {service.tasksWeHandle.map((task, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 bg-blue-50 text-secondary px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-blue-100"
                >
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full shrink-0"></span>
                  {task}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How We Work */}
      <section className="py-10 sm:py-14 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-secondary text-sm font-semibold uppercase tracking-wider">How We Work</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-primary mt-2">
              From first call to ongoing results.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { step: '01', title: 'Discovery Call', desc: '30-minute free session to understand your needs, gaps, and goals — no obligation.' },
              { step: '02', title: 'Scoping', desc: 'We define deliverables, timelines, and measurable success metrics together.' },
              { step: '03', title: 'Delivery', desc: 'Our team executes with weekly progress updates and full transparency.' },
              { step: '04', title: 'Ongoing Support', desc: 'Continuous monitoring, reporting, and refinement as your business grows.' },
            ].map((step) => (
              <div key={step.step} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 card-hover">
                <div className="text-4xl font-bold text-blue-50 leading-none mb-3">{step.step}</div>
                <h3 className="font-bold text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Whom + Outcome */}
      <section className="py-12 sm:py-16 lg:py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12">
            <div>
              <span className="text-secondary text-sm font-semibold uppercase tracking-wider">
                For Whom
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary mt-2 mb-6">
                Built for your stage.
              </h2>
              <div className="flex flex-wrap gap-3">
                {service.forWhom.map((item, i) => (
                  <span 
                    key={i}
                    className="bg-white text-text px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium border border-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-primary text-white rounded-2xl p-5 sm:p-8 lg:p-10">
              <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                The Outcome
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">
                {service.outcome}
              </h2>
              <p className="text-slate-300 mb-6">
                Ready to see how this works for your business? Start with a free consultation.
              </p>
              <Link to="/book-call"
                className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-semibold btn-primary"
              >
                <Calendar className="w-4 h-4" />
                Book a Free Call
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related Services - rendered as in-place collapsible briefs so nothing
          navigates to a missing /services/:slug page ("Service Not Found"). */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-primary mb-8">
            Related Services
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedServices.map((related) => (
              <details
                key={related.slug}
                className="bg-white border border-slate-100 rounded-xl p-6 group"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="flex items-center gap-3">
                    <span className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 group-open:bg-primary transition-colors">
                      <related.icon className="w-5 h-5 text-secondary group-open:text-white transition-colors" />
                    </span>
                    <span className="font-bold text-primary">{related.title}</span>
                  </span>
                  <span className="text-secondary text-xl leading-none">+</span>
                </summary>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-secondary mb-2">{related.tagline}</p>
                  <p className="text-sm text-text mb-3">{related.heroDesc}</p>
                  <ul className="space-y-1.5">
                    {related.whatYouGet.slice(0, 3).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text">
                        <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-12 sm:py-16 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-4">
            Questions about {service.title}?
          </h2>
          <p className="text-text mb-8">
            Our team is ready to discuss your specific needs. Start with a free 30-minute call.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/book-call"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold btn-primary"
            >
              <Calendar className="w-4 h-4" />
              Book a Free Call
            </Link>
            <a
              href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold btn-primary"
            >
              <MessageCircle className="w-4 h-4" />
              Chat on WhatsApp
            </a>
            <Link to="/contact-form"
              className="inline-flex items-center justify-center gap-2 border-2 border-slate-200 text-primary px-6 py-3 rounded-xl font-semibold btn-secondary"
            >
              <Mail className="w-4 h-4" />
              Contact Form
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ServiceDetail
