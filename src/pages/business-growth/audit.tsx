import { useEffect, useMemo, useState } from "react";
import { Loader2, SearchCheck } from "lucide-react";
import {
	getBusinessGrowthAuditIssues,
	getBusinessGrowthAuditPages,
	getBusinessGrowthAuditSummary,
	startBusinessGrowthAudit,
} from "../../services/businessGrowthApi";
import { mergeGrowthJourneyState, readGrowthJourneyState } from "../../components/business_growth/shared/businessGrowthTypes";
import type { AuditIssue, AuditPage, AuditSummary } from "../../types/businessGrowth";
import AuditListPage from "../../components/business_growth/audit/AuditListPage";
import AuditDetailPage from "../../components/business_growth/audit/AuditDetailPage";

export default function BusinessGrowthAuditPage() {
	const initialState = useMemo(() => readGrowthJourneyState(), []);
	const [assessmentSessionId, setAssessmentSessionId] = useState(initialState.assessmentSessionId || "");
	const [rootUrl, setRootUrl] = useState("");
	const [auditRunId, setAuditRunId] = useState(initialState.auditRunId || "");
	const [summary, setSummary] = useState<AuditSummary | null>(null);
	const [pages, setPages] = useState<AuditPage[]>([]);
	const [issues, setIssues] = useState<AuditIssue[]>([]);
	const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const refreshAuditData = async (targetAuditRunId: string) => {
		const [summaryResult, pagesResult, issuesResult] = await Promise.all([
			getBusinessGrowthAuditSummary(targetAuditRunId),
			getBusinessGrowthAuditPages(targetAuditRunId),
			getBusinessGrowthAuditIssues(targetAuditRunId),
		]);

		setSummary(summaryResult);
		setPages(pagesResult);
		setIssues(issuesResult);
		setSelectedIssue(issuesResult[0] || null);
	};

	useEffect(() => {
		if (!auditRunId) return;
		setLoading(true);
		setError("");
		refreshAuditData(auditRunId)
			.catch((fetchError) => {
				setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch audit data.");
			})
			.finally(() => setLoading(false));
	}, [auditRunId]);

	const onStartAudit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const started = await startBusinessGrowthAudit({
				assessment_session_id: assessmentSessionId,
				root_url: rootUrl,
			});
			setAuditRunId(started.audit_run_id);
			mergeGrowthJourneyState({ auditRunId: started.audit_run_id, assessmentSessionId });
		} catch (startError) {
			setError(startError instanceof Error ? startError.message : "Failed to start audit.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
				<div className="flex items-center gap-3 mb-5">
					<div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center">
						<SearchCheck className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-primary">Website Audit</h2>
						<p className="text-sm text-slate-500">Run a technical and on-page scan for a growth diagnosis baseline.</p>
					</div>
				</div>

				<form onSubmit={onStartAudit} className="grid lg:grid-cols-3 gap-4 items-end">
					<label className="text-sm font-medium text-primary">
						Assessment Session ID
						<input
							value={assessmentSessionId}
							onChange={(event) => setAssessmentSessionId(event.target.value)}
							required
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
					<label className="text-sm font-medium text-primary lg:col-span-2">
						Root URL
						<input
							value={rootUrl}
							onChange={(event) => setRootUrl(event.target.value)}
							required
							placeholder="https://yourdomain.com"
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
					<button
						type="submit"
						className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-light disabled:opacity-70 lg:col-span-3 w-full sm:w-auto"
						disabled={loading}
					>
						{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
						Start Audit
					</button>
				</form>
				{error && <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
			</section>

			{summary && (
				<section className="grid sm:grid-cols-3 gap-4">
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Audit Status</p>
						<p className="text-lg font-semibold text-primary mt-1">{summary.status}</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Pages Scanned</p>
						<p className="text-lg font-semibold text-primary mt-1">{summary.page_count ?? 0}</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Technical Score</p>
						<p className="text-lg font-semibold text-primary mt-1">{summary.technical_score ?? "-"}</p>
					</div>
				</section>
			)}

			{pages.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
					<div className="px-5 py-4 border-b border-slate-100">
						<h3 className="font-semibold text-primary">Crawled Pages</h3>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-sm">
							<thead className="bg-slate-50 text-slate-600">
								<tr>
									<th className="px-4 py-3 text-left font-semibold">URL</th>
									<th className="px-4 py-3 text-left font-semibold">Status</th>
									<th className="px-4 py-3 text-left font-semibold">Title</th>
									<th className="px-4 py-3 text-left font-semibold">H1</th>
								</tr>
							</thead>
							<tbody>
								{pages.map((page) => (
									<tr key={page.id} className="border-t border-slate-100">
										<td className="px-4 py-3 text-secondary truncate max-w-[320px]">{page.url}</td>
										<td className="px-4 py-3">{page.status_code ?? "-"}</td>
										<td className="px-4 py-3">{page.title || "-"}</td>
										<td className="px-4 py-3">{page.h1 || "-"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}

			<section className="grid lg:grid-cols-5 gap-4">
				<div className="lg:col-span-3">
					<AuditListPage issues={issues} selectedIssueId={selectedIssue?.id} onSelectIssue={setSelectedIssue} />
				</div>
				<div className="lg:col-span-2">
					<AuditDetailPage issue={selectedIssue} />
				</div>
			</section>
		</div>
	);
}
