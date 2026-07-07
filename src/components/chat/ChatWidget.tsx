import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MessageCircleMore, Send, X } from "lucide-react";
import { useChat } from "../../hooks/useChat";
import { ConsultantCards } from "./ConsultantCards";
import { LeadCaptureInlineForm } from "./LeadCaptureInlineForm";
import { QuickReplyChips } from "./QuickReplyChips";
import { TypingIndicator } from "./TypingIndicator";

type ChatWidgetProps = {
  onClose?: () => void;
};

const defaultPrompts = [
  "I need Business Strategy consulting",
  "Show HR, Payroll, and Compliance services",
  "I want AI and Data Science consulting",
  "Schedule a discovery call",
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const {
    messages,
    sendMessage,
    sendQuickReply,
    retryLastMessage,
    emitEvent,
    sessionProfile,
    pendingRequiredField,
    isLoading,
    error,
    clearChat,
  } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage(input);
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    emitEvent("chat_opened", {
      page: window.location.pathname,
      referrer: document.referrer || "direct",
    });
  }, [emitEvent]);

  const latestAssistant = [...messages].reverse().find((msg) => msg.role === "assistant" && !msg.isLoading);
  const visibleActions = latestAssistant?.actions ?? [];

  const handleBookCallRedirect = async (trigger: string) => {
    await emitEvent("booking_initiated", {
      trigger,
      source: "chat_widget",
      profile: sessionProfile,
      last_assistant_message: latestAssistant?.content ?? null,
    });

    navigate("/book-call", {
      state: {
        source: "chat_widget",
        prefill: {
          name: sessionProfile.name ?? "",
          email: sessionProfile.email ?? "",
          phone: sessionProfile.phone ?? "",
          service: sessionProfile.service_needed ?? sessionProfile.area_of_interest ?? "",
          message: latestAssistant?.content ?? "",
        },
      },
    });
  };

  const handleActionSelect = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes("schedule a call") || normalized.includes("book a call") || normalized === "call") {
      await handleBookCallRedirect(value);
      return;
    }

    await sendQuickReply(value);
  };

  const handleClose = async () => {
    await emitEvent("session_exit", {
      reason: "widget_closed",
      profile: sessionProfile,
      last_assistant_message: latestAssistant?.content,
    });
    onClose?.();
  };

  return (
    <section className="chat-shell flex flex-col h-[72vh] min-h-[420px] max-h-[720px] w-full overflow-hidden" aria-label="Ofstride Assistance">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-live-dot" aria-hidden="true" />
          <div>
            <h2 className="chat-title">Ofstride Services Assistant</h2>
            <p className="chat-subtitle">Personalized recommendations in a few steps</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            onClick={retryLastMessage}
            disabled={isLoading}
            className="chat-header-link"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="chat-header-link"
          >
            Clear
          </button>
          {onClose && (
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close chat"
              className="chat-close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="chat-welcome-banner" role="status">
        <MessageCircleMore className="w-4 h-4" />
        <p>Tell us your requirement and we will align the right Ofstride service domain and consultant options.</p>
      </div>

      <div className="chat-scroll flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && (
          <div className="chat-empty py-6">
            <h3>Great to connect with you.</h3>
            <p>Start with your business challenge. I will map it to Ofstride services and consultant fit.</p>
            <QuickReplyChips
              actions={defaultPrompts.map((value, index) => ({
                id: `default_${index}`,
                label: value,
                value,
                kind: "quick_reply",
              }))}
              disabled={isLoading}
              onSelect={handleActionSelect}
            />
          </div>
        )}

        {messages.map((msg) => (
          <article key={msg.id} className={`chat-message-row ${msg.role === "user" ? "is-user" : "is-assistant"}`}>
            <div className="chat-message-bubble">
              {msg.isLoading ? (
                <TypingIndicator />
              ) : (
                <div className="chat-message-content">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              )}
            </div>

            {!msg.isLoading && msg.sources && msg.sources.length > 0 && (
              <ConsultantCards sources={msg.sources} />
            )}
          </article>
        ))}

        {visibleActions.length > 0 && (
          <QuickReplyChips actions={visibleActions} disabled={isLoading} onSelect={handleActionSelect} />
        )}

        <LeadCaptureInlineForm pendingField={pendingRequiredField} disabled={isLoading} onSubmit={sendMessage} />

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100" role="alert">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="chat-input-shell"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your requirement, budget, or preferred timeline..."
          disabled={isLoading}
          className="chat-input"
          aria-label="Type your message"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="chat-send-btn"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => handleBookCallRedirect("footer_call_button")}
          className="chat-call-btn"
        >
          <Calendar className="w-4 h-4" />
          Call
        </button>
      </form>
    </section>
  );
};