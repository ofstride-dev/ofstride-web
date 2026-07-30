import React, { useState, useEffect } from 'react';
import { cashflowFetch, parseCashflowResponse } from '../../services/cashflowApi';

export default function AccountsReceivable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_name: '', customer_gstin: '', invoice_number: '', 
    invoice_date: new Date().toISOString().split('T')[0], 
    amount: '', gst_amount: '', irn_number: '', is_proforma: false, notes: ''
  });

  useEffect(() => { fetchInvoices(); }, []);

  const fetchInvoices = async () => {
    try {
      const res = await cashflowFetch('/cashflow/ar/list');
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok) setInvoices(parsed.data || []);
      else throw new Error(parsed.error || `Server returned ${parsed.status}`);
    } catch (err) {
      console.error("Fetch invoices failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await cashflowFetch('/cashflow/ar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok) {
        setInvoices([parsed.data, ...invoices]);
        setFormData({ 
          customer_name: '', customer_gstin: '', invoice_number: '', 
          invoice_date: new Date().toISOString().split('T')[0], 
          amount: '', gst_amount: '', irn_number: '', is_proforma: false, notes: '' 
        });
      } else {
        throw new Error(parsed.error || `Server error ${parsed.status}`);
      }
    } catch (err) {
      console.error("Save Failed:", err);
      alert("Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (invoice) => {
    const paymentAmount = window.prompt(
      `Record payment for ${invoice.invoice_number}\nEnter amount (Total: ₹${(invoice.amount + invoice.gst_amount)}):`, 
      invoice.amount + invoice.gst_amount
    );
    if (!paymentAmount) return;

    try {
      const res = await cashflowFetch('/cashflow/ar/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: parseFloat(paymentAmount),
          payment_mode: 'bank_transfer'
        })
      });
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok) {
        alert("Payment recorded successfully!");
        fetchInvoices(); 
      } else {
        throw new Error(parsed.error || `Server error ${parsed.status}`);
      }
    } catch (err) {
      console.error("Payment Failed:", err);
      alert("Failed to record payment.");
    }
  };

  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'paid' && !inv.is_proforma)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount || 0) + parseFloat(curr.gst_amount || 0)), 0);

  // --- PREMIUM STYLES ---
  const styles = {
    container: { maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
    title: { margin: 0, color: '#0f172a', fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.025em' },
    metricCard: { padding: '1rem 1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', border: '1px solid #f1f5f9' },
    metricText: { color: '#64748b', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.25rem 0' },
    metricValue: { color: '#0ea5e9', fontSize: '1.5rem', fontWeight: '700', margin: 0 },
    card: { backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)', marginBottom: '2.5rem', border: '1px solid #f8fafc' },
    cardTitle: { marginTop: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '600', marginBottom: '1.5rem' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', alignItems: 'end' },
    label: { display: 'block', fontSize: '0.875rem', color: '#475569', fontWeight: '500', marginBottom: '0.5rem' },
    input: { width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.95rem', color: '#0f172a', transition: 'border-color 0.15s ease', boxSizing: 'border-box' },
    checkboxLabel: { display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: '#475569', fontWeight: '500', cursor: 'pointer', height: '45px' },
    button: { padding: '0.75rem 1.5rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem', height: '45px', transition: 'background-color 0.2s', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)' },
    tableContainer: { backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' },
    th: { padding: '1rem 1.5rem', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '1rem 1.5rem', color: '#334155', fontSize: '0.95rem', borderBottom: '1px solid #f1f5f9' },
    badgeProforma: { marginLeft: '8px', fontSize: '0.7rem', backgroundColor: '#fef08a', color: '#854d0e', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontWeight: '600' },
    badgePaid: { backgroundColor: '#dcfce7', color: '#166534', padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '600', textTransform: 'capitalize' },
    badgePending: { backgroundColor: '#f1f5f9', color: '#475569', padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '600', textTransform: 'capitalize' },
    actionBtn: { padding: '0.4rem 1rem', backgroundColor: '#f8fafc', color: '#0ea5e9', border: '1px solid #e0f2fe', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }
  };

  return (
    <div style={styles.container}>
      
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Accounts Receivable</h2>
        <div style={styles.metricCard}>
          <p style={styles.metricText}>Total Outstanding</p>
          <p style={styles.metricValue}>₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Create New Invoice</h3>
        <form onSubmit={handleCreateInvoice} style={styles.formGrid}>
          <div>
            <label style={styles.label}>Customer Name</label>
            <input type="text" name="customer_name" value={formData.customer_name} onChange={handleInputChange} required style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Invoice #</label>
            <input type="text" name="invoice_number" value={formData.invoice_number} onChange={handleInputChange} placeholder="Auto-generated" style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Invoice Date</label>
            <input type="date" name="invoice_date" value={formData.invoice_date} onChange={handleInputChange} required style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Amount (₹)</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>GST Amount (₹)</label>
            <input type="number" name="gst_amount" value={formData.gst_amount} onChange={handleInputChange} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>IRN Number</label>
            <input type="text" name="irn_number" value={formData.irn_number} onChange={handleInputChange} placeholder="Optional" style={styles.input} />
          </div>
          <div style={styles.checkboxLabel}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" name="is_proforma" checked={formData.is_proforma} onChange={handleInputChange} style={{ marginRight: '0.75rem', width: '18px', height: '18px' }} />
              Is Proforma Invoice?
            </label>
          </div>
          <button type="submit" disabled={saving} style={styles.button}>
            {saving ? 'Creating...' : 'Create Invoice'}
          </button>
        </form>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Invoice #</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Total (w/ GST)</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const total = parseFloat(inv.amount || 0) + parseFloat(inv.gst_amount || 0);
              
              return (
                <tr key={inv.id}>
                  <td style={{...styles.td, fontWeight: '500', color: '#0f172a'}}>
                    {inv.cashflow_entities?.name || 'N/A'}
                    {inv.is_proforma && <span style={styles.badgeProforma}>PROFORMA</span>}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: '600' }}>{inv.invoice_number}</div>
                    {inv.irn_number && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>IRN: {inv.irn_number.substring(0, 10)}...</div>}
                  </td>
                  <td style={styles.td}>{inv.invoice_date}</td>
                  <td style={styles.td}>₹{parseFloat(inv.amount || 0).toLocaleString('en-IN')}</td>
                  <td style={{...styles.td, fontWeight: '600', color: '#0f172a'}}>₹{total.toLocaleString('en-IN')}</td>
                  <td style={styles.td}>
                    <span style={inv.status === 'paid' ? styles.badgePaid : styles.badgePending}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {inv.status !== 'paid' && !inv.is_proforma && (
                      <button onClick={() => handleRecordPayment(inv)} style={styles.actionBtn}>
                        Collect
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No invoices created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}