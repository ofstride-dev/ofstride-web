function PrivacyPolicy() {
  const sections = [
    {
      title: "1. About Us",
      body: "Ofstride Services LLP provides Business Advisory, HR Consulting, Recruitment, Financial Advisory, Legal Consulting, IT Consulting, AI & Business Automation, Compliance Advisory and Corporate Training.",
    },
    {
      title: "2. Information We Collect",
      body: "Personal, professional, business and technical information submitted through our website or services.",
    },
    {
      title: "3. Collection",
      body: "Information is collected through website forms, enquiries, recruitment, consulting engagements and lawful third-party sources.",
    },
    {
      title: "4. Purpose",
      body: "To deliver services, recruitment, compliance, support, analytics, security, AI-assisted processing and legal obligations.",
    },
    {
      title: "5. Legal Basis",
      body: "Consent, contractual necessity, legal obligations and legitimate business interests.",
    },
    {
      title: "6. AI-Based Processing",
      body: "AI tools may assist business processes; human oversight is maintained for important decisions.",
    },
    {
      title: "7. Cookies",
      body: "Cookies improve functionality and analytics; users may disable them in browser settings.",
    },
    {
      title: "8. Data Sharing",
      body: "No sale of personal data. Sharing only with authorised employees, service providers, advisors or authorities where required.",
    },
    {
      title: "9. International Transfers",
      body: "Appropriate safeguards are applied where overseas processing occurs.",
    },
    {
      title: "10. Security",
      body: "Administrative, technical and physical safeguards including access control and secure infrastructure.",
    },
    {
      title: "11. Retention",
      body: "Data retained only as long as necessary or legally required.",
    },
    {
      title: "12. Your Rights",
      body: "Access, correction, deletion, withdrawal of consent, grievance and other applicable rights.",
    },
    {
      title: "13. Children's Privacy",
      body: "Services are intended for businesses and professionals.",
    },
    {
      title: "14. Third-Party Links",
      body: "External websites have independent privacy practices.",
    },
    {
      title: "15. Recruitment",
      body: "Candidate information processed for recruitment and future opportunities with consent.",
    },
    {
      title: "16. Confidentiality",
      body: "Client confidential information is protected and disclosed only where legally required.",
    },
    {
      title: "17. Marketing",
      body: "Users may opt out of communications anytime.",
    },
    {
      title: "18. Changes",
      body: "Policy may be updated periodically.",
    },
    {
      title: "19. Grievance Officer",
      body: "Email: support@ofstrideservices.com",
    },
    {
      title: "20. Contact",
      body: "Ofstride Services LLP\nEmail: support@ofstrideservices.com\nWebsite: www.ofstrideservices.com",
    },
    {
      title: "21. Consent",
      body: "Use of the website constitutes consent as permitted by applicable law.",
    },
  ];

  return (
    <div className="pt-16 min-h-screen bg-slate-50">
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 lg:p-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary">Privacy Policy - Ofstride Services LLP</h1>
            <p className="mt-4 text-sm sm:text-base text-slate-700 leading-relaxed">
              This Privacy Policy explains how Ofstride Services LLP collects, uses, stores, shares and protects
              personal information in accordance with applicable Indian laws including the Digital Personal Data
              Protection Act, 2023 and the Information Technology Act, 2000.
            </p>

            <div className="mt-8 space-y-6">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-lg font-semibold text-primary">{section.title}</h2>
                  <p className="mt-2 text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>

            <p className="mt-10 pt-6 border-t border-slate-200 text-sm text-slate-600">
              Copyright Ofstride Services LLP. All Rights Reserved.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default PrivacyPolicy;
