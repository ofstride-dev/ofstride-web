import { useEffect } from 'react'
import Cal, { getCalApi } from '@calcom/embed-react'

function BookCall() {
  useEffect(() => {
    ;(async function initCal() {
      const cal = await getCalApi({ namespace: 'ofstride-meet' })
      cal('ui', {
        hideEventTypeDetails: false,
        layout: 'month_view',
      })
    })()
  }, [])

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
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
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default BookCall
