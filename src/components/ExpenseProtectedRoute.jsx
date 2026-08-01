import { Navigate, useNavigate } from "react-router-dom";
import { useExpenseAuth } from "../context/ExpenseAuthContext";

function ExpenseProtectedRoute({ children, adminOnly = false }) {
  const { session, profile, profileError, loading, signOut } = useExpenseAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/cashflow/expense/login" replace />;
  }

  // If we have a session but the profile query failed (e.g. RLS misconfig /
  // 500), don't let the user through to pages that dereference `profile.id`
  // or `profile.role` — that would crash. Show a clear error instead.
  if (profileError || !profile) {
    return (
      <div className="pt-12 sm:pt-16 min-h-screen bg-surface">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <h1 className="text-lg font-semibold text-primary mb-2">Profile unavailable</h1>
            <p className="text-sm text-muted mb-4">
              We couldn't load your expense profile. This usually means the database schema
              hasn't been applied yet, or row-level security is misconfigured. Please run
              <code className="mx-1 px-1 py-0.5 rounded bg-slate-100 text-xs">sql/expenses.sql</code>
              in the Supabase SQL editor and sign in again.
            </p>
            <a
              href="/cashflow/expense/login"
              className="inline-flex items-center justify-center bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (adminOnly && profile?.role !== "admin") {
    return <Navigate to="/cashflow/expense" replace />;
  }

  return children;
}

export default ExpenseProtectedRoute;