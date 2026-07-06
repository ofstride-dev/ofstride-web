import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useChat } from "../../hooks/useChat";

type ChatWidgetProps = {
  onClose?: () => void;
};

export const ChatWidget: React.FC<ChatWidgetProps> = ({ onClose }) => {
  const { messages, sendMessage, retryLastMessage, isLoading, error, clearChat } = useChat();
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

  return (
    <div className="flex flex-col h-[65vh] min-h-[360px] max-h-[620px] w-full bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <h2 className="font-semibold">OfStride Support Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={retryLastMessage}
            disabled={isLoading}
            className="text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={clearChat}
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Clear
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-medium mb-2">Hello! How can I help you?</p>
            <p className="text-sm">I am Ofstride Assistance. Please share your message to get started.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 font-medium">
                        Sources: {msg.sources.length} consultants found
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-200"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your requirement or ask for a consultant recommendation..."
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};