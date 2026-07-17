/**
 * Lightweight inline markdown renderer for chat messages.
 *
 * Handles the subset of Markdown used in deterministic templates and LLM
 * responses: **bold**, bullet lists (• and -), numbered lists, links [label](url),
 * line breaks, and section headers (##).
 *
 * Intentionally avoids adding an external dependency.
 */
import React from "react";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** and [label](url) patterns
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const full = match[1];
    if (full.startsWith("**")) {
      parts.push(<strong key={match.index}>{full.slice(2, -2)}</strong>);
    } else {
      // Link: [label](url)
      const label = match[2];
      const url = match[3];
      const isExternal = url.startsWith("http");
      parts.push(
        <a
          key={match.index}
          href={url}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-blue-600 underline hover:text-blue-800"
        >
          {label}
        </a>
      );
    }
    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, className }) => {
  if (!content) return null;

  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listBuffer.length) return;
    if (listType === "ul") {
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="list-disc list-inside space-y-0.5 my-1 text-sm">
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    } else {
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="list-decimal list-inside space-y-0.5 my-1 text-sm">
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    }
    listBuffer = [];
    listType = null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Blank line — flush list, add spacer
    if (!trimmed) {
      flushList();
      nodes.push(<div key={`sp-${idx}`} className="h-1" />);
      return;
    }

    // Section header ##
    if (trimmed.startsWith("## ")) {
      flushList();
      nodes.push(
        <p key={idx} className="font-semibold text-primary mt-2 mb-0.5 text-sm">
          {renderInline(trimmed.slice(3))}
        </p>
      );
      return;
    }

    // Bullet •  or  - item
    const bulletMatch = trimmed.match(/^[•\-]\s+(.+)$/);
    if (bulletMatch) {
      if (listType === "ol") flushList();
      listType = "ul";
      listBuffer.push(bulletMatch[1]);
      return;
    }

    // Numbered list  1) or 1.
    const numberedMatch = trimmed.match(/^\d+[).]\s+(.+)$/);
    if (numberedMatch) {
      if (listType === "ul") flushList();
      listType = "ol";
      listBuffer.push(numberedMatch[1]);
      return;
    }

    // Regular paragraph
    flushList();
    nodes.push(
      <p key={idx} className="text-sm leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();

  return (
    <div className={`chat-markdown space-y-0.5 ${className ?? ""}`}>
      {nodes}
    </div>
  );
};
