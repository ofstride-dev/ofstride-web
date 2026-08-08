import { useEffect, useMemo, useState } from "react";
import { Loader2, SearchCheck } from "lucide-react";
import {
	getBusinessGrowthAuditWorkerHealth,
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
	const [auditRunId, setAuditRunId] = useState("");
	const [pendingAuditRunId, setPendingAuditRunId] = useState(initialState.auditRunId || "");
	const [summary, setSummary] = useState<AuditSummary | null>(null);
	const [pages, setPages] = useState<AuditPage[]>([]);
	const [issues, setIssues] = useState<AuditIssue[]>([]);
	const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
	const [isStarting, setIsStarting] = useState(false);
	const [isPolling, setIsPolling] = useState(false);
	const [error, setError] = useState("");
	const [statusMessage, setStatusMessage] = useState("");
	const [workerHealthWarning, setWorkerHealthWarning] = useState("");

	const normalizeRootUrl = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return "";
		if (/^https?:\/\//i.test(trimmed)) return trimmed;
		return `https://${trimmed}`;
	};

	const clearAuditData = () => {
		setSummary(null);
		setPages([]);
		setIssues([]);
		setSelectedIssue(null);
	};

	const onResumePreviousRun = () => {
		if (!pendingAuditRunId) return;
		setError("");
		setStatusMessage("Resumed previous audit run.");
		setAuditRunId(pendingAuditRunId);
	};

	const onClearPreviousRun = () => {
		setPendingAuditRunId("");
		setAuditRunId("");
		clearAuditData();
		setStatusMessage("Cleared previous run. Start a new audit.");
		mergeGrowthJourneyState({ auditRunId: "" });
	};

	const refreshAuditData = async (targetAuditRunId: string) => {
		const [summaryResult, pagesResult, issuesResult] = await Promise.all([
			getBusinessGrowthAuditSummary(targetAuditRunId),
			getBusinessGrowthAuditPages(targetAuditRunId),
			getBusinessGrowthAuditIssues(targetAuditRunId),
		]);

		setSummary(summaryResult);
		setPages(pagesResult);
		setIssues(issuesResult);
		setSelectedIssue((prev) => {
			if (!issuesResult.length) return null;
			if (!prev) return issuesResult[0];
			const match = issuesResult.find((item) => item.id === prev.id);
			return match || issuesResult[0];
		});
		return summaryResult;
	};

	const isTerminal = (status?: string) =>
		status === "complete" || status === "failed";

	const deriveTechnicalScoreFromIssues = (items: AuditIssue[]): number => {
		const totalPenalty = items.reduce((penalty, issue) => {
			const sev = String(issue.severity || "").toLowerCase();
			if (sev === "critical") return penalty + 20;
			if (sev === "high") return penalty + 12;
			if (sev === "medium") return penalty + 7;
			if (sev === "low") return penalty + 3;
			return penalty + 5;
		}, 0);
		return Math.max(0, 100 - totalPenalty);
	};

	const displayPageCount =
		summary && (summary.page_count == null || summary.page_count <= 0)
			? pages.length
			: (summary?.page_count ?? 0);

	const displayTechnicalScore =
		summary && summary.technical_score == null
			? (issues.length ? deriveTechnicalScoreFromIssues(issues) : "-")
			: (summary?.technical_score ?? "-");

	// Fetch once on mount, then poll while the async worker is still running.
	useEffect(() => {
		if (!auditRunId) return;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let attempts = 0;
		const maxAttempts = 120;
		setIsPolling(true);

		const poll = async () => {
			try {
				const summaryResult = await refreshAuditData(auditRunId);
				if (cancelled) return;

				if (summaryResult?.root_url && !rootUrl) {
					setRootUrl(summaryResult.root_url);
				}

				if (!isTerminal(summaryResult?.status)) {
					attempts += 1;
					setStatusMessage("Audit is running. Refreshing report data...");
					if (attempts >= maxAttempts) {
						setError("Audit is taking longer than expected. You can keep this page open and retry refresh in a moment.");
						setIsPolling(false);
						return;
					}
					timer = setTimeout(poll, 3000);
				} else {
					setIsPolling(false);
					setStatusMessage("");
					if (summaryResult.status === "failed" && summaryResult.error_message) {
						setError(`Audit failed: ${summaryResult.error_message}`);
					}
				}
			} catch (fetchError) {
				if (!cancelled) {
					setIsPolling(false);
					const message = fetchError instanceof Error ? fetchError.message : "Failed to fetch audit data.";
					setError(message);
					if (/not found/i.test(message)) {
						mergeGrowthJourneyState({ auditRunId: "" });
						setAuditRunId("");
						clearAuditData();
						setStatusMessage("Previous audit run was not found. Start a new audit.");
					}
				}
			}
		};

		poll();

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	}, [auditRunId]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const health = await getBusinessGrowthAuditWorkerHealth();
				if (cancelled) return;
				if (!health.ok) {
					const failed = Object.entries(health.checks)
						.filter(([, item]) => !item.ok)
						.map(([key, item]) => `${key}: ${item.message || "failed"}`)
						.join(" | ");
					setWorkerHealthWarning(`Audit worker preflight failed. ${failed}`);
				} else {
					setWorkerHealthWarning("");
				}
			} catch (healthError) {
				if (!cancelled) {
					setWorkerHealthWarning(
						healthError instanceof Error
							? `Audit worker health check unavailable: ${healthError.message}`
							: "Audit worker health check unavailable"
					);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const onStartAudit = async (event: React.FormEvent) => {
		event.preventDefault();
		const normalizedRootUrl = normalizeRootUrl(rootUrl);
		if (!assessmentSessionId.trim() || !normalizedRootUrl) {
			setError("Assessment Session ID and Root URL are required.");
			return;
		}
		setError("");
		setStatusMessage("");
		setIsStarting(true);
		setPendingAuditRunId("");
		clearAuditData();
		try {
			if (workerHealthWarning) {
				setError(workerHealthWarning);
				setIsStarting(false);
				return;
			}
			const started = await startBusinessGrowthAudit({
				assessment_session_id: assessmentSessionId.trim(),
				root_url: normalizedRootUrl,
			});
			setAuditRunId(started.audit_run_id);
			setPendingAuditRunId(started.audit_run_id);
			mergeGrowthJourneyState({ auditRunId: started.audit_run_id, assessmentSessionId: assessmentSessionId.trim() });
			setRootUrl(normalizedRootUrl);
			setStatusMessage("Audit started. Gathering pages and issues...");
		} catch (startError) {
			setError(startError instanceof Error ? startError.message : "Failed to start audit.");
		} finally {
			setIsStarting(false);
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
						disabled={isStarting}
					>
						{isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
						Start Audit
					</button>
				</form>
				{pendingAuditRunId && !auditRunId && (
					<div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
						<p className="text-slate-700">
							A previous audit run was found: <span className="font-mono text-xs">{pendingAuditRunId}</span>
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={onResumePreviousRun}
								className="px-3 py-1.5 rounded-md bg-primary text-white font-medium hover:bg-primary-light"
							>
								Resume Previous Run
							</button>
							<button
								type="button"
								onClick={onClearPreviousRun}
								className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 font-medium bg-white hover:bg-slate-100"
							>
								Clear Previous Run
							</button>
						</div>
					</div>
				)}
				{isPolling && (
					<p className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
						Refreshing audit status and report data...
					</p>
				)}
				{workerHealthWarning && (
					<p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
						{workerHealthWarning}
					</p>
				)}
				{statusMessage && (
					<p className="mt-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
						{statusMessage}
					</p>
				)}
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
						<p className="text-lg font-semibold text-primary mt-1">{displayPageCount}</p>
					</div>
					<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<p className="text-sm text-slate-500">Technical Score</p>
						<p className="text-lg font-semibold text-primary mt-1">{displayTechnicalScore}</p>
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
