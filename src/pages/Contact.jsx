import { Link } from 'react-router-dom'
import { MapPin, Phone, Mail, Globe, Calendar, ExternalLink } from 'lucide-react'

function Contact() {
  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block text-secondary text-sm font-semibold uppercase tracking-wider mb-3">
            Contact
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary mb-6">
            Let&apos;s Build Your Next Move.
          </h1>
          <p className="text-xl text-text max-w-2xl mx-auto">
            New Delhi | Bengaluru | Pan-India
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Left: Contact Options */}
            <div>
              <h2 className="text-2xl font-bold text-primary mb-6">
                Get in Touch
              </h2>
              <p className="text-text mb-8">
                Choose the option that works best for you. We respond to all inquiries within 24 hours.
              </p>

              <div className="space-y-6">
                {/* Book a Call */}
                <Link to="/book-call"
                  className="flex items-start gap-4 bg-surface rounded-2xl p-6 card-hover group"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Calendar className="w-6 h-6 text-secondary group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-primary">Book a Free Call</h3>
                      <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full font-medium">FREE</span>
                    </div>
                    <p className="text-sm text-text mb-2">
                      Schedule a 30-minute consultation at a time that works for you.
                    </p>
                    <span className="inline-flex items-center gap-1 text-secondary text-sm font-medium">
                      cal.id/aintric <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </Link>

                {/* Contact Form */}
                <Link to="/contact-form"
                  className="flex items-start gap-4 bg-surface rounded-2xl p-6 card-hover group"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Mail className="w-6 h-6 text-secondary group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-primary mb-1">Send a Message</h3>
                    <p className="text-sm text-text mb-2">
                      Fill out our contact form and we will get back to you promptly.
                    </p>
                    <span className="inline-flex items-center gap-1 text-secondary text-sm font-medium">
                      aintric.com/contact <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </Link>

                {/* Phone */}
                <a 
                  href="tel:+918951606862"
                  className="flex items-start gap-4 bg-surface rounded-2xl p-6 card-hover group"
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Phone className="w-6 h-6 text-secondary group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-primary mb-1">Call Us</h3>
                    <p className="text-sm text-text mb-2">
                      Speak directly with our team during business hours.
                    </p>
                    <span className="inline-flex items-center gap-1 text-secondary text-sm font-medium">
                      +91 89516 06862
                    </span>
                  </div>
                </a>
              </div>
            </div>

            {/* Right: Contact Info Cards */}
            <div className="space-y-6">
              <div className="bg-surface rounded-2xl p-8">
                <h3 className="text-xl font-bold text-primary mb-6">Contact Information</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">New Delhi Office</h4>
                      <p className="text-sm text-text">FF B-68, Mansa Ram Park, Uttam Nagar, New Delhi – 110059</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">Bengaluru Office</h4>
                      <p className="text-sm text-text">No. 51, 4th Main, Postal Colony, Sanjaynagar, Bengaluru – 560094</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">Email</h4>
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
                      <h4 className="font-semibold text-primary mb-1">Phone</h4>
                      <a href="tel:+918951606862" className="text-sm text-secondary hover:underline block">+91 89516 06862</a>
                      <a href="tel:+919740997984" className="text-sm text-secondary hover:underline block">+91 9740997984</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary mb-1">Website</h4>
                      <a href="https://www.ofstrideservices.com" target="_blank" rel="noopener noreferrer" className="text-sm text-secondary hover:underline">
                        www.ofstrideservices.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-primary text-white rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-2">GSTIN</h3>
                <p className="text-slate-300 text-sm mb-4">07AAGFO4479B1Z9</p>
                <p className="text-slate-400 text-sm">
                  Ofstride Services LLP is a registered Limited Liability Partnership established in 2019.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
