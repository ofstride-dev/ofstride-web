import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { 
  ArrowRight, 
  Brain, 
  Shield, 
  Building2, 
  BarChart3,
  Users,
  Briefcase,
  FileText,
  Landmark,
  Gavel,
  Monitor,
  Cpu,
  Target,
  Globe,
  Phone,
  Mail,
  Calendar,
  ChevronDown,
  MessageCircle
} from 'lucide-react'

const practiceScenarios = [
  {
    icon: Building2,
    company: 'Manufacturing Co.',
    sector: '200 employees · Multi-state operations',
    narrative: 'Monthly payroll took 3 days and generated 10–12 errors per cycle. After onboarding Ofstride, AI-monitored payroll cut processing to 4 hours with zero anomalies.',
    outcome: '95% reduction in payroll errors. 100% statutory compliance.'
  },
  {
    icon: Briefcase,
    company: 'Tech Startup',
    sector: 'Hiring across 3 cities · Pre-Series A',
    narrative: 'Needed 15 senior hires in 30 days without setting up state-wise entities. EOR + recruitment ran in parallel — all positions filled on time, zero compliance risk.',
    outcome: '15 hires in 30 days. Zero entity setup required.'
  },
  {
    icon: BarChart3,
    company: 'Family-run MSME',
    sector: 'Preparing for first institutional funding',
    narrative: 'Books were maintained manually with no MIS. Ofstride rebuilt the financial architecture in 6 weeks — investor-ready P&L, cash-flow model, and virtual CFO support throughout.',
    outcome: 'Funding-ready MIS in 6 weeks. Deal closed successfully.'
  },
]

const backOfficeServices = [
  {
    icon: FileText,
    title: 'Finance, GST & Compliance',
    desc: 'GST registration and periodic filings, bookkeeping, TDS, ITR, ROC filings and audit preparedness — run on a compliance calendar so deadlines and penalty notices never surprise you.',
    slug: 'finance-gst-compliance'
  },
  {
    icon: Landmark,
    title: 'Udyam, Credit & Government Schemes',
    desc: 'Udyam registration, bank-ready project reports, working-capital and term-loan advisory, and eligibility assessment for CGTMSE, PMEGP and state subsidy schemes.',
    slug: 'udyam-credit-government-schemes'
  },
  {
    icon: Users,
    title: 'HR & Labour Compliance',
    desc: 'Employment documentation, payroll structuring, PF, ESI and Shops & Establishments compliance, plus recruitment support through a pan-India talent network.',
    slug: 'hr-labour-compliance'
  },
  {
    icon: Gavel,
    title: 'Legal & Contracts',
    desc: 'Vendor, customer and partnership agreements, labour-law and industrial dispute advisory, trademark protection, and recovery of delayed receivables under the MSMED Act.',
    slug: 'legal-contracts'
  },
  {
    icon: Target,
    title: 'Growth Strategy',
    desc: 'Pricing and margin analysis, market expansion, GeM and e-commerce onboarding, export readiness and process optimisation — actionable plans, not presentations.',
    slug: 'growth-strategy'
  },
  {
    icon: Cpu,
    title: 'Technology & AI Adoption',
    desc: 'Right-sized billing, inventory and CRM systems, workflow automation, custom AI agents and predictive models — built for lean teams and measured returns.',
    slug: 'technology-ai-adoption'
  },
]

const orbitServices = [
  { icon: FileText, label: 'Finance', sublabel: 'GST & Tax', angle: 0 },
  { icon: Landmark, label: 'Credit', sublabel: 'Udyam & Loans', angle: 60 },
  { icon: Users, label: 'HR', sublabel: 'Payroll & PF/ESI', angle: 120 },
  { icon: Gavel, label: 'Legal', sublabel: 'Contracts', angle: 180 },
  { icon: Target, label: 'Growth', sublabel: 'Strategy', angle: 240 },
  { icon: Cpu, label: 'Tech', sublabel: 'AI Systems', angle: 300 },
]

function LeadCaptureForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const webhookUrl = import.meta.env.VITE_LEAD_WEBHOOK_URL

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'msme-compliance-calendar', timestamp: new Date().toISOString() })
        })
      }
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-white">
        <span className="text-emerald-300 font-bold text-2xl">✓</span>
        <p className="font-semibold">You're on the list!</p>
        <p className="text-sm text-slate-200">We'll send the calendar to <strong>{email}</strong> shortly.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your work email"
        className="flex-1 border border-white/20 bg-white/10 text-white placeholder:text-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/60 focus:ring-2 focus:ring-white/15"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 bg-white text-primary px-6 py-3 rounded-xl font-semibold text-sm btn-primary disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Get the Calendar →'}
      </button>
    </form>
  )
}

function Home() {
  const revealRefs = useRef([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            entry.target.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'))
          }
        })
      },
      { threshold: 0.1 }
    )

    revealRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  const addToRefs = (el) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el)
    }
  }

  const clients = [
    'Cherry Pick Fine Furniture',
    'Fitness For Life',
    'Apple Industries',
    'Navshali Innovations',
    'Bokaro Steel City College',
  ]

  const whyPoints = [
    {
      icon: Shield,
      title: 'Defence + Corporate Discipline',
      desc: '32+ years of leadership experience. Precision in every execution.'
    },
    {
      icon: Brain,
      title: 'AI-First by Design',
      desc: 'Automation, prediction, and intelligence in every service we deliver.'
    },
    {
      icon: Building2,
      title: 'Multi-Discipline, One Partner',
      desc: 'HR, Finance, Legal, IT, AI — aligned under one roof.'
    },
    {
      icon: BarChart3,
      title: 'Measurable Outcomes',
      desc: 'KPIs tracked, results reported, value proven.'
    },
  ]

  const industries = [
    'Manufacturing', 'Engineering', 'Healthcare', 'Hospitality',
    'Retail', 'Insurance', 'Pharmaceuticals', 'Technology',
    'Logistics', 'Education', 'Wellness & Fitness', 'Startups',
    'MSMEs', 'GCCs'
  ]

  return (
    <div>
      {/* Hero Section */}
      <section className="min-h-screen flex items-start hero-pattern pt-16 sm:pt-20 lg:pt-24">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-start">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-secondary px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                <span className="w-2 h-2 bg-accent rounded-full ai-badge"></span>
                AI-Powered Compliance &amp; Back-Office for Indian MSMEs
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight mb-4 sm:mb-6">
                Your compliance, finance and HR — handled.<br />
                <span className="gradient-text">Fixed fees, AI speed.</span>
              </h1>

              <p className="text-base sm:text-lg text-text leading-relaxed mb-6 sm:mb-8 max-w-xl">
                Ofstride runs the back office of India's micro, small and medium enterprises: GST and tax filings, Udyam and bank credit, payroll and labour compliance, contracts and recovery — one senior team, one predictable monthly fee.
              </p>

              {/* Mobile Hero Visual — What We Handle */}
              <div className="lg:hidden mb-6 sm:mb-8">
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-primary via-slate-900 to-slate-800 text-white shadow-2xl p-4 sm:p-5">
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
                    What we handle for you
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      'GST, TDS & ITR filings',
                      'Udyam, loans & schemes',
                      'Payroll, PF/ESI & policies',
                      'Contracts & MSMED recovery',
                      'Practical AI & systems',
                    ].map((task) => (
                      <div key={task} className="flex items-start gap-2 text-[11px] sm:text-xs text-slate-100/90">
                        <span className="mt-1 w-1.5 h-1.5 bg-secondary rounded-full shrink-0"></span>
                        <span>{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                <Link to="/book-call"
                  className="btn-primary inline-flex items-center justify-center sm:justify-start gap-2 bg-primary text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base"
                >
                  <Calendar className="w-4 h-4" />
                  Book a Free Call
                </Link>
                <Link 
                  to="/services"
                  className="btn-secondary inline-flex items-center justify-center sm:justify-start gap-2 border-2 border-slate-200 text-primary px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl font-semibold text-sm sm:text-base"
                >
                  Explore Services
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                  <span>New Delhi & Bengaluru</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                  <span>Since 2019</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                  <span>32+ Years Leadership</span>
                </div>
              </div>

              {/* What We Handle — desktop sidebar */}
              <div className="hidden lg:block mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary mb-3">What we handle for you</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                  {['GST, TDS & ITR filings', 'Udyam, loans & schemes', 'Payroll, PF/ESI & policies', 'Contracts & MSMED recovery', 'Practical AI & systems'].map((task) => (
                    <div key={task} className="flex items-center gap-1.5 text-xs text-text">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full shrink-0"></span>
                      {task}
                    </div>
                  ))}
                </div>
              </div>

              {/* WhatsApp CTA — below hero text */}
              <div className="mt-5">
                <a
                  href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Or chat with us on WhatsApp
                </a>
              </div>
            </div>

            {/* Hero Visual — Service Orbit */}
            <div className="hidden lg:flex flex-col gap-5">
              <div className="relative animate-float">
                <div className="orbit-stage">
                  <div className="orbit-track">
                    {orbitServices.map((item) => {
                      const Icon = item.icon
                      return (
                        <div
                          key={item.label}
                          className="orbit-item"
                          style={{ '--orbit-angle': `${item.angle}deg`, '--orbit-radius': '138px' }}
                        >
                          <div className="orbit-pill">
                            <span className="orbit-icon-wrap">
                              <Icon className="w-4 h-4 text-secondary" />
                            </span>
                            <span className="orbit-label">{item.label}</span>
                            <span className="orbit-subtitle">{item.sublabel}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="orbit-ring orbit-ring-outer"></div>
                  <div className="orbit-ring orbit-ring-inner"></div>

                  <div className="orbit-center">
                    <img src="/logo-dark.png" alt="Ofstride Services LLP" />
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar — auto-scroll ticker */}
      <section className="bg-surface py-6 sm:py-8 border-y border-slate-100 overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-muted uppercase tracking-wider mb-4 font-medium">
            Trusted by teams at
          </p>
        </div>
        <div className="overflow-hidden">
          <div className="ticker-track items-center gap-x-10 sm:gap-x-16 gap-y-2 py-1">
            {[...clients, ...clients].map((client, i) => (
              <span key={i} className="text-slate-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                {client}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Services Bento Grid */}
      <section className="py-16 sm:py-24 lg:py-32" ref={addToRefs}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <span className="inline-block text-secondary text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 sm:mb-3">
              Our Services
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-3 sm:mb-4">
              The complete MSME back office, under one roof.
            </h2>
            <p className="text-sm sm:text-base text-text max-w-2xl mx-auto">
              Stop coordinating a CA, a lawyer, an HR consultant and an IT vendor. One accountable team, AI-accelerated delivery, fixed fees.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 reveal">
            {backOfficeServices.map((service, index) => (
              <Link
                key={service.slug}
                to="/services"
                className="card-hover bg-white border border-slate-100 rounded-2xl p-5 sm:p-8 group overflow-hidden relative"
                style={{ transitionDelay: `${index * 0.07}s` }}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary via-sky-400 to-accent opacity-70"></div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <service.icon className="w-5 h-5 sm:w-6 sm:h-6 text-secondary group-hover:text-white transition-colors" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-primary mb-2 group-hover:text-secondary transition-colors">
                  {service.title}
                </h3>
                <p className="text-text text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4">
                  {service.desc}
                </p>
                <span className="inline-flex items-center gap-1 text-secondary text-xs sm:text-sm font-medium group-hover:gap-2 transition-all">
                  Learn more <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </span>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link 
              to="/services"
              className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all"
            >
              View All 10 Services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Ofstride */}
      <section className="py-16 sm:py-24 lg:py-32 bg-surface" ref={addToRefs}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <span className="inline-block text-secondary text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 sm:mb-3">
              Why Us
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-primary mb-4">
              The Depth of Senior Expertise.<br />The Speed of Modern Tools.
            </h2>
            <p className="text-text max-w-2xl mx-auto">
              Every solution we deliver is built with senior oversight, practical execution, and tools that reduce friction.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 reveal">
            {whyPoints.map((point, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-5 sm:p-8 border border-slate-100 card-hover"
                style={{ transitionDelay: `${index * 0.08}s` }}
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                  <point.icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-primary mb-2">
                  {point.title}
                </h3>
                <p className="text-text text-sm leading-relaxed">
                  {point.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link 
              to="/about"
              className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all"
            >
              Meet Our Team <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* What This Looks Like in Practice */}
      <section className="py-16 sm:py-24" ref={addToRefs}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 reveal">
            <span className="inline-block text-secondary text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 sm:mb-3">
              What This Looks Like in Practice
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-primary mb-4">
              Real scenarios. Real outcomes.
            </h2>
            <p className="text-text max-w-2xl mx-auto">
              Here's how Ofstride has helped businesses move faster, stay compliant, and grow with confidence.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 reveal">
            {practiceScenarios.map((scenario, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 border border-slate-100 card-hover flex flex-col"
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                    <scenario.icon className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="font-bold text-primary text-sm leading-tight">{scenario.company}</p>
                    <p className="text-xs text-muted">{scenario.sector}</p>
                  </div>
                </div>
                <p className="text-sm text-text leading-relaxed mb-4 flex-1">{scenario.narrative}</p>
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-xs font-semibold text-accent">{scenario.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Magnet */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-slate-900/10 bg-gradient-to-br from-primary via-slate-900 to-slate-800 text-white shadow-[0_30px_90px_-35px_rgba(0,17,80,0.7)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.16),transparent_30%)]"></div>
            <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center p-6 sm:p-10 lg:p-12">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.24em] text-slate-200 mb-4 sm:mb-5">
                  Free download
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
                  MSME Compliance Calendar FY 2026–27
                </h2>
                <p className="text-slate-200 text-sm sm:text-base leading-relaxed max-w-2xl">
                  Every GST, TDS, PF/ESI and ROC deadline for the year, in one printable calendar — plus a monthly reminder email so nothing slips.
                </p>
                <div className="mt-5 sm:mt-6 flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  No spam — one useful email a month. Unsubscribe anytime. (Demo form — connect your email tool.)
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-6">
                <LeadCaptureForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 sm:py-24 lg:py-32" ref={addToRefs}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 reveal">
            <span className="inline-block text-secondary text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 sm:mb-3">
              Industries
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-primary mb-4">
              Built for Every Sector.<br />Powered by Intelligence.
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((industry) => (
              <span 
                key={industry}
                className="bg-surface text-text px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium border border-slate-100 hover:border-secondary hover:text-secondary transition-colors cursor-default"
              >
                {industry}
              </span>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link 
              to="/industries"
              className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all"
            >
              See Industries We Serve <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20" ref={addToRefs}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 reveal">
            <span className="inline-block text-secondary text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2">FAQ</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-primary">Quick Answers</h2>
          </div>
          <div className="space-y-4 reveal">
            {[
              {
                q: 'How quickly can we get started?',
                a: 'We can schedule your discovery call within 48 hours. Most clients are fully onboarded within 5–7 business days of the first conversation.'
              },
              {
                q: 'Do you work with small businesses and startups?',
                a: 'Yes. We serve MSMEs, startups, and enterprises. Our engagements are structured around your stage and scale — not a one-size-fits-all retainer.'
              },
              {
                q: 'What makes Ofstride different from traditional consulting?',
                a: "We don't just advise — we implement. Every service is AI-augmented, which means we deliver faster, flag issues earlier, and continuously adapt. You get outcomes, not slide decks."
              },
            ].map((faq, i) => (
              <details key={i} className="bg-white rounded-xl border border-slate-100 group">
                <summary className="flex items-center justify-between cursor-pointer list-none p-5 font-semibold text-primary">
                  {faq.q}
                  <ChevronDown className="w-5 h-5 text-secondary shrink-0 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-text text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 lg:py-32 bg-primary text-white" ref={addToRefs}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Build Smarter?
          </h2>
          <p className="text-slate-300 text-base sm:text-lg mb-10">
            Book a free 30-minute consultation. No pitch decks. 
            Just clarity on your next move.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-10">
            <Link to="/book-call"
              className="inline-flex items-center justify-center gap-2 bg-secondary text-white px-8 py-4 rounded-xl font-semibold text-lg btn-primary"
            >
              <Calendar className="w-5 h-5" />
              Book a Free Call
            </Link>
            <a
              href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border-2 border-emerald-400/50 text-white px-8 py-4 rounded-xl font-semibold hover:bg-emerald-600/30 transition-colors text-lg"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              WhatsApp Us
            </a>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 text-slate-400 text-sm">
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> New Delhi | Bengaluru
            </span>
            <a href="mailto:support@ofstrideservices.com" className="flex items-center gap-2 hover:text-white transition-colors">
              <Mail className="w-4 h-4" /> support@ofstrideservices.com
            </a>
            <a href="tel:+918951606862" className="flex items-center gap-2 hover:text-white transition-colors">
              <Phone className="w-4 h-4" /> +91 89516 06862
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
