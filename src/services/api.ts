/**
 * OfStride Agent API Client
 * Communicates with Azure Functions backend at /api/*
 */

import type {
  ApiEnvelope,
  ApiErrorPayload,
  ChatResponse,
  ChatEventRequest,
  ChatEventResponse,
  ConsultantSearchResult,
  HealthCheck,
} from "../types/chat";

const API_BASE = "/api";

interface ChatRequest {
  message: string;
  session_id: string;
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
  // Try localStorage first (persistent across page reloads)
  let id = localStorage.getItem("ofstride_session_id");
  if (id) {
    return id;
  }

  // Generate new session ID if none exists
  id = generateSessionId();
  
  // Store in both localStorage (persistence) and sessionStorage (security boundary)
  localStorage.setItem("ofstride_session_id", id);
  sessionStorage.setItem("ofstride_session_id", id);
  
  return id;
}

/**
 * Clear session ID (call on logout or explicit session end)
 */
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

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const payload: ChatRequest = {
    message,
    session_id: getOrCreateSessionId(),
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