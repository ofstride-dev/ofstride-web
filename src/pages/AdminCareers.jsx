import { useEffect, useState } from "react";
import {
  adminEnhanceJobDescription,
  adminGetApplication,
  adminListJobs,
  adminListApplications,
  adminRunApplicationAnalysis,
  adminCleanupStaleDrafts,
  adminSendFurtherDiscussionMail,
  adminSaveJob,
  adminUpdateApplicationStatus,
  ApiClientError,
} from "../services/api";
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthStateChange,
  getAccessToken,
} from "../services/supabase";

function AdminCareers() {
  const [auth, setAuth] = useState({ user: null, session: null, role: null, loading: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup"

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobForm, setJobForm] = useState({
    id: "",
    title: "",
    department: "",
    location: "",
    employment_type: "",
    status: "draft",
    jd_markdown: "",
  });
  const [savingJob, setSavingJob] = useState(false);
  const [jobMessage, setJobMessage] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [jdFile, setJdFile] = useState(null);
  const [uploadingJd, setUploadingJd] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [enhancingJd, setEnhancingJd] = useState(false);
  const [enhanceMessage, setEnhanceMessage] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [autoApplyStatus, setAutoApplyStatus] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const sub = onAuthStateChange((state) => {
      setAuth(state);
      if (state.role === "admin" || state.role === "employer") {
        loadList();
        loadJobs();
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await signInWithEmail(email, password);
    if (error) setAuthError(error);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await signUpWithEmail(email, password, "admin");
    if (error) {
      setAuthError(error);
    } else {
      setAuthError("Check your email for confirmation link.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuth({ user: null, session: null, role: null, loading: false });
    setItems([]);
    setJobs([]);
    setDetail(null);
  };

  // ── Data Loading ──────────────────────────────────────────────────────

  const loadList = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminListApplications({ limit: 100 });
      setItems(Array.isArray(data.items) ? data.items : []);
      if (!selectedId && data.items?.[0]?.id) {
        setSelectedId(String(data.items[0].id));
      }
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Failed to load applications.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const data = await adminListJobs();
      setJobs(Array.isArray(data.items) ? data.items : []);
    } catch {
      // Keep UX resilient
    }
  };

  const loadDetail = async (applicationId) => {
    if (!applicationId) return;
    setDetailLoading(true);
    try {
      const data = await adminGetApplication(applicationId);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  // ── Actions ───────────────────────────────────────────────────────────

  const onRunAnalysis = async () => {
    if (!selectedId) return;
    setAnalysisMessage("");
    try {
      const result = await adminRunApplicationAnalysis(selectedId, { auto_apply: autoApplyStatus });
      if (result.auto_applied) {
        setAnalysisMessage(`Analysis completed. Status auto-updated to ${result.suggested_status}.`);
      } else if (autoApplyStatus && result.suggested_status) {
        setAnalysisMessage(`Analysis completed. Suggested status: ${result.suggested_status}.`);
      } else {
        setAnalysisMessage("Analysis completed.");
      }
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setAnalysisMessage(e.message);
      } else {
        setAnalysisMessage("Failed to run analysis.");
      }
    }
  };

  const onSetStatus = async (status) => {
    if (!selectedId) return;
    await adminUpdateApplicationStatus(selectedId, status);
    await loadDetail(selectedId);
    await loadList();
  };

  const onPickJob = (job) => {
    setJobForm({
      id: String(job.id || ""),
      title: String(job.title || ""),
      department: String(job.department || ""),
      location: String(job.location || ""),
      employment_type: String(job.employment_type || ""),
      status: String(job.status || "draft"),
      jd_markdown: String(job.jd_markdown || ""),
    });
  };

  const onSaveJob = async (event) => {
    event.preventDefault();
    setSavingJob(true);
    setJobMessage("");
    try {
      await adminSaveJob({
        id: jobForm.id || undefined,
        title: jobForm.title,
        department: jobForm.department || undefined,
        location: jobForm.location || undefined,
        employment_type: jobForm.employment_type || undefined,
        status: jobForm.status,
        jd_markdown: jobForm.jd_markdown,
      });
      setJobMessage("Job profile saved successfully.");
      await loadJobs();
      await loadList();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setJobMessage(e.message);
      } else {
        setJobMessage("Failed to save job profile.");
      }
    } finally {
      setSavingJob(false);
    }
  };

  const onCleanupDrafts = async () => {
    setCleaning(true);
    setJobMessage("");
    try {
      const result = await adminCleanupStaleDrafts(24);
      setJobMessage(`Cleanup completed: ${result.updated} stale draft(s) marked upload_failed.`);
      await loadList();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setJobMessage(e.message);
      } else {
        setJobMessage("Cleanup failed.");
      }
    } finally {
      setCleaning(false);
    }
  };

  const onPublishUploadedJd = async () => {
    if (!jdFile) {
      setJobMessage("Choose a JD file (.md or .txt) first.");
      return;
    }
    if (!jobForm.title.trim()) {
      setJobMessage("Enter job title before uploading JD.");
      return;
    }

    setUploadingJd(true);
    setJobMessage("");
    try {
      const jdContent = await jdFile.text();
      await adminSaveJob({
        id: jobForm.id || undefined,
        title: jobForm.title,
        department: jobForm.department || undefined,
        location: jobForm.location || undefined,
        employment_type: jobForm.employment_type || undefined,
        status: jobForm.status,
        jd_markdown: jdContent || jobForm.jd_markdown,
        jd_raw_text: jdContent || jobForm.jd_markdown,
        jd_file_name: jdFile.name,
        jd_file_content_type: jdFile.type || "text/plain",
      });

      setJobMessage("JD uploaded to JD container and role published.");
      setJdFile(null);
      await loadJobs();
      await loadList();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setJobMessage(e.message);
      } else {
        setJobMessage("Failed to upload and publish JD.");
      }
    } finally {
      setUploadingJd(false);
    }
  };

  const onEnhanceJd = async () => {
    if (!jobForm.title.trim()) {
      setEnhanceMessage("Enter a job title first.");
      return;
    }
    setEnhancingJd(true);
    setEnhanceMessage("");
    try {
      const result = await adminEnhanceJobDescription({
        id: jobForm.id || undefined,
        title: jobForm.title,
        department: jobForm.department || undefined,
        location: jobForm.location || undefined,
        employment_type: jobForm.employment_type || undefined,
        jd_markdown: jobForm.jd_markdown || undefined,
      });
      setJobForm((prev) => ({ ...prev, jd_markdown: result.enhanced_jd_markdown }));
      setEnhanceMessage(
        result.has_template_match
          ? `JD enhanced using template ${result.template_id}.`
          : "JD enhanced using fallback template."
      );
    } catch (e) {
      if (e instanceof ApiClientError) {
        setEnhanceMessage(e.message);
      } else {
        setEnhanceMessage("Failed to enhance JD.");
      }
    } finally {
      setEnhancingJd(false);
    }
  };

  const onSendFurtherDiscussionMail = async () => {
    if (!selectedId) return;
    setNotifyMessage("");
    try {
      const res = await adminSendFurtherDiscussionMail(selectedId);
      if (res.sent) {
        setNotifyMessage("Follow-up discussion mail sent to applicant.");
      } else {
        setNotifyMessage(`Mail not sent: ${res.error || "unknown error"}`);
      }
      await loadDetail(selectedId);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setNotifyMessage(e.message);
      } else {
        setNotifyMessage("Could not send follow-up mail.");
      }
    }
  };

  // ── Render: Auth Screen ───────────────────────────────────────────────

  if (auth.loading) {
    return (
      <div className="pt-16 sm:pt-20 min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted">Loading authentication...</p>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-primary mb-2">Admin Sign In</h1>
            <p className="text-sm text-muted mb-6">
              Sign in with your Supabase account to manage careers.
            </p>

            <form onSubmit={authMode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  required
                  minLength={6}
                />
              </div>

              {authError && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium"
              >
                {authMode === "signin" ? "Sign In" : "Create Admin Account"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
                className="text-sm text-secondary hover:underline"
              >
                {authMode === "signin"
                  ? "No account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200">
              <p className="text-xs text-muted mb-2">Or sign in with Microsoft (Azure AD):</p>
              <a
                href="/.auth/login/aad?post_login_redirect_uri=/admin/careers"
                className="block text-center px-4 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                Sign in with Microsoft
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Dashboard ─────────────────────────────────────────────────

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-primary">Admin Careers Dashboard</h1>
          <div className="flex items-center gap-3">
            <a
              href="/careers/jobs"
              className="px-3 py-1.5 rounded-lg border border-secondary text-secondary text-xs bg-white hover:bg-blue-50 transition-colors"
            >
              View Job Seeker Page
            </a>
            <a
              href="/employer"
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white hover:bg-slate-50 transition-colors"
            >
              Employer Portal
            </a>
            <span className="text-xs text-muted">
              {auth.user?.email} ({auth.role})
            </span>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
            >
              Sign Out
            </button>
          </div>
        </div>
        <p className="text-text mb-3">Manage published job descriptions, review applicants, and run AI-assisted analysis.</p>

        {error && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">{error}</div>}

        <div className="grid xl:grid-cols-3 gap-6">
          <section className="bg-white rounded-xl shadow-sm p-4 xl:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary">Job Profiles (JD)</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-secondary border border-slate-200 rounded-lg px-2 py-1"
                  onClick={() => setJobForm({ id: "", title: "", department: "", location: "", employment_type: "", status: "draft", jd_markdown: "" })}
                >
                  + New
                </button>
                <button className="text-sm text-secondary" onClick={loadJobs}>Refresh</button>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-auto mb-4 pr-1">
              {jobs.map((job) => (
                <button
                  key={String(job.id)}
                  className={`w-full text-left border rounded-lg px-3 py-2 ${jobForm.id === String(job.id) ? "border-secondary bg-blue-50" : "border-slate-200 hover:border-secondary"}`}
                  onClick={() => onPickJob(job)}
                >
                  <div className="font-medium text-primary">{String(job.title || "Untitled")}</div>
                  <div className="text-xs text-muted">
                    {String(job.department || "")} {job.department && job.location ? "•" : ""} {String(job.location || "")} • {String(job.status || "draft")}
                  </div>
                </button>
              ))}
              {jobs.length === 0 && <p className="text-sm text-muted">No jobs created yet.</p>}
            </div>

            <form onSubmit={onSaveJob} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">Job Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Financial Analyst"
                  value={jobForm.title}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="e.g. Finance"
                    value={jobForm.department}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, India"
                    value={jobForm.location}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">Employment Type</label>
                  <select
                    value={jobForm.employment_type}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, employment_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary mb-1">Status</label>
                  <select
                    value={jobForm.status}
                    onChange={(e) => setJobForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-primary">Job Description (Markdown) *</label>
                  <button
                    type="button"
                    onClick={onEnhanceJd}
                    disabled={enhancingJd}
                    className="px-2 py-1 rounded border border-indigo-300 text-indigo-700 text-xs bg-indigo-50"
                    title="Enhance JD using AI template"
                  >
                    {enhancingJd ? "Enhancing..." : "Enhance JD"}
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder={"# Job Title\n\n## Responsibilities\n- ...\n\n## Requirements\n- ..."}
                  value={jobForm.jd_markdown}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, jd_markdown: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm"
                  required
                />
                {enhanceMessage && <p className="text-xs text-muted mt-1">{enhanceMessage}</p>}
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <label className="block text-xs font-medium text-primary mb-2">Or upload a JD file (.md or .txt)</label>
                <input
                  type="file"
                  accept=".md,.txt,text/markdown,text/plain"
                  onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm"
                />
                {jdFile && <p className="text-xs text-muted mt-2">Selected: {jdFile.name}</p>}
                <button
                  disabled={uploadingJd}
                  type="button"
                  onClick={onPublishUploadedJd}
                  className="mt-3 px-3 py-2 rounded-lg border border-primary text-primary text-sm bg-white"
                >
                  {uploadingJd ? "Uploading JD..." : "Upload JD & Publish Role"}
                </button>
              </div>
              <div className="flex gap-2">
                <button disabled={savingJob} type="submit" className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-sm">
                  {savingJob ? "Saving..." : jobForm.id ? "Update Job" : "Save Job"}
                </button>
                <button disabled={cleaning} type="button" onClick={onCleanupDrafts} className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                  {cleaning ? "Cleaning..." : "Cleanup Drafts"}
                </button>
              </div>
              {jobMessage && <p className={`text-xs ${jobMessage.includes("success") ? "text-emerald-600" : "text-muted"}`}>{jobMessage}</p>}
            </form>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-4 xl:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary">Applications</h2>
              <button className="text-sm text-secondary" onClick={loadList}>Refresh</button>
            </div>
            {loading ? (
              <p className="text-sm text-muted">Loading...</p>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-auto">
                {items.map((item) => (
                  <button
                    key={String(item.id)}
                    className={`w-full text-left border rounded-lg px-3 py-2 ${selectedId === String(item.id) ? "border-secondary bg-blue-50" : "border-slate-200"}`}
                    onClick={() => setSelectedId(String(item.id))}
                  >
                    <div className="font-medium text-primary">{String(item.full_name || "Unnamed")}</div>
                    <div className="text-xs text-muted">{String(item.job_title || item.job_id || "")}</div>
                    <div className="text-xs mt-1">
                      <span className="mr-2">Status: {String(item.submission_status || "-")}</span>
                      <span>Analysis: {String(item.analysis_status || "not_started")}</span>
                    </div>
                  </button>
                ))}
                {items.length === 0 && <p className="text-sm text-muted">No applications found.</p>}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl shadow-sm p-4 xl:col-span-1">
            <h2 className="font-semibold text-primary mb-4">Application Detail</h2>
            {detailLoading ? (
              <p className="text-sm text-muted">Loading detail...</p>
            ) : !detail ? (
              <p className="text-sm text-muted">Select an application to view details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div><strong>Reference:</strong> {String(detail.reference_id || "-")}</div>
                <div><strong>Name:</strong> {String(detail.full_name || "-")}</div>
                <div><strong>Email:</strong> {String(detail.email || "-")}</div>
                <div><strong>Phone:</strong> {String(detail.phone || "-")}</div>
                <div><strong>Job:</strong> {String(detail.job_title || detail.job_id || "-")}</div>
                <div><strong>Status:</strong> {String(detail.submission_status || "-")}</div>
                <div><strong>Analysis Status:</strong> {String(detail.analysis_status || "not_started")}</div>
                <div><strong>Match Score:</strong> {detail.match_score == null ? "-" : String(detail.match_score)}</div>
                <div><strong>Recommendation:</strong> {String(detail.recommendation || "-")}</div>
                <div><strong>Strengths:</strong> {String(detail.strengths_summary || "-")}</div>
                <div><strong>Gaps:</strong> {String(detail.gaps_summary || "-")}</div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-2">
                  <button onClick={onRunAnalysis} className="px-3 py-2 rounded-lg bg-primary text-white text-sm">Run Analysis</button>
                  <label className="inline-flex items-center gap-2 px-2 py-2 rounded-lg border border-slate-200 text-xs">
                    <input
                      type="checkbox"
                      checked={autoApplyStatus}
                      onChange={(e) => setAutoApplyStatus(Boolean(e.target.checked))}
                    />
                    Auto-apply suggested status
                  </label>
                  <button onClick={() => onSetStatus("under_review")} className="px-3 py-2 rounded-lg border border-slate-300 text-sm">Mark Under Review</button>
                  <button onClick={() => onSetStatus("shortlisted")} className="px-3 py-2 rounded-lg border border-emerald-400 text-emerald-700 text-sm">Shortlist</button>
                  <button onClick={() => onSetStatus("rejected")} className="px-3 py-2 rounded-lg border border-rose-400 text-rose-700 text-sm">Reject</button>
                  <button
                    onClick={onSendFurtherDiscussionMail}
                    className="px-3 py-2 rounded-lg border border-indigo-400 text-indigo-700 text-sm"
                  >
                    Send further discussion mail
                  </button>
                </div>
                {analysisMessage && <div className="text-xs text-muted">{analysisMessage}</div>}
                {notifyMessage && <div className="text-xs text-muted">{notifyMessage}</div>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminCareers;
