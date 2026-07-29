/**
 * ATS score breakdown card: overall composite + three sub-scores
 * (keyword_match, skills_coverage, section_completeness), missing keywords,
 * injectable keywords, and actionable recommendations.
 */

function scoreColor(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return "text-slate-500";
  if (n >= 75) return "text-emerald-600";
  if (n >= 50) return "text-amber-600";
  return "text-rose-600";
}

function scoreBarColor(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return "bg-slate-300";
  if (n >= 75) return "bg-emerald-500";
  if (n >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function SubScore({ label, value }) {
  const n = Number(value);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className={`font-semibold ${scoreColor(value)}`}>{Number.isNaN(n) ? "-" : `${n.toFixed(1)}`}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${scoreBarColor(value)}`} style={{ width: `${Number.isNaN(n) ? 0 : Math.max(2, n)}%` }} />
      </div>
    </div>
  );
}

export default function AtsScoreCard({ atsScore, aiMeta }) {
  if (!atsScore) return null;
  const overall = Number(atsScore.overall_score);
  const subs = atsScore.sub_scores || {};
  const missing = Array.isArray(atsScore.missing_keywords) ? atsScore.missing_keywords : [];
  const injectable = Array.isArray(atsScore.injectable_keywords) ? atsScore.injectable_keywords : [];
  const recs = Array.isArray(atsScore.recommendations) ? atsScore.recommendations : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">ATS Score</h3>
        <div className={`text-2xl font-bold ${scoreColor(overall)}`}>{Number.isNaN(overall) ? "-" : overall.toFixed(1)}</div>
      </div>

      <div className="space-y-2">
        <SubScore label="Keyword Match" value={subs.keyword_match} />
        <SubScore label="Skills Coverage" value={subs.skills_coverage} />
        <SubScore label="Section Completeness" value={subs.section_completeness} />
      </div>

      {aiMeta ? (
        <div className="text-xs text-muted border-t border-slate-100 pt-2">
          {aiMeta.ai_used ? (
            <span>AI-tailored via <strong>{aiMeta.ai_provider || "LLM"}</strong>{aiMeta.ai_fallback_reason ? ` (fallback: ${aiMeta.ai_fallback_reason})` : ""}</span>
          ) : (
            <span className="text-amber-700">AI tailoring did not run{aiMeta.ai_error ? `: ${aiMeta.ai_error}` : ""}</span>
          )}
        </div>
      ) : null}

      {injectable.length ? (
        <div>
          <div className="text-xs font-medium text-emerald-700 mb-1">Injectable from master resume</div>
          <div className="flex flex-wrap gap-1.5">
            {injectable.map((k, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">{k}</span>
            ))}
          </div>
        </div>
      ) : null}

      {missing.length ? (
        <div>
          <div className="text-xs font-medium text-rose-700 mb-1">Missing keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((k, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs">{k}</span>
            ))}
          </div>
        </div>
      ) : null}

      {recs.length ? (
        <div>
          <div className="text-xs font-medium text-muted mb-1">Recommendations</div>
          <ul className="list-disc list-inside space-y-1 text-xs text-text">
            {recs.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
