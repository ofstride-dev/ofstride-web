import React from "react";
import type { ConsultantSource } from "../../types/chat";

type ConsultantCardsProps = {
  sources: ConsultantSource[];
};

export const ConsultantCards: React.FC<ConsultantCardsProps> = ({ sources }) => {
  const consultants = sources
    .map((src) => ({
      name: String(src.metadata.consultant_name || src.metadata.source || "Ofstride Consultant"),
      role: String(src.metadata.role || "Consultant"),
      location: String(src.metadata.location || "India"),
      availability: String(src.metadata.availability || "On request"),
      content: src.content,
    }))
    .slice(0, 3);

  if (!consultants.length) {
    return null;
  }

  return (
    <div className="chat-consultant-grid" aria-label="Recommended consultants">
      {consultants.map((item) => (
        <article key={`${item.name}-${item.role}`} className="chat-consultant-card">
          <p className="chat-consultant-name">{item.name}</p>
          <p className="chat-consultant-meta">{item.role} • {item.location}</p>
          <p className="chat-consultant-summary">{item.content}</p>
          <p className="chat-consultant-meta">Availability: {item.availability}</p>
        </article>
      ))}
    </div>
  );
};
