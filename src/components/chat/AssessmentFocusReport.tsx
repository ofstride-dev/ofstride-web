import React, { useState } from "react";
import { Calendar, Check } from "lucide-react";

export interface AssessmentFocusReport {
  focus_title: string;
  validation_summary: string;
  recommended_agenda_items: string[];
}

type AssessmentFocusReportProps = {
  report: AssessmentFocusReport;
  onBookCall?: (trigger: string) => void;
};

/**
 * Final dynamic consulting summary (Section 4 of the assessment contract).
 * Renders the LLM-generated agenda with interactive checkboxes and an
 * inline booking-call link.
 */
export const AssessmentFocusReport: React.FC<AssessmentFocusReportProps> = ({
  report,
  onBookCall,
}) => {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (index: number) => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const items = Array.isArray(report.recommended_agenda_items)
    ? report.recommended_agenda_items
    : [];

  return (
    <div className="assessment-focus-report">
      <h4 className="assessment-focus-title">{report.focus_title}</h4>
      {report.validation_summary && (
        <p className="assessment-focus-summary">{report.validation_summary}</p>
      )}

      {items.length > 0 && (
        <ul className="assessment-focus-agenda">
          {items.map((item, index) => (
            <li key={index} className="assessment-focus-agenda-item">
              <label className="assessment-focus-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(checked[index])}
                  onChange={() => toggle(index)}
                  aria-label={`Mark "${item}" as done`}
                />
                <span className="assessment-focus-checkbox-box" aria-hidden="true">
                  {checked[index] ? <Check className="w-3.5 h-3.5" /> : null}
                </span>
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {onBookCall && (
        <button
          type="button"
          onClick={() => onBookCall("focus_report_cta")}
          className="assessment-focus-book-btn"
        >
          <Calendar className="w-4 h-4" />
          Book your strategy session
        </button>
      )}
    </div>
  );
};
