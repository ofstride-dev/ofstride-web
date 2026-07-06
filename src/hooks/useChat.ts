import { useState, useCallback, useRef } from "react";
import { sendChatMessage } from "../services/api";
import type { ConsultantSource } from "../types/chat";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: ConsultantSource[];
  isLoading?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearChat: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const messageIdRef = useRef(0);

  const generateId = () => `msg_${++messageIdRef.current}_${Date.now()}`;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);
    setError(null);
    setLastUserMessage(text.trim());

    try {
      const response = await sendChatMessage(text.trim());

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: response.response,
                isLoading: false,
                sources: response.sources,
              }
            : msg
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get response";
      setError(errorMsg);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessage || isLoading) return;
    await sendMessage(lastUserMessage);
  }, [isLoading, lastUserMessage, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setLastUserMessage(null);
    sessionStorage.removeItem("ofstride_session_id");
  }, []);

  return { messages, sendMessage, retryLastMessage, isLoading, error, clearChat };
}