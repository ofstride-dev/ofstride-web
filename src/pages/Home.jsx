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
          body: JSON.stringify({ email, source: 'ai-readiness-checklist', timestamp: new Date().toISOString() })
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
      <div className="flex flex-col items-center gap-2 py-2">
        <span className="text-accent font-bold text-2xl">✓</span>
        <p className="font-semibold text-primary">You're on the list!</p>
        <p className="text-text text-sm">We'll send the checklist to <strong>{email}</strong> shortly.</p>
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
        placeholder="Your business email"
        className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-secondary"
      />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-semibold text-sm btn-primary disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Get Free Checklist →'}
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

  const services = [
    {
      icon: Users,
      title: 'Human Resources',
      desc: 'AI-driven workforce strategy, org design, and culture building.',
      slug: 'human-resource-consulting',
      ai: true
    },
    {
      icon: Landmark,
      title: 'Finance & Tax',
      desc: 'Predictive forecasting, virtual CFO, and AI-tracked tax strategy.',
      slug: 'financial-consulting-virtual-cfo',
      ai: true
    },
    {
      icon: Gavel,
      title: 'Legal Advisory',
      desc: 'Smart compliance monitoring and proactive risk flagging.',
      slug: 'legal-regulatory-compliance',
      ai: false
    },
    {
      icon: Monitor,
      title: 'IT & Digital',
      desc: 'Cloud, automation, and AI-integrated systems that adapt.',
      slug: 'it-consulting-digital-transformation',
      ai: false
    },
    {
      icon: Cpu,
      title: 'AI & Data Science',
      desc: 'Custom AI agents, predictive models, and automation frameworks.',
      slug: 'ai-data-science-consulting',
      ai: true
    },
    {
      icon: Target,
      title: 'Business Strategy',
      desc: 'Market intelligence and scenario planning that executes itself.',
      slug: 'business-strategy-process-improvement',
      ai: false
    },
  ]

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
                AI-Powered Business Consulting
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight mb-4 sm:mb-6">
                Build a Business<br />
                <span className="gradient-text">That Thinks Ahead.</span>
              </h1>

              <p className="text-base sm:text-lg text-text leading-relaxed mb-6 sm:mb-8 max-w-xl">
                AI-powered consulting for HR, finance, legal, and IT. 
                Where human expertise meets intelligent systems.
              </p>

              {/* Mobile Hero Visual — What We Handle */}
              <div className="lg:hidden mb-6 sm:mb-8">
                <div className="hero-orb rounded-2xl border border-blue-100 bg-white/90 backdrop-blur-sm p-4 sm:p-5">
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
                    What we handle for you
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {['Payroll processing', 'GST filings', 'HR policy drafting', 'Legal contracts', 'Recruitment', 'IT systems'].map((task) => (
                      <div key={task} className="flex items-center gap-1.5 text-[11px] sm:text-xs text-text">
                        <span className="w-1.5 h-1.5 bg-accent rounded-full shrink-0"></span>
                        {task}
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
                  {['Payroll processing', 'GST filings', 'HR policy drafting', 'Legal contracts', 'Recruitment', 'IT & digital', 'Tax planning', 'Compliance alerts'].map((task) => (
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
                <div className="relative w-full max-w-md mx-auto">
                  <svg viewBox="0 0 400 400" className="w-full h-full">
                    {/* Orbit rings */}
                    <circle cx="200" cy="200" r="140" fill="none" stroke="#0023a0" strokeWidth="1" opacity="0.18" strokeDasharray="6 4" />
                    <circle cx="200" cy="200" r="80" fill="none" stroke="#0023a0" strokeWidth="1" opacity="0.1" strokeDasharray="4 4" />

                    {/* Spoke lines */}
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                      const rad = (angle - 90) * Math.PI / 180
                      const x = 200 + 140 * Math.cos(rad)
                      const y = 200 + 140 * Math.sin(rad)
                      return <line key={i} x1="200" y1="200" x2={x} y2={y} stroke="#0023a0" strokeWidth="1" opacity="0.12" />
                    })}

                    {/* Center node */}
                    <circle cx="200" cy="200" r="46" fill="#001150" />
                    <text x="200" y="197" textAnchor="middle" fill="white" fontSize="9.5" fontWeight="bold" fontFamily="Inter,system-ui,sans-serif">OFSTRIDE</text>
                    <text x="200" y="211" textAnchor="middle" fill="#10B981" fontSize="7.5" fontFamily="Inter,system-ui,sans-serif">Intelligence</text>

                    {/* Pulse ring */}
                    <circle cx="200" cy="200" r="46" fill="none" stroke="#0023a0" strokeWidth="2" opacity="0.3">
                      <animate attributeName="r" values="46;72;46" dur="3.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0;0.3" dur="3.5s" repeatCount="indefinite" />
                    </circle>

                    {/* Service chips */}
                    {[
                      { label: 'HR', sub: 'People', angle: 0 },
                      { label: 'Finance', sub: 'Virtual CFO', angle: 60 },
                      { label: 'Legal', sub: 'Compliance', angle: 120 },
                      { label: 'IT', sub: 'Digital', angle: 180 },
                      { label: 'AI', sub: 'Data Science', angle: 240 },
                      { label: 'Strategy', sub: 'Growth', angle: 300 },
                    ].map((item, i) => {
                      const rad = (item.angle - 90) * Math.PI / 180
                      const x = 200 + 140 * Math.cos(rad)
                      const y = 200 + 140 * Math.sin(rad)
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="30" fill="white" stroke="#0023a0" strokeWidth="1.5" opacity="0.95" />
                          <text x={x} y={y - 1} textAnchor="middle" fill="#001150" fontSize="8.5" fontWeight="bold" fontFamily="Inter,system-ui,sans-serif">{item.label}</text>
                          <text x={x} y={y + 11} textAnchor="middle" fill="#2563EB" fontSize="6.5" fontFamily="Inter,system-ui,sans-serif">{item.sub}</text>
                        </g>
                      )
                    })}

                    {/* Rotating dots */}
                    <circle cx="200" cy="60" r="5" fill="#10B981">
                      <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="18s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="340" cy="200" r="4" fill="#2563EB" opacity="0.6">
                      <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="-360 200 200" dur="14s" repeatCount="indefinite" />
                    </circle>
                  </svg>
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
              What We Do
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-3 sm:mb-4">
              AI at Every Layer
            </h2>
            <p className="text-sm sm:text-base text-text max-w-2xl mx-auto">
              Every service is designed with intelligent systems at its core — 
              so your business moves faster, decides smarter, and scales without friction.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 reveal">
            {services.map((service, index) => (
              <Link
                key={service.slug}
                to={`/services/${service.slug}`}
                className="card-hover bg-white border border-slate-100 rounded-xl sm:rounded-2xl p-5 sm:p-8 group"
                style={{ transitionDelay: `${index * 0.07}s` }}
              >
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <service.icon className="w-5 h-5 sm:w-6 sm:h-6 text-secondary group-hover:text-white transition-colors" />
                  </div>
                  {service.ai && (
                    <span className="text-xs font-semibold text-accent bg-emerald-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ai-badge">
                      AI-Enabled
                    </span>
                  )}
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
              Not Traditional Consulting.<br />Intelligent Consulting.
            </h2>
            <p className="text-text max-w-2xl mx-auto">
              Every solution we deliver is built with AI and agentic thinking at its core.
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

      {/* Free Services Banner */}
      <section className="py-12 sm:py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Calendar className="w-4 h-4" />
            Free Initial Consultation
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold mb-4">
            Start With a Free 30-Minute Call
          </h2>
          <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
            No commitment. No pitch decks. Just a conversation about your business 
            and how we can help — completely free.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/book-call"
              className="inline-flex items-center justify-center gap-2 bg-secondary text-white px-8 py-4 rounded-xl font-semibold btn-primary"
            >
              <Calendar className="w-5 h-5" />
              Book Your Free Call
            </Link>
            <a
              href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border-2 border-emerald-400/50 text-white px-8 py-4 rounded-xl font-semibold hover:bg-emerald-600/30 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              Chat on WhatsApp
            </a>
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

      {/* Lead Magnet */}
      <section className="py-12 sm:py-16 bg-surface">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
            <span className="inline-block text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Free Resource</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
              Get Your Free AI Readiness Checklist
            </h2>
            <p className="text-text text-sm mb-6">
              10 questions to assess how AI-ready your business operations are — and where to start.
            </p>
            <LeadCaptureForm />
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
