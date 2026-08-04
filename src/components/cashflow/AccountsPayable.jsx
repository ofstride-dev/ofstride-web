// AccountsPayable.jsx
// Premium UI version.
// NOTE: Business logic is unchanged from your original file.
// Replace this file with your existing logic if you've made changes after sharing it.

import React, { useState, useEffect } from 'react';
import { cashflowFetch, parseCashflowResponse } from '../../services/cashflowApi';
import { exportRowsAsCsv } from '../../services/csvExport';

export default function AccountsPayable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [approvingId, setApprovingId] = useState('');
  const [ocrStatus, setOcrStatus] = useState({ type: '', message: '' });

  const [formData, setFormData] = useState({
    vendor_name: '',
    bill_number: '',
    bill_date: '',
    amount: '',
    gst_amount: '',
    tds_section: 'NONE'
  });

  useEffect(() => { fetchInvoices(); }, []);

  const fetchInvoices = async () => {
    try {
      const res = await cashflowFetch('/cashflow/ap/list');
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok) setInvoices(parsed.data || []);
      else console.error('AP list failed:', parsed.error);
    } finally { setLoading(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrStatus({ type: '', message: '' });
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const res = await cashflowFetch('/cashflow/ap/ocr',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({file:reader.result})
        });
        const parsed = await parseCashflowResponse(res);
        if(parsed.ok) {
          const payload = parsed.data || {};
          const scanStatus = String(payload._scan_status || '').toLowerCase();
          const scanMessage = String(payload._scan_message || '').trim();
          const nextValues = {
            vendor_name: payload.vendor_name || '',
            bill_number: payload.bill_number || '',
            bill_date: payload.bill_date || '',
            amount: payload.amount || 0,
            gst_amount: payload.gst_amount || 0,
          };
          setFormData(p=>({...p,...nextValues}));

          if (scanStatus === 'warning') {
            setOcrStatus({
              type: 'warning',
              message: scanMessage || 'Invoice uploaded but scan could not extract fields.',
            });
          } else {
            setOcrStatus({
              type: 'success',
              message: scanMessage || 'Invoice scanned successfully.',
            });
          }
        }
        else {
          console.error('AP OCR failed:', parsed.error);
          setOcrStatus({ type: 'error', message: parsed.error || 'Scan failed. Please retry.' });
        }
      } finally { setOcrLoading(false); }
    };
  };

  const handleInputChange=e=>setFormData({...formData,[e.target.name]:e.target.value});

  const handleApproveBill = async (billId) => {
    if (!billId) return;
    setApprovingId(billId);
    try {
      const res = await cashflowFetch('/cashflow/ap/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bill_id: billId }),
      });
      const parsed = await parseCashflowResponse(res);
      if (parsed.ok && parsed.data) {
        setInvoices((prev) => prev.map((bill) => (bill.id === billId ? parsed.data : bill)));
      } else {
        console.error('AP approve failed:', parsed.error);
      }
    } finally {
      setApprovingId('');
    }
  };

  const handleSaveInvoice=async(e)=>{
    e.preventDefault();
    const res=await cashflowFetch('/cashflow/ap/save',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(formData)
    });
    const parsed = await parseCashflowResponse(res);
    if(parsed.ok){
      setInvoices([parsed.data,...invoices]);
      setFormData({vendor_name:'',bill_number:'',bill_date:'',amount:'',gst_amount:'',tds_section:'NONE'});
    } else {
      console.error('AP save failed:', parsed.error);
    }
  };

  const handleDownloadReport = () => {
    const now = new Date().toISOString().slice(0, 10);
    const rows = (invoices || []).map((inv) => {
      const gross = Number(inv.amount || 0);
      const gst = Number(inv.gst_amount || 0);
      const tds = Number(inv.tds_amount || 0);
      const net = gross - tds;
      const vendor = inv.cashflow_entities?.name || 'N/A';

      return {
        vendor,
        bill_number: inv.bill_number || '',
        bill_date: inv.bill_date || '',
        due_date: inv.due_date || '',
        gross_amount: gross.toFixed(2),
        gst_amount: gst.toFixed(2),
        tds_amount: tds.toFixed(2),
        net_payable: net.toFixed(2),
        status: inv.status || '',
      };
    });

    exportRowsAsCsv(
      `ap_report_${now}.csv`,
      [
        { header: 'Vendor', key: 'vendor' },
        { header: 'Bill Number', key: 'bill_number' },
        { header: 'Bill Date', key: 'bill_date' },
        { header: 'Due Date', key: 'due_date' },
        { header: 'Gross Amount', key: 'gross_amount' },
        { header: 'GST Amount', key: 'gst_amount' },
        { header: 'TDS Amount', key: 'tds_amount' },
        { header: 'Net Payable', key: 'net_payable' },
        { header: 'Status', key: 'status' },
      ],
      rows
    );
  };

  const inputStyle={
    width:'100%',height:48,padding:'0 16px',border:'1px solid #dbe4ee',
    borderRadius:12,fontSize:15,outline:'none',boxSizing:'border-box'
  };

  return (
    <div style={{maxWidth:1280,margin:'0 auto',padding:'8px 8px 20px'}}>
      <div style={{marginBottom:20,padding:'16px 18px',border:'1px solid #e2e8f0',borderRadius:16,background:'linear-gradient(165deg, #ffffff, #f8fbff)',boxShadow:'0 10px 24px rgba(15,23,42,0.04)'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{fontSize:32,fontWeight:700,margin:'0 0 6px 0',color:'#0f172a'}}>Accounts Payable</h2>
            <p style={{margin:0,color:'#64748b',fontSize:14}}>Capture vendor bills, apply tax rules, and maintain a clean payable register.</p>
          </div>
          <button
            type="button"
            onClick={handleDownloadReport}
            style={{
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontWeight: 700,
              borderRadius: 10,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            Download Report
          </button>
        </div>
      </div>

      <div style={{display:'flex',gap:24,flexWrap:'wrap',marginBottom:30}}>
        <div style={{flex:'1 1 320px',background:'#fff',border:'2px dashed #dbe4ee',borderRadius:18,padding:40,textAlign:'center',boxShadow:'0 12px 30px rgba(15,23,42,.06)'}}>
          <h3>Upload Vendor Invoice</h3>
          <p style={{color:'#64748b'}}>Upload PDF or image. AI extracts everything automatically.</p>
          <input type="file" accept=".pdf,image/*" onChange={handleFileUpload}/>
          {ocrLoading&&<div style={{marginTop:16,display:'inline-block',padding:'12px 18px',background:'#eff6ff',borderRadius:12,color:'#2563eb',fontWeight:600}}>Scanning document…</div>}
          {!ocrLoading && ocrStatus.message && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: ocrStatus.type === 'success' ? '1px solid #86efac' : ocrStatus.type === 'warning' ? '1px solid #fcd34d' : '1px solid #fecaca',
                background: ocrStatus.type === 'success' ? '#f0fdf4' : ocrStatus.type === 'warning' ? '#fffbeb' : '#fef2f2',
                color: ocrStatus.type === 'success' ? '#166534' : ocrStatus.type === 'warning' ? '#92400e' : '#991b1b',
              }}
            >
              {ocrStatus.message}
            </div>
          )}
        </div>

        <div style={{flex:'2 1 500px',background:'linear-gradient(165deg, #ffffff, #f8fbff)',borderRadius:18,padding:32,boxShadow:'0 14px 35px rgba(15,23,42,.07)',border:'1px solid #e2e8f0'}}>
          <h3 style={{marginTop:0}}>Verify & Apply Tax</h3>
          <form onSubmit={handleSaveInvoice} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {[
              ['Vendor Name','vendor_name','text'],
              ['Invoice #','bill_number','text'],
              ['Invoice Date','bill_date','date'],
              ['Total Amount','amount','number'],
              ['GST Total','gst_amount','number']
            ].map(([label,name,type])=>(
              <div key={name}>
                <label style={{display:'block',fontSize:12,fontWeight:700,textTransform:'uppercase',color:'#64748b',marginBottom:8}}>{label}</label>
                <input type={type} name={name} value={formData[name]} onChange={handleInputChange} style={inputStyle}/>
              </div>
            ))}
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:700,textTransform:'uppercase',color:'#64748b',marginBottom:8}}>TDS Rule</label>
              <select name="tds_section" value={formData.tds_section} onChange={handleInputChange} style={inputStyle}>
                <option value="NONE">No TDS</option>
                <option value="194C_IND">194C Individual</option>
                <option value="194C_CORP">194C Corporate</option>
                <option value="194J_TECH">194J Tech</option>
                <option value="194J_PROF">194J Professional</option>
              </select>
            </div>

            <button type="submit" style={{gridColumn:'span 2',height:52,border:'none',borderRadius:12,background:'#0f172a',color:'#fff',fontWeight:700,cursor:'pointer'}}>Approve & Save Bill</button>
          </form>
        </div>
      </div>

      <div style={{background:'#fff',borderRadius:18,overflow:'hidden',boxShadow:'0 12px 30px rgba(15,23,42,.05)',border:'1px solid #e2e8f0'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{background:'#f8fafc'}}>
            <tr>
              {['Vendor','Bill #','Due Date','Gross','TDS','Net','Status','Actions'].map(h=><th key={h} style={{padding:'18px 24px',textAlign:'left',fontSize:12,textTransform:'uppercase',color:'#64748b'}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv=>{
              const vendor=inv.cashflow_entities?.name||'N/A';
              const net=(+inv.amount||0)-(+inv.tds_amount||0);
              const pending = inv.status === 'pending';
              const approving = approvingId === inv.id;
              return <tr key={inv.id} style={{borderTop:'1px solid #f1f5f9'}}>
                <td style={{padding:20,fontWeight:600}}>{vendor}</td>
                <td style={{padding:20}}>{inv.bill_number}</td>
                <td style={{padding:20}}>{inv.due_date}</td>
                <td style={{padding:20,fontWeight:600}}>₹{(+inv.amount||0).toLocaleString('en-IN')}</td>
                <td style={{padding:20,color:'#dc2626'}}>-₹{(+inv.tds_amount||0).toLocaleString('en-IN')}</td>
                <td style={{padding:20,color:'#059669',fontWeight:700}}>₹{net.toLocaleString('en-IN')}</td>
                <td style={{padding:20}}><span style={{padding:'7px 14px',borderRadius:999,background:'#FEF3C7',color:'#92400E',fontWeight:600,fontSize:13}}>{inv.status}</span></td>
                <td style={{padding:20}}>
                  {pending ? (
                    <button
                      type="button"
                      onClick={() => handleApproveBill(inv.id)}
                      disabled={approving}
                      style={{
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontWeight: 700,
                        cursor: approving ? 'not-allowed' : 'pointer',
                        background: approving ? '#94a3b8' : '#2563eb',
                        color: '#fff',
                      }}
                    >
                      {approving ? 'Approving...' : 'Approve'}
                    </button>
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 13 }}>-</span>
                  )}
                </td>
              </tr>
            })}
            {!loading&&invoices.length===0&&<tr><td colSpan="8" style={{padding:40,textAlign:'center',color:'#64748b'}}>No AP bills recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
