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

  return (
    <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', width: '100vw', overflowX: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{ width: '240px', minWidth: '240px', backgroundColor: '#0f172a', color: '#fff', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
            <h3 style={{ color: '#38bdf8', margin: 0, fontSize: '1.40rem', fontWeight: 700 }}>Cashflow Manager</h3>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {navItems.map((item) => {
              const isActive = item.path === '/cashflow/expense' 
                ? location.pathname.startsWith('/cashflow/expense') 
                : location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    color: isActive ? '#fff' : '#94a3b8',
                    backgroundColor: isActive ? '#1e293b' : 'transparent',
                    padding: '0.65rem 1rem',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info or back to site link if needed */}
        <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem', marginTop: '2rem' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ← Back to Website
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, minWidth: 0, padding: '2rem', overflowY: 'auto', boxSizing: 'border-box' }}>
        <Outlet />
      </main>
    </div>
  );
}