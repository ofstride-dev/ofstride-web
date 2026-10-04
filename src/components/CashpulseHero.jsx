import { useEffect, useRef, useState } from 'react'

const scenes = [
  { title: 'Accounts Payable', subtitle: 'Capture vendor bills and apply tax rules' },
  { title: 'Bank Reconcile', subtitle: 'Match statements against your ledger' },
  { title: 'AI Financial Analyst', subtitle: 'Ask your ledger questions in plain English' },
]

export default function CashpulseHero() {
  const [scene, setScene] = useState(0)
  const [typed, setTyped] = useState('')
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    let timer
    const run = async () => {
      while (!cancelled.current) {
        for (let next = 0; next < scenes.length; next += 1) {
          setScene(next)
          if (next === 2) {
            const question = 'what is my net movement for this week?'
            setTyped('')
            for (let i = 1; i <= question.length && !cancelled.current; i += 1) {
              setTyped(question.slice(0, i))
              await new Promise((resolve) => { timer = window.setTimeout(resolve, 22) })
            }
          }
          await new Promise((resolve) => { timer = window.setTimeout(resolve, 2100) })
        }
      }
    }
    run()
    return () => {
      cancelled.current = true
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="cashpulse-hero-widget" aria-label="CashPulse product walkthrough">
      <div className="cashpulse-sidebar">
        <div className="cashpulse-logo">OS</div>
        {['▦', '↓', '↑', '↻', '▣'].map((icon, index) => (
          <span key={icon} className={`cashpulse-side-icon ${scene === index - 1 || (scene === 2 && index === 0) ? 'is-active' : ''}`}>{icon}</span>
        ))}
      </div>
      <div className="cashpulse-main">
        <div className="cashpulse-header">
          <div><strong>{scenes[scene].title}</strong><small>{scenes[scene].subtitle}</small></div>
          <span className="cashpulse-avatar">YS</span>
        </div>
        <div className="cashpulse-metrics">
          <span><small>Cash Collected</small><b>₹11,275</b></span>
          <span><small>Cash Disbursed</small><b>₹4,711</b></span>
          <span><small>Accounts Payable</small><b>₹46,030</b></span>
        </div>
        <div className="cashpulse-stage">
          {scene === 0 && (
            <div className="cashpulse-scene">
              <div className="cashpulse-upload"><b>↑ Upload Vendor Invoice</b><button>Choose File</button><small>AI extracts everything automatically</small></div>
              <div className="cashpulse-fields">{['Vendor Name', 'Invoice #', 'Invoice Date', 'GST Total', 'Gross Total', 'Tax Rules'].map((field, index) => <span key={field} style={{ animationDelay: `${index * 120}ms` }}><small>{field}</small><b>{['Acme Corp', 'INV-08471', '12/08/2026', '₹7,401.6', '₹48,521.6', 'Applied'][index]}</b></span>)}</div>
              <div className="cashpulse-primary">✓ Approve &amp; Save Bill</div>
            </div>
          )}
          {scene === 1 && (
            <div className="cashpulse-scene">
              <b className="cashpulse-scene-title">Bank Statement Reconcile</b><small>Compare bank receipts with AP / AR / Petty Cash records</small>
              <div className="cashpulse-parse"><span>bank_statement_aug2026.csv</span><button>Run Statement Parse</button></div>
              <div className="cashpulse-stats"><b>32<small>Matched</small></b><b>9<small>Mismatch</small></b><b>6<small>Missing</small></b><b>47<small>Platform Rows</small></b></div>
              <div className="cashpulse-rows"><span>IndianOil <em>₹904.52</em><i>Missing in bank</i></span><span>Acme Corp <em>₹12,900</em><i>Matched</i></span><span>Nova Traders <em>₹500.00</em><i>Amount mismatch</i></span></div>
            </div>
          )}
          {scene === 2 && (
            <div className="cashpulse-scene">
              <b className="cashpulse-ai-title">✦ Ofstride Intelligence</b><strong>AI Financial Analyst</strong>
              <div className="cashpulse-question">{typed}<span className="cashpulse-caret" /></div>
              <div className="cashpulse-primary">Analysing…</div>
              <div className="cashpulse-result"><small>Net movement this week</small><b>−₹27,700.3</b></div>
            </div>
          )}
        </div>
        <div className="cashpulse-dots">{scenes.map((item, index) => <span key={item.title} className={index === scene ? 'is-active' : ''} />)}</div>
      </div>
    </div>
  )
}
