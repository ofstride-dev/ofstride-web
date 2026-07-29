/**
 * Renders a structured ResumeData object as a clean, readable resume preview.
 * Used for both the master resume and AI-tailored versions.
 */

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="border-t border-slate-200 pt-3 mt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Bullets({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="list-disc list-inside space-y-0.5 text-sm text-text">
      {items.map((line, i) => (
        <li key={i} className="leading-snug">{String(line || "")}</li>
      ))}
    </ul>
  );
}

export default function ResumePreview({ resume, className = "" }) {
  if (!resume) {
    return <p className="text-sm text-muted">No resume to preview.</p>;
  }

  const pi = resume.personalInfo || {};
  const work = Array.isArray(resume.workExperience) ? resume.workExperience : [];
  const edu = Array.isArray(resume.education) ? resume.education : [];
  const projects = Array.isArray(resume.personalProjects) ? resume.personalProjects : [];
  const additional = resume.additional || {};
  const skills = Array.isArray(additional.technicalSkills) ? additional.technicalSkills : [];
  const certs = Array.isArray(additional.certificationsTraining) ? additional.certificationsTraining : [];
  const awards = Array.isArray(additional.awards) ? additional.awards : [];
  const languages = Array.isArray(additional.languages) ? additional.languages : [];
  const customSections = resume.customSections && typeof resume.customSections === "object"
    ? resume.customSections
    : {};

  const customEntries = Object.entries(customSections).filter(([, section]) => section && typeof section === "object");

  return (
    <div className={`text-sm ${className}`}>
      <header>
        {pi.name ? <div className="text-lg font-bold text-primary">{pi.name}</div> : null}
        {pi.title ? <div className="text-sm text-secondary font-medium">{pi.title}</div> : null}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted mt-1">
          {pi.email ? <span>{pi.email}</span> : null}
          {pi.phone ? <span>{pi.phone}</span> : null}
          {pi.location ? <span>{pi.location}</span> : null}
          {pi.linkedin ? <span className="truncate max-w-[180px]">{pi.linkedin}</span> : null}
          {pi.github ? <span className="truncate max-w-[180px]">{pi.github}</span> : null}
          {pi.website ? <span className="truncate max-w-[180px]">{pi.website}</span> : null}
        </div>
      </header>

      {resume.summary ? (
        <Section title="Summary">
          <p className="text-sm text-text leading-snug">{resume.summary}</p>
        </Section>
      ) : null}

      {work.length ? (
        <Section title="Experience">
          <div className="space-y-3">
            {work.map((job, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold text-text">{job.title || ""}{job.company ? ` — ${job.company}` : ""}</div>
                  {job.years ? <div className="text-xs text-muted">{job.years}</div> : null}
                </div>
                {job.location ? <div className="text-xs text-muted">{job.location}</div> : null}
                <Bullets items={job.description} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {projects.length ? (
        <Section title="Projects">
          <div className="space-y-3">
            {projects.map((p, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold text-text">{p.name || ""}{p.role ? ` — ${p.role}` : ""}</div>
                  {p.years ? <div className="text-xs text-muted">{p.years}</div> : null}
                </div>
                <Bullets items={p.description} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {edu.length ? (
        <Section title="Education">
          <div className="space-y-2">
            {edu.map((e, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-text">
                  {e.degree ? <span className="font-medium">{e.degree}</span> : null}
                  {e.institution ? <span className="text-muted">, {e.institution}</span> : null}
                </div>
                {e.years ? <div className="text-xs text-muted">{e.years}</div> : null}
                {e.description ? <div className="text-xs text-muted w-full">{e.description}</div> : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {skills.length || certs.length || awards.length || languages.length ? (
        <Section title="Skills & Awards">
          {skills.length ? (
            <div className="mb-2">
              <div className="text-xs font-medium text-muted mb-1">Technical Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">{s}</span>
                ))}
              </div>
            </div>
          ) : null}
          {certs.length ? (
            <div className="text-xs text-text mb-1"><span className="font-medium text-muted">Certifications:</span> {certs.join(", ")}</div>
          ) : null}
          {awards.length ? (
            <div className="text-xs text-text mb-1"><span className="font-medium text-muted">Awards:</span> {awards.join(", ")}</div>
          ) : null}
          {languages.length ? (
            <div className="text-xs text-text"><span className="font-medium text-muted">Languages:</span> {languages.join(", ")}</div>
          ) : null}
        </Section>
      ) : null}

      {customEntries.map(([key, section], index) => {
        const sectionType = String(section.sectionType || "");
        const title = String(key || `Section ${index + 1}`).replace(/([A-Z])/g, " $1").trim();

        if (sectionType === "itemList" && Array.isArray(section.items) && section.items.length) {
          return (
            <Section key={key} title={title}>
              <div className="space-y-3">
                {section.items.map((item, i) => (
                  <div key={i}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-semibold text-text">{item.title || ""}{item.subtitle ? ` — ${item.subtitle}` : ""}</div>
                      {item.years ? <div className="text-xs text-muted">{item.years}</div> : null}
                    </div>
                    {item.location ? <div className="text-xs text-muted">{item.location}</div> : null}
                    <Bullets items={item.description} />
                  </div>
                ))}
              </div>
            </Section>
          );
        }

        if (sectionType === "stringList" && Array.isArray(section.strings) && section.strings.length) {
          return (
            <Section key={key} title={title}>
              <Bullets items={section.strings} />
            </Section>
          );
        }

        if (sectionType === "text" && section.text) {
          return (
            <Section key={key} title={title}>
              <p className="text-sm text-text leading-snug">{section.text}</p>
            </Section>
          );
        }

        return null;
      })}
    </div>
  );
}
