import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Services from './pages/Services.jsx'
import ServiceDetail from './pages/ServiceDetail.jsx'
import About from './pages/About.jsx'
import Industries from './pages/Industries.jsx'
import Contact from './pages/Contact.jsx'
import BookCall from './pages/BookCall.jsx'
import ContactForm from './pages/ContactForm.jsx'
import Careers from './pages/Careers.jsx'
import AdminCareers from './pages/AdminCareers.jsx'
import CareersAccess from './pages/CareersAccess.jsx'
import EmployerCareers from './pages/EmployerCareers.jsx'

function App() {
  const location = useLocation()

  useEffect(() => {
    const routeTitleMap = {
      '/': 'Ofstride Services LLP — AI-Powered Business Consulting',
      '/services': 'Services | Ofstride Services LLP',
      '/about': 'About | Ofstride Services LLP',
      '/industries': 'Industries | Ofstride Services LLP',
      '/contact': 'Contact | Ofstride Services LLP',
      '/book-call': 'Book a Call | Ofstride Services LLP',
      '/contact-form': 'Contact Form | Ofstride Services LLP',
      '/careers': 'Careers | Ofstride Services LLP',
      '/careers/jobs': 'Jobseeker Careers | Ofstride Services LLP',
      '/employer': 'Employer Careers | Ofstride Services LLP',
      '/admin/careers': 'Admin Careers | Ofstride Services LLP',
    }

    if (location.pathname.startsWith('/services/')) {
      document.title = 'Service Details | Ofstride Services LLP'
      return
    }

    document.title = routeTitleMap[location.pathname] || 'Ofstride Services LLP'
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="services/:slug" element={<ServiceDetail />} />
        <Route path="about" element={<About />} />
        <Route path="industries" element={<Industries />} />
        <Route path="contact" element={<Contact />} />
        <Route path="careers" element={<CareersAccess />} />
        <Route path="careers/jobs" element={<Careers />} />
        <Route path="employer" element={<EmployerCareers />} />
        <Route path="admin/careers" element={<AdminCareers />} />
        <Route path="book-call" element={<BookCall />} />
        <Route path="contact-form" element={<ContactForm />} />
      </Route>
    </Routes>
  )
}

export default App
