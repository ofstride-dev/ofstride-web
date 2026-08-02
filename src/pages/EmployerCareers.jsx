import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmail,
  signUpWithEmail,
  signOut,
  onAuthStateChange,
} from "../services/supabase";
import { BriefcaseBusiness, LogOut, ShieldCheck, UserRound } from "lucide-react";

function EmployerCareers() {
  const [auth, setAuth] = useState({ user: null, session: null, role: null, loading: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const navigate = useNavigate();

  useEffect(() => {
    const sub = onAuthStateChange((state) => {
      setAuth(state);
    });
    return () => sub.unsubscribe();
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await signInWithEmail(email, password);
    if (error) setAuthError(error);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await signUpWithEmail(email, password, "employer");
    if (error) {
      setAuthError(error);
    } else {
      setAuthError("Check your email for confirmation link.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAuth({ user: null, session: null, role: null, loading: false });
  };

  if (auth.loading) {
    return (
      <div className="pt-12 sm:pt-16 min-h-screen bg-surface flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="pt-12 sm:pt-16 min-h-screen bg-surface">
        <section className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-secondary flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary mb-2">Employer / Admin</p>
            <h1 className="text-2xl font-bold text-primary mb-2">Employer Sign In</h1>
            <p className="text-sm text-muted mb-6">
              Sign in to manage hiring operations and job postings.
            </p>

            <form onSubmit={authMode === "signin" ? handleSignIn : handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none"
                  required
                  minLength={6}
                />
              </div>

              {authError && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 text-sm">
                  {authError}
                </div>
              )}

              <button type="submit" className="w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
                {authMode === "signin" ? "Sign In" : "Create Employer Account"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
                className="text-sm text-secondary hover:underline"
              >
                {authMode === "signin"
                  ? "No account? Register as employer"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pt-12 sm:pt-16 min-h-screen bg-surface">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-secondary mb-2">Employer Portal</p>
              <h1 className="text-3xl font-bold text-primary mb-3">Manage Hiring Operations</h1>
            </div>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
          <p className="text-text mb-2 inline-flex items-center gap-2">
            <UserRound className="w-4 h-4 text-secondary" />
            Welcome, {auth.user?.email} ({auth.role})
          </p>
          <p className="text-text mb-6">
            Use this portal to upload job descriptions and manage applications.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin/careers")}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm inline-flex items-center gap-2"
            >
              <BriefcaseBusiness className="w-4 h-4" />
              Open Admin Dashboard
            </button>
            <button
              onClick={() => navigate("/admin/careers")}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
            >
              Upload JD
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default EmployerCareers;
