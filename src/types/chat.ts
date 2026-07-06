export type ApiErrorType =
  | "validation"
  | "provider"
  | "retrieval"
  | "guardrail"
  | "infra";

export interface ApiErrorPayload {
  type: ApiErrorType;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
  trace_id: string;
}

export interface ConsultantSource {
  content: string;
  metadata: {
    source?: string;
    consultant_name?: string;
    skills?: string[];
    experience_years?: number;
    availability?: string;
    [key: string]: unknown;
  };
}

export interface ChatResponse {
  response: string;
  session_id: string;
  route_decision: "kb_success" | "kb_no_results" | "conversational" | "blocked";
  confidence: number;
  sources: ConsultantSource[];
  provider_used: string;
  fallback_reason?: string | null;
}

export interface HealthCheck {
  status: "ready" | "not_ready";
  checks: Record<string, { status: string; detail?: string; provider?: string }>;
  timestamp: string;
}

export interface ConsultantSearchResult {
  consultants: Array<Record<string, unknown>>;
  total: number;
  query: string;
}