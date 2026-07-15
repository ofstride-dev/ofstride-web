import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Briefcase, CheckCircle2, FileText, ShieldCheck, UploadCloud, Users } from "lucide-react";
import {
  completeCareersUpload,
  initCareersUpload,
  listCareersJobs,
  ApiClientError,
} from "../services/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function Careers() {
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");

  const [formData, setFormData] = useState({
    job_id: "",
    full_name: "",
    email: "",
    phone: "",
    linkedin_url: "",
    years_experience: "",
    cover_note: "",
    consent_accepted: false,
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [expandedJobId, setExpandedJobId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      setJobsError("");
      const response = await listCareersJobs();
      const nextJobs = Array.isArray(response.jobs) ? response.jobs : [];
      setJobs(nextJobs);
      // Auto-expand first job if none expanded yet
      if (nextJobs.length > 0) {
        setExpandedJobId((prev) => prev || nextJobs[0].id);
        setFormData((prev) => ({
          ...prev,
          job_id: prev.job_id || nextJobs[0].id,
        }));
      }
    } catch (error) {
      setJobsError(
        error instanceof ApiClientError
          ? error.message
          : "Could not load jobs right now. Please try again shortly."
      );
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadJobs().then(() => {});
    return () => {
      mounted = false;
    };
  }, [loadJobs]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === formData.job_id) ?? null,
    [jobs, formData.job_id]
  );

  const toggleExpand = (jobId) => {
    setExpandedJobId((prev) => (prev === jobId ? "" : jobId));
  };

  const onClickApplyForJob = (jobId) => {
    setFormData((prev) => ({ ...prev, job_id: jobId }));
    setExpandedJobId(jobId);
    setShowForm(true);
    setSubmitError("");
    // Scroll to form on mobile
    setTimeout(() => {
      document.getElementById("application-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSubmitError("");
    if (!file) {
      setResumeFile(null);
      return;
    }

    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_TYPES.includes(file.type)) {
      setSubmitError("Only PDF or DOCX resumes are allowed.");
      setResumeFile(null);
      return;
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      setSubmitError("Resume must be under 5 MB.");
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    if (!resumeFile) {
      setSubmitError("Please attach your resume before submitting.");
      return;
    }

    if (!formData.job_id) {
      setSubmitError("Please select a job before submitting.");
      return;
    }

    if (!formData.consent_accepted) {
      setSubmitError("Please accept consent to continue.");
      return;
    }

    try {
      setSubmitting(true);

      const initPayload = {
        job_id: formData.job_id,
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        linkedin_url: formData.linkedin_url.trim(),
        years_experience:
          formData.years_experience.trim() === ""
            ? undefined
            : Number(formData.years_experience),
        cover_note: formData.cover_note.trim(),
        consent_accepted: formData.consent_accepted,
        resume_original_name: resumeFile.name,
        resume_content_type: resumeFile.type,
        resume_size_bytes: resumeFile.size,
      };

      const initResponse = await initCareersUpload(initPayload);

      const uploadHeaders = {
        "x-ms-blob-type": initResponse.upload.required_headers["x-ms-blob-type"] || "BlockBlob",
        "Content-Type": initResponse.upload.required_headers["Content-Type"] || resumeFile.type,
      };

      const uploadResponse = await fetch(initResponse.upload.url, {
        method: initResponse.upload.method || "PUT",
        headers: uploadHeaders,
        body: resumeFile,
      });
      if (!uploadResponse.ok) {
        throw new Error(`Resume upload failed (HTTP ${uploadResponse.status})`);
      }

      const completeResponse = await completeCareersUpload(initResponse.application_id);
      setReferenceId(completeResponse.reference_id || initResponse.reference_id);
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiClientError && error.details?.code === "duplicate_application_window") {
        setSubmitError("You have already applied for this role in the last 30 days.");
      } else if (error instanceof ApiClientError) {
        setSubmitError(error.message || "Submission failed. Please try again.");
      } else {
        setSubmitError("Submission failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pt-16 sm:pt-20 min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-accent mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary mb-2">Application submitted</h1>
          <p className="text-text mb-4">
            Thank you for applying. Our HR team has received your application.
          </p>
          <div className="bg-surface rounded-xl px-4 py-3 text-left">
            <p className="text-sm text-muted">Reference ID</p>
            <p className="font-mono text-lg text-primary font-bold">{referenceId || "Pending"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <section className="py-14 sm:py-20 lg:py-24 bg-surface border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-secondary mb-2">Careers</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary">Talent Opportunities Through Ofstride</h1>
          <p className="text-text mt-3 max-w-3xl">
            We are a recruitment solutions provider. Explore live opportunities and submit your candidate profile through a secure, structured application workflow.
          </p>
          <div className="mt-6 grid sm:grid-cols-3 gap-3 text-sm text-primary">
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3"><ShieldCheck className="w-4 h-4 inline mr-2" />Secure upload flow</div>
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3"><Users className="w-4 h-4 inline mr-2" />Manual recruiter review</div>
            <div className="rounded-xl bg-white border border-slate-200 px-4 py-3"><FileText className="w-4 h-4 inline mr-2" />AI-assisted screening</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 mb-6">
          <p className="text-sm text-text">
            Employer/Admin flow moved to
            {" "}
            <a href="/employer" className="text-secondary font-medium underline">Employer Portal</a>
            .
            Jobseeker application flow is currently open while authentication provider migration is in progress.
          </p>
          <p className="mt-2 text-xs text-muted">No sign-in required for application submission at the moment.</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
        <aside className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" /> Open Positions
            {!jobsLoading && <span className="text-xs text-muted font-normal">({jobs.length} {jobs.length === 1 ? "role" : "roles"})</span>}
          </h2>

          {jobsLoading && <p className="text-sm text-muted py-4 text-center">Loading jobs...</p>}

          {!jobsLoading && jobsError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3 py-2">
              {jobsError}
            </div>
          )}

          {!jobsLoading && !jobsError && jobs.length === 0 && (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-muted">No active jobs are published yet.</p>
              <p className="text-xs text-muted mt-1">Check back later for new opportunities.</p>
            </div>
          )}

          <div className="space-y-3 mt-2">
            {jobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              const metaParts = [job.department, job.location, job.employment_type].filter(Boolean);
              return (
                <div
                  key={job.id}
                  className={`border rounded-xl transition-all duration-200 ${
                    isExpanded
                      ? "border-secondary shadow-sm bg-blue-50/30"
                      : "border-slate-200 hover:border-secondary/50 hover:shadow-sm"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 flex items-start justify-between gap-2"
                    onClick={() => toggleExpand(job.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-primary block truncate">{job.title}</span>
                      {metaParts.length > 0 && (
                        <span className="text-xs text-muted block mt-0.5">
                          {metaParts.join(" • ")}
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 text-slate-400 shrink-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-text max-h-60 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                          {job.jd_markdown || job.jd_raw_text || "No job details provided."}
                        </pre>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                          onClick={() => onClickApplyForJob(job.id)}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Apply Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div id="application-form" className="lg:col-span-3 bg-white rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-primary mb-2">Candidate Submission Form</h2>
          <p className="text-sm text-muted mb-6">This submission is handled by Ofstride as a recruitment service provider for client hiring mandates.</p>

          {!showForm && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 mb-6">
              Select a role from the left panel, expand the details, then click Apply to open the submission form.
            </div>
          )}

          {showForm && selectedJob && (
            <div className="rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm text-text mb-6">
              Applying for: <span className="font-semibold text-primary">{selectedJob.title}</span>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {showForm && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Full Name *</label>
                <input
                  name="full_name"
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Email *</label>
                <input
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Phone *</label>
                <input
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">LinkedIn (optional)</label>
                <input
                  name="linkedin_url"
                  type="url"
                  value={formData.linkedin_url}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Years of Experience (optional)</label>
              <input
                name="years_experience"
                type="number"
                min="0"
                step="0.5"
                value={formData.years_experience}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Cover Note (optional)</label>
              <textarea
                name="cover_note"
                rows={4}
                value={formData.cover_note}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1 flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Resume Upload *
              </label>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                required
                onChange={handleResumeChange}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white"
              />
              <p className="text-xs text-muted mt-2 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> PDF or DOCX, max 5 MB. Text-based resumes under 2 MB preferred.
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm text-text">
              <input
                type="checkbox"
                name="consent_accepted"
                checked={formData.consent_accepted}
                onChange={handleChange}
                className="mt-1"
                required
              />
              <span>
                I consent to Ofstride Services LLP processing my candidate profile for recruitment and role matching services.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || jobsLoading || jobs.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
          )}
        </div>
      </div>
      </section>
    </div>
  );
}

export default Careers;
