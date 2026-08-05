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
import BusinessGrowthLayout from './components/business_growth/shared/BusinessGrowthLayout'
import BusinessGrowthOverviewPage from './pages/business-growth/index'
import BusinessGrowthIntakePage from './pages/business-growth/intake'
import BusinessGrowthAuditPage from './pages/business-growth/audit'
import BusinessGrowthDiagnosisPage from './pages/business-growth/diagnosis'
import BusinessGrowthRoadmapPage from './pages/business-growth/roadmap'
import BusinessGrowthReviewPage from './pages/business-growth/review'

function App() {
  const location = useLocation()

  useEffect(() => {
    const routeTitleMap = {
      '/': 'Ofstride Services LLP — AI-Powered Business Consulting',
      '/services': 'Services | Ofstride Services LLP',
      '/about': 'About | Ofstride Services LLP',
      '/industries': 'Industries | Ofstride Services LLP',
      '/contact': 'Contact | Ofstride Services LLP',
      '/book-call': 'Book a Free Call | Ofstride Services LLP',
      '/contact-form': 'Contact Form | Ofstride Services LLP',
      '/privacy-policy': 'Privacy Policy | Ofstride Services LLP',
      '/careers': 'Careers | Ofstride Services LLP',
      '/careers/jobs': 'Jobseeker Careers | Ofstride Services LLP',
      '/careers/upload': 'Upload Resume or JD | Ofstride Services LLP',
      '/careers/veteran-transition': 'Veteran Connect | Ofstride Services LLP',
      '/employer': 'Employer Careers | Ofstride Services LLP',
      '/admin/careers': 'Admin Careers | Ofstride Services LLP',
      '/career-connect': 'Veteran Connect | Ofstride Services LLP',
      '/expenses/login': 'Sign In | Expense Portal',
      '/expenses': 'My Expenses | Expense Portal',
      '/expenses/new': 'Submit Claim | Expense Portal',
      '/expenses/admin': 'Admin Queue | Expense Portal',
      '/cashflow': 'Cash Flow Suite | Ofstride Services LLP',
      '/cashflow/dashboard': 'Dashboard | Cash Flow Suite',
      '/cashflow/ap': 'Accounts Payable | Cash Flow Suite',
      '/cashflow/ar': 'Accounts Receivable | Cash Flow Suite',
      '/cashflow/pettycash': 'Petty Cash | Cash Flow Suite',
      '/cashflow/reconcile': 'Bank Statement Reconcile | Cash Flow Suite',
      '/cashflow/expense': 'Expense Portal | Cash Flow Suite',
      '/business-growth': 'Growth Execution Planner | Ofstride Services LLP',
      '/business-growth/intake': 'Growth Execution Planner Intake | Ofstride Services LLP',
      '/business-growth/audit': 'Growth Execution Planner Audit | Ofstride Services LLP',
      '/business-growth/diagnosis': 'Growth Execution Planner Diagnosis | Ofstride Services LLP',
      '/business-growth/roadmap': 'Growth Execution Planner Roadmap | Ofstride Services LLP',
      '/business-growth/review': 'Growth Execution Planner Review | Ofstride Services LLP',
    }

    if (location.pathname.startsWith('/services/')) {
      document.title = 'Service Details | Ofstride Services LLP'
      return
    }

    if (location.pathname.startsWith('/cashflow')) {
      document.title = routeTitleMap[location.pathname] || 'Cash Flow Suite | Ofstride Services LLP'
      return
    }

    document.title = routeTitleMap[location.pathname] || 'Ofstride Services LLP'
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

          <Route path="business-growth" element={<BusinessGrowthLayout />}>
            <Route index element={<BusinessGrowthOverviewPage />} />
            <Route path="intake" element={<BusinessGrowthIntakePage />} />
            <Route path="audit" element={<BusinessGrowthAuditPage />} />
            <Route path="diagnosis" element={<BusinessGrowthDiagnosisPage />} />
            <Route path="roadmap" element={<BusinessGrowthRoadmapPage />} />
            <Route path="review" element={<BusinessGrowthReviewPage />} />
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