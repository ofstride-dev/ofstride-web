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

function computeSimpleDiff(originalText, enhancedText) {
  const before = String(originalText || "").split("\n");
  const after = String(enhancedText || "").split("\n");
  const maxLen = Math.max(before.length, after.length);
  const rows = [];
  for (let i = 0; i < maxLen; i += 1) {
    const prev = before[i] ?? "";
    const next = after[i] ?? "";
    if (prev === next) {
      continue;
    }
    rows.push({
      line: i + 1,
      prev,
      next,
      type: !prev ? "added" : !next ? "removed" : "changed",
    });
    if (rows.length >= 40) {
      break;
    }
  }
  return rows;
}

function getSuggestedAction(detail) {
  const status = String(detail?.submission_status || "").toLowerCase();
  const analysisStatus = String(detail?.analysis_status || "").toLowerCase();
  const recommendation = String(detail?.recommendation || "").toLowerCase();
  const mailSent = Boolean(detail?.applicant_email_sent_at);

  if (analysisStatus !== "completed") {
    return {
      key: "run-analysis",
      title: "Run resume analysis",
      description: "Start AI evaluation to generate score, recommendation, and next-step guidance.",
    };
  }

  if (status === "shortlisted" && !mailSent) {
    return {
      key: "send-confirmation",
      title: "Send shortlisted confirmation",
      description: "Notify the candidate with further discussion details.",
    };
  }

  if (status === "submitted" || status === "under_review") {
    if (recommendation === "shortlist") {
      return {
        key: "shortlist",
        title: "Shortlist candidate",
        description: "Analysis indicates strong fit. Move candidate to shortlisted status.",
      };
    }
    if (recommendation === "hold") {
      return {
        key: "reject",
        title: "Reject candidate",
        description: "Analysis indicates low fit. Close application with a rejection decision.",
      };
    }
    return {
      key: "under-review",
      title: "Keep under review",
      description: "Candidate needs manual review before final decision.",
    };
  }

  return {
    key: "none",
    title: "No immediate action required",
    description: "Current state looks complete. Use manual actions only if you want to override.",
  };
}

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
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobApplicationCounts, setJobApplicationCounts] = useState({});
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
  const [jdPreview, setJdPreview] = useState(null);
  const [showJobEditor, setShowJobEditor] = useState(false);
  const [workspaceView, setWorkspaceView] = useState("triage"); // triage | jobs
  const [detailTab, setDetailTab] = useState("overview"); // overview | ai | actions

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

  const loadList = async (jobIdOverride) => {
    setLoading(true);
    setError("");
    try {
      const effectiveJobId = String(jobIdOverride || selectedJobId || "").trim();
      const data = await adminListApplications({ limit: 100, job_id: effectiveJobId || undefined });
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
      const allJobs = Array.isArray(data.items) ? data.items : [];
      const sorted = [...allJobs].sort((a, b) => {
        const aActive = String(a.status || "").toLowerCase() === "active" ? 0 : 1;
        const bActive = String(b.status || "").toLowerCase() === "active" ? 0 : 1;
        return aActive - bActive;
      });
      setJobs(sorted);
      const active = sorted.filter((job) => String(job.status || "").toLowerCase() === "active");
      const countsEntries = await Promise.all(
        active.map(async (job) => {
          const id = String(job.id || "");
          if (!id) return [id, 0];
          try {
            const result = await adminListApplications({ job_id: id, limit: 200 });
            return [id, Number(result.count || 0)];
          } catch {
            return [id, 0];
          }
        })
      );
      setJobApplicationCounts(Object.fromEntries(countsEntries));

      if (!selectedJobId && sorted.length > 0) {
        const firstActive = sorted.find((job) => String(job.status || "").toLowerCase() === "active") || sorted[0];
        const jobId = String(firstActive.id || "");
        if (jobId) {
          setSelectedJobId(jobId);
          await loadList(jobId);
        }
      }
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
      setDetail((prev) => (prev ? { ...prev, ...result } : prev));
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
    const nextJobId = String(job.id || "");
    setSelectedJobId(nextJobId);
    setJobForm({
      id: nextJobId,
      title: String(job.title || ""),
      department: String(job.department || ""),
      location: String(job.location || ""),
      employment_type: String(job.employment_type || ""),
      status: String(job.status || "draft"),
      jd_markdown: String(job.jd_markdown || ""),
    });
    setShowJobEditor(false);
    setSelectedId("");
    loadList(nextJobId);
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
      await loadList(selectedJobId);
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
      await loadList(selectedJobId);
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
      const original = String(jobForm.jd_markdown || "");
      const result = await adminEnhanceJobDescription({
        id: jobForm.id || undefined,
        title: jobForm.title,
        department: jobForm.department || undefined,
        location: jobForm.location || undefined,
        employment_type: jobForm.employment_type || undefined,
        jd_markdown: jobForm.jd_markdown || undefined,
      });
      setJdPreview({
        original,
        enhanced: result.enhanced_jd_markdown,
        templateId: result.template_id,
        usedLlm: Boolean(result.used_llm),
        llmProvider: result.llm_provider || "",
        hasTemplateMatch: Boolean(result.has_template_match),
      });
      setEnhanceMessage("Preview generated. Review diff and apply changes if approved.");
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

  const onApplyEnhancedJd = () => {
    if (!jdPreview) return;
    setJobForm((prev) => ({ ...prev, jd_markdown: jdPreview.enhanced }));
    setEnhanceMessage(
      jdPreview.usedLlm
        ? `JD updated using ${jdPreview.llmProvider || "existing LLM"}.`
        : `JD updated using template ${jdPreview.templateId || "fallback"}.`
    );
    setJdPreview(null);
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

  const onRunSuggestedAction = async () => {
    if (!detail) return;
    const suggested = getSuggestedAction(detail);
    if (suggested.key === "run-analysis") {
      await onRunAnalysis();
      return;
    }
    if (suggested.key === "send-confirmation") {
      await onSendFurtherDiscussionMail();
      return;
    }
    if (suggested.key === "shortlist") {
      await onSetStatus("shortlisted");
      return;
    }
    if (suggested.key === "reject") {
      await onSetStatus("rejected");
      return;
    }
    if (suggested.key === "under-review") {
      await onSetStatus("under_review");
    }
  };

  const selectedJob = jobs.find((job) => String(job.id || "") === selectedJobId) || null;

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
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Admin Careers Workspace</h1>
            <p className="text-sm text-text mt-1">Focused workflow for candidate triage and job design.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs text-muted">
              {auth.user?.email} ({auth.role})
            </span>
            <a
              href="/careers/jobs"
              className="px-3 py-1.5 rounded-lg border border-secondary text-secondary text-xs bg-white hover:bg-blue-50 transition-colors"
            >
              View Public Jobs
            </a>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white hover:bg-slate-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="sticky top-[68px] sm:top-[84px] z-20 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-2 flex flex-wrap items-center gap-2 shadow-sm">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${workspaceView === "triage" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            onClick={() => setWorkspaceView("triage")}
          >
            Candidate Triage
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${workspaceView === "jobs" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            onClick={() => setWorkspaceView("jobs")}
          >
            Job Designer
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">{error}</div>}

        {workspaceView === "triage" ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <label className="block text-xs font-medium text-primary mb-1">Filter by Job</label>
                  <select
                    value={selectedJobId}
                    onChange={async (e) => {
                      const nextJobId = String(e.target.value || "");
                      setSelectedJobId(nextJobId);
                      setSelectedId("");
                      await loadList(nextJobId || undefined);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="">All jobs</option>
                    {jobs.map((job) => (
                      <option key={String(job.id)} value={String(job.id)}>
                        {String(job.title || "Untitled")} ({String(job.status || "draft")})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white hover:bg-slate-50 transition-colors" onClick={() => loadList(selectedJobId || undefined)}>
                  Refresh Queue
                </button>
              </div>
            </div>

            <div className="grid xl:grid-cols-[340px_1fr] gap-6">
              <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-primary">Applications Queue</h2>
                  <span className="text-xs text-muted">{items.length} items</span>
                </div>
                {loading ? (
                  <p className="text-sm text-muted">Loading...</p>
                ) : (
                  <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                    {items.map((item) => (
                      <button
                        key={String(item.id)}
                        className={`w-full text-left border rounded-lg px-3 py-2 transition-colors ${selectedId === String(item.id) ? "border-secondary bg-blue-50" : "border-slate-200 hover:border-secondary hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(String(item.id))}
                      >
                        <div className="font-medium text-primary truncate">{String(item.full_name || "Unnamed")}</div>
                        <div className="text-xs text-muted">{String(item.job_title || item.job_id || "")}</div>
                        <div className="text-xs mt-1 text-slate-700">
                          {String(item.submission_status || "-")} • {String(item.analysis_status || "not_started")}
                        </div>
                      </button>
                    ))}
                    {items.length === 0 && <p className="text-sm text-muted">No applications found.</p>}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                <h2 className="font-semibold text-primary mb-3">Candidate Workspace</h2>
                {detailLoading ? (
                  <p className="text-sm text-muted">Loading detail...</p>
                ) : !detail ? (
                  <p className="text-sm text-muted">Select an application to start review.</p>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const suggested = getSuggestedAction(detail);
                      return (
                        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                          <div className="text-xs font-semibold text-indigo-900">Suggested Next Action</div>
                          <div className="text-sm font-semibold text-indigo-900 mt-1">{suggested.title}</div>
                          <div className="text-xs text-indigo-800 mt-1">{suggested.description}</div>
                          {suggested.key !== "none" && (
                            <button
                              onClick={onRunSuggestedAction}
                              className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-700 text-white text-xs hover:opacity-95 transition-opacity"
                            >
                              Proceed
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Name:</strong> {String(detail.full_name || "-")}</div>
                      <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Reference:</strong> {String(detail.reference_id || "-")}</div>
                      <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Email:</strong> {String(detail.email || "-")}</div>
                      <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Status:</strong> {String(detail.submission_status || "-")}</div>
                      <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Analysis:</strong> {String(detail.analysis_status || "not_started")}</div>
                      <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Score:</strong> {detail.match_score == null ? "-" : String(detail.match_score)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${detailTab === "overview" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                        onClick={() => setDetailTab("overview")}
                      >
                        Overview
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${detailTab === "ai" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                        onClick={() => setDetailTab("ai")}
                      >
                        Review Analyzer
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${detailTab === "actions" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                        onClick={() => setDetailTab("actions")}
                      >
                        Actions
                      </button>
                    </div>

                    {detailTab === "overview" && (
                      <div className="space-y-2 text-sm">
                        <div><strong>Job:</strong> {String(detail.job_title || detail.job_id || "-")}</div>
                        <div><strong>Phone:</strong> {String(detail.phone || "-")}</div>
                        <div><strong>Recommendation:</strong> {String(detail.recommendation || "-")}</div>
                        <div><strong>Strengths:</strong> {String(detail.strengths_summary || "-")}</div>
                        <div><strong>Gaps:</strong> {String(detail.gaps_summary || "-")}</div>
                        {detail.structured_report?.summary && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700">Structured Summary</div>
                            <div className="text-sm text-slate-800 mt-1 break-words">{String(detail.structured_report.summary || "-")}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              Fit: {String(detail.structured_report?.fit_band || "-")} | Exp: {String(detail.structured_report?.score_breakdown?.experience_years ?? "-")} yrs | Matched: {String(detail.structured_report?.score_breakdown?.matched_skills_count ?? "-")} | Missing: {String(detail.structured_report?.score_breakdown?.missing_skills_count ?? "-")}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {detailTab === "ai" && (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <div className="text-xs font-semibold text-blue-900">Analyzer {"->"} Revalidator</div>
                          <div className="text-xs text-blue-800 mt-1">
                            Run AI analysis and revalidation to generate score, summary, and recommendation.
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button onClick={onRunAnalysis} className="px-3 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-95 transition-opacity">
                              Run Analyzer + Revalidator
                            </button>
                            <label className="inline-flex items-center gap-2 px-2 py-2 rounded-lg border border-blue-200 text-xs bg-white">
                              <input
                                type="checkbox"
                                checked={autoApplyStatus}
                                onChange={(e) => setAutoApplyStatus(Boolean(e.target.checked))}
                              />
                              Auto-apply suggested status
                            </label>
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                          <div><strong>AI used:</strong> {String(Boolean(detail.ai_used))}</div>
                          <div><strong>AI provider:</strong> {String(detail.ai_provider || "-")}</div>
                          <div><strong>Fallback reason:</strong> {String(detail.ai_fallback_reason || "-")}</div>
                          <div><strong>AI error:</strong> {String(detail.ai_error || "-")}</div>
                        </div>
                      </div>
                    )}

                    {detailTab === "actions" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => onSetStatus("under_review")} className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white hover:bg-slate-50 transition-colors">Mark Under Review</button>
                          <button onClick={() => onSetStatus("shortlisted")} className="px-3 py-2 rounded-lg border border-emerald-400 text-emerald-700 text-sm bg-white hover:bg-emerald-50 transition-colors">Shortlist</button>
                          <button onClick={() => onSetStatus("rejected")} className="px-3 py-2 rounded-lg border border-rose-400 text-rose-700 text-sm bg-white hover:bg-rose-50 transition-colors">Reject</button>
                        </div>
                        <button
                          onClick={onSendFurtherDiscussionMail}
                          className="px-3 py-2 rounded-lg border border-indigo-400 text-indigo-700 text-sm bg-white hover:bg-indigo-50 transition-colors"
                        >
                          Send confirmation mail
                        </button>
                      </div>
                    )}

                    {analysisMessage && <div className="text-xs text-muted">{analysisMessage}</div>}
                    {notifyMessage && <div className="text-xs text-muted">{notifyMessage}</div>}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="grid xl:grid-cols-[320px_1fr] gap-6">
            <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-primary">Job Profiles</h2>
                <button className="text-sm text-secondary" onClick={loadJobs}>Refresh</button>
              </div>

              <button
                type="button"
                className="w-full mb-3 text-xs text-secondary border border-slate-200 rounded-lg px-2 py-2 bg-white hover:bg-slate-50 transition-colors"
                onClick={() => {
                  setJobForm({ id: "", title: "", department: "", location: "", employment_type: "", status: "draft", jd_markdown: "" });
                  setShowJobEditor(true);
                }}
              >
                + Create New Job
              </button>

              <div className="space-y-2 max-h-[65vh] overflow-auto pr-1">
                {jobs.map((job) => (
                  <button
                    key={String(job.id)}
                    className={`w-full text-left border rounded-lg px-3 py-2 transition-colors ${selectedJobId === String(job.id) ? "border-secondary bg-blue-50" : "border-slate-200 hover:border-secondary hover:bg-slate-50"}`}
                    onClick={() => onPickJob(job)}
                  >
                    <div className="font-medium text-primary">{String(job.title || "Untitled")}</div>
                    <div className="text-xs text-muted">
                      {String(job.department || "")} {job.department && job.location ? "•" : ""} {String(job.location || "")} • {String(job.status || "draft")}
                    </div>
                    <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                      {Number(jobApplicationCounts[String(job.id)] || 0)} applied
                    </div>
                  </button>
                ))}
                {jobs.length === 0 && <p className="text-sm text-muted">No jobs found.</p>}
              </div>
            </section>

            <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
              <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    {selectedJob ? `Editing: ${selectedJob.title || "Untitled"}` : "No JD selected"}
                  </p>
                  <p className="text-xs text-muted">Use JD Enhancer and publish from this focused workspace.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowJobEditor((prev) => !prev)}
                  className="px-2 py-1 rounded border border-slate-300 text-xs bg-white hover:bg-slate-50 transition-colors"
                >
                  {showJobEditor ? "Hide Editor" : "Open Editor"}
                </button>
              </div>

              {showJobEditor && (
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
              )}
            </section>
          </div>
        )}
      </div>

      {jdPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-2 sm:p-6 flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-6xl bg-white rounded-xl shadow-xl overflow-hidden my-4">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-primary">JD Enhancement Preview</h3>
                <p className="text-xs text-muted">
                  {jdPreview.usedLlm
                    ? `Generated via existing LLM (${jdPreview.llmProvider || "configured provider"}).`
                    : `Generated via template mode (${jdPreview.templateId || "fallback"}).`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJdPreview(null)}
                className="px-2 py-1 rounded border border-slate-300 text-xs"
              >
                Close
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-0">
              <div className="border-r border-slate-200 p-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Current JD</h4>
                <pre className="text-xs leading-5 whitespace-pre-wrap break-words bg-slate-50 rounded-lg p-3 max-h-[52vh] overflow-auto">{jdPreview.original || "(empty)"}</pre>
              </div>
              <div className="p-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Proposed JD</h4>
                <pre className="text-xs leading-5 whitespace-pre-wrap break-words bg-emerald-50 rounded-lg p-3 max-h-[52vh] overflow-auto">{jdPreview.enhanced || "(empty)"}</pre>
              </div>
            </div>

            <div className="px-4 pb-3">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Diff Summary (first 40 changed lines)</h4>
              <div className="max-h-40 overflow-auto border border-slate-200 rounded-lg">
                {computeSimpleDiff(jdPreview.original, jdPreview.enhanced).length === 0 ? (
                  <p className="text-xs text-muted p-3">No textual differences detected.</p>
                ) : (
                  computeSimpleDiff(jdPreview.original, jdPreview.enhanced).map((row) => (
                    <div key={`${row.line}-${row.type}`} className="px-3 py-2 border-b border-slate-100 text-xs">
                      <div className="font-semibold text-slate-700">Line {row.line} ({row.type})</div>
                      <div className="text-rose-700">- {row.prev || "(empty)"}</div>
                      <div className="text-emerald-700">+ {row.next || "(empty)"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setJdPreview(null)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onApplyEnhancedJd}
                className="px-3 py-2 rounded-lg bg-primary text-white text-xs"
              >
                Apply Enhanced JD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCareers;
