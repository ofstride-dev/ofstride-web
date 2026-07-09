import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Clock, User, Mail, Phone, Briefcase, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react'

function BookCall() {
  const location = useLocation()
  const incomingPrefill = location.state?.prefill || {}
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [formData, setFormData] = useState({
    name: incomingPrefill.name || '',
    email: incomingPrefill.email || '',
    phone: incomingPrefill.phone || '',
    company: '',
    service: incomingPrefill.service || '',
    date: '',
    time: '',
    message: incomingPrefill.message || ''
  })

  const hasValidPhone = (value) => value.replace(/\D/g, '').length >= 10

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
  ]

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')

    const endpoint = import.meta.env.VITE_FORMS_WEBHOOK_URL || import.meta.env.VITE_ZAPIER_WEBHOOK_URL || import.meta.env.VITE_BOOK_CALL_WEBHOOK_URL
    const calMeetingEndpoint = import.meta.env.VITE_CAL_MEETING_WEBHOOK_URL
    const accessKey = import.meta.env.VITE_WEB3FORMS_KEY
    const calUsername = import.meta.env.VITE_CAL_USERNAME
    const calEventSlug = import.meta.env.VITE_CAL_EVENT_SLUG
    const calBookingUrl = calUsername && calEventSlug
      ? `https://cal.com/${calUsername}/${calEventSlug}`
      : null
    const payload = {
      type: 'booking_request',
      source: 'ofstride-website',
      submitted_at: new Date().toISOString(),
      notify_support_email: 'support@ofstrideservices.com',
      notify_requester_email: formData.email,
      cal_username: calUsername || null,
      cal_event_slug: calEventSlug || null,
      cal_booking_url: calBookingUrl,
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
            subject: `Consultation Request - ${formData.name}`,
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

      if (calMeetingEndpoint) {
        try {
          await fetch(calMeetingEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              ...payload,
              type: 'cal_meeting_request',
              request_type: 'book_call',
            }),
          })
        } catch {
          // Non-blocking: booking request already accepted by primary submission endpoint.
        }
      }

      setSubmitted(true)
    } catch (error) {
      setSubmitError('We could not submit your request automatically. Please email support@ofstrideservices.com directly and we will follow up shortly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = () => setStep(step + 1)
  const prevStep = () => setStep(step - 1)

  if (submitted) {
    return (
      <div className="pt-16 sm:pt-20 min-h-screen flex items-center justify-center bg-surface">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl p-6 sm:p-10 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-primary mb-3">Booking Confirmed!</h2>
            <p className="text-text mb-2">
              Thank you, <span className="font-semibold">{formData.name}</span>.
            </p>
            <p className="text-text mb-6">
              We have received your request for <span className="font-semibold">{formData.date}</span> at <span className="font-semibold">{formData.time}</span>.
            </p>
            <p className="text-sm text-muted mb-6">
              Your consultation request has been received. Our team will review it and follow up shortly.
            </p>
            {submitError && (
              <p className="text-sm text-amber-600 mb-4">{submitError}</p>
            )}
            <div className="bg-surface rounded-xl p-4 text-left mb-6">
              <p className="text-sm text-muted mb-1">Booking Reference</p>
              <p className="text-lg font-mono font-bold text-primary">OFS-{Date.now().toString(36).toUpperCase().slice(-6)}</p>
            </div>
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
            Free Consultation
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-3">
            Book Your 30-Minute Call
          </h1>
          <p className="text-text">
            No commitment. No pitch decks. Just clarity on your next move.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-8 sm:mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                s <= step ? 'bg-primary text-white' : 'bg-slate-200 text-muted'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-6 sm:w-8 h-0.5 ${s < step ? 'bg-primary' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm">
          {submitError && (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {submitError}
            </div>
          )}

          {/* Step 1: Your Info */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-up">
              <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-secondary" />
                About You
              </h2>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    placeholder="Raj Kumar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">Email *</label>
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
                  <label className="block text-sm font-medium text-primary mb-2">Phone *</label>
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
                  <label className="block text-sm font-medium text-primary mb-2">Company</label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                    placeholder="Your company name"
                  />
                </div>
              </div>

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

              <button
                type="button"
                onClick={nextStep}
                  disabled={!formData.name || !formData.email || !hasValidPhone(formData.phone) || !formData.service}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-xl font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Pick a Date <ArrowRight className="w-4 h-4" />
              </button>
                {!!formData.phone && !hasValidPhone(formData.phone) && (
                  <p className="text-sm text-red-600">Please enter at least 10 digits, with country code if applicable.</p>
                )}
            </div>
          )}

          {/* Step 2: Date & Time */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-up">
              <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-secondary" />
                Pick a Date & Time
              </h2>

              <div>
                <label className="block text-sm font-medium text-primary mb-2">Preferred Date *</label>
                <input
                  type="date"
                  name="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-3">Preferred Time (IST) *</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setFormData({ ...formData, time })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        formData.time === time
                          ? 'bg-primary text-white'
                          : 'bg-surface text-text hover:bg-blue-50'
                      }`}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-slate-200 text-primary px-6 py-4 rounded-xl font-semibold btn-secondary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.date || !formData.time}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-xl font-semibold btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next: Confirm <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-up">
              <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-secondary" />
                Confirm & Add Details
              </h2>

              <div className="bg-surface rounded-xl p-4 sm:p-5 space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                  <span className="text-muted">Name</span>
                  <span className="font-medium text-primary text-left sm:text-right break-words">{formData.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                  <span className="text-muted">Email</span>
                  <span className="font-medium text-primary text-left sm:text-right break-all">{formData.email}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                  <span className="text-muted">Phone</span>
                  <span className="font-medium text-primary text-left sm:text-right break-words">{formData.phone}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                  <span className="text-muted">Service</span>
                  <span className="font-medium text-primary text-left sm:text-right break-words">{formData.service}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                  <span className="text-muted">Date</span>
                  <span className="font-medium text-primary text-left sm:text-right">{formData.date}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                  <span className="text-muted">Time</span>
                  <span className="font-medium text-primary text-left sm:text-right">{formData.time} IST</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Anything specific you&apos;d like to discuss? (Optional)
                </label>
                <textarea
                  name="message"
                  rows={3}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none transition-all resize-none"
                  placeholder="Tell us about your business needs..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-slate-200 text-primary px-6 py-4 rounded-xl font-semibold btn-secondary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-xl font-semibold btn-primary disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Confirm Booking
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-muted text-center">
                By booking, you agree to receive a follow-up from our team regarding your consultation request.
                You can reschedule up to 2 hours before the call.
              </p>
            </div>
          )}
        </form>

        {/* Trust badges */}
        <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-muted">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> 30 minutes
          </span>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4" /> Video or Phone
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent" /> Completely Free
          </span>
        </div>
      </div>
    </div>
  )
}

export default BookCall
