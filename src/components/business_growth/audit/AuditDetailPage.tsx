import type { AuditIssue } from "../../../types/businessGrowth";

interface AuditDetailPageProps {
	issue?: AuditIssue | null;
}

export default function AuditDetailPage({ issue }: AuditDetailPageProps) {
	if (!issue) {
		return (
			<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
				Select an issue to see details.
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5">
			<h3 className="text-base font-semibold text-primary mb-3">Issue Details</h3>
			<dl className="space-y-3 text-sm">
				<div>
					<dt className="text-slate-500">Description</dt>
					<dd className="text-primary font-medium">{issue.description || "N/A"}</dd>
				</div>
				<div>
					<dt className="text-slate-500">Category</dt>
					<dd className="text-primary">{issue.category || "N/A"}</dd>
				</div>
				<div>
					<dt className="text-slate-500">Rule</dt>
					<dd className="text-primary">{issue.rule_id || "N/A"}</dd>
				</div>
				<div>
					<dt className="text-slate-500">Evidence</dt>
					<dd className="mt-1">
						<pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto">
							{JSON.stringify(issue.evidence || {}, null, 2)}
						</pre>
					</dd>
				</div>
			</dl>
		</div>
	);
}
