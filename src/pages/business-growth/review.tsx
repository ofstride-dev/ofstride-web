import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, UserCheck, XCircle } from "lucide-react";
import {
	approveBusinessGrowthReview,
	getBusinessGrowthReportPreview,
	getBusinessGrowthReviewHistory,
	startBusinessGrowthReview,
} from "../../services/businessGrowthApi";
import { mergeGrowthJourneyState, readGrowthJourneyState } from "../../components/business_growth/shared/businessGrowthTypes";
import type { ConsultantReviewRecord } from "../../types/businessGrowth";

export default function BusinessGrowthReviewPage() {
	const initialState = useMemo(() => readGrowthJourneyState(), []);
	const [diagnosisId, setDiagnosisId] = useState(initialState.diagnosisId || "");
	const [reviewerId, setReviewerId] = useState("consultant@ofstride");
	const [changesNote, setChangesNote] = useState("Validated diagnosis and roadmap priorities.");
	const [loading, setLoading] = useState(false);
	const [reportLoading, setReportLoading] = useState(false);
	const [error, setError] = useState("");
	const [successReviewId, setSuccessReviewId] = useState("");
	const [history, setHistory] = useState<ConsultantReviewRecord[]>([]);
	const [reportHtml, setReportHtml] = useState("");

	const submitReview = async (approved: boolean) => {
		setLoading(true);
		setError("");
		setSuccessReviewId("");
		try {
			await startBusinessGrowthReview();
			const response = await approveBusinessGrowthReview({
				growth_diagnosis_id: diagnosisId,
				approved,
				reviewer_id: reviewerId,
				changes_made: {
					note: changesNote,
					reviewed_at: new Date().toISOString(),
				},
			});
			setSuccessReviewId(response.review_id);
			await loadHistory(diagnosisId);
			mergeGrowthJourneyState({ diagnosisId, reviewApproved: approved });
		} catch (reviewError) {
			setError(reviewError instanceof Error ? reviewError.message : "Unable to save consultant review.");
		} finally {
			setLoading(false);
		}
	};

	const loadHistory = async (targetDiagnosisId: string) => {
		if (!targetDiagnosisId) {
			setHistory([]);
			return;
		}
		const rows = await getBusinessGrowthReviewHistory(targetDiagnosisId);
		setHistory(rows);
	};

	const loadPreview = async () => {
		if (!diagnosisId) return;
		setReportLoading(true);
		setError("");
		try {
			const response = await getBusinessGrowthReportPreview(diagnosisId);
			setReportHtml(response.html);
		} catch (previewError) {
			setError(previewError instanceof Error ? previewError.message : "Unable to load report preview.");
		} finally {
			setReportLoading(false);
		}
	};

	const printPreview = () => {
		if (!reportHtml) return;
		const opened = window.open("", "_blank", "noopener,noreferrer");
		if (!opened) return;
		opened.document.write(reportHtml);
		opened.document.close();
		opened.focus();
		opened.print();
	};

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
				<div className="flex items-center gap-3 mb-5">
					<div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center">
						<UserCheck className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-primary">Consultant Review</h2>
						<p className="text-sm text-slate-500">Finalize diagnosis and roadmap quality before client handoff.</p>
					</div>
				</div>

				<div className="space-y-4">
					<label className="text-sm font-medium text-primary block">
						Diagnosis ID
						<input
							value={diagnosisId}
							onChange={(event) => setDiagnosisId(event.target.value)}
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
					<label className="text-sm font-medium text-primary block">
						Reviewer ID
						<input
							value={reviewerId}
							onChange={(event) => setReviewerId(event.target.value)}
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
					<label className="text-sm font-medium text-primary block">
						Review Notes
						<textarea
							value={changesNote}
							onChange={(event) => setChangesNote(event.target.value)}
							rows={4}
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
				</div>

				<div className="mt-5 flex flex-col sm:flex-row gap-3">
					<button
						type="button"
						disabled={loading || !diagnosisId}
						onClick={() => loadHistory(diagnosisId)}
						className="inline-flex items-center justify-center gap-2 border border-slate-300 text-primary px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-70"
					>
						Load review history
					</button>
					<button
						type="button"
						disabled={reportLoading || !diagnosisId}
						onClick={loadPreview}
						className="inline-flex items-center justify-center gap-2 border border-slate-300 text-primary px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-70"
					>
						{reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
						Preview report
					</button>
					<button
						type="button"
						disabled={loading || !diagnosisId}
						onClick={() => submitReview(true)}
						className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-70"
					>
						{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
						Approve
					</button>
					<button
						type="button"
						disabled={loading || !diagnosisId}
						onClick={() => submitReview(false)}
						className="inline-flex items-center justify-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-rose-700 disabled:opacity-70"
					>
						<XCircle className="w-4 h-4" />
						Send Back
					</button>
				</div>

				{error && <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
				{successReviewId && (
					<p className="mt-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
						Review saved successfully. Review ID: {successReviewId}
					</p>
				)}

				{history.length > 0 && (
					<div className="mt-5 rounded-xl border border-slate-200 overflow-hidden">
						<div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
							<h3 className="font-semibold text-primary">Consultant Review History</h3>
						</div>
						<div className="divide-y divide-slate-100">
							{history.map((row) => (
								<div key={row.id} className="px-4 py-3 text-sm">
									<div className="flex items-center justify-between gap-3">
										<p className="font-medium text-primary">{row.reviewer_id || "Consultant"}</p>
										<span className={`px-2 py-1 rounded-full text-xs ${row.approved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
											{row.approved ? "Approved" : "Sent back"}
										</span>
									</div>
									<p className="text-xs text-slate-500 mt-1">{row.created_at || ""}</p>
									<pre className="mt-2 text-xs bg-slate-900 text-slate-100 rounded-lg p-2 overflow-x-auto">
										{JSON.stringify(row.changes_made || {}, null, 2)}
									</pre>
								</div>
							))}
						</div>
					</div>
				)}

				{reportHtml && (
					<div className="mt-5 rounded-xl border border-slate-200 overflow-hidden">
						<div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
							<h3 className="font-semibold text-primary">Report Preview</h3>
							<button
								type="button"
								onClick={printPreview}
								className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
							>
								Print / Save PDF
							</button>
						</div>
						<div className="p-3 bg-white">
							<iframe
								title="Business Growth Report Preview"
								srcDoc={reportHtml}
								className="w-full h-[560px] border border-slate-200 rounded-lg"
							/>
						</div>
					</div>
				)}
			</section>
		</div>
	);
}
