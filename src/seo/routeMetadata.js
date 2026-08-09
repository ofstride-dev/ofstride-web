export const SITE_ORIGIN = 'https://ofstrideservices.com'
export const SITE_NAME = 'Ofstride Services LLP'
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`

const defaultDescription = 'AI-powered business consulting in HR, Finance, Legal, IT and Strategy for ambitious businesses across India.'

const routes = {
  '/': { title: `${SITE_NAME} — AI-Powered Business Consulting`, description: defaultDescription },
  '/services': { title: `Services | ${SITE_NAME}`, description: 'Explore Ofstride consulting services across HR, finance, tax, legal, technology and business strategy.' },
  '/about': { title: `About | ${SITE_NAME}`, description: 'Learn how Ofstride combines practical consulting expertise with AI-powered systems to help businesses grow.' },
  '/industries': { title: `Industries | ${SITE_NAME}`, description: 'Consulting solutions for manufacturing, technology, healthcare, retail, startups, MSMEs and more.' },
  '/contact': { title: `Contact | ${SITE_NAME}`, description: 'Talk to Ofstride about your business, people, finance, compliance, technology or growth challenge.' },
  '/book-call': { title: `Book a Free Call | ${SITE_NAME}`, description: 'Book a conversation with Ofstride to identify the right consulting support for your business.' },
  '/contact-form': { title: `Contact Form | ${SITE_NAME}`, description: 'Send an enquiry to Ofstride Services LLP and our team will get back to you.' },
  '/privacy-policy': { title: `Privacy Policy | ${SITE_NAME}`, description: `Read the ${SITE_NAME} privacy policy.` },
  '/careers': { title: `Careers | ${SITE_NAME}`, description: 'Build your career with Ofstride Services LLP.' },
  '/careers/jobs': { title: `Jobseeker Careers | ${SITE_NAME}`, description: 'Explore career opportunities with Ofstride Services LLP.' },
  '/careers/upload': { title: `Upload Resume or JD | ${SITE_NAME}`, description: 'Share your resume or job description with the Ofstride careers team.' },
  '/careers/veteran-transition': { title: `Veteran Connect | ${SITE_NAME}`, description: 'Connect with Ofstride for veteran transition and career support.' },
  '/employer': { title: `Employer Careers | ${SITE_NAME}`, description: 'Connect with Ofstride for recruitment and workforce solutions.' },
  '/career-connect': { title: `Career Connect | ${SITE_NAME}`, description: 'Connect with Ofstride for veteran transition, career planning and support.' },
}

const serviceMetadata = {
  'human-resource-consulting': ['Human Resource Consulting', 'AI-driven workforce strategy, organisational design and culture building for teams that scale.'],
  'executive-search-recruitment': ['Executive Search & Recruitment', 'AI-powered talent intelligence and leadership hiring across India.'],
  'payroll-hr-compliance': ['Payroll & HR Compliance', 'Accurate payroll, statutory monitoring and HR compliance across every state.'],
  'financial-consulting-virtual-cfo': ['Financial Consulting & Virtual CFO', 'AI-enhanced forecasting, cash-flow intelligence and investor-ready financial discipline.'],
  'gst-tax-advisory': ['GST & Tax Advisory', 'Tax planning, GST compliance and regulatory insight that helps your business stay ahead.'],
  'legal-regulatory-compliance': ['Legal & Regulatory Compliance', 'Proactive legal and regulatory support across labour, corporate and civil matters.'],
  'it-consulting-digital-transformation': ['IT Consulting & Digital Transformation', 'Cloud, automation and AI-integrated systems that adapt as your business grows.'],
  'ai-data-science-consulting': ['AI & Data Science Consulting', 'Custom AI agents, predictive models and automation frameworks for intelligent operations.'],
  'business-strategy-process-improvement': ['Business Strategy & Process Improvement', 'AI-powered market intelligence, process optimisation and scenario planning.'],
  'employer-of-record-workforce': ['Employer of Record & Workforce Solutions', 'Pan-India workforce expansion with onboarding, compliance and contractor management.'],
}

export const PUBLIC_ROUTES = Object.keys(routes).concat(Object.keys(serviceMetadata).map((slug) => `/services/${slug}`))

export function getRouteMetadata(pathname = '/') {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (routes[path]) return { ...routes[path], path }
  const serviceMatch = path.match(/^\/services\/([^/]+)$/)
  if (serviceMatch && serviceMetadata[serviceMatch[1]]) {
    const [name, description] = serviceMetadata[serviceMatch[1]]
    return { title: `${name} | ${SITE_NAME}`, description, path }
  }
  return { ...routes['/'], path: '/' }
}

export function getMetaTags(pathname = '/') {
  const metadata = getRouteMetadata(pathname)
  const url = `${SITE_ORIGIN}${metadata.path === '/' ? '/' : metadata.path}`
  return { ...metadata, url, image: DEFAULT_OG_IMAGE }
}