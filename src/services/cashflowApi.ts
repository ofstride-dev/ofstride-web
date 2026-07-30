import { supabase } from "./supabase";

const DEFAULT_FUNC_API_BASE =
  "https://func-ofs-carrer-001-dzd4h9andncbhfha.southindia-01.azurewebsites.net/api";

export const CASHFLOW_API_BASE =
  (import.meta.env.VITE_CASHFLOW_API_URL as string | undefined)
  || (import.meta.env.VITE_CAREER_API_URL as string | undefined)
  || DEFAULT_FUNC_API_BASE;

async function cashflowIdentityHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user || null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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
