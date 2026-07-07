import React from "react";
import type { ChatAction } from "../../types/chat";

type QuickReplyChipsProps = {
  actions: ChatAction[];
  disabled?: boolean;
  onSelect: (value: string) => void;
};

export const QuickReplyChips: React.FC<QuickReplyChipsProps> = ({ actions, disabled, onSelect }) => {
  if (!actions.length) {
    return null;
  }

  return (
    <div className="chat-chip-row" role="group" aria-label="Suggested replies">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={disabled}
          className="chat-chip"
          onClick={() => onSelect(action.value)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};
