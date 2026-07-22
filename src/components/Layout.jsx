import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { 
  Menu, X, ChevronDown, Phone, Mail, MapPin, Calendar, Home, 
  Briefcase, Users, Globe, Info, MessageCircle, FileText
} from 'lucide-react'
import { ChatWidget } from './chat/ChatWidget'

function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isServicesOpen, setIsServicesOpen] = useState(false)
  const [isCareersOpen, setIsCareersOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const location = useLocation()
  const servicesRef = useRef(null)
  const closeTimerRef = useRef(null)
  const careersRef = useRef(null)
  const careersCloseTimerRef = useRef(null)
  const forceSolidHeader = location.pathname === '/careers/veteran-transition' || location.pathname === '/career-connect'

  const navLinkClass = ({ isActive }) => {
    const base = 'flex items-center gap-1.5 transition-colors font-medium px-2 py-1 rounded-lg'
    return isActive
      ? `${base} text-secondary bg-surface`
      : `${base} text-text hover:text-secondary hover:bg-surface`
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (servicesRef.current && !servicesRef.current.contains(event.target)) {
        setIsServicesOpen(false)
      }
      if (careersRef.current && !careersRef.current.contains(event.target)) {
        setIsCareersOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
    setIsServicesOpen(false)
    setIsCareersOpen(false)
    window.scrollTo(0, 0)
    setIsChatOpen(false)
  }, [location])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setIsServicesOpen(false)
        setIsCareersOpen(false)
        setIsMenuOpen(false)
        setIsChatOpen(false)
      }
    }

    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
      if (careersCloseTimerRef.current) {
        clearTimeout(careersCloseTimerRef.current)
      }
    }
  }, [])

  const serviceGroups = [
    {
      category: 'People & Workforce',
      services: [
        { name: 'Human Resource Consulting', slug: 'human-resource-consulting' },
        { name: 'Executive Search & Recruitment', slug: 'executive-search-recruitment' },
        { name: 'Payroll & HR Compliance', slug: 'payroll-hr-compliance' },
        { name: 'Employer of Record & Workforce', slug: 'employer-of-record-workforce' },
      ],
    },
    {
      category: 'Finance & Compliance',
      services: [
        { name: 'Financial Consulting & Virtual CFO', slug: 'financial-consulting-virtual-cfo' },
        { name: 'GST & Tax Advisory', slug: 'gst-tax-advisory' },
        { name: 'Legal & Regulatory Compliance', slug: 'legal-regulatory-compliance' },
      ],
    },
    {
      category: 'Technology & Growth',
      services: [
        { name: 'IT Consulting & Digital Transformation', slug: 'it-consulting-digital-transformation' },
        { name: 'AI & Data Science Consulting', slug: 'ai-data-science-consulting' },
      ],
    },
    {
      category: 'Strategy',
      services: [
        { name: 'Business Strategy & Process Improvement', slug: 'business-strategy-process-improvement' },
      ],
    },
  ]
  const services = serviceGroups.flatMap((g) => g.services)

  const careersItems = [
    { name: 'Upload Resume / JD', to: '/careers/upload' },
    { name: 'Jobseeker', to: '/careers/jobs' },
    { name: 'Veteran Connect', to: '/careers/veteran-transition' },
    { name: 'Employer / Admin', to: '/employer' },
  ]

  const openServices = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    setIsCareersOpen(false)
    setIsServicesOpen(true)
  }

  const closeServices = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => {
      setIsServicesOpen(false)
    }, 120)
  }

  const toggleServices = () => {
    setIsCareersOpen(false)
    setIsServicesOpen((prev) => !prev)
  }

  const openCareers = () => {
    if (careersCloseTimerRef.current) {
      clearTimeout(careersCloseTimerRef.current)
    }
    setIsServicesOpen(false)
    setIsCareersOpen(true)
  }

  const closeCareers = () => {
    if (careersCloseTimerRef.current) {
      clearTimeout(careersCloseTimerRef.current)
    }
    careersCloseTimerRef.current = setTimeout(() => {
      setIsCareersOpen(false)
    }, 120)
  }

  const toggleCareers = () => {
    setIsServicesOpen(false)
    setIsCareersOpen((prev) => !prev)
  }

  const closeAllMenus = () => {
    setIsServicesOpen(false)
    setIsCareersOpen(false)
    setIsMenuOpen(false)
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled || forceSolidHeader ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
        }`}
      >
        {/* Top contact bar — hidden on scroll */}
        <div className={`transition-all duration-300 overflow-hidden ${isScrolled ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-12 opacity-100'}`}>
          <div className="bg-primary text-white py-1.5 px-4 flex items-center justify-center flex-wrap gap-x-6 gap-y-1 text-xs">
            <a href="tel:+918951606862" className="flex items-center gap-1.5 hover:text-blue-200 transition-colors whitespace-nowrap">
              <Phone className="w-3 h-3" />
              +91 89516 06862
            </a>
            <a href="mailto:support@ofstrideservices.com" className="hidden sm:flex items-center gap-1.5 hover:text-blue-200 transition-colors">
              <Mail className="w-3 h-3" />
              support@ofstrideservices.com
            </a>
            <a
              href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp Us
            </a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="Ofstride Services LLP" className="logo-header" />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
              <NavLink to="/" end className={navLinkClass}>
                <Home className="w-4 h-4" />
                Home
              </NavLink>

              <div
                ref={servicesRef}
                className="relative"
                onMouseEnter={openServices}
                onMouseLeave={closeServices}
              >
                <button 
                  type="button"
                  onClick={toggleServices}
                  onFocus={openServices}
                  aria-expanded={isServicesOpen}
                  aria-haspopup="menu"
                  aria-label="Open services menu"
                  className="flex items-center gap-1 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface"
                >
                  <Briefcase className="w-4 h-4" />
                  Services
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />
                </button>

                {isServicesOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50"
                    role="menu"
                    onMouseEnter={openServices}
                    onMouseLeave={closeServices}
                    style={{ maxHeight: '460px', overflowY: 'auto' }}
                  >
                    {serviceGroups.map((group) => (
                      <div key={group.category} className="px-3 pt-2 pb-1 first:pt-1">
                        <p className="px-1 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.category}</p>
                        <div className="space-y-0.5">
                          {group.services.map((s) => (
                            <Link
                              key={s.slug}
                              to={`/services/${s.slug}`}
                              role="menuitem"
                              className="block px-4 py-2 text-sm text-text hover:bg-surface hover:text-secondary rounded-lg transition-colors"
                              onClick={() => setIsServicesOpen(false)}
                            >
                              {s.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <NavLink to="/industries" className={navLinkClass}>
                <Globe className="w-4 h-4" />
                Industries
              </NavLink>
              <div
                ref={careersRef}
                className="relative"
                onMouseEnter={openCareers}
                onMouseLeave={closeCareers}
              >
                <button
                  type="button"
                  onClick={toggleCareers}
                  onFocus={openCareers}
                  aria-expanded={isCareersOpen}
                  aria-haspopup="menu"
                  aria-label="Open careers menu"
                  className="flex items-center gap-1 text-text hover:text-secondary transition-colors font-medium px-2 py-1 rounded-lg hover:bg-surface"
                >
                  <FileText className="w-4 h-4" />
                  Careers
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCareersOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCareersOpen && (
                  <div
                    className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50"
                    role="menu"
                    onMouseEnter={openCareers}
                    onMouseLeave={closeCareers}
                  >
                    <div className="space-y-0.5">
                      {careersItems.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          className="block px-4 py-2 text-sm text-text hover:bg-surface hover:text-secondary rounded-lg transition-colors"
                          onClick={() => setIsCareersOpen(false)}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <NavLink to="/about" className={navLinkClass}>
                <Info className="w-4 h-4" />
                About
              </NavLink>
              <NavLink to="/contact" className={navLinkClass}>
                <Mail className="w-4 h-4" />
                Contact
              </NavLink>
            </nav>

            {/* CTA + Mobile Menu */}
            <div className="flex items-center gap-2 sm:gap-4">
              <Link 
                to="/book-call"
                className="hidden sm:inline-flex btn-primary bg-primary text-white px-5 py-2.5 rounded-lg font-medium text-sm"
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                Book a Call
              </Link>

              <button 
                type="button"
                className="lg:hidden p-2 rounded-md"
                aria-label={isMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div id="mobile-menu" className="lg:hidden bg-white border-t border-surface" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="max-w-7xl mx-auto px-3 py-5 space-y-2">
              <NavLink
                to="/"
                end
                onClick={closeAllMenus}
                className={({ isActive }) => `flex items-center gap-2 py-3 px-3 rounded-lg transition-colors font-medium ${isActive ? 'text-secondary bg-surface' : 'text-text hover:text-secondary hover:bg-surface'}`}
              >
                <Home className="w-5 h-5" /> Home
              </NavLink>

              <div className="px-3">
                <button 
                  type="button"
                  onClick={toggleServices}
                  aria-expanded={isServicesOpen}
                  aria-label="Toggle services in mobile menu"
                  className="flex items-center gap-2 py-3 text-text hover:text-secondary transition-colors font-medium w-full"
                >
                  <Briefcase className="w-5 h-5" /> Services
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${isServicesOpen ? 'rotate-180' : ''}`} />
                </button>

                {isServicesOpen && (
                  <div className="pl-8 space-y-1 mt-1" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {serviceGroups.map((group) => (
                      <div key={group.category} className="space-y-0.5">
                        <p className="px-1 mt-2 mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.category}</p>
                        {group.services.map((s) => (
                          <Link
                            key={s.slug}
                            to={`/services/${s.slug}`}
                            className="block py-2 text-sm text-text hover:text-secondary transition-colors"
                            onClick={closeAllMenus}
                          >
                            {s.name}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <NavLink
                to="/industries"
                onClick={closeAllMenus}
                className={({ isActive }) => `flex items-center gap-2 py-3 px-3 rounded-lg transition-colors font-medium ${isActive ? 'text-secondary bg-surface' : 'text-text hover:text-secondary hover:bg-surface'}`}
              >
                <Globe className="w-5 h-5" /> Industries
              </NavLink>
              <div className="px-3">
                <button
                  type="button"
                  onClick={toggleCareers}
                  aria-expanded={isCareersOpen}
                  aria-label="Toggle careers in mobile menu"
                  className="flex items-center gap-2 py-3 text-text hover:text-secondary transition-colors font-medium w-full"
                >
                  <FileText className="w-5 h-5" /> Careers
                  <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${isCareersOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCareersOpen && (
                  <div className="pl-8 space-y-1 mt-1">
                    {careersItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="block py-2 text-sm text-text hover:text-secondary transition-colors"
                        onClick={closeAllMenus}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <NavLink
                to="/about"
                onClick={closeAllMenus}
                className={({ isActive }) => `flex items-center gap-2 py-3 px-3 rounded-lg transition-colors font-medium ${isActive ? 'text-secondary bg-surface' : 'text-text hover:text-secondary hover:bg-surface'}`}
              >
                <Info className="w-5 h-5" /> About
              </NavLink>
              <NavLink
                to="/contact"
                onClick={closeAllMenus}
                className={({ isActive }) => `flex items-center gap-2 py-3 px-3 rounded-lg transition-colors font-medium ${isActive ? 'text-secondary bg-surface' : 'text-text hover:text-secondary hover:bg-surface'}`}
              >
                <Mail className="w-5 h-5" /> Contact
              </NavLink>

              <div className="pt-4 border-t border-surface space-y-3">
                <Link
                  to="/book-call"
                  onClick={closeAllMenus}
                  className="flex items-center justify-center gap-2 w-full bg-primary text-white px-5 py-3 rounded-lg font-medium"
                >
                  <Calendar className="w-4 h-4" /> Book a Free Call
                </Link>
                <a
                  href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeAllMenus}
                  className="flex items-center justify-center gap-2 w-full bg-emerald-600 text-white px-5 py-3 rounded-lg font-medium"
                >
                  <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
                </a>
                <Link
                  to="/contact-form"
                  onClick={closeAllMenus}
                  className="flex items-center justify-center gap-2 w-full border-2 border-slate-200 text-primary px-5 py-3 rounded-lg font-medium"
                >
                  <Mail className="w-4 h-4" /> Send a Message
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1" tabIndex="-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-7">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <img src="/logo.png" alt="Ofstride" className="logo-footer" />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                AI-powered business consulting for HR, Finance, Legal, IT & Strategy. 
                Building intelligent systems since 2019.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">Services</h4>
              <ul className="space-y-2">
                {services.slice(0, 6).map((s) => (
                  <li key={s.slug}>
                    <Link to={`/services/${s.slug}`} className="text-slate-300 hover:text-white text-xs sm:text-sm transition-colors">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* More Services */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">More</h4>
              <ul className="space-y-2">
                {services.slice(6).map((s) => (
                  <li key={s.slug}>
                    <Link to={`/services/${s.slug}`} className="text-slate-300 hover:text-white text-xs sm:text-sm transition-colors">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">Contact</h4>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2 text-slate-300 text-xs sm:text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>New Delhi & Bengaluru, India</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-xs sm:text-sm">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href="mailto:support@ofstrideservices.com" className="hover:text-white transition-colors break-all">
                    support@ofstrideservices.com
                  </a>
                </li>
                <li className="flex items-center gap-2 text-slate-300 text-xs sm:text-sm">
                  <Phone className="w-4 h-4 shrink-0" />
                  <a href="tel:+918951606862" className="hover:text-white transition-colors">
                    +91 89516 06862
                  </a>
                </li>
                <li>
                  <a
                    href="https://wa.me/918951606862?text=Hi%2C+I%27d+like+to+know+more+about+Ofstride%27s+services"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-xs sm:text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    Chat on WhatsApp
                  </a>
                </li>
              </ul>

              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                <Link 
                  to="/book-call"
                  className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Book a Free Call
                </Link>
                <Link
                  to="/admin/careers"
                  className="inline-flex items-center gap-2 border border-slate-500 text-slate-300 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Admin Careers
                </Link>
                <Link 
                  to="/contact-form"
                  className="inline-flex items-center gap-2 border border-slate-500 text-slate-300 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send Message
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 sm:mt-7 pt-5 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-slate-400 text-xs sm:text-sm text-center sm:text-left">
              © 2026 Ofstride Services LLP. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Privacy</Link>
              <Link to="/" className="text-slate-400 hover:text-white text-xs sm:text-sm transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Chat */}
      <div
        className="fixed right-3 sm:right-6 z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {isChatOpen && (
          <div className="mb-3 w-[calc(100vw-1.5rem)] sm:w-[420px] max-w-[420px]">
            <ChatWidget onClose={() => setIsChatOpen(false)} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsChatOpen((prev) => !prev)}
          aria-expanded={isChatOpen}
          aria-label={isChatOpen ? 'Close Ofstride Assistance' : 'Open Ofstride Assistance'}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-secondary text-white px-4 py-3 shadow-lg hover:bg-blue-600 transition-colors"
        >
          {isChatOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
          <span className="text-sm font-semibold">Ofstride Assistance</span>
        </button>
      </div>
    </div>
  )
}

export default Layout
