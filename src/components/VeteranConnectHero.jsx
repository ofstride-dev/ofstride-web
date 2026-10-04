import { useEffect, useRef, useState } from 'react'

const scenes = [
  { title: 'AI Military Skill Translator', subtitle: 'Turn service experience into civilian language', nav: 'Profile' },
  { title: 'Translated Results', subtitle: 'Civilian titles, skills, industries - all mapped', nav: 'Profile' },
  { title: 'Live Job Targets', subtitle: 'Real roles, scored against your profile', nav: 'Jobs & ATS' },
  { title: 'ATS Alignment', subtitle: 'Every weighted signal, broken down', nav: 'Jobs & ATS' },
  { title: 'Resume Builder', subtitle: 'Close the gap with one click', nav: 'Resume Builder' },
]

export default function VeteranConnectHero() {
  const [scene, setScene] = useState(0)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    let timer
    const run = async () => {
      while (!cancelled.current) {
        for (let next = 0; next < scenes.length && !cancelled.current; next += 1) {
          setScene(next)
          await new Promise((resolve) => { timer = window.setTimeout(resolve, next === 1 || next === 3 ? 3100 : 2400) })
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
    <div className="veteran-hero-widget" aria-label="Veteran Connect product walkthrough">
      <div className="veteran-app-top">
        <div className="veteran-brand"><span className="veteran-brand-bars"><i /><i /><i /><i /></span><b>OFSTRIDE<small>SERVICES LLP</small></b></div>
        <div className="veteran-nav"><span>Workspace</span><span className={scene < 2 ? 'is-active' : ''}>Profile</span><span className={scene >= 2 ? 'is-active' : ''}>Jobs &amp; ATS</span><span className={scene === 4 ? 'is-active' : ''}>Resume Builder</span></div>
        <div className="veteran-user"><span>••</span><small><b>Candidate profile</b>Personal details masked</small></div>
      </div>
      <div className="veteran-heading"><b>{scenes[scene].title}</b><small>{scenes[scene].subtitle}</small></div>
      <div className="veteran-stage">
        {scene === 0 && <div className="veteran-scene veteran-translator"><div className="veteran-input"><small>Military experience</small><b>Led a cross-functional field operations team of 24 personnel</b><span>Service record loaded</span></div><div className="veteran-translate-button">✦ Translating experience...</div><div className="veteran-cursor">⌁</div></div>}
        {scene === 1 && <div className="veteran-scene veteran-results"><div className="veteran-result-card"><small>CIVILIAN TITLE</small><b>Operations Team Lead</b><small>TRANSFERABLE SKILLS</small><div><em>Team leadership</em><em>Resource planning</em><em>Risk management</em></div></div><div className="veteran-result-card"><small>RECOMMENDED INDUSTRIES</small><b>Operations · Logistics · Security</b><div className="veteran-save-pill">✓ Saved to Resume &amp; Profile</div></div></div>}
        {scene === 2 && <div className="veteran-scene veteran-jobs"><div className="veteran-job-card"><span>92% MATCH</span><b>Operations Manager</b><small>Indian logistics company · Bengaluru</small><div><i>Leadership</i><i>Process design</i><i>Team operations</i></div><button>Score against my profile</button></div><div className="veteran-job-card is-muted"><span>78% MATCH</span><b>Workforce Operations Lead</b><small>Technology services · Mumbai</small></div></div>}
        {scene === 3 && <div className="veteran-scene veteran-breakdown"><div className="veteran-breakdown-score"><small>ATS ALIGNMENT SCORE</small><strong>84%</strong><div className="veteran-score-bar"><i /></div></div><div className="veteran-breakdown-list"><span><b>Skills match</b><strong>92%</strong></span><span><b>Experience relevance</b><strong>86%</strong></span><span><b>Education alignment</b><strong>71%</strong></span><span><b>Keywords detected</b><strong>78%</strong></span></div></div>}
        {scene === 4 && <div className="veteran-scene veteran-resume"><div className="veteran-resume-page"><small>ATS-READY RESUME</small><b>Candidate profile</b><span>OPERATIONS LEAD · PEOPLE · PROCESS</span><hr /><i /><i /><i /><i /></div><div className="veteran-build-button">Build ATS resume <strong>→</strong></div><div className="veteran-build-pill">✓ New resume built - scores improved</div></div>}
      </div>
      <div className="veteran-dots">{scenes.map((item, index) => <span key={item.title} className={index === scene ? 'is-active' : ''} />)}</div>
    </div>
  )
}
