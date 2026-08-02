import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

export default function CashflowLayout() {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/cashflow/dashboard' },
    { label: 'Payables (AP)', path: '/cashflow/ap' },
    { label: 'Receivables (AR)', path: '/cashflow/ar' },
    { label: 'Petty Cash', path: '/cashflow/pettycash' },
    { label: 'Expense Portal', path: '/cashflow/expense' },
  ];

  const isActivePath = (path) => {
    if (path === '/cashflow/expense') {
      return location.pathname.startsWith('/cashflow/expense');
    }
    return location.pathname === path;
  };

  return (
    <div className="pt-12 sm:pt-16 min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.10),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(59,130,246,0.10),transparent_42%),#f8fafc]">
      <section className="py-10 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 sm:mb-8 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm px-5 sm:px-7 py-5 sm:py-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-secondary mb-2">Solutions</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-primary">Cashflow Management</h1>
            <p className="text-text mt-3 max-w-3xl">
              Unified finance operations for AP, AR, petty cash, and employee expense workflows.
            </p>
          </div>

          <div className="rounded-2xl bg-white/95 border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-2 sm:p-3 overflow-x-auto backdrop-blur-sm">
            <nav className="flex items-center gap-2 min-w-max">
              {navItems.map((item) => {
                const isActive = isActivePath(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-primary text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]'
                        : 'text-text hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-6 sm:mt-8">
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  );
}