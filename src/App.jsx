import { Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom'
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
import CareersUpload from './pages/CareersUpload.jsx'
import EmployerCareers from './pages/EmployerCareers.jsx'
import CareerForm from './pages/vat-career-form.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
function ExpenseIdRedirect() {
  const { id } = useParams()
  return <Navigate to={`/cashflow/expense/${id || ''}`} replace />
}

import CashflowLayout from './components/cashflow/CashflowLayout.jsx'
import CashflowDashboard from './components/cashflow/CashflowDashboard.jsx'
import AccountsPayable from './components/cashflow/AccountsPayable.jsx'
import AccountsReceivable from './components/cashflow/AccountsReceivable.jsx'
import PettyCash from './components/cashflow/PettyCash.jsx'
import BankStatementReconcile from './components/cashflow/BankStatementReconcile.jsx'
import ExpensesAuthLayout from './components/ExpensesAuthLayout.jsx'
import ExpenseProtectedRoute from './components/ExpenseProtectedRoute.jsx'
import ExpensesLogin from './pages/expenses/ExpensesLogin.jsx'
import MyExpenses from './pages/expenses/MyExpenses.jsx'
import SubmitExpense from './pages/expenses/SubmitExpense.jsx'
import ExpenseDetail from './pages/expenses/ExpenseDetail.jsx'
import AdminExpenseQueue from './pages/expenses/AdminExpenseQueue.jsx'
import { getMetaTags } from './seo/routeMetadata.js'

function App() {
  const location = useLocation()

  useEffect(() => {
    const metadata = getMetaTags(location.pathname)
    document.title = metadata.title
    const setMeta = (selector, attribute, content) => {
      let element = document.head.querySelector(selector)
      if (!element) { element = document.createElement('meta'); element.setAttribute(attribute, content); document.head.appendChild(element) }
      element.setAttribute('content', content)
    }
    setMeta('meta[name="description"]', 'name', metadata.description)
    setMeta('meta[property="og:type"]', 'property', 'website')
    setMeta('meta[property="og:site_name"]', 'property', 'Ofstride Services LLP')
    setMeta('meta[property="og:title"]', 'property', metadata.title)
    setMeta('meta[property="og:description"]', 'property', metadata.description)
    setMeta('meta[property="og:url"]', 'property', metadata.url)
    setMeta('meta[property="og:image"]', 'property', metadata.image)
    setMeta('meta[property="og:image:width"]', 'property', '1200')
    setMeta('meta[property="og:image:height"]', 'property', '630')
    setMeta('meta[name="twitter:card"]', 'name', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'name', metadata.title)
    setMeta('meta[name="twitter:description"]', 'name', metadata.description)
    setMeta('meta[name="twitter:image"]', 'name', metadata.image)
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
    canonical.href = metadata.url
  }, [location.pathname])

  return (
    <Routes>
      {/* PUBLIC MARKETING WEBSITE ROUTES */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="services/:slug" element={<ServiceDetail />} />
        <Route path="about" element={<About />} />
        <Route path="industries" element={<Industries />} />
        <Route path="contact" element={<Contact />} />
        <Route path="careers" element={<Careers />} />
        <Route path="careers/jobs" element={<Careers />} />
        <Route path="careers/upload" element={<CareersUpload />} />
        <Route path="careers/veteran-transition" element={<CareerForm />} />
        <Route path="employer" element={<EmployerCareers />} />
        <Route path="admin/careers" element={<AdminCareers />} />
        <Route path="book-call" element={<BookCall />} />
        <Route path="contact-form" element={<ContactForm />} />
        <Route path="career-connect" element={<CareerForm />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />

          {/* CASHFLOW SUITE ROUTES (NOW INSIDE PUBLIC LAYOUT) */}
          <Route path="cashflow" element={<CashflowLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CashflowDashboard />} />
            <Route path="ap" element={<AccountsPayable />} />
            <Route path="ar" element={<AccountsReceivable />} />
            <Route path="pettycash" element={<PettyCash />} />
            <Route path="reconcile" element={<BankStatementReconcile />} />
            <Route path="expense" element={<ExpensesAuthLayout />}>
              <Route
                index
                element={
                  <ExpenseProtectedRoute>
                    <MyExpenses />
                  </ExpenseProtectedRoute>
                }
              />
              <Route path="login" element={<ExpensesLogin />} />
              <Route
                path="new"
                element={
                  <ExpenseProtectedRoute>
                    <SubmitExpense />
                  </ExpenseProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ExpenseProtectedRoute adminOnly>
                    <AdminExpenseQueue />
                  </ExpenseProtectedRoute>
                }
              />
              <Route
                path=":id"
                element={
                  <ExpenseProtectedRoute>
                    <ExpenseDetail />
                  </ExpenseProtectedRoute>
                }
              />
            </Route>
          </Route>

      </Route>

      <Route path="/expenses" element={<Navigate to="/cashflow/expense" replace />} />
      <Route path="/expenses/login" element={<Navigate to="/cashflow/expense/login" replace />} />
      <Route path="/expenses/new" element={<Navigate to="/cashflow/expense/new" replace />} />
      <Route path="/expenses/admin" element={<Navigate to="/cashflow/expense/admin" replace />} />
      <Route path="/expenses/:id" element={<ExpenseIdRedirect />} />
    </Routes>
  )
}

export default App