import { createRoutesFromElements, Route, Navigate, useParams } from 'react-router-dom'
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
import CashflowAuthLayout from './components/cashflow/CashflowAuthLayout.jsx'
import CashflowProtectedRoute from './components/CashflowProtectedRoute.jsx'
import CashflowLogin from './pages/cashflow/CashflowLogin.jsx'
import CashflowResetPassword from './pages/cashflow/CashflowResetPassword.jsx'
import MyExpenses from './pages/expenses/MyExpenses.jsx'
import SubmitExpense from './pages/expenses/SubmitExpense.jsx'
import ExpenseDetail from './pages/expenses/ExpenseDetail.jsx'
import AdminExpenseQueue from './pages/expenses/AdminExpenseQueue.jsx'
import CashflowOnboarding from './pages/cashflow/CashflowOnboarding.jsx'
import CashflowCompanyProfile from './pages/cashflow/CashflowCompanyProfile.jsx'
import AcceptInvite from './pages/expenses/AcceptInvite.jsx'
import AdminInvites from './pages/expenses/AdminInvites.jsx'
import { PUBLIC_ROUTES } from './seo/routeMetadata.js'
import { HelmetProvider } from 'react-helmet-async'

export const routes = createRoutesFromElements(
  <>
      {/* PUBLIC MARKETING WEBSITE ROUTES */}
      <Route path="/" element={<HelmetProvider><Layout /></HelmetProvider>}>
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
            <Route index element={<Navigate to="login" replace />} />
            <Route path="login" element={<CashflowLogin />} />
            <Route path="reset-password" element={<CashflowResetPassword />} />
            <Route path="dashboard" element={<CashflowProtectedRoute><CashflowDashboard /></CashflowProtectedRoute>} />
            <Route path="ap" element={<CashflowProtectedRoute><AccountsPayable /></CashflowProtectedRoute>} />
            <Route path="ar" element={<CashflowProtectedRoute><AccountsReceivable /></CashflowProtectedRoute>} />
            <Route path="pettycash" element={<CashflowProtectedRoute><PettyCash /></CashflowProtectedRoute>} />
            <Route path="reconcile" element={<CashflowProtectedRoute><BankStatementReconcile /></CashflowProtectedRoute>} />
            <Route
              path="invites"
              element={
                <CashflowProtectedRoute allowedRoles={["owner", "admin", "finance"]}>
                  <AdminInvites />
                </CashflowProtectedRoute>
              }
            />
            <Route path="expense" element={<CashflowAuthLayout />}>
              <Route path="login" element={<CashflowLogin />} />
              <Route path="accept-invite" element={<AcceptInvite />} />
              <Route
                path="onboarding"
                element={
                  <CashflowProtectedRoute allowWithoutCompany>
                    <CashflowOnboarding />
                  </CashflowProtectedRoute>
                }
              />
              <Route
                path="company-profile"
                element={
                  <CashflowProtectedRoute allowWithoutCompany>
                    <CashflowCompanyProfile />
                  </CashflowProtectedRoute>
                }
              />
              <Route
                index
                element={
                  <CashflowProtectedRoute>
                    <MyExpenses />
                  </CashflowProtectedRoute>
                }
              />
              <Route
                path="new"
                element={
                  <CashflowProtectedRoute>
                    <SubmitExpense />
                  </CashflowProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <CashflowProtectedRoute adminOnly>
                    <AdminExpenseQueue />
                  </CashflowProtectedRoute>
                }
              />
              <Route
                path=":id"
                element={
                  <CashflowProtectedRoute>
                    <ExpenseDetail />
                  </CashflowProtectedRoute>
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
  </>,
)

// vite-react-ssg uses this route option to expand the dynamic service route.
const publicServicePaths = PUBLIC_ROUTES.filter((path) => path.startsWith('/services/'))
const marketingRoute = routes.find((route) => route.path === '/')
const serviceRoute = marketingRoute?.children?.find((route) => route.path === 'services/:slug')
if (serviceRoute) {
  serviceRoute.getStaticPaths = () => publicServicePaths
}

export default routes