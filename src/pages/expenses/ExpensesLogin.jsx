import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useExpenseAuth } from "../../context/ExpenseAuthContext";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-secondary focus:ring-2 focus:ring-secondary/20 outline-none";

function ExpensesLogin() {
  const { session, signIn, signUp, loading } = useExpenseAuth();
  const navigate = useNavigate();

  // "signin" | "signup" | "admin_signup"
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/cashflow/expense" replace />;
  }

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await signIn(email.trim(), password);
        if (signInError) {
          setError(signInError);
          return;
        }
        navigate("/cashflow/expense");
      } else {
        // "signup" -> employee, "admin_signup" -> admin
        const role = mode === "admin_signup" ? "admin" : "employee";
        const { error: signUpError } = await signUp(
          email.trim(),
          password,
          fullName.trim(),
          role
        );
        if (signUpError) {
          setError(signUpError);
          return;
        }
        setInfo(
          role === "admin"
            ? "Admin account created. Check your email for a confirmation link, then sign in."
            : "Account created. Check your email for a confirmation link, then sign in."
        );
        switchMode("signin");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isSignup = mode === "signup" || mode === "admin_signup";
  const heading =
    mode === "signin"
      ? "Sign in"
      : mode === "admin_signup"
      ? "Create an admin account"
      : "Create an account";

  return (
    <div className="bg-surface">
      <section className="py-4 sm:py-6 lg:py-8">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-primary mb-1">{heading}</h1>
            <p className="text-sm text-muted mb-6">Expense Reimbursement Portal</p>

            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 btn-ui ${
                  mode === "signin"
                    ? "btn-ui-primary"
                    : "btn-ui-neutral"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 btn-ui ${
                  mode === "signup"
                    ? "btn-ui-primary"
                    : "btn-ui-neutral"
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => switchMode("admin_signup")}
                className={`flex-1 btn-ui ${
                  mode === "admin_signup"
                    ? "btn-ui-primary"
                    : "btn-ui-neutral"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
                {info}
              </div>
            )}

            {mode === "admin_signup" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-4">
                Admin accounts can view all submitted expense claims and approve,
                reject, or mark them ready for payment.
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignup && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-ui btn-ui-primary"
              >
                {submitting
                  ? "Please wait..."
                  : mode === "signin"
                  ? "Sign In"
                  : mode === "admin_signup"
                  ? "Create Admin Account"
                  : "Sign Up"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ExpensesLogin;