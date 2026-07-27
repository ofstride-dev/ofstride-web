import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ShieldCheck } from "lucide-react";
import { useExpenseAuth } from "../../context/ExpenseAuthContext";
import { listMyExpenses, STATUS_LABELS, STATUS_BADGE_CLASSES } from "../../services/expenseService";

function StatusBadge({ status }) {
  const classes = STATUS_BADGE_CLASSES[status] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${classes}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function MyExpenses() {
  const { user, profile, signOut } = useExpenseAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let isMounted = true;
    setLoading(true);
    listMyExpenses(user.id)
      .then((data) => {
        if (isMounted) setExpenses(data);
      })
      .catch(() => {
        if (isMounted) setError("Could not load your claims right now. Please try again shortly.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <div className="pt-12 sm:pt-16 min-h-screen bg-surface">
      <section className="py-10 sm:py-14 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-primary">My Expense Claims</h1>
              <p className="text-sm text-muted mt-1">{profile?.full_name || user?.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {profile?.role === "admin" && (
                <Link
                  to="/expenses/admin"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-text hover:bg-surface"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Admin Queue
                </Link>
              )}
              <Link
                to="/expenses/new"
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm"
              >
                <Plus className="w-4 h-4" />
                New Claim
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-text hover:bg-surface"
              >
                Sign Out
              </button>
            </div>
          </div>

          {loading && <p className="text-sm text-muted py-4 text-center">Loading your claims...</p>}

          {!loading && error && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          {!loading && !error && expenses.length === 0 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <p className="text-sm text-muted">You haven't submitted any expense claims yet.</p>
            </div>
          )}

          {!loading && !error && expenses.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-100">
              {expenses.map((expense) => (
                <Link
                  key={expense.id}
                  to={`/expenses/${expense.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-surface transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-primary truncate">{expense.category}</p>
                    <p className="text-sm text-muted truncate">
                      {expense.spend_date} · {expense.currency} {Number(expense.amount).toFixed(2)}
                    </p>
                  </div>
                  <StatusBadge status={expense.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default MyExpenses;
