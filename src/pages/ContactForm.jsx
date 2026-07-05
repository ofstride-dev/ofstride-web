import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, CheckCircle2, User, Mail, Phone, Briefcase, MessageSquare, ArrowRight, MapPin, Globe, Calendar } from 'lucide-react'
import { submitContactRequest } from '../services/notifications.js'

function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [ticketReference, setTicketReference] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    service: '',
    budget: '',
    message: ''
  })

  const services = [
    'Human Resource Consulting',
    'Executive Search & Recruitment',
    'Payroll & HR Compliance',
    'Financial Consulting & Virtual CFO',
    'GST & Tax Advisory',
    'Legal & Regulatory Compliance',
    'IT Consulting & Digital Transformation',
    'AI & Data Science Consulting',
    'Business Strategy & Process Improvement',
    'Employer of Record (EOR)',
    'Not sure / Multiple services'
  ]

  const budgets = [
    'Under ₹50,000',
    '₹50,000 - ₹2,00,000',
    '₹2,00,000 - ₹5,00,000',
    '₹5,00,000 - ₹10,00,000',
    'Above ₹10,00,000',
    'Prefer to discuss'
  ]

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSubmissionError('')

    const reference = `OFS-${Date.now().toString(36).toUpperCase().slice(-6)}`
    setTicketReference(reference)

    try {
      await submitContactRequest(formData, reference)
      setSubmitted(true)
    } catch (error) {
      console.error('Contact form submission failed', error)
      setSubmissionError('We were unable to send your message automatically. Please email support@ofstrideservices.com directly and we will follow up shortly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center bg-surface">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl p-10 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-primary mb-3">Message Sent!</h2>
            <p className="text-text mb-2">
              Thank you, <span className="font-semibold">{formData.name}</span>.
            </p>
            <p className="text-text mb-6">
              We have received your message and will get back to you within 24 hours.
            </p>
            <div className="bg-surface rounded-xl p-4 text-left mb-6">
              <p className="text-sm text-muted mb-1">Ticket Reference</p>
              <p className="text-lg font-mono font-bold text-primary">{ticketReference}</p>
            </div>
            <p className="text-sm text-muted mb-6">
              A confirmation note is being prepared for {formData.email}
            </p>
            <a href="/" className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all">
              Back to Home <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-20 min-h-screen bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-5 gap-12">
          {/* Left: Info */}
          <div className="lg:col-span-2">
            <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
              Contact Us
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              Let&apos;s Start a Conversation
            </h1>
            <p className="text-text mb-8">
              Tell us about your business challenges. We will recommend the right solution — 
              starting with a free consultation.
            </p>

            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h4 className="font-semibold text-primary text-sm">New Delhi</h4>
                  <p className="text-sm text-text">FF B-68, Mansa Ram Park, Uttam Nagar, New Delhi – 110059</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h4 className="font-semibold text-primary text-sm">Bengaluru</h4>
                  <p className="text-sm text-text">No. 51, 4th Main, Postal Colony, Sanjaynagar, Bengaluru – 560094</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h4 className="font-semibold text-primary text-sm">Email</h4>
                  <a href="mailto:support@ofstrideservices.com" className="text-sm text-secondary hover:underline">
                    support@ofstrideservices.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h4 className="font-semibold text-primary text-sm">Phone</h4>
                  <a href="tel:+918951606862" className="text-sm text-secondary hover:underline block">+91 89516 06862</a>
                  <a href="tel:+919740997984" className="text-sm text-secondary hover:underline block">+91 9740997984</a>
                </div>
              </div>
            </div>

            <div className="bg-primary text-white rounded-2xl p-6">
              <h4 className="font-bold mb-2">Prefer to book a call?</h4>
              <p className="text-slate-300 text-sm mb-4">
                Schedule a free 30-minute consultation at your convenience.
              </p>
              <Link 
                to="/book-call"
                className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Book a Free Call
              </Link>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-sm space-y-5">
              <h2 className="text-xl font-bold text-primary mb-6">Send us a Message</h2>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    <User className="w-3 h-3 inline mr-1" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    <Mail className="w-3 h-3 inline mr-1" />
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    <Phone className="w-3 h-3 inline mr-1" />
                    Phone *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    placeholder="+91 89516 06862"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    <Briefcase className="w-3 h-3 inline mr-1" />
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">Service Interest *</label>
                  <select
                    name="service"
                    required
                    value={formData.service}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all bg-white"
                  >
                    <option value="">Select a service</option>
                    {services.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">Budget Range</label>
                  <select
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all bg-white"
                  >
                    <option value="">Select budget</option>
                    {budgets.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  How can we help? *
                </label>
                <textarea
                  name="message"
                  rows={5}
                  required
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all resize-none"
                  placeholder="Describe your business challenge, goals, or questions..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-xl font-semibold btn-primary disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>

              {submissionError ? (
                <p className="text-sm text-red-600 text-center">{submissionError}</p>
              ) : (
                <p className="text-xs text-muted text-center">
                  We respect your privacy. Your information will never be shared with third parties.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactForm
