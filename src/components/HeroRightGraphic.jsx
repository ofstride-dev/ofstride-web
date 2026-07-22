import { motion } from 'framer-motion';
import {
  FileText,
  Landmark,
  Users,
  ScrollText,
  BrainCircuit,
  Sparkles,
} from 'lucide-react';

const NODES = [
  {
    id: 1, label: 'GST, TDS & ITR filings', short: 'FILINGS', tag: 'TX-01', icon: FileText,
    color: 'text-cyan-400', stroke: '#22d3ee', border: 'group-hover:border-cyan-500/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(34,211,238,0.45)]', angle: -90,
  },
  {
    id: 2, label: 'Udyam, loans & schemes', short: 'UDYAM', tag: 'FN-02', icon: Landmark,
    color: 'text-blue-400', stroke: '#60a5fa', border: 'group-hover:border-blue-500/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(96,165,250,0.45)]', angle: -18,
  },
  {
    id: 3, label: 'Payroll, PF/ESI & policies', short: 'PAYROLL', tag: 'HR-03', icon: Users,
    color: 'text-emerald-400', stroke: '#34d399', border: 'group-hover:border-emerald-500/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(52,211,153,0.45)]', angle: 54,
  },
  {
    id: 4, label: 'Contracts & MSMED recovery', short: 'LEGAL', tag: 'LG-04', icon: ScrollText,
    color: 'text-fuchsia-400', stroke: '#e879f9', border: 'group-hover:border-fuchsia-500/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(232,121,249,0.45)]', angle: 198,
  },
  {
    id: 5, label: 'Practical AI & systems', short: 'AI CORE', tag: 'AI-05', icon: BrainCircuit,
    color: 'text-violet-400', stroke: '#a78bfa', border: 'group-hover:border-violet-500/50',
    glow: 'group-hover:shadow-[0_0_24px_rgba(167,139,250,0.45)]', angle: 126,
  },
];

const TICK_COUNT = 72;
const C = 200;        // SVG center
const R = 170;        // orbit radius (matches node x/y)
const END = 124;      // line endpoint distance (lands at node box edge)
const CURVE = 22;     // bezier control offset

function nodeGeom(angle) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ex = C + END * cos;
  const ey = C + END * sin;
  const midX = C + (END / 2) * cos;
  const midY = C + (END / 2) * sin;
  const ctrlX = midX - CURVE * sin;
  const ctrlY = midY + CURVE * cos;
  return { ex, ey, path: `M${C} ${C} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}` };
}

const SATELLITES = [
  { angle: 20, r: 150 },
  { angle: 150, r: 150 },
  { angle: 280, r: 150 },
];

export default function HeroRightGraphic() {
  return (
    <div className="relative w-full min-h-[480px] sm:min-h-[620px] flex items-center justify-center p-4 overflow-hidden select-none">
      {/* --- BACKGROUND: dot grid + ambient glow --- */}
      <div
        className="absolute inset-0 opacity-[0.18] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(148,163,184,0.4) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-gradient-to-tr from-cyan-500/10 via-violet-500/10 to-transparent rounded-full blur-3xl opacity-70" />
      </div>

      {/* --- RADAR SWEEP --- */}
      <div className="absolute w-[400px] h-[400px] rounded-full pointer-events-none animate-[spin_6s_linear_infinite]"
        style={{
          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.14) 28deg, transparent 60deg, transparent 360deg)',
          maskImage: 'radial-gradient(circle, transparent 40px, black 60px, black 195px, transparent 210px)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 40px, black 60px, black 195px, transparent 210px)',
        }}
      />

      {/* --- RADAR RINGS + TICK RING + CROSSHAIRS --- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute flex items-center justify-center pointer-events-none"
      >
        <div className="w-[230px] h-[230px] rounded-full border border-white/[0.06] border-dashed animate-[spin_60s_linear_infinite]" />
        <div className="absolute w-[340px] h-[340px] rounded-full border border-white/[0.08]" />
        {/* Tick ring */}
        <div className="absolute w-[470px] h-[470px] animate-[spin_90s_linear_infinite_reverse]">
          <svg viewBox="0 0 470 470" className="w-full h-full">
            {Array.from({ length: TICK_COUNT }).map((_, i) => {
              const a = (i / TICK_COUNT) * Math.PI * 2;
              const major = i % 6 === 0;
              const inner = 228;
              const outer = major ? 234 : 231;
              const x1 = 235 + inner * Math.cos(a);
              const y1 = 235 + inner * Math.sin(a);
              const x2 = 235 + outer * Math.cos(a);
              const y2 = 235 + outer * Math.sin(a);
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,255,255,0.13)"
                  strokeWidth={major ? 1.3 : 0.6}
                />
              );
            })}
          </svg>
        </div>
        <div className="absolute w-[490px] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute h-[490px] w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      </motion.div>

      {/* --- MAIN CONSTELLATION (fixed 400x400, scaled on mobile) --- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[400px] h-[400px] scale-[0.82] sm:scale-100 flex items-center justify-center"
      >
        {/* --- SVG: curved paths, flow, packets, core arcs, satellites --- */}
        <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
          <defs>
            {NODES.map((n) => (
              <linearGradient key={`grad-${n.id}`} id={`grad-${n.id}`} x1="200" y1="200" x2="400" y2="200" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.08" />
                <stop offset="100%" stopColor={n.stroke} stopOpacity="0.8" />
              </linearGradient>
            ))}
            {NODES.map((n) => (
              <marker key={`arr-${n.id}`} id={`arr-${n.id}`} markerWidth="9" markerHeight="9"
                refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L6,3 L0,6 Z" fill={n.stroke} opacity="0.85" />
              </marker>
            ))}
          </defs>

          {/* Curved connectors with draw-on + arrowhead */}
          {NODES.map((node) => {
            const g = nodeGeom(node.angle);
            return (
              <motion.path
                key={`line-${node.id}`}
                d={g.path}
                fill="none"
                stroke={`url(#grad-${node.id})`}
                strokeWidth="1.6"
                markerEnd={`url(#arr-${node.id})`}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1, delay: 0.5 + node.id * 0.1 }}
              />
            );
          })}

          {/* Animated flow overlay on each curve */}
          {NODES.map((node) => {
            const g = nodeGeom(node.angle);
            return (
              <motion.path
                key={`flow-${node.id}`}
                d={g.path}
                fill="none"
                stroke={node.stroke}
                strokeWidth="2"
                strokeDasharray="3 10"
                opacity={0.45}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: [-26, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
              />
            );
          })}

          {/* Traveling data packets along each curve */}
          {NODES.map((node) => {
            const g = nodeGeom(node.angle);
            return (
              <g key={`pkt-${node.id}`}>
                <circle r="2.6" fill={node.stroke} opacity="0.9">
                  <animateMotion dur="2.4s" begin={`${node.id * 0.3}s`} repeatCount="indefinite" path={g.path} />
                </circle>
                <circle r="1.6" fill={node.stroke} opacity="0.6">
                  <animateMotion dur="2.4s" begin={`${node.id * 0.3 + 1.2}s`} repeatCount="indefinite" path={g.path} />
                </circle>
              </g>
            );
          })}

          {/* Rotating arc rings around core */}
          <motion.g style={{ transformOrigin: '200px 200px' }}
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 22, ease: 'linear' }}>
            <circle cx="200" cy="200" r="74" fill="none" stroke="#22d3ee" strokeWidth="1.4"
              strokeDasharray="90 374" strokeLinecap="round" opacity="0.55" />
          </motion.g>
          <motion.g style={{ transformOrigin: '200px 200px' }}
            animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 30, ease: 'linear' }}>
            <circle cx="200" cy="200" r="86" fill="none" stroke="#a78bfa" strokeWidth="1.2"
              strokeDasharray="130 410" strokeLinecap="round" opacity="0.5" />
          </motion.g>

          {/* Orbiting satellite dots on mid ring */}
          <motion.g style={{ transformOrigin: '200px 200px' }}
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}>
            {SATELLITES.map((s, i) => {
              const rad = (s.angle * Math.PI) / 180;
              const x = 200 + s.r * Math.cos(rad);
              const y = 200 + s.r * Math.sin(rad);
              return <circle key={i} cx={x} cy={y} r="1.8" fill="#94a3b8" opacity="0.7" />;
            })}
          </motion.g>
        </svg>

        {/* --- CENTRAL CORE NODE --- */}
        <motion.div
          animate={{ y: [-3, 3, -3] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
          className="relative z-20 group cursor-pointer"
        >
          <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-cyan-500/30 via-violet-500/30 to-blue-500/30 blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
          {/* HUD corner brackets */}
          <div className="absolute -inset-3 pointer-events-none">
            {['-top-1 -left-1 border-l-2 border-t-2', '-top-1 -right-1 border-r-2 border-t-2', '-bottom-1 -left-1 border-l-2 border-b-2', '-bottom-1 -right-1 border-r-2 border-b-2'].map((c) => (
              <div key={c} className={`absolute ${c} w-4 h-4 rounded-sm border-cyan-400/60`} />
            ))}
          </div>
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.25)] group-hover:shadow-[0_0_60px_rgba(139,92,246,0.4)] transition-all duration-500">
            <Sparkles className="w-9 h-9 text-cyan-400 group-hover:text-violet-400 transition-colors duration-300 animate-[spin_12s_linear_infinite]" />
            <span className="text-[12px] font-mono tracking-widest text-slate-100 mt-2 uppercase font-semibold text-center leading-tight px-1">
              Ofstride<br />Core Engine
            </span>
            <span className="text-[8px] font-mono tracking-[0.3em] text-cyan-300/70 uppercase mt-1">v2.4</span>
          </div>
        </motion.div>

        {/* --- 5 PERIPHERAL NODES --- */}
        {NODES.map((node, index) => {
          const rad = (node.angle * Math.PI) / 180;
          const x = R * Math.cos(rad);
          const y = R * Math.sin(rad);
          const Icon = node.icon;
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: 1, x, y }}
              transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.2 + index * 0.1 }}
              className="absolute z-10"
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 7 + index, ease: 'easeInOut', delay: index * 0.5 }}
                className="group relative cursor-pointer flex flex-col items-center"
              >
                {/* HUD corner brackets (on hover) */}
                <div className="absolute -inset-2 pointer-events-none">
                  {['-top-1 -left-1 border-l border-t', '-top-1 -right-1 border-r border-t', '-bottom-1 -left-1 border-l border-b', '-bottom-1 -right-1 border-r border-b'].map((c) => (
                    <div key={c} className={`absolute ${c} w-2.5 h-2.5 border-white/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  ))}
                </div>
                <div className={`w-[94px] h-[94px] sm:w-[104px] sm:h-[104px] rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center gap-1.5 px-2 transition-all duration-300 ${node.border} ${node.glow} group-hover:scale-105 group-hover:bg-slate-800/90`}>
                  {/* top accent bar */}
                  <div className={`h-[2px] w-7 rounded-full bg-current ${node.color} opacity-60 group-hover:opacity-100 group-hover:w-10 transition-all duration-300`} />
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 ${node.color} transition-transform duration-300 group-hover:scale-110`} />
                  <span className="text-[10.5px] sm:text-[11.5px] font-medium text-slate-100 text-center leading-tight">{node.label}</span>
                  <span className="text-[8px] font-mono tracking-[0.25em] text-slate-500 uppercase">{node.short} · {node.tag}</span>
                </div>
                {/* Active connection indicator dot */}
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-slate-950 flex items-center justify-center">
                  <div className={`w-1.5 h-1.5 rounded-full bg-current ${node.color} animate-pulse`} />
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
