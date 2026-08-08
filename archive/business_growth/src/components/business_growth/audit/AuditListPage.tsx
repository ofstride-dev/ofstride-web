import type { AuditIssue } from "../../../types/businessGrowth";

const severityClassMap: Record<string, string> = {
	critical: "bg-rose-100 text-rose-700",
	high: "bg-orange-100 text-orange-700",
	medium: "bg-amber-100 text-amber-700",
	low: "bg-emerald-100 text-emerald-700",
};

interface AuditListPageProps {
	issues: AuditIssue[];
	selectedIssueId?: string;
	onSelectIssue: (issue: AuditIssue) => void;
}

export default function AuditListPage({ issues, selectedIssueId, onSelectIssue }: AuditListPageProps) {
	if (!issues.length) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
				No issues found for this run.
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
			<div className="px-5 py-4 border-b border-slate-100">
				<h3 className="text-base font-semibold text-primary">Issue Findings</h3>
			</div>
			<div className="divide-y divide-slate-100">
				{issues.map((issue) => {
					const severityClass = severityClassMap[issue.severity] || "bg-slate-100 text-slate-700";
					const isActive = selectedIssueId === issue.id;
					return (
						<button
							type="button"
							key={issue.id}
							className={`w-full text-left px-5 py-4 transition-colors ${isActive ? "bg-blue-50" : "hover:bg-slate-50"}`}
							onClick={() => onSelectIssue(issue)}
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-semibold text-primary">{issue.description || "Unlabeled issue"}</p>
									<p className="text-xs text-slate-500 mt-1">Rule: {issue.rule_id || "unknown"}</p>
								</div>
								<span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${severityClass}`}>
									{issue.severity}
								</span>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
