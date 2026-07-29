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
  assessment_focus?: AssessmentFocusReport | null;
}

export interface AssessmentFocusReport {
  focus_title: string;
  validation_summary: string;
  recommended_agenda_items: string[];
}

export interface ChatResponse {
  response: string;
  session_id: string;
  state?: string;
  route_decision:
    | "kb_success"
    | "kb_no_results"
    | "conversational"
    | "conversational_action"
    | "blocked"
    | "fallback"
    | "deterministic_template"
    | "human_handoff";
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
  | "cta_selected"
  | "email_captured"
  | "phone_captured"
  | "human_handoff_triggered";

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

export interface CareerJob {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
  jd_markdown?: string | null;
  jd_raw_text?: string | null;
  status: string;
  updated_at?: string | null;
}

export interface CareersJobsResponse {
  jobs: CareerJob[];
  count: number;
  total_items?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  facets?: {
    departments?: string[];
    locations?: string[];
    employment_types?: string[];
  };
  filters?: {
    query?: string | null;
    department?: string | null;
    location?: string | null;
    employment_type?: string | null;
  };
}

export interface CareersInitUploadRequest {
  job_id: string;
  full_name: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  years_experience?: number;
  cover_note?: string;
  consent_accepted: boolean;
  resume_original_name: string;
  resume_content_type: string;
  resume_size_bytes: number;
  resume_content_base64?: string;
}

export interface CareersInitUploadResponse {
  application_id: string;
  reference_id: string;
  upload: {
    method: string;
    url: string;
    expires_in_seconds: number;
    required_headers: Record<string, string>;
    uploaded?: boolean;
  };
}

export interface CareersCompleteResponse {
  application_id: string;
  reference_id: string;
  status: string;
  applicant_notification?: {
    sent: boolean;
    error?: string | null;
  };
  hr_notification?: {
    sent: boolean;
    error?: string | null;
  };
}

export interface AdminCareersListResponse {
  items: Array<Record<string, unknown>>;
  count: number;
  requested_by?: string;
}

export interface AdminCareersDetail extends Record<string, unknown> {
  id: string;
  reference_id?: string;
  full_name?: string;
  email?: string;
  submission_status?: string;
  analysis_status?: string;

  // Enhanced fields for rich UX
  match_score?: number | null;
  recommendation?: string | null;
  strengths_summary?: string | null;
  gaps_summary?: string | null;
  job_title?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  years_experience?: number | null;
  cover_note?: string | null;

  // Parsing / document health
  resume_parse_error?: string | null;          // "corrupt" | "empty" | "unreadable" | null
  parsing_completed_at?: string | null;
  applicant_email_sent_at?: string | null;

  // Human review state
  reviewed_by_human_at?: string | null;        // null = unread / not yet reviewed
  override_reason?: string | null;             // recruiter's reason when overriding AI
  override_reason_label?: string | null;

  // AI analysis structure
  structured_report?: Record<string, unknown> | null;
  skills_matrix?: Array<Record<string, unknown>>;
  experience_analysis?: Record<string, unknown> | null;
  education_analysis?: Record<string, unknown> | null;

  // Resume download for inline preview
  resume_signed_url?: string | null;
  resume_original_name?: string | null;
  resume_content_type?: string | null;

  // Timeline / audit trail
  created_at?: string | null;
  updated_at?: string | null;
  timeline_events?: Array<{
    event_type: string;
    event_label: string;
    timestamp: string;
    actor?: string;
  }>;
}