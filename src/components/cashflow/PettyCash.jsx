import React, { useState, useEffect } from 'react';
import { cashflowFetch, parseCashflowResponse } from '../../services/cashflowApi';

export default function PettyCash() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: 'OUT',
    description: '',
    category: ''
  });

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    try {
      const res = await cashflowFetch('/cashflow/pettycash');
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok) setEntries(parsed.data || []);
      else throw new Error(parsed.error || `Server returned ${parsed.status}`);
    } catch (err) {
      console.error("Failed to fetch ledger", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await cashflowFetch('/cashflow/pettycash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok) {
        setEntries([parsed.data, ...entries]); // Add new entry to top of list
        setFormData({ ...formData, amount: '', description: '', category: '' }); // Reset form
      } else {
        throw new Error(parsed.error || `Server returned ${parsed.status}`);
      }
    } catch (err) {
      console.error("Failed to save entry", err);
    } finally {
      setSaving(false);
    }
  };

  // Calculate Balance safely using exact DB columns (cash_in - cash_out)
  const balance = entries.reduce((acc, curr) => {
    const cashIn = parseFloat(curr.cash_in || 0);
    const cashOut = parseFloat(curr.cash_out || 0);
    return acc + cashIn - cashOut;
  }, 0);

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Header & Balance Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>Petty Cash Ledger</h2>
        <div style={{ 
          padding: '0.75rem 1.5rem', 
          backgroundColor: balance >= 0 ? '#dcfce7' : '#fee2e2', 
          borderRadius: '8px', 
          border: `1px solid ${balance >= 0 ? '#86efac' : '#fca5a5'}` 
        }}>
          <span style={{ color: balance >= 0 ? '#166534' : '#991b1b', fontWeight: 600, fontSize: '1.1rem' }}>
            Current Balance: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Entry Form Container */}
      <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.1rem', marginBottom: '1rem', color: '#1e293b' }}>New Cash Entry</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#475569', fontWeight: 500 }}>Type</label>
            <select name="type" value={formData.type} onChange={handleInputChange} style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
              <option value="OUT">Cash Out (Expense)</option>
              <option value="IN">Cash In (Withdrawal)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#475569', fontWeight: 500 }}>Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#475569', fontWeight: 500 }}>Amount (₹)</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} required min="1" placeholder="e.g. 500" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#475569', fontWeight: 500 }}>Description</label>
            <input type="text" name="description" value={formData.description} onChange={handleInputChange} required placeholder="e.g. Office snacks" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#475569', fontWeight: 500 }}>Category (Optional)</label>
            <input type="text" name="category" value={formData.category} onChange={handleInputChange} placeholder="Leave blank for AI" style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          </div>

          <button type="submit" disabled={saving} style={{ padding: '0.65rem 1.25rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, height: '42px' }}>
            {saving ? 'Saving...' : 'Log Entry'}
          </button>
        </form>
      </div>

      {/* Ledger Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading ledger entries...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>Category</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>Cash In</th>
                <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>Cash Out</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>{entry.entry_date}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>{entry.description}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ 
                      backgroundColor: entry.auto_categorized ? '#eff6ff' : '#f1f5f9', 
                      color: entry.auto_categorized ? '#1d4ed8' : '#334155',
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}>
                      {entry.category} {entry.auto_categorized ? '✨ (AI)' : ''}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#16a34a', fontWeight: 600 }}>
                    {parseFloat(entry.cash_in) > 0 ? `₹${parseFloat(entry.cash_in).toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#dc2626', fontWeight: 600 }}>
                    {parseFloat(entry.cash_out) > 0 ? `₹${parseFloat(entry.cash_out).toLocaleString('en-IN')}` : '-'}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    No cash entries recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}