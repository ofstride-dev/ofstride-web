import type { GrowthRoadmapPhase } from "../../../types/businessGrowth";

export interface BusinessGrowthStep {
	label: string;
	path: string;
	shortDescription: string;
}

export const BUSINESS_GROWTH_STEPS: BusinessGrowthStep[] = [
	{
		label: "Overview",
		path: "/business-growth",
		shortDescription: "Live KPIs and growth workflow status",
	},
	{
		label: "Intake",
		path: "/business-growth/intake",
		shortDescription: "Collect business profile and goals",
	},
	{
		label: "Audit",
		path: "/business-growth/audit",
		shortDescription: "Run crawl and capture technical issues",
	},
	{
		label: "Diagnosis",
		path: "/business-growth/diagnosis",
		shortDescription: "Generate maturity and blockers",
	},
	{
		label: "Roadmap",
		path: "/business-growth/roadmap",
		shortDescription: "Prioritize quick wins and growth bets",
	},
	{
		label: "Review",
		path: "/business-growth/review",
		shortDescription: "Consultant validation and sign-off",
	},
];

export const PHASE_LABELS: Record<GrowthRoadmapPhase, string> = {
	quick_win: "Quick Win",
	foundation_30d: "Foundation (30 Days)",
	growth_60_90d: "Growth (60-90 Days)",
};

export interface GrowthJourneyState {
	businessProfileId?: string;
	assessmentSessionId?: string;
	auditRunId?: string;
	diagnosisId?: string;
	roadmapCompleted?: boolean;
	reviewApproved?: boolean;
}

const STORAGE_KEY = "ofstride_business_growth_state";

export function readGrowthJourneyState(): GrowthJourneyState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return {};
		}
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") {
			return {};
		}
		return parsed as GrowthJourneyState;
	} catch {
		return {};
	}
}

export function writeGrowthJourneyState(nextState: GrowthJourneyState): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function mergeGrowthJourneyState(patch: GrowthJourneyState): GrowthJourneyState {
	const nextState = { ...readGrowthJourneyState(), ...patch };
	writeGrowthJourneyState(nextState);
	return nextState;
}
