import React from "react";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="chat-typing" role="status" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
      <strong>Thinking</strong>
    </div>
  );
};
