export type GrowthMaturityStage = "foundational" | "moderate" | "growth_ready";

export type GrowthSeverity = "critical" | "high" | "medium" | "low";

export type GrowthRoadmapPhase = "quick_win" | "foundation_30d" | "growth_60_90d";

export type GrowthRoadmapStatus = "draft" | "in_progress" | "done" | "blocked";

export interface GrowthProfileMetadata {
	[key: string]: unknown;
}

export interface GrowthIntakeRequest {
	name: string;
	domain: string;
	industry?: string;
	target_geo?: string;
	growth_goal?: string;
	current_channels?: string[];
	budget_band?: string;
	urgency_band?: string;
	contact_name: string;
	contact_email: string;
	contact_phone?: string;
	metadata?: GrowthProfileMetadata;
}

export interface GrowthIntakeResponse {
	business_profile_id: string;
	assessment_session_id: string;
}

export interface AuditStartRequest {
	assessment_session_id: string;
	root_url: string;
}

export interface AuditStartResponse {
	audit_run_id: string;
	status: string;
}

export interface AuditSummary {
	id: string;
	assessment_session_id: string;
	status: string;
	root_url: string;
	page_count?: number;
	technical_score?: number;
	error_message?: string | null;
	completed_at?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface AuditPage {
	id: string;
	audit_run_id: string;
	url: string;
	status_code?: number;
	title?: string;
	meta_description?: string;
	h1?: string;
	canonical?: string;
	has_viewport_meta?: boolean;
	link_count?: number;
	image_count?: number;
	is_indexable?: boolean;
}

export interface AuditIssue {
	id: string;
	audit_run_id: string;
	audit_page_id?: string;
	category?: string;
	rule_id?: string;
	severity: GrowthSeverity;
	description?: string;
	evidence?: Record<string, unknown>;
}

export interface GrowthDiagnosis {
	id: string;
	audit_run_id: string;
	maturity_stage: GrowthMaturityStage;
	blockers: string[];
	opportunities: string[];
	overall_score: number;
	category_scores?: Record<string, number | null>;
	issue_counts?: Record<string, number>;
	evidence_counts?: Record<string, number>;
	measured_domains?: number;
	total_issues?: number;
	created_at?: string;
}

export interface GrowthDiagnosisGenerateResponse {
	growth_diagnosis_id: string;
}

export interface RoadmapItem {
	id: string;
	growth_diagnosis_id: string;
	phase: GrowthRoadmapPhase;
	title: string;
	description?: string;
	domain?: string;
	impact?: number;
	confidence?: number;
	effort?: number;
	strategic_weight?: number;
	priority_score?: number;
	status: GrowthRoadmapStatus;
}

export interface RoadmapGenerateResponse {
	growth_diagnosis_id: string;
	roadmap_items_created: number;
	message?: string;
}

export interface RoadmapUpdateRequest {
	item_id: string;
	updates: Partial<
		Pick<
			RoadmapItem,
			"status" | "title" | "description" | "impact" | "effort" | "confidence" | "domain" | "phase" | "strategic_weight"
		>
	>;
}

export interface RoadmapUpdateResponse {
	updated: number;
}

export interface ReviewStartResponse {
	status: string;
}

export interface ReviewApproveRequest {
	growth_diagnosis_id: string;
	approved: boolean;
	reviewer_id?: string;
	changes_made?: Record<string, unknown>;
}

export interface ReviewApproveResponse {
	review_id: string;
}

export interface ConsultantReviewRecord {
	id: string;
	growth_diagnosis_id: string;
	reviewer_id?: string;
	approved: boolean;
	changes_made?: Record<string, unknown>;
	created_at?: string;
}

export interface GuidanceSnippet {
	label: string;
	code: string;
}

export interface BeforeAfterExample {
	type: string;
	before: string;
	after: string;
}

export interface RoadmapGuidanceItem {
	roadmap_item_id: string;
	title: string;
	domain: string;
	steps: string[];
	snippets: GuidanceSnippet[];
	before_after: BeforeAfterExample[];
}

export interface GuidanceResponse {
	growth_diagnosis_id: string;
	guidance: RoadmapGuidanceItem[];
	ai_narrative?: {
		provider?: string | null;
		fallback_reason?: string | null;
		narrative: string;
	};
}

export interface ReportPreviewResponse {
	growth_diagnosis_id: string;
	html: string;
	summary: {
		overall_score?: number;
		maturity_stage?: string;
		roadmap_items: number;
		issues_considered: number;
	};
}

export interface KpiRecordResponse {
	status: string;
}

export interface GrowthKpiRecord {
	[key: string]: unknown;
}

export interface ProfileOnlyGuidance {
	mode: "profile_only";
	findings: string[];
	solutions: string[];
	uses_chat_signals: boolean;
}

export interface GrowthJourneyResumeResponse {
	assessment_session: Record<string, unknown>;
	business_profile: Record<string, unknown>;
	audit_run: Record<string, unknown> | null;
	growth_diagnosis: Record<string, unknown> | null;
	roadmap: {
		items_total: number;
		items_done: number;
		items: Array<Record<string, unknown>>;
	};
	review: {
		latest: Record<string, unknown> | null;
		total_reviews: number;
	};
	resume_state: {
		businessProfileId?: string;
		assessmentSessionId?: string;
		auditRunId?: string;
		diagnosisId?: string;
		roadmapCompleted?: boolean;
		reviewApproved?: boolean;
	};
	profile_only_guidance: ProfileOnlyGuidance | null;
}
