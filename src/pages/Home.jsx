import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
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
  Calendar
} from 'lucide-react'

function Home() {
  const revealRefs = useRef([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
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
      ai: true
    },
    {
      icon: Monitor,
      title: 'IT & Digital',
      desc: 'Cloud, automation, and AI-integrated systems that adapt.',
      slug: 'it-consulting-digital-transformation',
      ai: true
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
      ai: true
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

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                <Link to="/book-call"
                  target="_blank"
                  rel="noopener noreferrer"
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
              </div>
            </div>

            {/* Hero Visual */}
            <div className="hidden lg:block relative animate-float">
              <div className="relative w-full aspect-square max-w-lg mx-auto">
                <svg viewBox="0 0 400 400" className="w-full h-full">
                  <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:'#0023a0', stopOpacity:0.15}} />
                      <stop offset="100%" style={{stopColor:'#10B981', stopOpacity:0.08}} />
                    </linearGradient>
                  </defs>

                  <circle cx="200" cy="200" r="150" fill="url(#grad1)" />

                  <g stroke="#0023a0" strokeWidth="1" opacity="0.25">
                    <line x1="200" y1="80" x2="280" y2="160" />
                    <line x1="280" y1="160" x2="320" y2="240" />
                    <line x1="320" y1="240" x2="240" y2="320" />
                    <line x1="240" y1="320" x2="160" y2="320" />
                    <line x1="160" y1="320" x2="80" y2="240" />
                    <line x1="80" y1="240" x2="120" y2="160" />
                    <line x1="120" y1="160" x2="200" y2="80" />
                    <line x1="200" y1="80" x2="200" y2="200" />
                    <line x1="280" y1="160" x2="200" y2="200" />
                    <line x1="320" y1="240" x2="200" y2="200" />
                    <line x1="240" y1="320" x2="200" y2="200" />
                    <line x1="160" y1="320" x2="200" y2="200" />
                    <line x1="80" y1="240" x2="200" y2="200" />
                    <line x1="120" y1="160" x2="200" y2="200" />
                  </g>

                  <g fill="#001150">
                    <circle cx="200" cy="200" r="12" opacity="0.9" />
                    <circle cx="200" cy="80" r="8" opacity="0.7" />
                    <circle cx="280" cy="160" r="8" opacity="0.7" />
                    <circle cx="320" cy="240" r="8" opacity="0.7" />
                    <circle cx="240" cy="320" r="8" opacity="0.7" />
                    <circle cx="160" cy="320" r="8" opacity="0.7" />
                    <circle cx="80" cy="240" r="8" opacity="0.7" />
                    <circle cx="120" cy="160" r="8" opacity="0.7" />
                  </g>

                  <circle cx="200" cy="200" r="20" fill="none" stroke="#0023a0" strokeWidth="2" opacity="0.3">
                    <animate attributeName="r" values="20;30;20" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="bg-surface py-6 sm:py-8 border-y border-slate-100">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-muted uppercase tracking-wider mb-3 sm:mb-4 font-medium">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-3">
            {clients.map((client) => (
              <span key={client} className="text-slate-600 font-semibold text-xs sm:text-sm whitespace-nowrap">
                {client}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Services Bento Grid */}
      <section className="py-16 sm:py-24 lg:py-32" ref={addToRefs}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {services.map((service, index) => (
              <Link
                key={service.slug}
                to={`/services/${service.slug}`}
                className="card-hover bg-white border border-slate-100 rounded-xl sm:rounded-2xl p-5 sm:p-8 group"
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
          <div className="text-center mb-12 sm:mb-16">
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {whyPoints.map((point, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-5 sm:p-8 border border-slate-100 card-hover"
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
            <Link to="/contact-form"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              <Mail className="w-5 h-5" />
              Send a Message
            </Link>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 sm:py-24 lg:py-32" ref={addToRefs}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
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
            <Link to="/contact-form"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              <Mail className="w-5 h-5" />
              Contact Form
            </Link>
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
