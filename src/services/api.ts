/**
 * OfStride Agent API Client
 * Communicates with Azure Functions backend at /api/*
 * Phase 1: Supabase Auth integration with Bearer JWT tokens
 * Phase 2: Career APIs routed to dedicated Function App (separate from SWA)
 */

import type {
  ApiEnvelope,
  ApiErrorPayload,
  ChatResponse,
  ChatEventRequest,
  ChatEventResponse,
  ConsultantSearchResult,
  HealthCheck,
  CareersJobsResponse,
  CareersInitUploadRequest,
  CareersInitUploadResponse,
  CareersCompleteResponse,
  AdminCareersListResponse,
  AdminCareersDetail,
} from "../types/chat";
import { getAccessToken } from "./supabase";

const API_BASE = "/api";

/** Dedicated Career Function App base URL (separate from SWA managed functions) */
const CAREER_API_BASE = import.meta.env.VITE_CAREER_API_URL
  || "https://func-ofs-carrer-001-dzd4h9andncbhfha.southindia-01.azurewebsites.net/api";

export interface AuthUser {
  isAuthenticated: boolean;
  userId?: string;
  userDetails?: string;
  identityProvider?: string;
  roles: string[];
}

/**
 * Build headers with Supabase Bearer token (primary) or x-admin-key (fallback)
 */
async function authHeaders(): Promise<HeadersInit> {
  // Try Supabase JWT first
  const token = await getAccessToken();
  if (token) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  // Fallback to x-admin-key for local dev
  const apiKey = (import.meta.env.VITE_ADMIN_API_KEY || "").trim();
  if (apiKey) {
    return {
      "Content-Type": "application/json",
      "x-admin-key": apiKey,
    };
  }

  return { "Content-Type": "application/json" };
}

/**
 * Build headers with just the API key (no Bearer token) for backward compat
 */
function apiKeyHeaderMaybe(): HeadersInit {
  const apiKey = (import.meta.env.VITE_ADMIN_API_KEY || "").trim();
  return apiKey ? { "x-admin-key": apiKey } : {};
}

interface ChatRequest {
  message: string;
  session_id: string;
  session_profile?: Record<string, string>;
}

export class ApiClientError extends Error {
  readonly type: ApiErrorPayload["type"];
  readonly details?: Record<string, unknown>;
  readonly traceId?: string;

  constructor(payload: ApiErrorPayload, traceId?: string) {
    super(payload.message);
    this.name = "ApiClientError";
    this.type = payload.type;
    this.details = payload.details;
    this.traceId = traceId;
  }
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getOrCreateSessionId(): string {
  let id = localStorage.getItem("ofstride_session_id");
  if (id) {
    return id;
  }
  id = generateSessionId();
  localStorage.setItem("ofstride_session_id", id);
  sessionStorage.setItem("ofstride_session_id", id);
  return id;
}

export function clearSessionId(): void {
  localStorage.removeItem("ofstride_session_id");
  sessionStorage.removeItem("ofstride_session_id");
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ApiEnvelope<T>>;
  return typeof candidate.ok === "boolean" && typeof candidate.trace_id === "string";
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const rawText = await response.text();
  let rawBody: unknown = null;
  if (rawText) {
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      rawBody = null;
    }
  }

  if (!isEnvelope<T>(rawBody)) {
    const snippet = rawText.trim().slice(0, 200);
    const suffix = snippet ? `: ${snippet}` : "";
    throw new Error(`Unexpected API response shape (HTTP ${response.status})${suffix}`);
  }

  if (!rawBody.ok || !response.ok) {
    const fallbackError: ApiErrorPayload = {
      type: "infra",
      message: `Request failed (HTTP ${response.status})`,
    };
    throw new ApiClientError(rawBody.error ?? fallbackError, rawBody.trace_id);
  }

  if (rawBody.data === null) {
    throw new Error("API returned ok=true but data was null");
  }

  return rawBody.data;
}

export async function sendChatMessage(
  message: string,
  sessionProfile?: Record<string, string>
): Promise<ChatResponse> {
  const payload: ChatRequest = {
    message,
    session_id: getOrCreateSessionId(),
    session_profile: sessionProfile,
  };

  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseEnvelope<ChatResponse>(response);
}

export async function checkHealth(): Promise<HealthCheck> {
  const response = await fetch(`${API_BASE}/health`);
  return parseEnvelope<HealthCheck>(response);
}

export async function searchConsultants(query: string): Promise<ConsultantSearchResult> {
  const response = await fetch(
    `${API_BASE}/consultants/search?${new URLSearchParams({ query })}`
  );
  return parseEnvelope<ConsultantSearchResult>(response);
}

export function getChatSessionId(): string {
  return getOrCreateSessionId();
}

export async function postChatEvent(payload: ChatEventRequest): Promise<ChatEventResponse> {
  const response = await fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return parseEnvelope<ChatEventResponse>(response);
}

export async function postMakeWebhook(
  url: string | undefined,
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function notifyChatEnded(payload: {
  session_id: string;
  profile: Record<string, string>;
  summary: string;
  messages?: { role: string; content: string }[];
}): Promise<void> {
  const url = import.meta.env.VITE_MAKE_WEBHOOK_CHAT_URL as string | undefined;
  await postMakeWebhook(url, {
    event: "chat_ended",
    source: "ofstride-website-chat-widget",
    session_id: payload.session_id,
    profile: payload.profile,
    summary: payload.summary,
    messages: payload.messages ?? [],
    notify_support_email: "support@ofstrideservices.com",
    ended_at: new Date().toISOString(),
  });
}

export async function listCareersJobs(): Promise<CareersJobsResponse> {
  const response = await fetch(`${CAREER_API_BASE}/jobs`);
  return parseEnvelope<CareersJobsResponse>(response);
}

export async function initCareersUpload(
  payload: CareersInitUploadRequest
): Promise<CareersInitUploadResponse> {
  const response = await fetch(`${CAREER_API_BASE}/careers/init-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseEnvelope<CareersInitUploadResponse>(response);
}

export async function completeCareersUpload(applicationId: string): Promise<CareersCompleteResponse> {
  const response = await fetch(`${CAREER_API_BASE}/careers/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ application_id: applicationId }),
  });
  return parseEnvelope<CareersCompleteResponse>(response);
}

// ── Admin Career API (routed to dedicated Function App) ─────────────────
// Route changed from admin-careers to careers/admin to avoid Azure Functions
// reserved route families (admin/*, runtime/webhooks/*).

export async function adminListApplications(params?: {
  status?: string;
  job_id?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminCareersListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.job_id) query.set("job_id", params.job_id);
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  if (typeof params?.offset === "number") query.set("offset", String(params.offset));

  query.set("_path", "applications");
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    headers: await authHeaders(),
  });
  return parseEnvelope<AdminCareersListResponse>(response);
}

export async function adminGetApplication(applicationId: string): Promise<AdminCareersDetail> {
  const query = new URLSearchParams({ _path: `applications/${encodeURIComponent(applicationId)}` });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    headers: await authHeaders(),
  });
  return parseEnvelope<AdminCareersDetail>(response);
}

export async function adminUpdateApplicationStatus(
  applicationId: string,
  status: "under_review" | "shortlisted" | "rejected"
): Promise<{ application_id: string; status: string }> {
  const query = new URLSearchParams({ _path: `applications/${encodeURIComponent(applicationId)}/status` });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });
  return parseEnvelope<{ application_id: string; status: string }>(response);
}

export async function adminRunApplicationAnalysis(
  applicationId: string
): Promise<{
  application_id: string;
  analysis_status: string;
  match_score: number;
  recommendation: string;
  matched_skills: string[];
  missing_skills: string[];
  strengths_summary: string;
  gaps_summary: string;
}> {
  const query = new URLSearchParams({ _path: `applications/${encodeURIComponent(applicationId)}/analysis` });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return parseEnvelope<{
    application_id: string;
    analysis_status: string;
    match_score: number;
    recommendation: string;
    matched_skills: string[];
    missing_skills: string[];
    strengths_summary: string;
    gaps_summary: string;
  }>(response);
}

export async function adminListJobs(): Promise<{ items: Array<Record<string, unknown>>; count: number }> {
  const query = new URLSearchParams({ _path: "jobs" });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    headers: await authHeaders(),
  });
  return parseEnvelope<{ items: Array<Record<string, unknown>>; count: number }>(response);
}

export async function adminSaveJob(payload: {
  id?: string;
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  jd_markdown: string;
  jd_raw_text?: string;
  status: "draft" | "active" | "archived";
}): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ _path: "jobs" });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  return parseEnvelope<Record<string, unknown>>(response);
}

export async function adminCleanupStaleDrafts(olderThanHours = 24): Promise<{ updated: number; older_than_hours: number }> {
  const query = new URLSearchParams({ _path: "cleanup" });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ older_than_hours: olderThanHours }),
  });
  return parseEnvelope<{ updated: number; older_than_hours: number }>(response);
}

export async function adminInitJdUpload(payload: {
  file_name: string;
  content_type: string;
  size_bytes: number;
}): Promise<{
  upload: { method: string; url: string; expires_in_seconds: number; required_headers: Record<string, string> };
  blob: { container: string; path: string };
}> {
  const query = new URLSearchParams({ _path: "jd-upload/init" });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  return parseEnvelope<{
    upload: { method: string; url: string; expires_in_seconds: number; required_headers: Record<string, string> };
    blob: { container: string; path: string };
  }>(response);
}

export async function adminPublishJobFromUpload(payload: {
  id?: string;
  title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  status: "draft" | "active" | "archived";
  blob_path: string;
  blob_container: string;
}): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ _path: "jobs/from-upload" });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  return parseEnvelope<Record<string, unknown>>(response);
}

export async function adminSendFurtherDiscussionMail(
  applicationId: string
): Promise<{ application_id: string; sent: boolean; error?: string | null }> {
  const query = new URLSearchParams({ _path: `applications/${encodeURIComponent(applicationId)}/notify` });
  const response = await fetch(`${CAREER_API_BASE}/careers/admin?${query.toString()}`, {
    method: "POST",
    headers: await authHeaders(),
  });
  return parseEnvelope<{ application_id: string; sent: boolean; error?: string | null }>(response);
}

export function buildAadLoginUrl(postLoginRedirectPath: string): string {
  const normalized = postLoginRedirectPath.startsWith("/")
    ? postLoginRedirectPath
    : `/${postLoginRedirectPath}`;
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(normalized)}`;
}

export async function getAuthUser(): Promise<AuthUser> {
  try {
    const response = await fetch("/.auth/me", { credentials: "same-origin" });
    if (!response.ok) {
      return { isAuthenticated: false, roles: [] };
    }

    const payload = await response.json();
    const principal = Array.isArray(payload?.clientPrincipal)
      ? payload.clientPrincipal[0]
      : payload?.clientPrincipal;

    if (!principal || typeof principal !== "object") {
      return { isAuthenticated: false, roles: [] };
    }

    const roles = Array.isArray(principal.userRoles)
      ? principal.userRoles.map((role: unknown) => String(role))
      : [];
    const normalized = roles.map((role: string) => role.toLowerCase());
    const isAuthenticated = !normalized.includes("anonymous");

    return {
      isAuthenticated,
      userId: principal.userId ? String(principal.userId) : undefined,
      userDetails: principal.userDetails ? String(principal.userDetails) : undefined,
      identityProvider: principal.identityProvider ? String(principal.identityProvider) : undefined,
      roles,
    };
  } catch {
    return { isAuthenticated: false, roles: [] };
  }
}