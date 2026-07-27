import { Outlet } from "react-router-dom";
import { ExpenseAuthProvider } from "../context/ExpenseAuthContext";

function ExpensesAuthLayout() {
  return (
    <ExpenseAuthProvider>
      <Outlet />
    </ExpenseAuthProvider>
  );
}

export default ExpensesAuthLayout;
