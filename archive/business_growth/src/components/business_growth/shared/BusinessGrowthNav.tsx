import { Link, useLocation } from "react-router-dom";
import { BUSINESS_GROWTH_STEPS } from "./businessGrowthTypes";

function isActivePath(currentPath: string, targetPath: string): boolean {
	if (targetPath === "/business-growth") {
		return currentPath === targetPath;
	}
	return currentPath.startsWith(targetPath);
}

export default function BusinessGrowthNav() {
	const location = useLocation();

	return (
		<div className="rounded-2xl bg-white/95 border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-2 sm:p-3 overflow-x-auto backdrop-blur-sm">
			<nav className="flex items-center gap-2 min-w-max">
				{BUSINESS_GROWTH_STEPS.map((step) => {
					const isActive = isActivePath(location.pathname, step.path);
					return (
						<Link
							key={step.path}
							to={step.path}
							className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
								isActive
									? "bg-primary text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]"
									: "text-text hover:bg-slate-100"
							}`}
							title={step.shortDescription}
						>
							{step.label}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
