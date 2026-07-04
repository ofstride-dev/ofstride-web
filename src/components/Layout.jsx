import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { 
  Menu, X, ChevronDown, Phone, Mail, MapPin, Calendar, Home, 
  Briefcase, Users, Globe, Info 
} from 'lucide-react'

function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isServicesOpen, setIsServicesOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const location = useLocation()
  const servicesRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (servicesRef.current && !servicesRef.current.contains(event.target)) {
        setIsServicesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
    setIsServicesOpen(false)
    window.scrollTo(0, 0)
  }, [location])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const services = [
    { name: 'Human Resources', slug: 'human-resource-consulting' },
    { name: 'Executive Search', slug: 'executive-search-recruitment' },
    { name: 'Payroll & Compliance', slug: 'payroll-hr-compliance' },
    { name: 'Virtual CFO', slug: 'financial-consulting-virtual-cfo' },
    { name: 'GST & Tax', slug: 'gst-tax-advisory' },
    { name: 'Legal Advisory', slug: 'legal-regulatory-compliance' },
    { name: 'IT & Digital', slug: 'it-consulting-digital-transformation' },
    { name: 'AI & Data Science', slug: 'ai-data-science-consulting' },
    { name: 'Business Strategy', slug: 'business-strategy-process-improvement' },
    { name: 'EOR & Workforce', slug: 'employer-of-record-workforce' },
  ]

  const toggleServices = () => setIsServicesOpen(!isServicesOpen)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="Ofstride Services LLP" className="logo-header" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
              <Link to="/" className="flex items-center gap-1.5 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface">
                <Home className="w-4 h-4" />
                Home
              </Link>

              <div ref={servicesRef} className="relative">
                <button 
                  onClick={toggleServices}
                  className="flex items-center gap-1 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface"
                >
                  <Briefcase className="w-4 h-4" />
                  Services
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />
                </button>

                {isServicesOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50"
                    style={{ maxHeight: '320px', overflowY: 'auto' }}
                  >
                    {services.map((s) => (
                      <Link
                        key={s.slug}
                        to={`/services/${s.slug}`}
                        className="block px-4 py-2.5 text-sm text-text hover:bg-surface hover:text-secondary rounded-lg transition-colors"
                        onClick={() => setIsServicesOpen(false)}
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link to="/about" className="flex items-center gap-1.5 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface">
                <Info className="w-4 h-4" />
                About
              </Link>
              <Link to="/industries" className="flex items-center gap-1.5 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface">
                <Globe className="w-4 h-4" />
                Industries
              </Link>
              <Link to="/contact" className="flex items-center gap-1.5 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface">
                <Mail className="w-4 h-4" />
                Contact
              </Link>
            </nav>

            {/* CTA + Mobile Menu */}
            <div className="flex items-center gap-4">
              <Link 
                to="/book-call"
                className="hidden sm:inline-flex btn-primary bg-primary text-white px-5 py-2.5 rounded-lg font-medium text-sm"
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                Book a Call
              </Link>

              <button 
                className="lg:hidden p-2"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-white border-t border-surface" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-2">
              <Link to="/" className="flex items-center gap-2 py-3 px-3 text-text hover:text-secondary hover:bg-surface rounded-lg transition-colors font-medium">
                <Home className="w-5 h-5" /> Home
              </Link>

              <div className="px-3">
                <button 
                  onClick={toggleServices}
                  className="flex items-center gap-2 py-3 text-text hover:text-secondary transition-colors font-medium w-full"
                >
                  <Briefcase className="w-5 h-5" /> Services
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />
                </button>

                {isServicesOpen && (
                  <div className="pl-8 space-y-1 mt-1" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {services.map((s) => (
                      <Link
                        key={s.slug}
                        to={`/services/${s.slug}`}
                        className="block py-2 text-sm text-text hover:text-secondary transition-colors"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link to="/about" className="flex items-center gap-2 py-3 px-3 text-text hover:text-secondary hover:bg-surface rounded-lg transition-colors font-medium">
                <Info className="w-5 h-5" /> About
              </Link>
              <Link to="/industries" className="flex items-center gap-2 py-3 px-3 text-text hover:text-secondary hover:bg-surface rounded-lg transition-colors font-medium">
                <Globe className="w-5 h-5" /> Industries
              </Link>
              <Link to="/contact" className="flex items-center gap-2 py-3 px-3 text-text hover:text-secondary hover:bg-surface rounded-lg transition-colors font-medium">
                <Mail className="w-5 h-5" /> Contact
              </Link>

              <div className="pt-4 border-t border-surface space-y-3">
                <Link to="/book-call" className="flex items-center justify-center gap-2 w-full bg-primary text-white px-5 py-3 rounded-lg font-medium">
                  <Calendar className="w-4 h-4" /> Book a Free Call
                </Link>
                <Link to="/contact-form" className="flex items-center justify-center gap-2 w-full border-2 border-slate-200 text-primary px-5 py-3 rounded-lg font-medium">
                  <Mail className="w-4 h-4" /> Send a Message
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="Ofstride" className="logo-footer" />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                AI-powered business consulting for HR, Finance, Legal, IT & Strategy. 
                Building intelligent systems since 2019.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">Services</h4>
              <ul className="space-y-2.5">
                {services.slice(0, 6).map((s) => (
                  <li key={s.slug}>
                    <Link to={`/services/${s.slug}`} className="text-slate-300 hover:text-white text-sm transition-colors">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* More Services */}
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">More</h4>
              <ul className="space-y-2.5">
                {services.slice(6).map((s) => (
                  <li key={s.slug}>
                    <Link to={`/services/${s.slug}`} className="text-slate-300 hover:text-white text-sm transition-colors">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">Contact</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-slate-300 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>New Delhi & Bengaluru, India</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href="mailto:support@ofstrideservices.com" className="hover:text-white transition-colors">
                    support@ofstrideservices.com
                  </a>
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-sm">
                  <Phone className="w-4 h-4 shrink-0" />
                  <a href="tel:+918951606862" className="hover:text-white transition-colors">
                    +91 89516 06862
                  </a>
                </li>
              </ul>

              <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
                <Link 
                  to="/book-call"
                  className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Book a Free Call
                </Link>
                <Link 
                  to="/contact-form"
                  className="inline-flex items-center gap-2 border border-slate-500 text-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send Message
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © 2026 Ofstride Services LLP. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy</Link>
              <Link to="/" className="text-slate-400 hover:text-white text-sm transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout
