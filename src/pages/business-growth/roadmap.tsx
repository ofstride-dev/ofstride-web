import { useMemo, useState } from "react";
import { Loader2, Milestone, RefreshCcw } from "lucide-react";
import {
	generateBusinessGrowthGuidance,
	generateBusinessGrowthRoadmap,
	getBusinessGrowthRoadmap,
	updateBusinessGrowthRoadmapItem,
} from "../../services/businessGrowthApi";
import { PHASE_LABELS, mergeGrowthJourneyState, readGrowthJourneyState } from "../../components/business_growth/shared/businessGrowthTypes";
import type { GrowthRoadmapStatus, RoadmapGuidanceItem, RoadmapItem } from "../../types/businessGrowth";

const statusOptions: GrowthRoadmapStatus[] = ["draft", "in_progress", "done", "blocked"];

export default function BusinessGrowthRoadmapPage() {
	const initialState = useMemo(() => readGrowthJourneyState(), []);
	const [auditRunId, setAuditRunId] = useState(initialState.auditRunId || "");
	const [diagnosisId, setDiagnosisId] = useState(initialState.diagnosisId || "");
	const [items, setItems] = useState<RoadmapItem[]>([]);
	const [savingItemId, setSavingItemId] = useState<string | null>(null);
	const [guidanceItem, setGuidanceItem] = useState<RoadmapGuidanceItem | null>(null);
	const [guidanceNarrative, setGuidanceNarrative] = useState("");
	const [guidanceLoading, setGuidanceLoading] = useState(false);
	const [cms, setCms] = useState("generic");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const refreshItems = async (targetDiagnosisId: string) => {
		const rows = await getBusinessGrowthRoadmap(targetDiagnosisId);
		const sorted = [...rows].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
		setItems(sorted);
		mergeGrowthJourneyState({
			diagnosisId: targetDiagnosisId,
			roadmapCompleted: sorted.length > 0 && sorted.every((item) => item.status === "done"),
		});
	};

	const onGenerate = async () => {
		setError("");
		setLoading(true);
		try {
			const generated = await generateBusinessGrowthRoadmap(auditRunId);
			setDiagnosisId(generated.growth_diagnosis_id);
			mergeGrowthJourneyState({ diagnosisId: generated.growth_diagnosis_id, roadmapCompleted: false });
			await refreshItems(generated.growth_diagnosis_id);
		} catch (generateError) {
			setError(generateError instanceof Error ? generateError.message : "Could not generate roadmap.");
		} finally {
			setLoading(false);
		}
	};

	const onRefresh = async () => {
		if (!diagnosisId) return;
		setError("");
		setLoading(true);
		try {
			await refreshItems(diagnosisId);
		} catch (refreshError) {
			setError(refreshError instanceof Error ? refreshError.message : "Could not load roadmap.");
		} finally {
			setLoading(false);
		}
	};

	const onChangeStatus = async (item: RoadmapItem, status: GrowthRoadmapStatus) => {
		setSavingItemId(item.id);
		try {
			await updateBusinessGrowthRoadmapItem({
				item_id: item.id,
				updates: { status },
			});
			setItems((prev) => {
				const next = prev.map((existing) => (existing.id === item.id ? { ...existing, status } : existing));
				mergeGrowthJourneyState({
					diagnosisId,
					roadmapCompleted: next.length > 0 && next.every((entry) => entry.status === "done"),
				});
				return next;
			});
		} catch (statusError) {
			setError(statusError instanceof Error ? statusError.message : "Unable to update roadmap item.");
		} finally {
			setSavingItemId(null);
		}
	};

	const onSaveScoring = async (item: RoadmapItem, updates: Partial<RoadmapItem>) => {
		setSavingItemId(item.id);
		setError("");
		try {
			await updateBusinessGrowthRoadmapItem({
				item_id: item.id,
				updates: {
					impact: updates.impact,
					effort: updates.effort,
					confidence: updates.confidence,
					domain: updates.domain,
					title: updates.title,
					description: updates.description,
				},
			});
			await onRefresh();
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Unable to save roadmap item.");
		} finally {
			setSavingItemId(null);
		}
	};

	const onGenerateGuidance = async (item: RoadmapItem) => {
		setGuidanceLoading(true);
		setError("");
		try {
			const response = await generateBusinessGrowthGuidance({
				roadmap_item_id: item.id,
				cms,
				include_llm: true,
			});
			setGuidanceItem(response.guidance[0] || null);
			setGuidanceNarrative(response.ai_narrative?.narrative || "");
		} catch (guidanceError) {
			setError(guidanceError instanceof Error ? guidanceError.message : "Unable to generate guidance.");
		} finally {
			setGuidanceLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
				<div className="flex items-center gap-3 mb-5">
					<div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center">
						<Milestone className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-primary">Prioritized Growth Roadmap</h2>
						<p className="text-sm text-slate-500">Move from insight to execution with phase-based action items.</p>
					</div>
				</div>

				<div className="grid lg:grid-cols-3 gap-4">
					<label className="text-sm font-medium text-primary lg:col-span-2">
						Audit Run ID
						<input
							value={auditRunId}
							onChange={(event) => setAuditRunId(event.target.value)}
							className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
						/>
					</label>
					<div className="flex gap-2 items-end">
						<button
							type="button"
							onClick={onGenerate}
							disabled={loading || !auditRunId}
							className="inline-flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-primary-light disabled:opacity-70"
						>
							{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
							Generate
						</button>
						<button
							type="button"
							onClick={onRefresh}
							disabled={loading || !diagnosisId}
							className="inline-flex items-center justify-center gap-2 border border-slate-300 text-primary px-4 py-2.5 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-70"
						>
							<RefreshCcw className="w-4 h-4" /> Refresh
						</button>
					</div>
				</div>

				{diagnosisId && <p className="text-xs text-slate-500 mt-3">Diagnosis ID: {diagnosisId}</p>}
				{error && <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
			</section>

			<section className="space-y-4">
				{items.map((item) => (
					<article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
							<div>
								<p className="text-xs uppercase tracking-wider text-secondary font-semibold">
									{PHASE_LABELS[item.phase] || item.phase}
								</p>
								<input
									value={item.title}
									onChange={(event) =>
										setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, title: event.target.value } : row)))
									}
									className="text-lg font-semibold text-primary mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
								/>
								<textarea
									value={item.description || ""}
									onChange={(event) =>
										setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, description: event.target.value } : row)))
									}
									rows={2}
									className="text-sm text-slate-600 mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
								/>
								<div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
									<span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Priority: {(item.priority_score ?? 0).toFixed(2)}</span>
								</div>

								<div className="mt-3 grid sm:grid-cols-4 gap-2">
									<label className="text-xs text-slate-600">
										Impact
										<input
											type="number"
											min={1}
											max={5}
											value={item.impact ?? 1}
											onChange={(event) =>
												setItems((prev) =>
													prev.map((row) =>
														row.id === item.id ? { ...row, impact: Number(event.target.value) } : row
													)
												)
											}
											className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
										/>
									</label>
									<label className="text-xs text-slate-600">
										Effort
										<input
											type="number"
											min={1}
											max={5}
											value={item.effort ?? 1}
											onChange={(event) =>
												setItems((prev) =>
													prev.map((row) =>
														row.id === item.id ? { ...row, effort: Number(event.target.value) } : row
													)
												)
											}
											className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
										/>
									</label>
									<label className="text-xs text-slate-600">
										Confidence
										<input
											type="number"
											min={1}
											max={5}
											value={item.confidence ?? 1}
											onChange={(event) =>
												setItems((prev) =>
													prev.map((row) =>
														row.id === item.id ? { ...row, confidence: Number(event.target.value) } : row
													)
												)
											}
											className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
										/>
									</label>
									<label className="text-xs text-slate-600">
										Domain
										<select
											value={item.domain || "technical"}
											onChange={(event) =>
												setItems((prev) =>
													prev.map((row) =>
														row.id === item.id ? { ...row, domain: event.target.value } : row
													)
												)
											}
											className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
										>
											<option value="technical">technical</option>
											<option value="content">content</option>
											<option value="local">local</option>
											<option value="conversion">conversion</option>
										</select>
									</label>
								</div>
							</div>

							<div className="text-sm font-medium text-primary min-w-[170px]">
								Status
								<select
									value={item.status}
									onChange={(event) => onChangeStatus(item, event.target.value as GrowthRoadmapStatus)}
									className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								>
									{statusOptions.map((status) => (
										<option key={status} value={status}>{status}</option>
									))}
								</select>
								<div className="mt-3 space-y-2">
									<button
										type="button"
										onClick={() => onSaveScoring(item, item)}
										disabled={savingItemId === item.id}
										className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-70"
									>
										{savingItemId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
										Save edits
									</button>
									<button
										type="button"
										onClick={() => onGenerateGuidance(item)}
										disabled={guidanceLoading}
										className="w-full inline-flex items-center justify-center gap-2 border border-slate-300 text-primary px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-70"
									>
										{guidanceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
										AI how to fix
									</button>
								</div>
							</div>
						</div>
					</article>
				))}

				{!items.length && (
					<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
						No roadmap items yet. Generate roadmap using an existing Audit Run ID.
					</div>
				)}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					<div>
						<h3 className="text-lg font-semibold text-primary">AI-Assisted How to Fix</h3>
						<p className="text-sm text-slate-500">Templated implementation guidance with optional AI narrative.</p>
					</div>
					<label className="text-sm text-slate-600">
						CMS
						<select value={cms} onChange={(event) => setCms(event.target.value)} className="mt-1 ml-2 rounded-lg border border-slate-300 px-3 py-2">
							<option value="generic">generic</option>
							<option value="wordpress">wordpress</option>
							<option value="shopify">shopify</option>
						</select>
					</label>
				</div>

				{guidanceNarrative && (
					<pre className="mt-4 whitespace-pre-wrap text-sm bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto">
						{guidanceNarrative}
					</pre>
				)}

				{guidanceItem ? (
					<div className="mt-4 space-y-4">
						<div>
							<h4 className="font-semibold text-primary">{guidanceItem.title}</h4>
							<ul className="mt-2 space-y-1 text-sm text-slate-700">
								{guidanceItem.steps.map((step) => (
									<li key={step} className="flex items-start gap-2">
										<span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2" />
										{step}
									</li>
								))}
							</ul>
						</div>

						{guidanceItem.snippets.length > 0 && (
							<div>
								<h4 className="font-semibold text-primary">Code Snippets</h4>
								{guidanceItem.snippets.map((snippet) => (
									<div key={snippet.label} className="mt-2">
										<p className="text-sm font-medium text-slate-700">{snippet.label}</p>
										<pre className="mt-1 text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto">
											{snippet.code}
										</pre>
									</div>
								))}
							</div>
						)}

						{guidanceItem.before_after.length > 0 && (
							<div className="grid md:grid-cols-2 gap-3">
								{guidanceItem.before_after.map((row, idx) => (
									<div key={`${row.type}-${idx}`} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
										<p className="text-xs uppercase tracking-wide text-slate-500">{row.type}</p>
										<p className="text-sm text-rose-700 mt-2"><strong>Before:</strong> {row.before}</p>
										<p className="text-sm text-emerald-700 mt-1"><strong>After:</strong> {row.after}</p>
									</div>
								))}
							</div>
						)}
					</div>
				) : (
					<p className="mt-4 text-sm text-slate-500">Pick a roadmap item and click AI how to fix to generate implementation guidance.</p>
				)}
			</section>
		</div>
	);
}
