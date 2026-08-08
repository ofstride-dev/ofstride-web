import { Outlet } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import BusinessGrowthNav from "./BusinessGrowthNav";

export default function BusinessGrowthLayout() {
	return (
		<div className="pt-12 sm:pt-16 min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.10),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.08),transparent_42%),#f8fafc]">
			<section className="py-10 sm:py-14">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-6 sm:mb-8 rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm px-5 sm:px-7 py-5 sm:py-6">
						<div className="flex items-start gap-3">
							<div className="w-11 h-11 rounded-xl bg-blue-50 text-secondary flex items-center justify-center shrink-0">
								<BarChart3 className="w-5 h-5" />
							</div>
							<div>
								<p className="text-sm font-semibold uppercase tracking-wider text-secondary mb-2">Solutions</p>
								<h1 className="text-3xl sm:text-4xl font-bold text-primary">Growth Execution Planner</h1>
								<p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-secondary mt-2">From Audit to Execution Plan</p>
								<p className="text-text mt-3 max-w-3xl">
									A structured growth engine from intake to consultant-approved roadmap.
									Track maturity, resolve blockers, and execute measurable growth actions.
								</p>
							</div>
						</div>
					</div>

					<BusinessGrowthNav />

					<div className="mt-6 sm:mt-8">
						<Outlet />
					</div>
				</div>
			</section>
		</div>
	);
}
