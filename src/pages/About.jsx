import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Award, GraduationCap, Briefcase, BookOpen, Lightbulb, Plane, Scale, Calendar, Mail, Phone } from 'lucide-react'

function About() {
  const team = [
    {
      name: 'Raj Kumar Jha',
      role: 'Managing Partner',
      icon: Shield,
      desc: 'An Air Veteran with over 32 years of combined defence and corporate leadership experience. Led HR, operations, administration, and business development across healthcare, hospitality, insurance, and fitness industries.',
      credentials: 'PG Business Administration, IIMS Kolkata | Business Strategy, IIM Lucknow',
      color: 'bg-blue-50'
    },
    {
      name: 'Yuvraj Singh',
      role: 'AI & Data Science Consultant',
      icon: Lightbulb,
      desc: 'A specialist in Artificial Intelligence, Data Science, and Agentic AI workflows. Architects intelligent business solutions, predictive analytics, automation frameworks, and enterprise AI systems.',
      credentials: 'AI Strategy & Implementation | Predictive Analytics | Agentic AI',
      color: 'bg-emerald-50'
    },
    {
      name: 'Naveen Kumar',
      role: 'Senior Consultant — Business Strategy',
      icon: Award,
      desc: 'An IIT (BHU) Varanasi graduate and founder of Aquvio. Innovation leader with Indian and UK patents in water purification technology. Recognised with several national and international innovation awards.',
      credentials: 'IIT (BHU) Varanasi | Patented Innovator | National & International Awards',
      color: 'bg-amber-50'
    },
    {
      name: 'Girindra Kumar Pathak',
      role: 'Senior Consultant — Legal Services',
      icon: Scale,
      desc: 'A former Indian Air Force veteran and practicing advocate with more than 15 years of legal experience. Specialises in labour law, industrial disputes, civil litigation, arbitration, family law, and corporate legal advisory.',
      credentials: 'Ex-IAF | 15+ Years Legal Practice | Labour & Corporate Law Expert',
      color: 'bg-red-50'
    }
  ]

  const stats = [
    { number: '32+', label: 'Years Combined Leadership' },
    { number: '10', label: 'Integrated Services' },
    { number: '2', label: 'Offices — Delhi & Bengaluru' },
    { number: '2019', label: 'Established' }
  ]

  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
            About Us
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-6 max-w-4xl">
            Defence Discipline.<br />
            Corporate Leadership.<br />
            <span className="gradient-text">Intelligent Systems.</span>
          </h1>
          <p className="text-xl text-text max-w-2xl leading-relaxed">
            Established in 2019, Ofstride Services LLP is a multidisciplinary business consulting firm 
            providing integrated solutions in Human Resources, Finance, Legal, IT, Business Strategy, 
            Artificial Intelligence, and Workforce Development.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">{stat.number}</div>
                <div className="text-sm text-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
                Our Philosophy
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-6">
                We Do Not Just Advise.<br />We Build Systems.
              </h2>
              <p className="text-text leading-relaxed mb-6">
                Our consulting philosophy combines defence discipline, corporate leadership, innovation, 
                and technology to deliver practical, cost-effective, and customised business solutions 
                that improve operational efficiency, strengthen compliance, and accelerate sustainable growth.
              </p>
              <p className="text-text leading-relaxed mb-8">
                With offices in New Delhi and Bengaluru, we partner with startups, MSMEs, enterprises, 
                and Global Capability Centres (GCCs) to build scalable, compliant, and future-ready organisations.
              </p>
              <Link 
                to="/services"
                className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all"
              >
                Explore Our Services <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="bg-surface rounded-2xl p-8 lg:p-10">
              <h3 className="text-xl font-bold text-primary mb-6">Why Partner With Us</h3>
              <ul className="space-y-4">
                {[
                  'Leadership backed by Defence and Corporate experience',
                  'Multi-disciplinary consulting under one roof',
                  'Customized business solutions',
                  'Affordable and scalable engagement models',
                  'Strong regulatory and compliance expertise',
                  'Technology-driven transformation',
                  'Pan-India talent acquisition network',
                  'Focus on measurable business outcomes'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mt-2 shrink-0"></div>
                    <span className="text-text text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Free Consultation Banner */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Calendar className="w-4 h-4" />
            Free Initial Consultation
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start With a Free 30-Minute Call
          </h2>
          <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
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

      {/* Leadership Team */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
              Leadership
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              The Team Behind the Intelligence
            </h2>
            <p className="text-text max-w-2xl mx-auto">
              A multi-disciplinary team combining defence discipline, corporate leadership, 
              innovation, and AI expertise.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member, index) => (
              <div 
                key={index}
                className="bg-white rounded-2xl p-8 border border-slate-100 card-hover"
              >
                <div className={`w-14 h-14 ${member.color} rounded-xl flex items-center justify-center mb-6`}>
                  <member.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-1">{member.name}</h3>
                <p className="text-secondary font-medium text-sm mb-4">{member.role}</p>
                <p className="text-text text-sm leading-relaxed mb-4">
                  {member.desc}
                </p>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-muted">{member.credentials}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate Info */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
                Corporate Information
              </span>
              <h2 className="text-3xl font-bold text-primary mb-8">
                Get in Touch
              </h2>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-primary mb-1">Company</h4>
                  <p className="text-text">Ofstride Services LLP</p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-1">Established</h4>
                  <p className="text-text">2019</p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-1">Business Structure</h4>
                  <p className="text-text">Limited Liability Partnership</p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-1">GSTIN</h4>
                  <p className="text-text">07AAGFO4479B1Z9</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-surface rounded-2xl p-6">
                <h4 className="font-semibold text-primary mb-2">Head Office — New Delhi</h4>
                <p className="text-text text-sm">
                  FF B-68, Mansa Ram Park, Uttam Nagar,<br />
                  New Delhi – 110059
                </p>
              </div>
              <div className="bg-surface rounded-2xl p-6">
                <h4 className="font-semibold text-primary mb-2">Bengaluru Office</h4>
                <p className="text-text text-sm">
                  No. 51, 4th Main, Postal Colony, Sanjaynagar,<br />
                  Bengaluru – 560094
                </p>
              </div>
              <div className="bg-surface rounded-2xl p-6">
                <h4 className="font-semibold text-primary mb-2">Contact</h4>
                <p className="text-text text-sm space-y-1">
                  <a href="mailto:support@ofstrideservices.com" className="text-secondary hover:underline block">support@ofstrideservices.com</a>
                  <a href="tel:+918951606862" className="text-secondary hover:underline block">+91 89516 06862</a>
                  <a href="tel:+919740997984" className="text-secondary hover:underline block">+91 9740997984</a>
                  <a href="https://www.ofstrideservices.com" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline block">www.ofstrideservices.com</a>
                </p>
              </div>
              <div className="bg-primary text-white rounded-2xl p-6">
                <h4 className="font-bold mb-2">Book a Free Call</h4>
                <p className="text-slate-300 text-sm mb-4">
                  Schedule a free 30-minute consultation with our team.
                </p>
                <Link to="/book-call"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default About
