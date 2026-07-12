import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function CareersAccess() {
  const [audience, setAudience] = useState("jobseeker");
  const navigate = useNavigate();

  const targetPath = useMemo(() => {
    if (audience === "employer") {
      return "/employer";
    }
    return "/careers/jobs";
  }, [audience]);

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary mb-2">Careers Portal</p>
          <h1 className="text-3xl font-bold text-primary mb-3">Choose Your Careers Path</h1>
          <p className="text-text mb-6">
            Select Jobseeker to browse and apply for roles. Select Employer/Admin to sign in and manage job descriptions and applications.
          </p>

          <label className="block text-sm font-medium text-primary mb-2">I am a</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white mb-5"
          >
            <option value="jobseeker">Jobseeker</option>
            <option value="employer">Employer / Admin</option>
          </select>

          <button
            type="button"
            onClick={() => navigate(targetPath)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-primary text-white font-semibold"
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}

export default CareersAccess;
