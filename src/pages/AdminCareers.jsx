import { useEffect, useState } from "react";
import {
  adminGetApplication,
  adminInitJdUpload,
  adminListJobs,
  adminListApplications,
  adminPublishJobFromUpload,
  adminRunApplicationAnalysis,
  adminCleanupStaleDrafts,
  adminSendFurtherDiscussionMail,
  adminSaveJob,
  adminUpdateApplicationStatus,
  ApiClientError,
} from "../services/api";

function AdminCareers() {
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
    jd_raw_text: "",
  });
  const [savingJob, setSavingJob] = useState(false);
  const [jobMessage, setJobMessage] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [jdFile, setJdFile] = useState(null);
  const [uploadingJd, setUploadingJd] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");

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
      // Keep UX resilient; errors shown in global card when needed.
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
    loadList();
    loadJobs();
  }, []);

  useEffect(() => {
    loadDetail(selectedId);
  }, [selectedId]);

  const onRunAnalysis = async () => {
    if (!selectedId) return;
    await adminRunApplicationAnalysis(selectedId);
    await loadDetail(selectedId);
    await loadList();
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
      jd_raw_text: String(job.jd_raw_text || ""),
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
        jd_raw_text: jobForm.jd_raw_text || jobForm.jd_markdown,
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
      const init = await adminInitJdUpload({
        file_name: jdFile.name,
        content_type: jdFile.type || "text/plain",
        size_bytes: jdFile.size,
      });

      const uploadHeaders = {
        "x-ms-blob-type": init.upload.required_headers["x-ms-blob-type"] || "BlockBlob",
        "Content-Type": init.upload.required_headers["Content-Type"] || jdFile.type || "text/plain",
      };

      const uploadResp = await fetch(init.upload.url, {
        method: init.upload.method || "PUT",
        headers: uploadHeaders,
        body: jdFile,
      });
      if (!uploadResp.ok) {
        throw new Error(`JD upload failed (HTTP ${uploadResp.status})`);
      }

      await adminPublishJobFromUpload({
        id: jobForm.id || undefined,
        title: jobForm.title,
        department: jobForm.department || undefined,
        location: jobForm.location || undefined,
        employment_type: jobForm.employment_type || undefined,
        status: jobForm.status,
        blob_path: init.blob.path,
        blob_container: init.blob.container,
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

  return (
    <div className="pt-16 sm:pt-20 min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Admin Careers Dashboard</h1>
        <p className="text-text mb-3">Manage published job descriptions, review applicants, and run AI-assisted analysis.</p>
        <div className="mb-6 flex flex-wrap gap-2">
          <a href="/.auth/login/aad" className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">Sign in with Microsoft</a>
          <a href="/.auth/logout" className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">Sign out</a>
        </div>

        {error && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">{error}</div>}

        <div className="grid xl:grid-cols-3 gap-6">
          <section className="bg-white rounded-xl shadow-sm p-4 xl:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary">Job Profiles (JD)</h2>
              <button className="text-sm text-secondary" onClick={loadJobs}>Refresh</button>
            </div>

            <div className="space-y-2 max-h-56 overflow-auto mb-4 pr-1">
              {jobs.map((job) => (
                <button
                  key={String(job.id)}
                  className="w-full text-left border rounded-lg px-3 py-2 border-slate-200 hover:border-secondary"
                  onClick={() => onPickJob(job)}
                >
                  <div className="font-medium text-primary">{String(job.title || "Untitled")}</div>
                  <div className="text-xs text-muted">{String(job.status || "draft")}</div>
                </button>
              ))}
              {jobs.length === 0 && <p className="text-sm text-muted">No jobs created yet.</p>}
            </div>

            <form onSubmit={onSaveJob} className="space-y-3">
              <input
                type="text"
                placeholder="Job title"
                value={jobForm.title}
                onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Department"
                  value={jobForm.department}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={jobForm.location}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Employment type"
                  value={jobForm.employment_type}
                  onChange={(e) => setJobForm((prev) => ({ ...prev, employment_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
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
              <textarea
                rows={8}
                placeholder="JD markdown"
                value={jobForm.jd_markdown}
                onChange={(e) => setJobForm((prev) => ({ ...prev, jd_markdown: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
                required
              />
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <label className="block text-xs font-medium text-primary mb-2">Upload JD file to JD storage (.md or .txt)</label>
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
              <button disabled={savingJob} type="submit" className="px-3 py-2 rounded-lg bg-primary text-white text-sm">
                {savingJob ? "Saving..." : "Save Job"}
              </button>
              <button disabled={cleaning} type="button" onClick={onCleanupDrafts} className="ml-2 px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                {cleaning ? "Cleaning..." : "Cleanup stale drafts"}
              </button>
              {jobMessage && <p className="text-xs text-muted">{jobMessage}</p>}
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
