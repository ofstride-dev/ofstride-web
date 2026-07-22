/**
 * OfStride Supabase Auth Client
 * Handles authentication for admin, employer, and jobseeker roles
 */

import { createClient, type User, type Session } from "@supabase/supabase-js";

function normalizeEnvValue(value: string | undefined): string {
  const trimmed = (value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeSupabaseUrl(value: string | undefined): string {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    return "";
  }
  try {
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return "";
  }
}

// These are set in .env as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

export type AuthRole = "admin" | "employer" | "jobseeker" | null;

export interface AuthState {
  user: User | null;
  session: Session | null;
  role: AuthRole;
  loading: boolean;
}

/**
 * Get the current JWT access token for API authorization
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

/**
 * Build Authorization headers with Bearer token for API calls
 */
export async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { user: null, error: error.message };
  }
  return { user: data.user, error: null };
}

/**
 * Sign up a new user
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  role: AuthRole = "jobseeker"
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role, // Sets role in user_metadata
      },
    },
  });
  if (error) {
    return { user: null, error: error.message };
  }
  return { user: data.user, error: null };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get the user's role from user_metadata
 */
export function getUserRole(user: User | null): AuthRole {
  if (!user) return null;
  const role = user.user_metadata?.role as string | undefined;
  if (role === "admin" || role === "employer" || role === "jobseeker") {
    return role;
  }
  // Check app_metadata as fallback (set by Supabase custom claims)
  const appRole = (user.app_metadata?.role as string) || "";
  if (appRole === "admin" || appRole === "employer" || appRole === "jobseeker") {
    return appRole as AuthRole;
  }
  return null;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (state: AuthState) => void
): { unsubscribe: () => void } {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user || null;
    const role = getUserRole(user);
    callback({
      user,
      session,
      role,
      loading: false,
    });
  });

  // Also get initial state
  supabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user || null;
    const role = getUserRole(user);
    callback({
      user,
      session: data.session,
      role,
      loading: false,
    });
  });

  return { unsubscribe: () => subscription.unsubscribe() };
}