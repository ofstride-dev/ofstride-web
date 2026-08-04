import { useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { generateBusinessGrowthDiagnosis, getBusinessGrowthDiagnosis } from "../../services/businessGrowthApi";
import { mergeGrowthJourneyState, readGrowthJourneyState } from "../../components/business_growth/shared/businessGrowthTypes";
import type { GrowthDiagnosis } from "../../types/businessGrowth";

const stageStyles: Record<string, string> = {
	foundational: "bg-rose-50 text-rose-700 border-rose-200",
	moderate: "bg-amber-50 text-amber-700 border-amber-200",
	growth_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const categoryLabels: Record<string, string> = {
	technical: "Technical",
	content: "Content",
	local: "Local",
	conversion: "Conversion",
};


function scoreClass(score: number): string {
	if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
	if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
	return "text-rose-700 bg-rose-50 border-rose-200";
}

export default function BusinessGrowthDiagnosisPage() {
	const initialState = useMemo(() => readGrowthJourneyState(), []);
	const [auditRunId, setAuditRunId] = useState(initialState.auditRunId || "");
	const [diagnosisId, setDiagnosisId] = useState(initialState.diagnosisId || "");
	const [diagnosis, setDiagnosis] = useState<GrowthDiagnosis | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const fetchDiagnosis = async (targetDiagnosisId: string) => {
		const item = await getBusinessGrowthDiagnosis(targetDiagnosisId);
		setDiagnosis(item);
	};

	useEffect(() => {
		if (!diagnosisId) {
			return;
		}
		setLoading(true);
		setError("");
		fetchDiagnosis(diagnosisId)
			.catch((fetchError) => {
				setError(fetchError instanceof Error ? fetchError.message : "Unable to load diagnosis.");
			})
			.finally(() => setLoading(false));
	}, [diagnosisId]);

	const onGenerate = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoading(true);
		setError("");
		try {
			const generated = await generateBusinessGrowthDiagnosis(auditRunId);
			setDiagnosisId(generated.growth_diagnosis_id);
			mergeGrowthJourneyState({ diagnosisId: generated.growth_diagnosis_id, auditRunId });
		} catch (generateError) {
			setError(generateError instanceof Error ? generateError.message : "Unable to generate diagnosis.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
				<div className="flex items-center gap-3 mb-5">
					<div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center">
						<Gauge className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-primary">Growth Diagnosis</h2>
						<p className="text-sm text-slate-500">Convert raw audit signals into strategic maturity insights.</p>
					</div>
				</div>

				<form onSubmit={onGenerate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
					<label className="text-sm font-medium text-primary flex-1">
						Audit Run ID
						<input
							value={auditRunId}
							onChange={(event) => setAuditRunId(event.target.value)}
							required
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
					<button
						type="submit"
						disabled={loading}
						className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-light disabled:opacity-70"
					>
						{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
						Generate Diagnosis
					</button>
				</form>
				{error && <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
			</section>

			{diagnosis && (
				<section className="space-y-4">
					<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h3 className="text-lg font-semibold text-primary">Maturity Summary</h3>
							<span className={`px-3 py-1 rounded-full border text-sm font-semibold ${stageStyles[diagnosis.maturity_stage] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
								{diagnosis.maturity_stage.replace("_", " ")}
							</span>
						</div>
						<p className="text-sm text-slate-500 mt-2">Diagnosis ID: {diagnosis.id}</p>

						<div className="mt-5">
							<div className="w-full h-4 rounded-full bg-slate-200 overflow-hidden">
								<div
									className={`h-full ${diagnosis.overall_score >= 80 ? "bg-emerald-500" : diagnosis.overall_score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
									style={{ width: `${Math.max(0, Math.min(100, diagnosis.overall_score))}%` }}
								/>
							</div>
							<div className="mt-2 flex items-center justify-between text-xs text-slate-500">
								<span>0</span>
								<span>50</span>
								<span>80</span>
								<span>100</span>
							</div>
						</div>

						<p className="text-4xl font-bold text-primary mt-4">{diagnosis.overall_score}</p>
						<p className="text-sm text-slate-500">Overall growth readiness score</p>

						<div className="mt-4 flex flex-wrap gap-2 text-xs">
							<span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
								Critical: {diagnosis.issue_counts?.critical ?? 0}
							</span>
							<span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
								High: {diagnosis.issue_counts?.high ?? 0}
							</span>
							<span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
								Medium: {diagnosis.issue_counts?.medium ?? 0}
							</span>
							<span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
								Low: {diagnosis.issue_counts?.low ?? 0}
							</span>
						</div>
					</div>

					<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
						{Object.entries(diagnosis.category_scores || {}).map(([key, value]) => (
							<div key={key} className={`rounded-xl border p-4 ${scoreClass(value)}`}>
								<p className="text-xs uppercase tracking-wide">{categoryLabels[key] || key}</p>
								<p className="text-2xl font-bold mt-1">{value}</p>
								<p className="text-xs mt-1">Category score</p>
							</div>
						))}
					</div>

					<div className="grid md:grid-cols-2 gap-4">
						<div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
							<h4 className="font-semibold text-rose-800 flex items-center gap-2">
								<ShieldAlert className="w-4 h-4" />
								Key Blockers
							</h4>
							<ul className="mt-3 space-y-2 text-sm text-rose-900">
								{diagnosis.blockers.length ? diagnosis.blockers.map((item) => (
									<li key={item} className="flex items-start gap-2">
										<span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-2" />
										{item}
									</li>
								)) : <li>No blockers identified.</li>}
							</ul>
						</div>
						<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
							<h4 className="font-semibold text-emerald-800">Growth Opportunities</h4>
							<ul className="mt-3 space-y-2 text-sm text-emerald-900">
								{diagnosis.opportunities.length ? diagnosis.opportunities.map((item) => (
									<li key={item} className="flex items-start gap-2">
										<span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2" />
										{item}
									</li>
								)) : <li>No opportunities identified yet.</li>}
							</ul>
						</div>
					</div>
				</section>
			)}
		</div>
	);
}
