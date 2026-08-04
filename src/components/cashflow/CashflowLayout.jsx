import React, { useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Download, FileSpreadsheet, FileCode2, X } from 'lucide-react';
import { cashflowFetch } from '../../services/cashflowApi';

export default function CashflowLayout() {
  const location = useLocation();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportType, setExportType] = useState('tally');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eduMode, setEduMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState('');

  const today = useMemo(() => {
    const dt = new Date();
    return dt.toISOString().slice(0, 10);
  }, []);

  const monthStart = useMemo(() => {
    const dt = new Date();
    dt.setDate(1);
    return dt.toISOString().slice(0, 10);
  }, []);

  const openExportModal = () => {
    setStartDate((prev) => prev || monthStart);
    setEndDate((prev) => prev || today);
    setExportError('');
    setIsExportOpen(true);
  };

  const closeExportModal = () => {
    if (isDownloading) return;
    setIsExportOpen(false);
    setExportError('');
  };

  const handleDownload = async () => {
    if (!startDate || !endDate) {
      setExportError('Please select both start and end dates.');
      return;
    }
    if (startDate > endDate) {
      setExportError('Start date must be earlier than or equal to end date.');
      return;
    }

    const endpoint = exportType === 'tally' ? '/export/tally' : '/export/gstr';
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    if (exportType === 'tally' && eduMode) {
      params.set('edu_mode', 'true');
    }

    setIsDownloading(true);
    setExportError('');

    try {
      const res = await cashflowFetch(`${endpoint}?${params.toString()}`, {
        method: 'GET',
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const payload = await res.json();
          throw new Error(payload?.error || payload?.message || 'Export failed.');
        }
        const text = await res.text();
        throw new Error(text || `Export failed with status ${res.status}.`);
      }

      const blob = await res.blob();
      const ext = exportType === 'tally' ? 'xml' : 'xlsx';
      const filename =
        exportType === 'tally'
          ? `tally_export_${startDate}_to_${endDate}.xml`
          : `gstr_report_${startDate}_to_${endDate}.xlsx`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setIsExportOpen(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/cashflow/dashboard' },
    { label: 'Payables (AP)', path: '/cashflow/ap' },
    { label: 'Receivables (AR)', path: '/cashflow/ar' },
    { label: 'Petty Cash', path: '/cashflow/pettycash' },
    { label: 'Tally Reconcile', path: '/cashflow/reconcile' },
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
            <div className="flex items-center justify-between gap-2 min-w-max">
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

              <button
                type="button"
                onClick={openExportModal}
                className="ml-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-secondary text-sm font-semibold hover:bg-blue-100 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exports &amp; Compliance
              </button>
            </div>
          </div>

          <div className="mt-6 sm:mt-8">
            <Outlet />
          </div>
        </div>
      </section>

      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-primary">Exports &amp; Compliance</h3>
              <button
                type="button"
                onClick={closeExportModal}
                disabled={isDownloading}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">Export Type</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportType('tally')}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      exportType === 'tally'
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 bg-white text-text hover:bg-slate-50'
                    }`}
                  >
                    <FileCode2 className="w-4 h-4" />
                    Tally XML Export
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('gstr')}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      exportType === 'gstr'
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 bg-white text-text hover:bg-slate-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    GSTR Excel Report
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              {exportType === 'tally' && (
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={eduMode}
                    onChange={(e) => setEduMode(e.target.checked)}
                  />
                  Override voucher dates to first of month (Educational Mode)
                </label>
              )}

              {exportError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {exportError}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeExportModal}
                disabled={isDownloading}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-text hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? 'Preparing...' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}