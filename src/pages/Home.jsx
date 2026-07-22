import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import HeroRightGraphic from '../components/HeroRightGraphic.jsx'
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

const orbitEdgePoints = [
  {
    icon: FileText,
    title: 'GST, TDS & ITR filings',
    subtitle: 'Managed compliance calendar',
    angle: 0,
    cardPosition: { left: 50, top: 15 },
    color: '#2563EB',
    glow: 'rgba(37, 99, 235, 0.28)',
  },
  {
    icon: Landmark,
    title: 'Udyam, loans & schemes',
    subtitle: 'Bank-ready documentation',
    angle: 72,
    cardPosition: { left: 80, top: 31 },
    color: '#0284C7',
    glow: 'rgba(2, 132, 199, 0.24)',
  },
  {
    icon: Users,
    title: 'Payroll, PF/ESI & policies',
    subtitle: 'From your first hire',
    angle: 144,
    cardPosition: { left: 72, top: 73 },
    color: '#0F766E',
    glow: 'rgba(15, 118, 110, 0.24)',
  },
  {
    icon: Gavel,
    title: 'Contracts & MSMED recovery',
    subtitle: 'Get paid on time',
    angle: 216,
    cardPosition: { left: 28, top: 73 },
    color: '#7C3AED',
    glow: 'rgba(124, 58, 237, 0.24)',
  },
  {
    icon: Cpu,
    title: 'Practical AI & systems',
    subtitle: 'Billing, inventory, automation',
    angle: 288,
    cardPosition: { left: 20, top: 31 },
    color: '#DB2777',
    glow: 'rgba(219, 39, 119, 0.24)',
  },
]

const getOrbitPoint = (angle, radius, cardRadius = 44) => {
  const rad = (angle - 90) * Math.PI / 180

  return {
    x: 200 + radius * Math.cos(rad),
    y: 200 + radius * Math.sin(rad),
    left: 50 + cardRadius * Math.cos(rad),
    top: 50 + cardRadius * Math.sin(rad),
  }
}

function Home() {
  const revealRefs = useRef([])
  const [activeOrbitTitle, setActiveOrbitTitle] = useState(null)

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
      <section className="min-h-screen flex items-start hero-pattern pt-12 sm:pt-16 lg:pt-14">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-start">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-secondary px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                <span className="w-2 h-2 bg-accent rounded-full ai-badge"></span>
                AI-Powered Compliance &amp; Back-Office for Indian MSMEs
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight mb-4 sm:mb-6">
                Build a Business<br />
                <span className="gradient-text">That Thinks Ahead.</span>
              </h1>

              <p className="text-base sm:text-lg text-text leading-relaxed mb-6 sm:mb-8 max-w-xl">
                Ofstride runs the back office of India's micro, small and medium enterprises: GST and tax filings, Udyam and bank credit, payroll and labour compliance, contracts and recovery — one senior team, one predictable monthly fee.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm p-2.5 sm:p-3 inline-block max-w-full shadow-sm">
                <div className="flex flex-nowrap items-center gap-2 sm:gap-3 overflow-x-auto">
                <Link to="/book-call"
                  className="btn-primary inline-flex items-center justify-center gap-2 bg-primary text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4" />
                  Book a Free Call
                </Link>
                <Link 
                  to="/services"
                  className="btn-secondary inline-flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 text-secondary px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap"
                >
                  Explore Services
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 border border-emerald-700 bg-emerald-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Us
                </a>
                </div>
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

            </div>

            {/* Hero Visual — Ofstride Core Engine */}
            <div className="flex flex-col gap-5 lg:-mt-8">
              <HeroRightGraphic />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar — auto-scroll ticker */}
      <section className="bg-surface py-4 sm:py-6 border-y border-slate-100 overflow-hidden">
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
      <section className="py-10 sm:py-14 lg:py-16" ref={addToRefs}>
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
            <p className="mt-4 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs sm:text-sm font-semibold text-secondary">
              Transforming Businesses Through IT Strategy, AI, & Data Science
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 reveal">
            {backOfficeServices.map((service, index) => (
              <Link
                key={service.slug}
                to="/services"
                className="card-hover bg-white border border-slate-100 rounded-xl sm:rounded-2xl p-5 sm:p-8 group overflow-hidden"
                style={{ transitionDelay: `${index * 0.07}s` }}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <service.icon className="w-5 h-5 sm:w-6 sm:h-6 text-secondary group-hover:text-white transition-colors" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-primary group-hover:text-secondary transition-colors">
                  {service.title}
                </h3>
                <div className="max-h-0 opacity-0 mt-0 group-hover:max-h-28 group-hover:opacity-100 group-hover:mt-3 transition-all duration-300 ease-out">
                  <p className="text-text text-xs sm:text-sm leading-relaxed">
                    {service.desc}
                  </p>
                </div>
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
      <section className="py-10 sm:py-14 lg:py-16 bg-surface" ref={addToRefs}>
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
      <section className="py-12 sm:py-16" ref={addToRefs}>
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

      {/* Industries */}
      <section className="py-10 sm:py-14 lg:py-16" ref={addToRefs}>
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
      <section className="py-12 sm:py-16" ref={addToRefs}>
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
      <section className="py-10 sm:py-12 bg-slate-50" ref={addToRefs}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-primary via-slate-900 to-slate-800 text-white px-6 sm:px-10 py-8 sm:py-10 shadow-[0_32px_80px_-36px_rgba(0,17,80,0.65)]">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
                Ready to Build Smarter?
              </h2>
              <p className="text-slate-200 text-sm sm:text-base mb-6 max-w-2xl mx-auto">
                Book a free 30-minute consultation. No pitch decks. Just clarity on your next move.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7 text-xs sm:text-sm">
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-slate-100">1. Discovery call</div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-slate-100">2. Priority roadmap</div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-slate-100">3. Execution support</div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
              <Link to="/book-call"
                className="inline-flex items-center justify-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-semibold btn-primary"
              >
                <Calendar className="w-5 h-5" />
                Book a Free Call
              </Link>
              <a
                href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-emerald-300/60 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp Us
              </a>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-slate-300 text-xs sm:text-sm">
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
        </div>
      </section>
    </div>
  )
}

export default Home

