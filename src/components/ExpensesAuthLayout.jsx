import { Outlet } from "react-router-dom";
import { ExpenseAuthProvider } from "../context/ExpenseAuthContext";

function ExpensesAuthLayout() {
  const styles = {
    container: {
      width: "100%",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "1rem",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "2rem",
      gap: "1rem",
      flexWrap: "wrap",
    },
    title: {
      margin: 0,
      color: "#0f172a",
      fontSize: "1.75rem",
      fontWeight: "700",
      letterSpacing: "-0.025em",
    },
    subtitle: {
      margin: "0.35rem 0 0 0",
      color: "#64748b",
      fontSize: "0.95rem",
      fontWeight: "500",
    },
    metricCard: {
      padding: "1rem 1.5rem",
      backgroundColor: "#fff",
      borderRadius: "12px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
      border: "1px solid #f1f5f9",
    },
    metricText: {
      color: "#64748b",
      fontSize: "0.875rem",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      margin: "0 0 0.25rem 0",
    },
    metricValue: {
      color: "#0ea5e9",
      fontSize: "1.5rem",
      fontWeight: "700",
      margin: 0,
    },
  };

  return (
    <ExpenseAuthProvider>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>Expense Portal</h2>
            <p style={styles.subtitle}>Claims, approvals, and reimbursements</p>
          </div>
          
        </div>

        <Outlet />
      </div>
    </ExpenseAuthProvider>
  );
}

export default ExpensesAuthLayout;
