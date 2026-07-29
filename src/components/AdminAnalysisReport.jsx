import { useMemo, useState } from "react";

export default function AdminAnalysisReport({ analysis, loading }) {
  const report = useMemo(() => normalizeAnalysis(analysis), [analysis]);
  const [reportTab, setReportTab] = useState("score-breakout");

  if (loading) return <SkeletonReport />;
  if (!report || !report.hasData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-muted">
        No analysis data available. Run a resume analysis to see results.
      </div>
    );
  }

  const tabs = [
    { key: "score-breakout", label: "Score Breakout" },
    { key: "strengths-gaps", label: "Strengths & Gaps" },
    { key: "exec-summary", label: "Executive Summary" },
  ];

  return (
    <div className="space-y-3">
      <ScoreCard report={report} />
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              reportTab === tab.key
                ? "border-secondary bg-blue-50 text-secondary"
                : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
            }`}
            onClick={() => setReportTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {reportTab === "score-breakout" && <ScoreBreakoutTab report={report} />}
      {reportTab === "strengths-gaps" && <StrengthsGapsTab report={report} />}
      {reportTab === "exec-summary" && <ExecutiveSummaryTab report={report} />}
    </div>
  );
}

/* Score Breakout Tab */
function ScoreBreakoutTab({ report }) {
  const breakdown = report.scoreBreakdown;
  const hasDimensions = breakdown?.skills_fit != null || breakdown?.experience_fit != null || breakdown?.education_fit != null;

  return (
    <div className="space-y-3">
      <ScoreBreakdownCard report={report} />
      {hasDimensions && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-semibold text-slate-700">Weighted Dimension Scores</h3>
          {breakdown.skills_fit != null && (
            <DimensionBar label="Skills Fit" score={breakdown.skills_fit} max={breakdown.skills_max ?? 40} color="bg-indigo-500" />
          )}
          {breakdown.experience_fit != null && (
            <DimensionBar label="Experience / Seniority" score={breakdown.experience_fit} max={breakdown.experience_max ?? 30} color="bg-cyan-500" />
          )}
          {breakdown.education_fit != null && (
            <DimensionBar label="Education / Certifications" score={breakdown.education_fit} max={breakdown.education_max ?? 30} color="bg-violet-500" />
          )}
        </div>
      )}
      {report.skillsMatrix?.length > 0 && <SkillsMatrixCard skills={report.skillsMatrix} />}
    </div>
  );
}

function DimensionBar({ label, score, max, color }) {
  const pct = max > 0 ? Math.round((Number(score) / Number(max)) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{score}/{max}</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* Strengths & Gaps Tab */
function StrengthsGapsTab({ report }) {
  const hasText = report.strengthsSummary || report.gapsSummary;
  const hasMatched = report.matchedSkills?.length > 0;
  const hasMissing = report.missingSkills?.length > 0;
  if (!hasText && !hasMatched && !hasMissing) {
    return <p className="text-xs text-muted">No strengths or gaps data available.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">&#10003;</span>
          <h3 className="text-xs font-semibold text-emerald-800">Strengths</h3>
        </div>
        {report.strengthsSummary && <p className="text-xs text-emerald-700 leading-relaxed">{report.strengthsSummary}</p>}
        {report.matchedSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {report.matchedSkills.slice(0, 16).map((s) => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-200 text-[10px] text-emerald-800 font-medium">{s}</span>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white text-[10px] font-bold">&#10005;</span>
          <h3 className="text-xs font-semibold text-rose-800">Gaps / Missing</h3>
        </div>
        {report.gapsSummary && <p className="text-xs text-rose-700 leading-relaxed">{report.gapsSummary}</p>}
        {report.missingSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {report.missingSkills.slice(0, 16).map((s) => (
              <span key={s} className="px-1.5 py-0.5 rounded bg-rose-200 text-[10px] text-rose-800 font-medium">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Executive Summary Tab */
function ExecutiveSummaryTab({ report }) {
  const es = deriveExecutiveSummary(report);
  const dimColors = {
    indigo: "bg-indigo-500",
    cyan: "bg-cyan-500",
    violet: "bg-violet-500",
  };
  // Score-driven so badge color is consistent across both analysis engines
  // (careers_agentic uses shortlist/review/hold; the 3-layer pipeline uses
  // Strong Proceed / Proceed with Caveats / Manual Review / Reject).
  const recoBadge =
    es.score != null && es.score >= 75
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : es.score != null && es.score < 50
        ? "bg-rose-100 text-rose-800 border-rose-300"
        : "bg-amber-100 text-amber-800 border-amber-300";
  const bandBadge =
    es.fitBand === "high"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : es.fitBand === "low"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  const visibleDims = es.dimensions?.filter((d) => d.score != null) || [];

  return (
    <div className="space-y-3">
      {/* Verdict headline + narrative */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-sm">&#128203;</span>
          <h3 className="text-xs font-semibold text-indigo-800">Executive Summary</h3>
          {es.recommendation && (
            <span className={`ml-auto px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${recoBadge}`}>
              {es.recommendation}
            </span>
          )}
        </div>
        {es.headline && (
          <p className="text-sm font-semibold text-indigo-800 leading-relaxed mb-2">{es.headline}</p>
        )}
        {es.narrative && (
          <p className="text-xs text-indigo-700 leading-relaxed mb-2">{es.narrative}</p>
        )}
        {report.rationale && (
          <div>
            <span className="text-[10px] font-semibold text-indigo-600">Rationale: </span>
            <span className="text-xs text-indigo-700 leading-relaxed">{report.rationale}</span>
          </div>
        )}
        {(report.llmProvider || report.llmFallback) && (
          <div className="mt-2 pt-2 border-t border-indigo-200 text-[10px] text-indigo-500">
            {report.llmProvider && <span>Provider: {report.llmProvider}</span>}
            {report.llmFallback && <span className="ml-2">({report.llmFallback})</span>}
          </div>
        )}
      </div>

      {/* Dimension snapshot — mirrors the Score Breakout weighted bars */}
      {visibleDims.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-semibold text-slate-700">Weighted Dimension Snapshot</h3>
          {visibleDims.map((d) => (
            <DimensionBar
              key={d.label}
              label={d.label}
              score={d.score}
              max={d.max}
              color={dimColors[d.color] || "bg-slate-500"}
            />
          ))}
        </div>
      )}

      {/* Highlights & risks chips */}
      {(es.highlights?.length > 0 || es.risks?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">&#10003;</span>
              <h3 className="text-xs font-semibold text-emerald-800">Highlights</h3>
            </div>
            {es.highlights?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {es.highlights.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-200 text-[10px] text-emerald-800 font-medium">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-700">No standout matched skills.</p>
            )}
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white text-[10px] font-bold">&#10005;</span>
              <h3 className="text-xs font-semibold text-rose-800">Risks / Gaps</h3>
            </div>
            {es.risks?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {es.risks.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-rose-200 text-[10px] text-rose-800 font-medium">{s}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-rose-700">No critical gaps identified.</p>
            )}
          </div>
        </div>
      )}

      {/* Confidence band + experience / education */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Confidence</h3>
          <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-medium ${bandBadge}`}>
            {es.fitBand === "high" ? "High confidence" : es.fitBand === "low" ? "Low confidence" : "Medium confidence"}
          </span>
          {es.score != null && (
            <p className="text-xs text-slate-600 mt-2">Overall score: <span className="font-semibold">{es.score}/100</span></p>
          )}
        </div>
        {report.experienceAnalysis && <ExperienceCard exp={report.experienceAnalysis} />}
        {report.educationAnalysis && <EducationCard edu={report.educationAnalysis} />}
      </div>
    </div>
  );
}

/* Exported sub-components (used by parent pages directly) */
export { ScoreCard, ScoreBreakdownCard, SkillsMatrixCard, ExperienceCard, EducationCard, StrengthsGapsCard, SummaryCard };

/* ── Normalization ── */
function normalizeAnalysis(raw) {
  if (!raw) return null;
  const isNew = raw.layer3 || raw.layer1;
  if (isNew) {
    const l3 = raw.layer3 || {};
    const l1 = raw.layer1 || {};
    const scoreBreakdown = {
      skills_fit: l3.score_breakdown?.skills_fit ?? l3.score_breakdown?.skills ?? null,
      skills_max: l3.score_breakdown?.skills_max ?? 40,
      experience_fit: l3.score_breakdown?.experience_fit ?? l3.score_breakdown?.experience ?? null,
      experience_max: l3.score_breakdown?.experience_max ?? 30,
      education_fit: l3.score_breakdown?.education_fit ?? l3.score_breakdown?.education ?? null,
      education_max: l3.score_breakdown?.education_max ?? 30,
    };
    const report = {
      hasData: true,
      score: raw.final_score ?? l3.match_score,
      recommendation: raw.final_recommendation || l3.recommendation,
      fitBand: raw.fit_band || l3.fit_band || "medium",
      summary: l3.summary || "",
      rationale: l3.recommendation_rationale || "",
      strengthsSummary: l3.strengths_summary || "",
      gapsSummary: l3.gaps_summary || "",
      skillsMatrix: l3.skills_matrix || [],
      experienceAnalysis: l3.experience_analysis || null,
      educationAnalysis: l3.education_analysis || null,
      scoreBreakdown,
      executiveSummary: l3.executive_summary || l3.structured_report?.executive_summary || null,
      llmProvider: l3.llm_provider || null,
      llmFallback: l3.llm_fallback_reason || null,
      matchedSkills: l1.matched_required?.map((s) => s.skill) || [],
      missingSkills: l1.missing_required || [],
    };
    report.executiveSummary = deriveExecutiveSummary(report);
    return report;
  }
  const sr = raw.structured_report || {};
  const scoreBreakdown = {
    skills_fit: sr.score_breakdown?.skills_fit ?? sr.score_breakdown?.skills ?? null,
    skills_max: sr.score_breakdown?.skills_max ?? 40,
    experience_fit: sr.score_breakdown?.experience_fit ?? sr.score_breakdown?.experience ?? null,
    experience_max: sr.score_breakdown?.experience_max ?? 30,
    education_fit: sr.score_breakdown?.education_fit ?? sr.score_breakdown?.education ?? null,
    education_max: sr.score_breakdown?.education_max ?? 30,
    keyword_score: sr.score_breakdown?.keyword_score ?? null,
    keyword_max: sr.score_breakdown?.keyword_max ?? 100,
    semantic_score: sr.score_breakdown?.semantic_score ?? null,
    semantic_max: sr.score_breakdown?.semantic_max ?? 100,
    overall_score: sr.score_breakdown?.overall_score ?? raw.match_score ?? null,
    overall_max: sr.score_breakdown?.overall_max ?? 100,
  };
  const report = {
    hasData: raw.match_score != null || raw.recommendation || sr.summary,
    score: raw.match_score,
    recommendation: raw.recommendation,
    fitBand: sr.fit_band || "medium",
    summary: sr.summary || raw.ai_summary || "",
    rationale: sr.recommendation_rationale || "",
    strengthsSummary: raw.strengths_summary || "",
    gapsSummary: raw.gaps_summary || "",
    skillsMatrix: raw.skills_matrix || [],
    experienceAnalysis: raw.experience_analysis || null,
    educationAnalysis: raw.education_analysis || null,
    scoreBreakdown,
    executiveSummary: sr.executive_summary || null,
    llmProvider: raw.ai_provider,
    llmFallback: raw.ai_fallback_reason,
    matchedSkills: Array.isArray(raw.matched_skills) ? raw.matched_skills : [],
    missingSkills: Array.isArray(raw.missing_skills) ? raw.missing_skills : [],
  };
  report.executiveSummary = deriveExecutiveSummary(report);
  return report;
}

/* ── deriveExecutiveSummary: build a structured summary object,
   falling back to existing fields when the backend payload omits one,
   so the Executive Summary tab always renders structured output. ── */
function deriveExecutiveSummary(report) {
  const es = report.executiveSummary;
  const bd = report.scoreBreakdown || {};
  const score = report.score != null ? Math.round(Number(report.score)) : null;
  const reco = String(report.recommendation || "").toLowerCase();
  const fit = String(report.fitBand || "medium").toLowerCase();
  const recoLabel =
    reco === "shortlist" ? "Shortlist"
      : reco === "review" ? "Review"
        : reco === "hold" ? "Hold"
          : (report.recommendation || "-");
  const bandLabel = fit.charAt(0).toUpperCase() + fit.slice(1);
  const headline = `${recoLabel} · ${bandLabel} fit${score != null ? ` · ${score}/100` : ""}`;
  const fallbackDims = [
    { label: "Skills Fit", score: bd.skills_fit, max: bd.skills_max ?? 40, color: "indigo" },
    { label: "Experience", score: bd.experience_fit, max: bd.experience_max ?? 30, color: "cyan" },
    { label: "Education", score: bd.education_fit, max: bd.education_max ?? 30, color: "violet" },
  ];
  if (es && typeof es === "object") {
    const dims =
      Array.isArray(es.dimensions) && es.dimensions.length
        ? es.dimensions.map((d, i) => ({
            label: d.label,
            score: d.score,
            max: d.max,
            color: d.color || fallbackDims[i]?.color || "slate",
          }))
        : fallbackDims;
    return {
      headline: es.headline || headline,
      narrative: es.narrative || report.summary || "",
      recommendation: es.recommendation || report.recommendation || "",
      fitBand: es.fit_band || es.fitBand || report.fitBand || "medium",
      score: es.score != null ? es.score : score,
      dimensions: dims,
      highlights: Array.isArray(es.highlights) ? es.highlights : (report.matchedSkills || []).slice(0, 3),
      risks: Array.isArray(es.risks) ? es.risks : (report.missingSkills || []).slice(0, 3),
      confidence: es.confidence || report.fitBand || "medium",
    };
  }
  return {
    headline,
    narrative: report.summary || "",
    recommendation: report.recommendation || "",
    fitBand: report.fitBand || "medium",
    score,
    dimensions: fallbackDims,
    highlights: (report.matchedSkills || []).slice(0, 3),
    risks: (report.missingSkills || []).slice(0, 3),
    confidence: report.fitBand || "medium",
  };
}
function ScoreCard({ report }) {
  const pct = report.score != null ? Math.round(Number(report.score)) : null;
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
  const badgeColor = pct >= 75
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : pct >= 50
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-rose-100 text-rose-800 border-rose-300";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke={pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#f43f5e"} strokeWidth="3"
              strokeDasharray={`${pct ? (pct / 100) * 100 : 0} 100`}
              strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">{pct != null ? pct : "--"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-sm font-semibold text-slate-800">Overall Match Score</h2>
            {pct != null && <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${badgeColor}`}>
              {pct >= 75 ? "Strong Match" : pct >= 50 ? "Moderate" : "Low Fit"}
            </span>}
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>
      </div>
      {report.recommendation && (
        <p className="text-xs text-slate-600 mt-2 border-t border-slate-100 pt-2">
          <span className="font-medium">AI Recommendation: </span>{report.recommendation}
        </p>
      )}
    </div>
  );
}

/* ── ScoreBreakdownCard ── */
function ScoreBreakdownCard({ report }) {
  const breakdown = report.scoreBreakdown;
  if (!breakdown) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-700 mb-3">Score Breakdown</h3>
      {breakdown.keyword_score != null && breakdown.keyword_max != null && (
        <BreakdownRow label="Keyword Overlap" score={breakdown.keyword_score} max={breakdown.keyword_max} />
      )}
      {breakdown.semantic_score != null && breakdown.semantic_max != null && (
        <BreakdownRow label="Semantic Match" score={breakdown.semantic_score} max={breakdown.semantic_max} />
      )}
      {breakdown.overall_score != null && breakdown.overall_max != null && (
        <BreakdownRow label="Overall (Composite)" score={breakdown.overall_score} max={breakdown.overall_max} />
      )}
    </div>
  );
}

function BreakdownRow({ label, score, max }) {
  const pct = max > 0 ? Math.round((Number(score) / Number(max)) * 100) : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-0.5">
        <span>{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-slate-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── SkillsMatrixCard ── */
function SkillsMatrixCard({ skills }) {
  if (!skills?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-700 mb-2">Skills Matrix ({skills.length})</h3>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {skills.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${String(s.match || s.status || "partial").toLowerCase() === "matched" || String(s.match || s.status || "").toLowerCase() === "present" ? "bg-emerald-500" : String(s.match || s.status || "partial").toLowerCase() === "partial" ? "bg-amber-500" : "bg-rose-500"}`} />
              <span className="text-slate-800 truncate">{s.skill || s.name || `Skill ${i + 1}`}</span>
            </div>
            <span className="text-muted shrink-0 ml-2">{s.category || s.duration || s.status || ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ExperienceCard ── */
function ExperienceCard({ exp }) {
  if (!exp) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-700 mb-2">Experience Analysis</h3>
      <p className="text-xs text-slate-600 leading-relaxed">{exp.summary || exp.analysis || JSON.stringify(exp)}</p>
    </div>
  );
}

/* ── EducationCard ── */
function EducationCard({ edu }) {
  if (!edu) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-700 mb-2">Education Analysis</h3>
      <p className="text-xs text-slate-600 leading-relaxed">{edu.summary || edu.analysis || JSON.stringify(edu)}</p>
    </div>
  );
}

/* ── StrengthsGapsCard (kept for backward compat with direct imports) ── */
function StrengthsGapsCard({ report }) {
  return <StrengthsGapsTab report={report} />;
}

/* ── SummaryCard (kept for backward compat) ── */
function SummaryCard({ report }) {
  return <ExecutiveSummaryTab report={report} />;
}

/* ── Skeleton ── */
function SkeletonReport() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-200" />
          <div className="flex-1 h-3 bg-slate-200 rounded-full" />
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
        <div className="space-y-2">{[1, 2, 3].map((i) => (
          <div key={i}><div className="h-3 w-20 bg-slate-200 rounded mb-0.5" /><div className="h-2 w-full bg-slate-200 rounded" /></div>
        ))}</div>
      </div>
    </div>
  );
}
