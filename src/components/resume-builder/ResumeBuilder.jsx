/**
 * Resume Builder — Phase 1 admin surface.
 *
 * Flow: upload a master resume (PDF/DOCX) → it's parsed into structured
 * ResumeData → paste a JD → "Tailor Resume" produces an AI-tailored version
 * with an ATS sub-score breakdown → versions are saved with history.
 *
 * Talks to the careers/manage resume-builder/* endpoints via services/api.
 */
import { useCallback, useEffect, useState } from "react";
import {
  rbListMasterResumes,
  rbGetMasterResume,
  rbUploadMasterResume,
  rbDeleteMasterResume,
  rbTailorResume,
  rbListVersions,
  ApiClientError,
} from "../../services/api";
import ResumePreview from "./ResumePreview.jsx";
import AtsScoreCard from "./AtsScoreCard.jsx";
import VersionHistory from "./VersionHistory.jsx";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export default function ResumeBuilder() {
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [aiMeta, setAiMeta] = useState(null);
  const [jdText, setJdText] = useState("");

  const [uploading, setUploading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [error, setError] = useState("");

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    setError("");
    try {
      const data = await rbListMasterResumes();
      setDrafts(Array.isArray(data.items) ? data.items : []);
    } catch (exc) {
      setError(exc instanceof ApiClientError ? exc.message : "Failed to load resumes.");
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const selectDraft = useCallback(async (draftId) => {
    if (!draftId) {
      setSelectedDraftId("");
      setSelectedDraft(null);
      setVersions([]);
      setSelectedVersion(null);
      setAiMeta(null);
      return;
    }
    setSelectedDraftId(draftId);
    setSelectedVersion(null);
    setAiMeta(null);
    setError("");
    try {
      const [detail, vers] = await Promise.all([
        rbGetMasterResume(draftId),
        rbListVersions(draftId),
      ]);
      setSelectedDraft(detail?.draft || null);
      setVersions(Array.isArray(vers.items) ? vers.items : []);
    } catch (exc) {
      setError(exc instanceof ApiClientError ? exc.message : "Failed to load resume.");
    }
  }, []);

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const content_base64 = await readFileAsBase64(file);
      const result = await rbUploadMasterResume({ filename: file.name, content_base64 });
      await loadDrafts();
      if (result?.draft?.id) {
        await selectDraft(result.draft.id);
      }
    } catch (exc) {
      setError(exc instanceof ApiClientError ? exc.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [loadDrafts, selectDraft]);

  const handleTailor = useCallback(async () => {
    if (!selectedDraftId || !jdText.trim()) return;
    setTailoring(true);
    setError("");
    try {
      const result = await rbTailorResume({ draft_id: selectedDraftId, jd_text: jdText.trim() });
      setSelectedVersion(result?.version || null);
      setAiMeta({
        ai_used: result?.ai_used,
        ai_provider: result?.ai_provider ?? null,
        ai_fallback_reason: result?.ai_fallback_reason ?? null,
        ai_error: result?.ai_error ?? null,
      });
      const vers = await rbListVersions(selectedDraftId);
      setVersions(Array.isArray(vers.items) ? vers.items : []);
    } catch (exc) {
      setError(exc instanceof ApiClientError ? exc.message : "Tailoring failed.");
    } finally {
      setTailoring(false);
    }
  }, [selectedDraftId, jdText]);

  const handleDelete = useCallback(async (draftId) => {
    if (!draftId) return;
    if (!window.confirm("Delete this master resume and all its tailored versions?")) return;
    setError("");
    try {
      await rbDeleteMasterResume(draftId);
      if (selectedDraftId === draftId) {
        setSelectedDraftId("");
        setSelectedDraft(null);
        setVersions([]);
        setSelectedVersion(null);
        setAiMeta(null);
      }
      await loadDrafts();
    } catch (exc) {
      setError(exc instanceof ApiClientError ? exc.message : "Delete failed.");
    }
  }, [selectedDraftId, loadDrafts]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">{error}</div>
      ) : null}

      <div className="grid xl:grid-cols-[320px_1fr] gap-6">
        <section className="bg-white rounded-xl shadow-sm p-4 border border-slate-100 space-y-3">
          <h2 className="font-semibold text-primary">Master Resumes</h2>
          <label className="block">
            <span className="text-xs font-medium text-muted">Upload resume (PDF/DOCX/TXT)</span>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
              className="mt-1 block w-full text-xs text-muted file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-secondary file:text-white file:cursor-pointer disabled:opacity-60"
            />
          </label>

          {draftsLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : drafts.length === 0 ? (
            <p className="text-xs text-muted">No master resumes yet. Upload one to begin.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {drafts.map((d) => {
                const active = selectedDraftId === String(d.id);
                return (
                  <div key={d.id} className={`border rounded-lg px-3 py-2 transition-colors ${active ? "border-secondary bg-blue-50 ring-1 ring-secondary" : "border-slate-200 hover:border-secondary hover:bg-slate-50"}`}>
                    <button type="button" className="w-full text-left" onClick={() => selectDraft(String(d.id))}>
                      <div className="font-medium text-primary truncate text-sm">{String(d.title || "Untitled")}</div>
                      <div className="text-xs text-muted truncate">{String(d.source_filename || "")}</div>
                      {d.updated_at ? <div className="text-[10px] text-muted mt-0.5">{new Date(d.updated_at).toLocaleString()}</div> : null}
                    </button>
                    <div className="text-right mt-1">
                      <button type="button" className="text-[10px] text-rose-600 hover:underline" onClick={() => handleDelete(String(d.id))}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {selectedDraft ? (
          <>
            <section className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
                <h2 className="font-semibold text-primary mb-2">Tailor to Job Description</h2>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the job description here…"
                  rows={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted">{jdText.length} chars</span>
                  <button
                    type="button"
                    disabled={!jdText.trim() || tailoring}
                    onClick={handleTailor}
                    className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    {tailoring ? "Tailoring…" : "Tailor Resume"}
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_300px] gap-4">
                <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-primary">{selectedVersion ? "Tailored Resume" : "Master Resume"}</h2>
                    {selectedVersion ? <span className="text-xs text-muted">v{selectedVersion.version_number}</span> : null}
                  </div>
                  <ResumePreview resume={selectedVersion ? selectedVersion.tailored_resume : selectedDraft.resume_data} />
                </div>
                <div className="space-y-4">
                  {selectedVersion ? (
                    <>
                      <AtsScoreCard atsScore={selectedVersion.ats_score} aiMeta={aiMeta} />
                      {selectedVersion.strategy_notes ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-xs font-medium text-muted mb-1">Strategy notes</div>
                          <p className="text-xs text-text">{selectedVersion.strategy_notes}</p>
                        </div>
                      ) : null}
                      {Array.isArray(selectedVersion.applied_changes) && selectedVersion.applied_changes.length ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-xs font-medium text-emerald-700 mb-1">Applied changes ({selectedVersion.applied_changes.length})</div>
                          <ul className="space-y-1 text-xs text-text">
                            {selectedVersion.applied_changes.map((c, i) => (
                              <li key={i}><code className="text-[10px] text-muted">{String(c.path || "")}</code> — {String(c.status || "")}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                      <p className="text-xs text-muted">Run “Tailor Resume” to generate a tailored version with an ATS score.</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <h3 className="text-xs font-semibold text-primary mb-2">Version History</h3>
                    <VersionHistory
                      versions={versions}
                      selectedVersionId={selectedVersion?.id}
                      onSelect={(v) => {
                        setSelectedVersion(v);
                        setAiMeta({ ai_used: v.ai_used, ai_provider: v.ai_provider ?? null, ai_fallback_reason: null, ai_error: v.ai_error ?? null });
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="bg-white rounded-xl shadow-sm p-8 border border-slate-100 text-center">
            <p className="text-sm text-muted">Select or upload a master resume to start tailoring.</p>
          </section>
        )}
      </div>
    </div>
  );
}
