/**
 * CitationChips — compact source/citation badges shown under assistant messages.
 *
 * Consultant profiles are surfaced via ConsultantCards; this component handles
 * all other source types (website pages, service catalog, company docs).
 */
import React from "react";
import type { ConsultantSource } from "../../types/chat";
import { FileText } from "lucide-react";

type CitationChipsProps = {
  sources: ConsultantSource[];
};

function deriveLabel(src: ConsultantSource): string {
  const meta = src.metadata;
  // Named page / section
  if (meta.title) return String(meta.title);
  if (meta.section) return String(meta.section).replace(/_/g, " ");
  // URL-based
  if (meta.url) {
    const url = String(meta.url);
    const parts = url.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (last && last !== "ofstride.com") {
      return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  if (meta.source) return String(meta.source).replace(/_/g, " ");
  return "Ofstride website";
}

function isConsultantSource(src: ConsultantSource): boolean {
  const t = String(src.metadata.source_type ?? "");
  return (
    t === "consultant_profile" ||
    t === "consultant_cv" ||
    t === "consultant_data" ||
    Boolean(src.metadata.consultant_name)
  );
}

export const CitationChips: React.FC<CitationChipsProps> = ({ sources }) => {
  const chips = sources
    .filter((s) => !isConsultantSource(s))
    .slice(0, 4);

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Sources">
      {chips.map((src, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium"
          title={String(src.metadata.url ?? src.metadata.source ?? "")}
        >
          <FileText className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          {deriveLabel(src)}
        </span>
      ))}
    </div>
  );
};
