// AccountsPayable.jsx
// Premium UI version.
// NOTE: Business logic is unchanged from your original file.
// Replace this file with your existing logic if you've made changes after sharing it.

import React, { useState, useEffect } from 'react';

export default function AccountsPayable() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ocrLoading, setOcrLoading] = useState(false);

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
      const res = await fetch('/api/cashflow/ap/list');
      const json = await res.json();
      if (json.ok) setInvoices(json.data || []);
    } finally { setLoading(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const res = await fetch('/api/cashflow/ap/ocr',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({file:reader.result})
        });
        const json=await res.json();
        if(json.ok) setFormData(p=>({...p,...json.data}));
      } finally { setOcrLoading(false); }
    };
  };

  const handleInputChange=e=>setFormData({...formData,[e.target.name]:e.target.value});

  const handleSaveInvoice=async(e)=>{
    e.preventDefault();
    const res=await fetch('/api/cashflow/ap/save',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(formData)
    });
    const json=await res.json();
    if(json.ok){
      setInvoices([json.data,...invoices]);
      setFormData({vendor_name:'',bill_number:'',bill_date:'',amount:'',gst_amount:'',tds_section:'NONE'});
    }
  };

  const inputStyle={
    width:'100%',height:48,padding:'0 16px',border:'1px solid #dbe4ee',
    borderRadius:12,fontSize:15,outline:'none',boxSizing:'border-box'
  };

  return (
    <div style={{maxWidth:1280,margin:'0 auto',padding:32}}>
      <h2 style={{fontSize:32,fontWeight:700,marginBottom:28,color:'#0f172a'}}>Accounts Payable</h2>

      <div style={{display:'flex',gap:24,flexWrap:'wrap',marginBottom:30}}>
        <div style={{flex:'1 1 320px',background:'#fff',border:'2px dashed #dbe4ee',borderRadius:18,padding:40,textAlign:'center',boxShadow:'0 8px 30px rgba(15,23,42,.05)'}}>
          <h3>Upload Vendor Invoice</h3>
          <p style={{color:'#64748b'}}>Upload PDF or image. AI extracts everything automatically.</p>
          <input type="file" accept=".pdf,image/*" onChange={handleFileUpload}/>
          {ocrLoading&&<div style={{marginTop:16,display:'inline-block',padding:'12px 18px',background:'#eff6ff',borderRadius:12,color:'#2563eb',fontWeight:600}}>Scanning document…</div>}
        </div>

        <div style={{flex:'2 1 500px',background:'#fff',borderRadius:18,padding:32,boxShadow:'0 10px 35px rgba(15,23,42,.06)'}}>
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

      <div style={{background:'#fff',borderRadius:18,overflow:'hidden',boxShadow:'0 10px 35px rgba(15,23,42,.05)'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead style={{background:'#f8fafc'}}>
            <tr>
              {['Vendor','Bill #','Due Date','Gross','TDS','Net','Status'].map(h=><th key={h} style={{padding:'18px 24px',textAlign:'left',fontSize:12,textTransform:'uppercase',color:'#64748b'}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv=>{
              const vendor=inv.cashflow_entities?.name||'N/A';
              const net=(+inv.amount||0)-(+inv.tds_amount||0);
              return <tr key={inv.id} style={{borderTop:'1px solid #f1f5f9'}}>
                <td style={{padding:20,fontWeight:600}}>{vendor}</td>
                <td style={{padding:20}}>{inv.bill_number}</td>
                <td style={{padding:20}}>{inv.due_date}</td>
                <td style={{padding:20,fontWeight:600}}>₹{(+inv.amount||0).toLocaleString('en-IN')}</td>
                <td style={{padding:20,color:'#dc2626'}}>-₹{(+inv.tds_amount||0).toLocaleString('en-IN')}</td>
                <td style={{padding:20,color:'#059669',fontWeight:700}}>₹{net.toLocaleString('en-IN')}</td>
                <td style={{padding:20}}><span style={{padding:'7px 14px',borderRadius:999,background:'#FEF3C7',color:'#92400E',fontWeight:600,fontSize:13}}>{inv.status}</span></td>
              </tr>
            })}
            {!loading&&invoices.length===0&&<tr><td colSpan="7" style={{padding:40,textAlign:'center',color:'#64748b'}}>No AP bills recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
