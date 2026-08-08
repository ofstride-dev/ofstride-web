import type {
	AuditIssue,
	AuditPage,
	AuditStartRequest,
	AuditStartResponse,
	AuditSummary,
	ConsultantReviewRecord,
	GuidanceResponse,
	GrowthDiagnosis,
	GrowthDiagnosisGenerateResponse,
	GrowthIntakeRequest,
	GrowthIntakeResponse,
	GrowthJourneyResumeResponse,
	GrowthKpiRecord,
	KpiRecordResponse,
	ReportPreviewResponse,
	ReviewApproveRequest,
	ReviewApproveResponse,
	ReviewStartResponse,
	RoadmapGenerateResponse,
	RoadmapItem,
	RoadmapUpdateRequest,
	RoadmapUpdateResponse,
} from "../types/businessGrowth";

const API_BASE = (import.meta.env.VITE_CAREER_API_URL || "/api").replace(/\/$/, "");
const BG_BASE = `${API_BASE}/business-growth`;

async function parseJsonResponse<T>(response: Response): Promise<T> {
	const rawText = await response.text();

	let body: unknown = null;
	if (rawText) {
		try {
			body = JSON.parse(rawText);
		} catch {
			body = rawText;
		}
	}

	if (!response.ok) {
		const message =
			typeof body === "string"
				? body
				: (body as { message?: string; error?: string } | null)?.message ||
				  (body as { message?: string; error?: string } | null)?.error ||
				  `Request failed (HTTP ${response.status})`;
		throw new Error(message || `Request failed (HTTP ${response.status})`);
	}

	return body as T;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
	const query = new URLSearchParams();
	Object.entries(params).forEach(([key, value]) => {
		if (value) {
			query.set(key, value);
		}
	});
	const qs = query.toString();
	return qs ? `${path}?${qs}` : path;
}

export async function submitBusinessGrowthIntake(
	payload: GrowthIntakeRequest
): Promise<GrowthIntakeResponse> {
	const response = await fetch(`${BG_BASE}/intake`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJsonResponse<GrowthIntakeResponse>(response);
}

export async function startBusinessGrowthAudit(payload: AuditStartRequest): Promise<AuditStartResponse> {
	const response = await fetch(`${BG_BASE}/audit/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJsonResponse<AuditStartResponse>(response);
}

export async function getBusinessGrowthAuditWorkerHealth(): Promise<{
	ok: boolean;
	checks: Record<string, { ok: boolean; message: string | null }>;
}> {
	const response = await fetch(`${BG_BASE}/health/worker`);
	return parseJsonResponse(response);
}

export async function getBusinessGrowthAuditSummary(auditRunId: string): Promise<AuditSummary> {
	const response = await fetch(withQuery(`${BG_BASE}/audit/summary`, { audit_run_id: auditRunId }));
	return parseJsonResponse<AuditSummary>(response);
}

export async function getBusinessGrowthAuditPages(auditRunId: string): Promise<AuditPage[]> {
	const response = await fetch(withQuery(`${BG_BASE}/audit/pages`, { audit_run_id: auditRunId }));
	return parseJsonResponse<AuditPage[]>(response);
}

export async function getBusinessGrowthAuditIssues(auditRunId: string): Promise<AuditIssue[]> {
	const response = await fetch(withQuery(`${BG_BASE}/audit/issues`, { audit_run_id: auditRunId }));
	return parseJsonResponse<AuditIssue[]>(response);
}

export async function generateBusinessGrowthDiagnosis(
	auditRunId: string
): Promise<GrowthDiagnosisGenerateResponse> {
	const response = await fetch(`${BG_BASE}/diagnosis/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ audit_run_id: auditRunId }),
	});
	return parseJsonResponse<GrowthDiagnosisGenerateResponse>(response);
}

export async function getBusinessGrowthDiagnosis(diagnosisId: string): Promise<GrowthDiagnosis> {
	const response = await fetch(
		withQuery(`${BG_BASE}/diagnosis`, { growth_diagnosis_id: diagnosisId })
	);
	return parseJsonResponse<GrowthDiagnosis>(response);
}

export async function generateBusinessGrowthRoadmap(
	auditRunId: string
): Promise<RoadmapGenerateResponse> {
	const response = await fetch(`${BG_BASE}/roadmap/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ audit_run_id: auditRunId }),
	});
	return parseJsonResponse<RoadmapGenerateResponse>(response);
}

export async function getBusinessGrowthRoadmap(diagnosisId: string): Promise<RoadmapItem[]> {
	const response = await fetch(
		withQuery(`${BG_BASE}/roadmap`, { growth_diagnosis_id: diagnosisId })
	);
	return parseJsonResponse<RoadmapItem[]>(response);
}

export async function updateBusinessGrowthRoadmapItem(
	payload: RoadmapUpdateRequest
): Promise<RoadmapUpdateResponse> {
	const response = await fetch(`${BG_BASE}/roadmap/update`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJsonResponse<RoadmapUpdateResponse>(response);
}

export async function startBusinessGrowthReview(): Promise<ReviewStartResponse> {
	const response = await fetch(`${BG_BASE}/review/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ started_at: new Date().toISOString() }),
	});
	return parseJsonResponse<ReviewStartResponse>(response);
}

export async function approveBusinessGrowthReview(
	payload: ReviewApproveRequest
): Promise<ReviewApproveResponse> {
	const response = await fetch(`${BG_BASE}/review/approve`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJsonResponse<ReviewApproveResponse>(response);
}

export async function getBusinessGrowthReviewHistory(
	diagnosisId: string
): Promise<ConsultantReviewRecord[]> {
	const response = await fetch(
		withQuery(`${BG_BASE}/review/history`, { growth_diagnosis_id: diagnosisId })
	);
	return parseJsonResponse<ConsultantReviewRecord[]>(response);
}

export async function generateBusinessGrowthGuidance(payload: {
	growth_diagnosis_id?: string;
	roadmap_item_id?: string;
	cms?: string;
	include_llm?: boolean;
}): Promise<GuidanceResponse> {
	const response = await fetch(`${BG_BASE}/guidance/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJsonResponse<GuidanceResponse>(response);
}

export async function getBusinessGrowthReportPreview(
	diagnosisId: string
): Promise<ReportPreviewResponse> {
	const response = await fetch(
		withQuery(`${BG_BASE}/report/preview`, { growth_diagnosis_id: diagnosisId })
	);
	return parseJsonResponse<ReportPreviewResponse>(response);
}

export async function getBusinessGrowthKpis(): Promise<GrowthKpiRecord[]> {
	const response = await fetch(`${BG_BASE}/kpi`);
	return parseJsonResponse<GrowthKpiRecord[]>(response);
}

export async function getBusinessGrowthJourney(
	assessmentSessionId: string
): Promise<GrowthJourneyResumeResponse> {
	const response = await fetch(
		withQuery(`${BG_BASE}/journey`, { assessment_session_id: assessmentSessionId })
	);
	return parseJsonResponse<GrowthJourneyResumeResponse>(response);
}

export async function recordBusinessGrowthKpi(payload: Record<string, unknown>): Promise<KpiRecordResponse> {
	const response = await fetch(`${BG_BASE}/kpi/record`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	return parseJsonResponse<KpiRecordResponse>(response);
}
