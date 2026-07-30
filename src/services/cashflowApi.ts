import { supabase } from "./supabase";

const DEFAULT_FUNC_API_BASE =
  "https://func-ofs-carrer-001-dzd4h9andncbhfha.southindia-01.azurewebsites.net/api";

export const CASHFLOW_API_BASE =
  (import.meta.env.VITE_CASHFLOW_API_URL as string | undefined)
  || (import.meta.env.VITE_CAREER_API_URL as string | undefined)
  || DEFAULT_FUNC_API_BASE;

async function cashflowIdentityHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const session = data.session || null;
  const user = session?.user || null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  if (!user?.id) {
    return headers;
  }

  headers["x-user-id"] = user.id;

  const rawRole = String(
    user.user_metadata?.role || user.app_metadata?.role || ""
  ).toLowerCase();

  // Keep cashflow auth strict and explicit. We only pass roles expected by
  // backend validator so malformed/unknown roles are rejected cleanly.
  if (rawRole === "admin" || rawRole === "finance") {
    headers["x-app-role"] = rawRole;
  }

  return headers;
}

export async function cashflowFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const baseHeaders = await cashflowIdentityHeaders();
  const mergedHeaders: HeadersInit = {
    ...(baseHeaders as Record<string, string>),
    ...((init.headers || {}) as Record<string, string>),
  };

  return fetch(`${CASHFLOW_API_BASE}${path}`, {
    ...init,
    headers: mergedHeaders,
  });
}

export async function parseCashflowResponse<T = any>(res: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}> {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  let payload: any = null;
  if (raw && contentType.toLowerCase().includes("application/json")) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (res.ok && payload?.ok === true) {
    return {
      ok: true,
      status: res.status,
      data: (payload.data ?? null) as T | null,
      error: null,
    };
  }

  const messageFromPayload =
    payload?.error?.message
    || payload?.error
    || payload?.message
    || null;

  const fallback = raw
    ? `HTTP ${res.status}: ${raw.slice(0, 240)}`
    : `HTTP ${res.status}: Empty response`;

  return {
    ok: false,
    status: res.status,
    data: null,
    error: String(messageFromPayload || fallback),
  };
}
