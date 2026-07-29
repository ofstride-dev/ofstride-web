/**
 * Version history list for a master resume. Each entry shows the version
 * number, ATS overall score, AI badge, and timestamp. Clicking loads it.
 */

function scorePill(score) {
  const n = Number(score);
  if (Number.isNaN(n) || n === 0) return null;
  const cls = n >= 75 ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : n >= 50 ? "bg-amber-100 text-amber-800 border-amber-300"
    : "bg-rose-100 text-rose-800 border-rose-300";
  return { n, cls };
}

export default function VersionHistory({ versions, selectedVersionId, onSelect }) {
  if (!Array.isArray(versions) || versions.length === 0) {
    return (
      <p className="text-xs text-muted">No tailored versions yet. Paste a JD and run “Tailor Resume”.</p>
    );
  }
  return (
    <div className="space-y-2">
      {versions.map((v) => {
        const pill = scorePill(v.overall_score);
        const active = selectedVersionId === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            className={`w-full text-left border rounded-lg px-3 py-2 transition-colors ${active ? "border-secondary bg-blue-50 ring-1 ring-secondary" : "border-slate-200 hover:border-secondary hover:bg-slate-50"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-primary">v{v.version_number}</div>
              <div className="flex items-center gap-1.5">
                {v.ai_used ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-100 text-violet-700 border border-violet-200">AI</span>
                ) : null}
                {pill ? (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border ${pill.cls}`}>{pill.n.toFixed(0)}</span>
                ) : null}
              </div>
            </div>
            <div className="text-xs text-muted mt-0.5">
              {v.created_at ? new Date(v.created_at).toLocaleString() : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
