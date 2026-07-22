import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Cal, { getCalApi } from '@calcom/embed-react'

function BookCall() {
  const location = useLocation()
  const prefill = location.state?.prefill ?? {}

  const [form, setForm] = useState({
    name: prefill.name || '',
    email: prefill.email || '',
    phone: prefill.phone || '',
    notes: prefill.message || '',
  })

  useEffect(() => {
    ;(async function initCal() {
      const cal = await getCalApi({ namespace: 'ofstride-meet' })
      cal('ui', {
        hideEventTypeDetails: false,
        layout: 'month_view',
      })
    })()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="pt-12 sm:pt-16 min-h-screen bg-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="text-center mb-8">
          <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
            Free Consultation
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-3">
            Book Your 30-Minute Call
          </h1>
          <p className="text-text">
            Pick your preferred slot and confirm instantly.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-2 sm:p-4">
          <Cal
            namespace="ofstride-meet"
            calLink="ofstride/ofstride-meet?overlayCalendar=true"
            style={{ width: '100%', height: '100%', overflow: 'scroll' }}
            config={{
              layout: 'month_view',
              useSlotsViewOnSmallScreen: 'true',
              name: form.name || undefined,
              email: form.email || undefined,
              notes: form.notes || undefined,
            }}
          />
        </div>

        {/* Prefill captured from the assistant (e.g. the summarize text) */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-5 sm:p-6">
          <h2 className="text-lg font-bold text-primary mb-4">Your Details</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Phone</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 ..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-primary mb-1">Additional Notes</label>
            <textarea
              name="notes"
              rows={4}
              value={form.notes}
              onChange={handleChange}
              placeholder="Anything you'd like us to know before the call..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none resize-none"
            />
          </div>
          <p className="text-xs text-muted mt-2">
            These details are prefilled from your assistant conversation and shared with our team when you book.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BookCall

