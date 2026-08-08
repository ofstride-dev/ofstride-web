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
import AdminAnalysisReport from "../components/AdminAnalysisReport";
import ResumeBuilder from "../components/resume-builder/ResumeBuilder.jsx";
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthStateChange,
  getAccessToken,
} from "../services/supabase";
import { BriefcaseBusiness, ClipboardCheck, FileSearch, LogOut, Sparkles, UserRound, UserSearch } from "lucide-react";

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

/* ── Enhanced Queue UI Helpers ────────────────────────────────── */
function getStatusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "shortlisted") return { label: "Shortlisted", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" };
  if (s === "rejected") return { label: "Rejected", bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" };
  if (s === "under_review") return { label: "Under Review", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" };
  if (s === "submitted") return { label: "New", bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" };
  return { label: status || "Pending", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };
}

function getParsingFlag(detail) {
  const parseError = String(detail?.resume_parse_error || "").toLowerCase();
  if (parseError === "corrupt" || parseError === "empty" || parseError === "unreadable") {
    return { flag: true, label: "Parsing Error / Incomplete Data", color: "text-amber-600", bg: "bg-amber-50", icon: "\u26A0\uFE0F" };
  }
  if (!detail?.analysis_status || String(detail.analysis_status).toLowerCase() !== "completed") {
    return { flag: false, label: "", color: "", bg: "", icon: "" };
  }
  const score = detail.match_score != null ? Number(detail.match_score) : null;
  if (score != null && score < 30) {
    return { flag: true, label: "Low Data Confidence", color: "text-amber-500", bg: "bg-amber-50", icon: "\u26A0\uFE0F" };
  }
  return { flag: false, label: "", color: "", bg: "", icon: "" };
}

function getScorePill(detail) {
  const score = detail?.match_score != null ? Math.round(Number(detail.match_score)) : null;
  if (score == null) return null;
  const color = score >= 75 ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : score >= 50 ? "bg-amber-100 text-amber-800 border-amber-300"
    : "bg-rose-100 text-rose-800 border-rose-300";
  return { score, color };
}

function getUnreadIndicator(detail) {
  if (!detail?.reviewed_by_human_at && detail?.analysis_status === "completed") {
    return { unread: true };
  }
  return { unread: false };
}

function getTimelineEvents(detail) {
  const events = [];
  if (detail?.created_at) {
    events.push({ event_type: "applied", event_label: "Application Submitted", timestamp: detail.created_at, actor: "Candidate" });
  }
  if (detail?.analysis_status === "completed" && detail?.parsing_completed_at) {
    events.push({ event_type: "ai_score", event_label: "AI Score Generated", timestamp: detail.parsing_completed_at, actor: "AI System" });
  }
  if (detail?.reviewed_by_human_at) {
    events.push({ event_type: "reviewed", event_label: "Reviewed by Human", timestamp: detail.reviewed_by_human_at, actor: "Admin" });
  }
  if (Array.isArray(detail?.timeline_events)) {
    detail.timeline_events.forEach((ev) => events.push(ev));
  }
  return events.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
}

function getEnhancedSuggestedAction(detail) {
  const status = String(detail?.submission_status || "").toLowerCase();
  const analysisStatus = String(detail?.analysis_status || "").toLowerCase();
  const recommendation = String(detail?.recommendation || "").toLowerCase();
  const mailSent = Boolean(detail?.applicant_email_sent_at);
  const parseError = String(detail?.resume_parse_error || "").toLowerCase();
  const score = detail?.match_score != null ? Number(detail.match_score) : null;

  if (parseError === "corrupt" || parseError === "empty" || parseError === "unreadable") {
    return { key: "request-updated-resume", title: "Request Updated Resume", description: "The uploaded resume appears corrupt or unreadable. Request a new upload from the candidate.", variant: "amber" };
  }
  if (analysisStatus !== "completed") {
    return { key: "run-analysis", title: "Run AI Analysis", description: "Start AI evaluation to generate score, recommendation, and next-step guidance.", variant: "primary" };
  }
  if (status === "shortlisted" && !mailSent) {
    return { key: "send-confirmation", title: "Send Interview Invite", description: "Notify the candidate with further discussion details and interview scheduling.", variant: "primary" };
  }
  if (status === "shortlisted" && mailSent) {
    return { key: "none", title: "Interview Invite Sent", description: "Candidate has been notified. Awaiting response.", variant: "muted" };
  }
  if (status === "rejected") {
    return { key: "none", title: "Candidate Rejected", description: "Final decision recorded. No further action required.", variant: "muted" };
  }
  if (score != null && score >= 75 && (recommendation === "shortlist" || !recommendation)) {
    return { key: "shortlist", title: "Shortlist & Schedule", description: "Strong match detected. Move to shortlisted status and send interview invite.", variant: "primary" };
  }
  if (score != null && score < 50 && (recommendation === "hold" || !recommendation)) {
    return { key: "reject", title: "Move to Reject", description: "Low fit score. Consider rejecting or flagging for HR audit.", variant: "rose" };
  }
  if (recommendation === "shortlist") {
    return { key: "shortlist", title: "Shortlist candidate", description: "Analysis indicates strong fit. Move candidate to shortlisted status.", variant: "primary" };
  }
  if (recommendation === "hold") {
    return { key: "under-review", title: "Keep under review", description: "Analysis indicates low fit. Keep candidate under review before final decision.", variant: "amber" };
  }
  return { key: "under-review", title: "Manual Review Required", description: "Candidate needs manual review before final decision.", variant: "amber" };
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
        key: "under-review",
        title: "Keep under review",
        description: "Analysis indicates low fit. Keep candidate under review before final decision.",
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
  const [notifyState, setNotifyState] = useState("idle"); // idle | success | error
  const [enhancingJd, setEnhancingJd] = useState(false);
  const [enhanceMessage, setEnhanceMessage] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [jdPreview, setJdPreview] = useState(null);
  const [showJobEditor, setShowJobEditor] = useState(false);
  const [workspaceView, setWorkspaceView] = useState("triage"); // triage | jobs | builder
  const [detailTab, setDetailTab] = useState("profile"); // profile | review | audit
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTargetStatus, setOverrideTargetStatus] = useState("");
  const [overrideReasons] = useState([
    { key: "resume_parse_error", label: "Resume parsing error" },
    { key: "referred_by_employee", label: "Referred by employee" },
    { key: "equivalent_experience", label: "Equivalent industry experience" },
    { key: "other", label: "Other reason" },
  ]);
  const [overrideReason, setOverrideReason] = useState("");
  const [statusActionLoading, setStatusActionLoading] = useState(false);

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

  useEffect(() => {
    setNotifyMessage("");
    setNotifyState("idle");
  }, [selectedId]);

  // ── Actions ───────────────────────────────────────────────────────────

  const onRunAnalysis = async () => {
    if (!selectedId) return;
    setAnalysisMessage("");
    setDetailLoading(true);
    try {
      const result = await adminRunApplicationAnalysis(selectedId, { auto_apply: false });
      const scoreLabel = result.match_score == null ? "-" : String(result.match_score);
      const recommendationLabel = String(result.recommendation || "-");
      setAnalysisMessage(`Analysis completed. Score: ${scoreLabel}. Recommendation: ${recommendationLabel}.`);
      setDetailTab("review");
      await loadDetail(selectedId);
      setDetail((prev) => ({ ...(prev || {}), ...result }));
      await loadList();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setAnalysisMessage(e.message);
      } else {
        setAnalysisMessage("Failed to run analysis.");
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const onSetStatus = async (status, overrideReasonParam) => {
    if (!selectedId) return;
    setStatusActionLoading(true);
    try {
      await adminUpdateApplicationStatus(selectedId, status);
      await loadDetail(selectedId);
      await loadList();
    } finally {
      setStatusActionLoading(false);
    }
  };

  const onSetStatusWithOverride = async (status) => {
    const suggested = getEnhancedSuggestedAction(detail);
    const currentRec = String(detail?.recommendation || "").toLowerCase();
    const isOverride = (status === "shortlisted" && currentRec === "hold") ||
      (status === "rejected" && (currentRec === "shortlist" || (detail?.match_score ?? 0) >= 75));
    if (isOverride) {
      setOverrideTargetStatus(status);
      setOverrideReason("");
      setShowOverrideModal(true);
      return;
    }
    await onSetStatus(status);
  };

  const onConfirmOverride = async () => {
    const reason = overrideReason;
    setShowOverrideModal(false);
    setOverrideTargetStatus("");
    setOverrideReason("");
    await onSetStatus(overrideTargetStatus);
    setDetail((prev) => ({
      ...(prev || {}),
      override_reason: reason || "other",
      reviewed_by_human_at: new Date().toISOString(),
    }));
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
      setEnhanceMessage("AI draft generated. Review and accept or reject.");
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
        ? `JD accepted from AI assistant (${jdPreview.llmProvider || "configured provider"}).`
        : `JD accepted from template draft (${jdPreview.templateId || "fallback"}).`
    );
    setJdPreview(null);
  };

  const onSendFurtherDiscussionMail = async () => {
    if (!selectedId) return;
    setNotifyMessage("");
    setNotifyState("idle");
    try {
      const res = await adminSendFurtherDiscussionMail(selectedId);
      if (res.sent) {
        setNotifyMessage("Follow-up discussion mail sent to applicant.");
        setNotifyState("success");
      } else {
        setNotifyMessage(`Mail not sent: ${res.error || "unknown error"}`);
        setNotifyState("error");
      }
      await loadDetail(selectedId);
    } catch (e) {
      if (e instanceof ApiClientError) {
        setNotifyMessage(e.message);
        setNotifyState("error");
      } else {
        setNotifyMessage("Could not send follow-up mail.");
        setNotifyState("error");
      }
    }
  };

  const onRunSuggestedAction = async () => {
    if (!detail) return;
    const suggested = getEnhancedSuggestedAction(detail);
    if (suggested.key === "run-analysis") {
      await onRunAnalysis();
      return;
    }
    if (suggested.key === "send-confirmation") {
      await onSendFurtherDiscussionMail();
      return;
    }
    if (suggested.key === "shortlist") {
      await onSetStatusWithOverride("shortlisted");
      return;
    }
    if (suggested.key === "reject") {
      await onSetStatusWithOverride("rejected");
      return;
    }
    if (suggested.key === "under-review") {
      await onSetStatus("under_review");
    }
  };

  const suggestedAction = detail ? getEnhancedSuggestedAction(detail) : null;

  const selectedJob = jobs.find((job) => String(job.id || "") === selectedJobId) || null;

  // ── Render: Auth Screen ───────────────────────────────────────────────

  if (auth.loading) {
    return (
      <div className="pt-12 sm:pt-16 min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted">Loading authentication...</p>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="pt-12 sm:pt-16 min-h-screen bg-surface">
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
    <div className="pt-12 sm:pt-16 min-h-screen bg-surface overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-6 sm:pb-8 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm px-5 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-secondary flex items-center justify-center shrink-0">
                <BriefcaseBusiness className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-secondary mb-1">Careers Admin</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">Admin Careers Workspace</h1>
                <p className="text-sm text-text mt-1">Three-step flow: create JD, receive applications, review with AI recommendation.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs text-muted inline-flex items-center gap-1.5">
                <UserRound className="w-3.5 h-3.5 text-secondary" />
                {auth.user?.email} ({auth.role})
              </span>
              <a
                href="/careers/jobs"
                className="btn-ui btn-ui-sm btn-ui-info"
              >
                View Public Jobs
              </a>
              <button
                onClick={handleSignOut}
                className="btn-ui btn-ui-sm btn-ui-neutral"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="sticky top-[68px] sm:top-[84px] z-20 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-2 flex flex-wrap items-center gap-2 shadow-sm">
          <button
            type="button"
            className={`btn-ui btn-ui-sm min-w-[118px] h-9 ${workspaceView === "triage" ? "border-secondary bg-blue-50 text-secondary" : "btn-ui-neutral"}`}
            onClick={() => setWorkspaceView("triage")}
          >
            <FileSearch className="w-3.5 h-3.5" />
            Resume Review
          </button>
          <button
            type="button"
            className={`btn-ui btn-ui-sm min-w-[118px] h-9 ${workspaceView === "jobs" ? "border-secondary bg-blue-50 text-secondary" : "btn-ui-neutral"}`}
            onClick={() => setWorkspaceView("jobs")}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            JD Studio
          </button>
          <button
            type="button"
            className={`btn-ui btn-ui-sm min-w-[118px] h-9 ${workspaceView === "builder" ? "border-secondary bg-blue-50 text-secondary" : "btn-ui-neutral"}`}
            onClick={() => setWorkspaceView("builder")}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Resume Builder
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid md:grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="font-semibold text-primary inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-secondary">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                </span>
                JD Creation
              </div>
              <div className="text-muted mt-1">Admin/Employer creates JD. AI can draft or enhance for acceptance/rejection.</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="font-semibold text-primary inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <UserSearch className="w-3.5 h-3.5" />
                </span>
                Candidate Application
              </div>
              <div className="text-muted mt-1">Jobseeker views published JD and applies with resume.</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="font-semibold text-primary inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                  <FileSearch className="w-3.5 h-3.5" />
                </span>
                Resume Review
              </div>
              <div className="text-muted mt-1">Reviewer agent generates recommendation, then employer takes final decision.</div>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">{error}</div>}

        {workspaceView === "builder" ? (
          <ResumeBuilder />
        ) : workspaceView === "triage" ? (
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
                <button className="btn-ui btn-ui-neutral" onClick={() => loadList(selectedJobId || undefined)}>
                  Refresh Queue
                </button>
              </div>
            </div>

            <div className="grid xl:grid-cols-[340px_1fr] gap-6">
              <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-primary">Resume Queue</h2>
                  <span className="text-xs text-muted">{items.length} items</span>
                </div>
                {loading ? (
                  <p className="text-sm text-muted">Loading...</p>
                ) : (
                  <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                    {items.map((item) => {
                      const badge = getStatusBadge(item.submission_status);
                      const parsingFlag = getParsingFlag(item);
                      const scorePill = getScorePill(item);
                      const unread = getUnreadIndicator(item);
                      return (
                        <button
                          key={String(item.id)}
                          className={`w-full text-left border rounded-lg px-3 py-2.5 transition-colors ${selectedId === String(item.id) ? "border-secondary bg-blue-50 ring-1 ring-secondary" : "border-slate-200 hover:border-secondary hover:bg-slate-50"}`}
                          onClick={() => setSelectedId(String(item.id))}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-primary truncate text-sm">{String(item.full_name || "Unnamed")}</div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {parsingFlag.flag && <span className="text-xs" title={parsingFlag.label}>{parsingFlag.icon}</span>}
                              {scorePill && (
                                <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${scorePill.color}`}>
                                  {scorePill.score}/100
                                </span>
                              )}
                              {unread.unread && <span className="w-2 h-2 rounded-full bg-blue-500" title="New / Unreviewed" />}
                            </div>
                          </div>
                          <div className="text-xs text-muted mt-0.5 truncate">{String(item.job_title || item.job_id || "")}</div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border font-medium ${badge.bg} ${badge.text} ${badge.border}`}>
                              {badge.label}
                            </span>
                            <span className="text-[10px] text-muted">
                              {String(item.created_at ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "")}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {items.length === 0 && <p className="text-sm text-muted">No applications found.</p>}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                <h2 className="font-semibold text-primary mb-3">Reviewer Workspace</h2>
                {detailLoading ? (
                  <p className="text-sm text-muted">Loading detail...</p>
                ) : !detail ? (
                  <p className="text-sm text-muted">Select a candidate resume to start review.</p>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const sa = suggestedAction || getEnhancedSuggestedAction(detail);
                      const variantStyles = {
                        primary: "border-indigo-200 bg-indigo-50",
                        amber: "border-amber-200 bg-amber-50",
                        rose: "border-rose-200 bg-rose-50",
                        muted: "border-slate-200 bg-slate-50",
                      };
                      const btnStyles = {
                        primary: "bg-indigo-700 hover:opacity-95",
                        amber: "bg-amber-600 hover:opacity-95",
                        rose: "bg-rose-600 hover:opacity-95",
                        muted: "bg-slate-400 cursor-not-allowed",
                      };
                      const textStyles = {
                        primary: "text-indigo-900",
                        amber: "text-amber-900",
                        rose: "text-rose-900",
                        muted: "text-slate-600",
                      };
                      const descStyles = {
                        primary: "text-indigo-800",
                        amber: "text-amber-800",
                        rose: "text-rose-800",
                        muted: "text-slate-500",
                      };
                      const v = sa.variant || "primary";
                      return (
                        <div className={`rounded-lg border p-3 ${variantStyles[v] || variantStyles.primary}`}>
                          <div className={`text-xs font-semibold ${textStyles[v] || textStyles.primary}`}>Suggested Next Action</div>
                          <div className={`text-sm font-semibold mt-1 ${textStyles[v] || textStyles.primary}`}>{sa.title}</div>
                          <div className={`text-xs mt-1 ${descStyles[v] || descStyles.primary}`}>{sa.description}</div>
                          {(sa.key !== "none" || notifyMessage) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {sa.key !== "none" && (
                                <button
                                  onClick={onRunSuggestedAction}
                                  disabled={detailLoading || statusActionLoading}
                                  className={`btn-ui btn-ui-sm text-white transition-opacity disabled:opacity-50 ${btnStyles[v] || btnStyles.primary}`}
                                >
                                  {sa.key === "run-analysis" && detailLoading ? "Analyzing..." : statusActionLoading ? "Updating..." : "Proceed"}
                                </button>
                              )}
                              {notifyMessage && (
                                <span className={`px-2 py-1 rounded text-[11px] border ${
                                  notifyState === "success"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                  {notifyState === "success" ? "Mail sent" : notifyMessage}
                                </span>
                              )}
                            </div>
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${detailTab === "profile" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                        onClick={() => setDetailTab("profile")}
                      >
                        Candidate Profile
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${detailTab === "review" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                        onClick={() => setDetailTab("review")}
                      >
                        AI Recommendation
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${detailTab === "audit" ? "border-secondary bg-blue-50 text-secondary" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                        onClick={() => setDetailTab("audit")}
                      >
                        Audit Trail
                      </button>
                    </div>

                    {detailTab === "profile" && (
                      <div className="space-y-3 text-sm">
                        {(() => {
                          const pf = getParsingFlag(detail);
                          return pf.flag ? (
                            <div className={`rounded-lg border border-amber-300 ${pf.bg} p-3 flex items-start gap-2`}>
                              <span className="text-sm shrink-0">{pf.icon}</span>
                              <div>
                                <div className="text-xs font-semibold text-amber-800">Data Quality Warning</div>
                                <div className="text-xs text-amber-700 mt-0.5">{pf.label}</div>
                              </div>
                            </div>
                          ) : null;
                        })()}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Job:</strong> {String(detail.job_title || detail.job_id || "-")}</div>
                          <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Phone:</strong> {String(detail.phone || "-")}</div>
                          <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Email:</strong> {String(detail.email || "-")}</div>
                          <div className="rounded border border-slate-200 px-2 py-1.5"><strong>Experience:</strong> {String(detail.years_experience ?? "-")} yrs</div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {detail.strengths_summary && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                              <div className="text-xs font-semibold text-emerald-800 mb-1">Strengths</div>
                              <p className="text-xs text-emerald-700 leading-relaxed">{String(detail.strengths_summary)}</p>
                            </div>
                          )}
                          {detail.gaps_summary && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                              <div className="text-xs font-semibold text-rose-800 mb-1">Gaps / Dealbreakers</div>
                              <p className="text-xs text-rose-700 leading-relaxed">{String(detail.gaps_summary)}</p>
                            </div>
                          )}
                        </div>
                        {detail.structured_report?.summary && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700">Structured Summary</div>
                            <div className="text-sm text-slate-800 mt-1 break-words">{String(detail.structured_report.summary || "-")}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              Fit: {String(detail.structured_report?.fit_band || "-")} | Exp: {String(detail.structured_report?.score_breakdown?.experience_years ?? "-")} yrs | Matched: {String(detail.structured_report?.score_breakdown?.matched_skills_count ?? "-")} | Missing: {String(detail.structured_report?.score_breakdown?.missing_skills_count ?? "-")}
                            </div>
                          </div>
                        )}
                        {detail.cover_note && (
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="text-xs font-semibold text-slate-700 mb-1">Cover Note</div>
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{String(detail.cover_note)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {detailTab === "review" && (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <div className="text-xs font-semibold text-blue-900">AI Candidate Review</div>
                          <div className="text-xs text-blue-800 mt-1">
                            Generate AI analysis based on JD fit, keyword overlap, semantic similarity, and structured reasoning.
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button onClick={onRunAnalysis} className="btn-ui btn-ui-primary">
                              {detailLoading ? "Analyzing..." : "Generate Recommendation"}
                            </button>
                          </div>
                        </div>

                        <AdminAnalysisReport analysis={detail} loading={detailLoading} />

                        {detail.analysis_status === "completed" && (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => onSetStatusWithOverride("under_review")} disabled={statusActionLoading} className="btn-ui btn-ui-warning">Mark Under Review</button>
                              <button onClick={() => onSetStatusWithOverride("shortlisted")} disabled={statusActionLoading} className="btn-ui btn-ui-success">Shortlist</button>
                              <button onClick={() => onSetStatusWithOverride("rejected")} disabled={statusActionLoading} className="btn-ui btn-ui-danger">Reject</button>
                            </div>
                            <button
                              onClick={onSendFurtherDiscussionMail}
                              className="btn-ui btn-ui-info"
                            >
                              Send confirmation mail
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {detailTab === "audit" && (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <h3 className="text-xs font-semibold text-slate-700 mb-3">Candidate Timeline</h3>
                          {(() => {
                            const events = getTimelineEvents(detail);
                            if (events.length === 0) {
                              return <p className="text-xs text-muted">No timeline events recorded yet.</p>;
                            }
                            return (
                              <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                                {events.map((ev, idx) => {
                                  const isLast = idx === events.length - 1;
                                  const dotColor = ev.event_type === "applied" ? "bg-blue-500"
                                    : ev.event_type === "ai_score" ? "bg-indigo-500"
                                    : ev.event_type === "reviewed" ? "bg-emerald-500"
                                    : "bg-slate-400";
                                  return (
                                    <li key={idx} className="ml-3">
                                      <span className={`absolute -left-[7px] w-3 h-3 rounded-full border-2 border-white ${dotColor}`} />
                                      <div className="text-xs font-medium text-slate-800">{ev.event_label}</div>
                                      <div className="text-[10px] text-muted">
                                        {ev.timestamp ? new Date(ev.timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                                        {ev.actor ? ` • ${ev.actor}` : ""}
                                      </div>
                                      {ev.event_type === "reviewed" && detail?.override_reason && (
                                        <div className="text-[10px] text-amber-600 mt-0.5">
                                          Override reason: {String(detail.override_reason_label || detail.override_reason || "")}
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            );
                          })()}
                        </div>

                        {detail?.resume_signed_url && (
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <h3 className="text-xs font-semibold text-slate-700 mb-2">Resume Document</h3>
                            <a
                              href={String(detail.resume_signed_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-secondary hover:underline"
                            >
                              <span>{String(detail.resume_original_name || "View resume")}</span>
                              <span className="text-[10px] text-muted">({String(detail.resume_content_type || "file")})</span>
                            </a>
                          </div>
                        )}

                        {detail?.override_reason && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <h3 className="text-xs font-semibold text-amber-800 mb-1">Override Recorded</h3>
                            <p className="text-xs text-amber-700">
                              <span className="font-medium">Reason: </span>
                              {String(detail.override_reason_label || detail.override_reason || "-")}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {analysisMessage && <div className="text-xs text-muted">{analysisMessage}</div>}
                    {notifyMessage && notifyState !== "success" && <div className="text-xs text-muted">{notifyMessage}</div>}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="grid xl:grid-cols-[320px_1fr] gap-6">
            <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-primary">Job Description Studio</h2>
                <button className="btn-ui btn-ui-sm btn-ui-neutral" onClick={loadJobs}>Refresh</button>
              </div>

              <button
                type="button"
                className="w-full mb-3 btn-ui btn-ui-sm btn-ui-primary"
                onClick={() => {
                  setJobForm({ id: "", title: "", department: "", location: "", employment_type: "", status: "draft", jd_markdown: "" });
                  setShowJobEditor(true);
                }}
              >
                + Create New JD
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
                  <p className="text-xs text-muted">Use AI assist to draft/enhance JD, then accept or reject before publishing.</p>
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
                    className="px-4 py-2 rounded-lg border border-indigo-300 text-indigo-700 text-sm font-semibold bg-indigo-50"
                    title="AI assist can draft or enhance JD"
                  >
                    <span className="mr-2 inline-flex items-center rounded border border-indigo-300 px-1.5 py-0.5 text-xs">AI</span>
                    {enhancingJd ? "Drafting..." : "AI Draft Assist"}
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
                  {uploadingJd ? "Uploading JD..." : "Upload JD & Publish"}
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
                <h3 className="text-sm font-semibold text-primary">JD AI Draft Review</h3>
                <p className="text-xs text-muted">
                  {jdPreview.usedLlm
                    ? `Generated by AI assistant (${jdPreview.llmProvider || "configured provider"}).`
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
                <h4 className="text-xs font-semibold text-slate-700 mb-2">AI Drafted JD</h4>
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
                Reject Draft
              </button>
              <button
                type="button"
                onClick={onApplyEnhancedJd}
                className="px-3 py-2 rounded-lg bg-primary text-white text-xs"
              >
                Accept Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
            <h3 className="text-sm font-semibold text-primary mb-1">Override AI Recommendation</h3>
            <p className="text-xs text-muted mb-3">
              You are changing this candidate's status against the AI recommendation. Please select a reason for audit purposes.
            </p>
            <div className="space-y-1.5 mb-4">
              {overrideReasons.map((r) => (
                <label
                  key={r.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${overrideReason === r.key ? "border-secondary bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <input
                    type="radio"
                    name="overrideReason"
                    value={r.key}
                    checked={overrideReason === r.key}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="accent-secondary"
                  />
                  <span className="text-slate-800">{r.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowOverrideModal(false); setOverrideReason(""); setOverrideTargetStatus(""); }}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmOverride}
                disabled={!overrideReason || statusActionLoading}
                className="px-3 py-2 rounded-lg bg-primary text-white text-xs disabled:opacity-50"
              >
                {statusActionLoading ? "Updating..." : "Confirm Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCareers;

