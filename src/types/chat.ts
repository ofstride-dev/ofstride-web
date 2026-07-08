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

export interface ChatAction {
  id: string;
  label: string;
  value: string;
  kind?: "quick_reply" | "cta";
}

export interface ChatUiHints {
  actions?: ChatAction[];
  highlight_consultants?: boolean;
  next_required_field?: "name" | "phone" | "email" | null;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  state?: string;
  route_decision: "kb_success" | "kb_no_results" | "conversational" | "blocked";
  confidence: number;
  sources: ConsultantSource[];
  provider_used: string;
  fallback_reason?: string | null;
  session_profile?: Record<string, string>;
  ui_hints?: ChatUiHints;
}

export type ChatEventType =
  | "chat_opened"
  | "intent_selected"
  | "lead_form_submitted"
  | "consultant_viewed"
  | "booking_initiated"
  | "response_generated"
  | "session_exit"
  | "off_topic_query"
  | "cta_selected";

export interface ChatEventRequest {
  event_type: ChatEventType;
  session_id: string;
  payload: Record<string, unknown>;
}

export interface ChatEventResponse {
  accepted: boolean;
  event_id?: string;
  queued?: boolean;
  webhook_dispatched?: boolean;
  webhook_error?: string | null;
  occurred_at?: string;
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