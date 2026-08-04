import { useState } from "react";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import { submitBusinessGrowthIntake } from "../../services/businessGrowthApi";
import { mergeGrowthJourneyState } from "../../components/business_growth/shared/businessGrowthTypes";

export default function BusinessGrowthIntakePage() {
	const [form, setForm] = useState({
		name: "",
		domain: "",
		industry: "",
		target_geo: "India",
		growth_goal: "",
		contact_name: "",
		contact_email: "",
		contact_phone: "",
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ business_profile_id: string; assessment_session_id: string } | null>(null);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;
		setForm((prev) => ({ ...prev, [name]: value }));
	};

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const response = await submitBusinessGrowthIntake({
				...form,
				current_channels: [],
			});
			setResult(response);
			mergeGrowthJourneyState({
				businessProfileId: response.business_profile_id,
				assessmentSessionId: response.assessment_session_id,
			});
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Unable to submit intake at the moment.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="grid lg:grid-cols-3 gap-6">
			<section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
				<div className="flex items-center gap-3 mb-5">
					<div className="w-10 h-10 rounded-xl bg-blue-50 text-secondary flex items-center justify-center">
						<Building2 className="w-5 h-5" />
					</div>
					<div>
						<h2 className="text-xl font-bold text-primary">Business Intake</h2>
						<p className="text-sm text-slate-500">Capture your baseline so analysis can be accurate.</p>
					</div>
				</div>

				<form className="space-y-4" onSubmit={onSubmit}>
					<div className="grid sm:grid-cols-2 gap-4">
						<label className="text-sm font-medium text-primary">
							Business Name
							<input name="name" required value={form.name} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
						<label className="text-sm font-medium text-primary">
							Website Domain
							<input name="domain" required value={form.domain} onChange={handleChange} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
					</div>

					<div className="grid sm:grid-cols-2 gap-4">
						<label className="text-sm font-medium text-primary">
							Industry
							<input name="industry" value={form.industry} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
						<label className="text-sm font-medium text-primary">
							Target Geography
							<input name="target_geo" value={form.target_geo} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
					</div>

					<label className="text-sm font-medium text-primary">
						Growth Goal
						<textarea name="growth_goal" value={form.growth_goal} onChange={handleChange} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Example: increase inbound leads by 40% in 90 days" />
					</label>

					<div className="grid sm:grid-cols-3 gap-4">
						<label className="text-sm font-medium text-primary sm:col-span-1">
							Contact Name
							<input name="contact_name" required value={form.contact_name} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
						<label className="text-sm font-medium text-primary sm:col-span-1">
							Contact Email
							<input type="email" name="contact_email" required value={form.contact_email} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
						<label className="text-sm font-medium text-primary sm:col-span-1">
							Contact Phone
							<input name="contact_phone" value={form.contact_phone} onChange={handleChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
						</label>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-light disabled:opacity-70"
					>
						{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
						Create Assessment Session
					</button>
				</form>

				{error && <p className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
			</section>

			<aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-fit">
				<h3 className="font-semibold text-primary">Current Session</h3>
				{!result ? (
					<p className="text-sm text-slate-500 mt-2">No assessment session yet. Submit the form to continue.</p>
				) : (
					<div className="mt-3 space-y-3">
						<div className="flex items-start gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
							<CheckCircle2 className="w-4 h-4 mt-0.5" />
							<p className="text-sm font-medium">Session created successfully.</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wide text-slate-500">Business Profile ID</p>
							<p className="text-sm font-medium text-primary break-all">{result.business_profile_id}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wide text-slate-500">Assessment Session ID</p>
							<p className="text-sm font-medium text-primary break-all">{result.assessment_session_id}</p>
						</div>
					</div>
				)}
			</aside>
		</div>
	);
}
