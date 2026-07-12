import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, CheckCircle2, User, Mail, Phone, Briefcase, MessageSquare, ArrowRight, MapPin, Globe, Calendar } from 'lucide-react'

function ContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
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
    setSubmitError('')

    const endpoint = import.meta.env.VITE_MAKE_WEBHOOK_CHAT_URL || import.meta.env.VITE_FORMS_WEBHOOK_URL || import.meta.env.VITE_ZAPIER_WEBHOOK_URL || import.meta.env.VITE_CONTACT_WEBHOOK_URL
    const accessKey = import.meta.env.VITE_WEB3FORMS_KEY
    const payload = {
      type: 'contact_request',
      source: 'ofstride-website',
      channel: 'contact_form',
      notify_via: 'make_com_chat_pipeline',
      submitted_at: new Date().toISOString(),
      notify_support_email: 'support@ofstrideservices.com',
      notify_requester_email: formData.email,
      ...formData,
    }

    try {
      let submitted = false

      if (endpoint) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          })

          if (response.ok) {
            submitted = true
          }
        } catch {
          // Fall through to Web3Forms fallback.
        }
      }

      if (!submitted) {
        if (!accessKey) {
          throw new Error('No submission provider configured')
        }

        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            access_key: accessKey,
            subject: `Contact Request - ${formData.name}`,
            from_name: 'Ofstride Website',
            replyto: formData.email,
            ...payload,
          }),
        })

        const result = await response.json().catch(() => ({}))
        if (!response.ok || !result.success) {
          throw new Error('Web3Forms submission failed')
        }

        submitted = true
      }

      if (!submitted) {
        throw new Error('No submission provider accepted the request')
      }

      setSubmitted(true)

    } catch (error) {
      setSubmitError('We could not submit your request automatically. Please email support@ofstrideservices.com directly and we will follow up shortly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="pt-16 sm:pt-20 min-h-screen flex items-center justify-center bg-surface">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-primary mb-3">Message Sent!</h2>
            <p className="text-text mb-2">
              Thank you, <span className="font-semibold">{formData.name}</span>.
            </p>
            <p className="text-text mb-6">
              Your message has been received. Our team will review it and follow up within 24 hours.
            </p>
            <div className="bg-surface rounded-xl p-4 text-left mb-6">
              <p className="text-sm text-muted mb-1">Ticket Reference</p>
              <p className="text-lg font-mono font-bold text-primary">OFS-{Date.now().toString(36).toUpperCase().slice(-6)}</p>
            </div>
            <p className="text-sm text-muted mb-6">
              We have recorded your request and will be in touch using the contact details you provided.
            </p>
            <Link to="/" className="inline-flex items-center gap-2 text-secondary font-semibold hover:gap-3 transition-all">
              Back to Home <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid lg:grid-cols-5 gap-8 sm:gap-12">
          {/* Left: Info */}
          <div className="lg:col-span-2">
            <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
              Contact Us
            </span>
            <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-4">
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
                  <a href="mailto:support@ofstrideservices.com" className="text-sm text-secondary hover:underline break-all">
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
              <a 
                href="/book-call"
                className="inline-flex items-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Book a Free Call
              </a>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-xl font-bold text-primary mb-6">Send us a Message</h2>
              {submitError && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {submitError}
                </div>
              )}

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

              <p className="text-xs text-muted text-center">
                We respect your privacy. Your information will never be shared with third parties.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactForm
