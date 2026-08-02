import { Briefcase, CheckCircle2, Users } from "lucide-react";

function formatCount(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-IN").format(safe);
}

const METRIC_CARDS = [
  {
    key: "jobs_posted_total",
    label: "Jobs Posted",
    icon: Briefcase,
    labelClass: "text-slate-600",
    valueClass: "text-red-600",
    iconBg: "bg-sky-100",
    iconText: "text-sky-700",
    cardTone: "from-white via-sky-50/70 to-blue-50/85",
  },
  {
    key: "resumes_received_total",
    label: "Resumes Applied",
    icon: Users,
    labelClass: "text-slate-600",
    valueClass: "text-blue-700",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
    cardTone: "from-white via-blue-50/70 to-sky-50/85",
  },
  {
    key: "shortlisted_total",
    label: "Shortlisted",
    icon: CheckCircle2,
    labelClass: "text-slate-600",
    valueClass: "text-green-500",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-700",
    cardTone: "from-white via-indigo-50/70 to-blue-50/85",
  },
];

export default function LivePipelineMetrics({ metrics }) {
  const safeMetrics = {
    jobs_posted_total: Number(metrics?.jobs_posted_total || 0),
    departments_count: Number(metrics?.departments_count || 0),
    resumes_received_total: Number(metrics?.resumes_received_total || 0),
    resumes_last_24h: Number(metrics?.resumes_last_24h || 0),
    shortlisted_total: Number(metrics?.shortlisted_total || 0),
  };

  const footerByCard = {
    jobs_posted_total: `Across ${formatCount(safeMetrics.departments_count)} departments`,
    resumes_received_total: `+${formatCount(safeMetrics.resumes_last_24h)} in the last 24h`,
    shortlisted_total: "Efficiency: 23% shortlisting conversion",
  };

  return (
    <div className="relative my-8 w-full max-w-6xl mx-auto p-0">

      <div className="relative mb-4 flex items-center gap-3">
        <div className="relative flex items-center gap-2.5 rounded-full border border-sky-200 bg-white/90 px-3.5 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          </span>
          <span className="h-px w-8 bg-gradient-to-r from-sky-500/70 to-transparent" />
          <h3 className="text-[11px] font-semibold tracking-[0.22em] text-slate-700 uppercase">
            Live AI Pipeline Active
          </h3>
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
        <div className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-1/2 hidden md:block h-px -translate-y-1/2 bg-gradient-to-r from-sky-300/0 via-sky-300/55 to-sky-300/0" />

        {METRIC_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.key}
              className={`group relative overflow-hidden rounded-[1.3rem] border border-sky-100 bg-gradient-to-br ${card.cardTone} px-4 py-3 md:px-4 md:py-3 shadow-[0_8px_22px_rgba(148,163,184,0.12)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_14px_32px_rgba(14,165,233,0.20)]`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.08)_42%,rgba(255,255,255,0.22))]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500/70 via-blue-500/70 to-indigo-500/65" />
              <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-sky-200/45 blur-2xl transition-transform duration-300 group-hover:scale-125" />

              <div className="relative flex h-full flex-col justify-between gap-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[12px] font-medium uppercase tracking-[0.18em] ${card.labelClass}`}>{card.label}</p>
                    <p className={`mt-2 text-[2.15rem] font-black leading-none ${card.valueClass}`}>
                      {formatCount(safeMetrics[card.key])}
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-2xl border border-white/10 ${card.iconBg} p-2.5 ${card.iconText} shadow-[0_0_20px_rgba(255,255,255,0.05)]`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                {footerByCard[card.key] ? (
                  <div className="relative mt-auto rounded-full border border-sky-200 bg-white/85 px-2.5 py-1.5 text-center text-[10px] font-medium text-sky-700">
                    <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/85 to-transparent" />
                    {footerByCard[card.key]}
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent" />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
