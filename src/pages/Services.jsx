import { Link } from 'react-router-dom'
import { ArrowRight, Users, Search, FileCheck, Landmark, Receipt, Gavel, Monitor, Cpu, Target, Globe, Calendar, Mail } from 'lucide-react'

function Services() {
  const allServices = [
    {
      icon: Users,
      title: 'Human Resource Consulting',
      tagline: 'HR That Predicts. Not Just Reacts.',
      desc: 'AI-driven workforce strategy, org design, and culture building — built for teams that scale.',
      slug: 'human-resource-consulting',
      features: ['Predictive attrition modelling', 'Automated skill-gap analysis', 'AI-assisted policy drafting', 'Intelligent org-structure recommendations']
    },
    {
      icon: Search,
      title: 'Executive Search & Recruitment',
      tagline: 'Find Leaders Before Your Competitors Do.',
      desc: 'AI-powered talent intelligence across India. The right person, the right role, the right time.',
      slug: 'executive-search-recruitment',
      features: ['AI-candidate matching', 'Automated resume parsing', 'Predictive cultural-fit analysis', 'Intelligent interview scheduling']
    },
    {
      icon: FileCheck,
      title: 'Payroll & HR Compliance',
      tagline: 'Compliance on Autopilot.',
      desc: 'Zero-error payroll, real-time statutory monitoring, and AI-generated filings — across every state.',
      slug: 'payroll-hr-compliance',
      features: ['Automated payroll with anomaly detection', 'Real-time compliance monitoring', 'AI-generated PF/ESI/PT filings', 'Predictive audit-risk alerts']
    },
    {
      icon: Landmark,
      title: 'Financial Consulting & Virtual CFO',
      tagline: 'CFO Clarity. Without the Full-Time Cost.',
      desc: 'AI-enhanced forecasting, cash-flow intelligence, and investor-ready financial discipline.',
      slug: 'financial-consulting-virtual-cfo',
      features: ['Automated financial forecasting', 'AI-driven cash-flow optimisation', 'Intelligent MIS dashboards', 'Predictive fundraising readiness']
    },
    {
      icon: Receipt,
      title: 'GST & Tax Advisory',
      tagline: 'Tax Strategy That Stays Ahead.',
      desc: 'AI tracks every regulatory change. You focus on growth. We handle the complexity.',
      slug: 'gst-tax-advisory',
      features: ['Automated GST reconciliation', 'AI-powered tax-saving recommendations', 'Predictive litigation-risk scoring', 'Smart filing calendars']
    },
    {
      icon: Gavel,
      title: 'Legal & Regulatory Compliance',
      tagline: 'Legal Protection, 24/7.',
      desc: 'AI-monitored compliance, smart contract review, and proactive risk flagging — across labour, corporate, and civil law.',
      slug: 'legal-regulatory-compliance',
      features: ['AI-powered contract review', 'Automated regulatory alerts', 'Intelligent case-law research', 'Smart document drafting']
    },
    {
      icon: Monitor,
      title: 'IT Consulting & Digital Transformation',
      tagline: 'Technology That Learns With You.',
      desc: 'Cloud, automation, and AI-integrated systems that adapt as your business grows.',
      slug: 'it-consulting-digital-transformation',
      features: ['AI-driven infrastructure optimisation', 'Automated system monitoring', 'Intelligent cloud cost management', 'Smart workflow automation']
    },
    {
      icon: Cpu,
      title: 'AI & Data Science Consulting',
      tagline: 'Build Systems That Think.',
      desc: 'Custom AI agents, predictive models, and automation frameworks — we do not just advise, we architect intelligence.',
      slug: 'ai-data-science-consulting',
      features: ['Custom AI agent development', 'Predictive analytics models', 'Natural language processing', 'Self-improving ML systems'],
      featured: true
    },
    {
      icon: Target,
      title: 'Business Strategy & Process Improvement',
      tagline: 'Strategy That Executes Itself.',
      desc: 'AI-powered market intelligence, process optimisation, and scenario planning — your roadmap, continuously updated.',
      slug: 'business-strategy-process-improvement',
      features: ['AI-powered market intelligence', 'Automated process mapping', 'Predictive performance dashboards', 'Intelligent scenario planning']
    },
    {
      icon: Globe,
      title: 'Employer of Record (EOR) & Workforce Solutions',
      tagline: 'Hire Anywhere. Comply Everywhere.',
      desc: 'Pan-India workforce expansion with AI-driven onboarding, compliance, and contractor management.',
      slug: 'employer-of-record-workforce',
      features: ['Automated multi-state compliance', 'AI-driven contractor classification', 'Intelligent onboarding workflows', 'Predictive workforce planning']
    },
  ]

  return (
    <div className="pt-16 sm:pt-20">
      {/* Hero */}
      <section className="py-14 sm:py-20 lg:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-secondary text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2 sm:mb-3">
            Our Services
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-primary mb-4 sm:mb-6">
            AI at Every Layer
          </h1>
          <p className="text-text text-base sm:text-lg max-w-2xl mx-auto">
            Ten integrated services. One intelligent partner. Every solution is designed 
            with AI and agentic thinking at its core.
          </p>
        </div>
      </section>

      {/* Services List */}
      <section className="py-14 sm:py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-5 sm:space-y-8">
            {allServices.map((service, index) => (
              <div 
                key={service.slug}
                className={`bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover ${
                  service.featured ? 'ring-2 ring-secondary/20' : ''
                }`}
              >
                <div className="p-5 sm:p-8 lg:p-10">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6 sm:gap-8">
                    {/* Left: Icon + Title */}
                    <div className="lg:w-1/3">
                      <div className="flex items-center gap-3 sm:gap-4 mb-4">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center ${
                          service.featured ? 'bg-primary text-white' : 'bg-blue-50 text-secondary'
                        }`}>
                          <service.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        {service.featured && (
                          <span className="text-xs font-bold text-white bg-secondary px-3 py-1 rounded-full">
                            FLAGSHIP
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">
                        {service.title}
                      </h2>
                      <p className="text-secondary font-semibold text-base sm:text-lg">
                        {service.tagline}
                      </p>
                    </div>

                    {/* Right: Description + Features */}
                    <div className="lg:w-2/3">
                      <p className="text-text mb-6 leading-relaxed">
                        {service.desc}
                      </p>

                      <div className="grid sm:grid-cols-2 gap-2.5 sm:gap-3 mb-6">
                        {service.features.map((feature, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 shrink-0"></div>
                            <span className="text-sm text-text">{feature}</span>
                          </div>
                        ))}
                      </div>

                      <Link 
                        to={`/services/${service.slug}`}
                        className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all"
                      >
                        Explore Service <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-4">
            Not Sure Where to Start?
          </h2>
          <p className="text-text mb-8">
            Tell us about your business. We will recommend the right combination of services — 
            starting with a free consultation.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/book-call"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-semibold btn-primary"
            >
              <Calendar className="w-5 h-5" />
              Book a Free Call
            </Link>
            <Link to="/contact-form"
              className="inline-flex items-center justify-center gap-2 border-2 border-slate-200 text-primary px-8 py-4 rounded-xl font-semibold btn-secondary"
            >
              <Mail className="w-5 h-5" />
              Send a Message
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Services
