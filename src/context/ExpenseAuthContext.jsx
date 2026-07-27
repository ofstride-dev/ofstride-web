import { createContext, useContext, useEffect, useState } from "react";
import { supabase, signInWithEmail, signOut as supabaseSignOut } from "../services/supabase";

const ExpenseAuthContext = createContext(undefined);

async function fetchProfile(userId) {
  if (!userId) {
    return null;
  }
  
  // 1. Use .maybeSingle() to safely check for a profile without throwing a 406 error
  let { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // If a real database error occurs (e.g. RLS recursion / 500), surface it
    return { error };
  }

  // 2. SELF-HEALING FALLBACK: If the profile row is missing (data is null),
  // automatically create a default row so older accounts don't break the UI!
  if (!data) {
    console.warn("Profile row missing for user. Self-healing by creating a default profile...");
    
    const defaultProfile = {
      id: userId,
      full_name: "Team Member", // Default fallback name
      role: "employee",        // Default fallback role
    };

    const { data: createdProfile, error: createError } = await supabase
      .from("profiles")
      .upsert(defaultProfile)
      .select("id, full_name, role, company_id, created_at")
      .maybeSingle();

    if (createError) {
      console.error("Failed to self-heal profile:", createError);
      // Return a temporary in-memory profile so the UI still loads without crashing
      return defaultProfile;
    }

    return createdProfile;
  }

  return data;
}

export function ExpenseAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session || null);
      if (data.session?.user?.id) {
        const result = await fetchProfile(data.session.user.id);
        if (isMounted) {
          if (result?.error) {
            setProfile(null);
            setProfileError(result.error);
          } else {
            setProfile(result);
            setProfileError(null);
          }
        }
      }
      if (isMounted) setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession || null);
      if (newSession?.user?.id) {
        const result = await fetchProfile(newSession.user.id);
        if (isMounted) {
          if (result?.error) {
            setProfile(null);
            setProfileError(result.error);
          } else {
            setProfile(result);
            setProfileError(null);
          }
        }
      } else {
        setProfile(null);
        setProfileError(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { user, error } = await signInWithEmail(email, password);
    return { user, error };
  };

  const signUp = async (email, password, fullName, role = "employee") => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The handle_new_expense_profile trigger reads these from
        // raw_user_meta_data and inserts/updates the profiles row accordingly.
        data: { full_name: fullName, role },
      },
    });
    if (error) {
      return { user: null, error: error.message };
    }
    return { user: data.user, error: null };
  };

  const signOut = async () => {
    await supabaseSignOut();
    setSession(null);
    setProfile(null);
    setProfileError(null);
  };

  const value = {
    session,
    user: session?.user || null,
    profile,
    profileError,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <ExpenseAuthContext.Provider value={value}>{children}</ExpenseAuthContext.Provider>;
}

export function useExpenseAuth() {
  const ctx = useContext(ExpenseAuthContext);
  if (!ctx) {
    throw new Error("useExpenseAuth must be used inside ExpenseAuthProvider");
  }
  return ctx;
}