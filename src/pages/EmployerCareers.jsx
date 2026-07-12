function EmployerCareers() {
  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary mb-2">Employer / Admin</p>
          <h1 className="text-3xl font-bold text-primary mb-3">Manage Hiring Operations</h1>
          <p className="text-text mb-6">
            Use this portal to upload job descriptions and open the admin dashboard.
          </p>

          <div className="flex flex-wrap gap-3">
            <a href="/admin/careers#upload" className="px-4 py-2 rounded-lg bg-primary text-white text-sm">Upload JD</a>
            <a href="/admin/careers" className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Open Admin Dashboard</a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default EmployerCareers;
