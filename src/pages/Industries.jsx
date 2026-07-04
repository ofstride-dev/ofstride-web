import { Link } from 'react-router-dom'
import { ArrowRight, Factory, Stethoscope, Cpu, Truck, Hotel, ShoppingCart, Shield, Pill, GraduationCap, Dumbbell, Rocket, Building2, Globe } from 'lucide-react'

function Industries() {
  const industries = [
    {
      icon: Factory,
      name: 'Manufacturing',
      desc: 'AI-driven supply chain optimisation, workforce planning, and compliance management for manufacturing operations.',
      services: ['HR Consulting', 'Legal Compliance', 'IT & Digital', 'Business Strategy']
    },
    {
      icon: Factory,
      name: 'Engineering',
      desc: 'Talent acquisition, project cost management, and digital transformation for engineering firms.',
      services: ['Executive Search', 'Virtual CFO', 'IT Consulting', 'AI Solutions']
    },
    {
      icon: Stethoscope,
      name: 'Healthcare',
      desc: 'Regulatory compliance, workforce management, and AI-powered patient analytics for healthcare providers.',
      services: ['HR Consulting', 'Legal Advisory', 'AI & Data Science', 'Payroll']
    },
    {
      icon: Hotel,
      name: 'Hospitality',
      desc: 'Staffing solutions, financial controls, and operational excellence for hotels and restaurants.',
      services: ['HR Consulting', 'Virtual CFO', 'Business Strategy', 'Payroll']
    },
    {
      icon: ShoppingCart,
      name: 'Retail',
      desc: 'Demand forecasting, workforce scaling, and digital transformation for retail chains and e-commerce.',
      services: ['AI & Data Science', 'HR Consulting', 'IT & Digital', 'Strategy']
    },
    {
      icon: Shield,
      name: 'Insurance',
      desc: 'Risk analytics, regulatory compliance, and AI-driven claims processing optimisation.',
      services: ['AI & Data Science', 'Legal Compliance', 'GST & Tax', 'Strategy']
    },
    {
      icon: Pill,
      name: 'Pharmaceuticals',
      desc: 'Quality compliance, R&D tax incentives, and supply chain intelligence for pharma companies.',
      services: ['Legal Advisory', 'GST & Tax', 'Business Strategy', 'AI Solutions']
    },
    {
      icon: Cpu,
      name: 'Technology',
      desc: 'AI strategy, talent acquisition, and scalable infrastructure for tech startups and enterprises.',
      services: ['AI & Data Science', 'Executive Search', 'IT & Digital', 'EOR']
    },
    {
      icon: Truck,
      name: 'Logistics',
      desc: 'Route optimisation, workforce management, and compliance across multi-state operations.',
      services: ['AI & Data Science', 'HR Consulting', 'Legal Compliance', 'Payroll']
    },
    {
      icon: GraduationCap,
      name: 'Education',
      desc: 'Institutional compliance, financial governance, and digital learning infrastructure.',
      services: ['Legal Advisory', 'Virtual CFO', 'IT & Digital', 'HR Consulting']
    },
    {
      icon: Dumbbell,
      name: 'Wellness & Fitness',
      desc: 'Membership analytics, staff management, and growth strategy for fitness chains and wellness brands.',
      services: ['Business Strategy', 'HR Consulting', 'AI Analytics', 'Payroll']
    },
    {
      icon: Rocket,
      name: 'Startups',
      desc: 'End-to-end support from incorporation to scaling — HR, finance, legal, and AI strategy.',
      services: ['All Services', 'Virtual CFO', 'Legal Advisory', 'AI & Data Science']
    },
    {
      icon: Building2,
      name: 'MSMEs',
      desc: 'Affordable, scalable consulting that grows with your business — compliance, finance, and operations.',
      services: ['Payroll', 'GST & Tax', 'Legal Compliance', 'Virtual CFO']
    },
    {
      icon: Globe,
      name: 'GCCs',
      desc: 'India centre setup, talent acquisition, compliance, and workforce scaling for global capability centres.',
      services: ['EOR & Workforce', 'Executive Search', 'Legal Advisory', 'IT & Digital']
    }
  ]

  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
            Industries
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-6">
            Built for Every Sector.<br />
            <span className="gradient-text">Powered by Intelligence.</span>
          </h1>
          <p className="text-xl text-text max-w-2xl mx-auto">
            From manufacturing floors to GCC boardrooms — sector-specific solutions 
            with AI at the centre.
          </p>
        </div>
      </section>

      {/* Industries Grid */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((industry, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-8 border border-slate-100 card-hover"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                  <industry.icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">
                  {industry.name}
                </h3>
                <p className="text-text text-sm leading-relaxed mb-6">
                  {industry.desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {industry.services.map((svc, i) => (
                    <span 
                      key={i}
                      className="text-xs bg-surface text-text px-2.5 py-1 rounded-full font-medium"
                    >
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Your Industry, Your Solution
          </h2>
          <p className="text-slate-300 text-lg mb-10">
            Every sector has unique challenges. We build AI-powered solutions tailored to yours.
          </p>
          <Link 
            to="/contact"
            className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 rounded-xl font-semibold btn-primary"
          >
            Discuss Your Industry Needs
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}

export default Industries
