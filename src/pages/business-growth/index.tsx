import { Link } from "react-router-dom";
import { BarChart3, CheckCircle2, CircleDot, Compass, Flag, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getBusinessGrowthKpis } from "../../services/businessGrowthApi";
import { BUSINESS_GROWTH_STEPS, readGrowthJourneyState } from "../../components/business_growth/shared/businessGrowthTypes";

function formatStepStatus(stepPath: string, state: ReturnType<typeof readGrowthJourneyState>) {
	if (stepPath.includes("intake")) return state.assessmentSessionId ? "done" : "pending";
	if (stepPath.includes("audit")) return state.auditRunId ? "done" : "pending";
	if (stepPath.includes("diagnosis")) return state.diagnosisId ? "done" : "pending";
	if (stepPath.includes("roadmap")) return state.roadmapCompleted ? "done" : state.diagnosisId ? "in_progress" : "pending";
	if (stepPath.includes("review")) return state.reviewApproved ? "done" : state.diagnosisId ? "in_progress" : "pending";
	return "active";
}

export default function BusinessGrowthOverviewPage() {
	const [kpis, setKpis] = useState<Record<string, unknown>[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let mounted = true;
		getBusinessGrowthKpis()
			.then((rows) => {
				if (mounted) {
					setKpis(rows);
					setError("");
				}
			})
			.catch(() => {
				if (mounted) {
					setError("Live KPI feed is not available yet. Displaying workflow status only.");
				}
			})
			.finally(() => {
				if (mounted) {
					setLoading(false);
				}
			});

		return () => {
			mounted = false;
		};
	}, []);

	const state = useMemo(() => readGrowthJourneyState(), []);

	const flowCards = [
		{
			label: "Assessment Session",
			value: state.assessmentSessionId || "Not started",
			icon: Compass,
		},
		{
			label: "Audit Run",
			value: state.auditRunId || "Not started",
			icon: Flag,
		},
		{
			label: "Diagnosis",
			value: state.diagnosisId || "Not generated",
			icon: Rocket,
		},
	];

	const completedSteps = [
		Boolean(state.assessmentSessionId),
		Boolean(state.auditRunId),
		Boolean(state.diagnosisId),
		Boolean(state.roadmapCompleted),
		Boolean(state.reviewApproved),
	].filter(Boolean).length;

	const statCards = [
		{ label: "KPI Records", value: String(kpis.length), helper: "Loaded from /kpi" },
		{ label: "Completed Steps", value: String(completedSteps), helper: "Across intake to review" },
		{ label: "Current Stage", value: state.reviewApproved ? "Completed" : state.roadmapCompleted ? "Review" : state.diagnosisId ? "Roadmap" : state.auditRunId ? "Diagnosis" : state.assessmentSessionId ? "Audit" : "Intake", helper: "Auto-derived from current state" },
	];

	return (
		<div className="space-y-6 sm:space-y-8">
			<section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center shrink-0">
						<BarChart3 className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl sm:text-2xl font-bold text-primary">Growth Execution Planner Dashboard</h2>
						<p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-secondary mt-1">From Audit to Execution Plan</p>
						<p className="text-text mt-2 max-w-3xl">
							A single command center for your growth lifecycle: intake, audit, diagnosis,
							roadmap, and consultant review.
						</p>
					</div>
				</div>

				<div className="grid md:grid-cols-3 gap-4 mt-6">
					{statCards.map((card) => (
						<div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-sm text-slate-500">{card.label}</p>
							<p className="text-2xl font-bold text-primary mt-1">{card.value}</p>
							<p className="text-xs text-slate-500 mt-1">{card.helper}</p>
						</div>
					))}
				</div>

				{error && (
					<p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
						{error}
					</p>
				)}
			</section>

			<section className="grid lg:grid-cols-3 gap-4">
				{flowCards.map((item) => (
					<div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
						<div className="flex items-center justify-between">
							<p className="text-sm text-slate-500">{item.label}</p>
							<item.icon className="w-4 h-4 text-secondary" />
						</div>
						<p className="text-sm sm:text-base font-semibold text-primary mt-3 break-all">{item.value}</p>
					</div>
				))}
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
				<div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
					<h3 className="font-semibold text-primary">Workflow Progress</h3>
					<Link to="/business-growth/intake" className="text-sm font-semibold text-secondary hover:underline">
						Continue flow
					</Link>
				</div>
				<div className="divide-y divide-slate-100">
					{BUSINESS_GROWTH_STEPS.map((step) => {
						const status = formatStepStatus(step.path, state);
						return (
							<div key={step.path} className="px-5 py-4 flex items-start justify-between gap-3">
								<div>
									<p className="font-medium text-primary">{step.label}</p>
									<p className="text-sm text-slate-500">{step.shortDescription}</p>
								</div>
								<div className="flex items-center gap-2">
									{status === "done" ? (
										<CheckCircle2 className="w-5 h-5 text-emerald-600" />
									) : (
										<CircleDot className="w-5 h-5 text-slate-400" />
									)}
									<span className="text-xs uppercase tracking-wide text-slate-500">{status}</span>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			{!loading && kpis.length > 0 && (
				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
					<h3 className="font-semibold text-primary">Latest KPI Snapshot</h3>
					<pre className="mt-3 text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto">
						{JSON.stringify(kpis[0], null, 2)}
					</pre>
				</section>
			)}
		</div>
	);
}
