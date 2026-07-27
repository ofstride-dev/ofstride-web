import { createContext, useContext, useEffect, useState } from "react";
import { supabase, signInWithEmail, signOut as supabaseSignOut } from "../services/supabase";

const ExpenseAuthContext = createContext(undefined);

async function fetchProfile(userId) {
  if (!userId) {
    return null;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id, created_at")
    .eq("id", userId)
    .single();
  if (error) {
    // Surface the error instead of silently returning null so the UI can tell
    // the difference between "no profile row yet" and "the query failed"
    // (e.g. RLS recursion / 500). Returning the error object lets the provider
    // decide how to react.
    return { error };
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