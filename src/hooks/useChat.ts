import { useState, useCallback, useRef } from "react";
import { getChatSessionId, postChatEvent, sendChatMessage } from "../services/api";
import type { ChatAction, ChatEventType, ConsultantSource } from "../types/chat";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: ConsultantSource[];
  actions?: ChatAction[];
  isLoading?: boolean;
  assessmentFocus?: AssessmentFocusReport | null;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string, options?: { silent?: boolean }) => Promise<void>;
  sendSilentMessage: (text: string) => Promise<void>;
  sendQuickReply: (value: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  emitEvent: (eventType: ChatEventType, payload?: Record<string, unknown>) => Promise<void>;
  sessionId: string;
  sessionProfile: Record<string, string>;
  chatState: string; // "OPEN" | "INTAKE_FIELDS" | "INTAKE_SUBMITTED" | "DOMAIN_SELECTED" | "CONSULTANTS_SHOWN" | "CONVERSATION"
  pendingRequiredField: "name" | "phone" | "email" | null;
  isLoading: boolean;
  error: string | null;
  clearChat: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [sessionProfile, setSessionProfile] = useState<Record<string, string>>({});
  const [chatState, setChatState] = useState<string>("OPEN");
  const [pendingRequiredField, setPendingRequiredField] = useState<"name" | "phone" | "email" | null>(null);
  const messageIdRef = useRef(0);
  const sessionId = getChatSessionId();

  const hasCompleteLead = useCallback((profile: Record<string, string>) => {
    return Boolean(profile.name && profile.phone && profile.email);
  }, []);

  const emitEvent = useCallback(
    async (eventType: ChatEventType, payload: Record<string, unknown> = {}) => {
      try {
        await postChatEvent({
          event_type: eventType,
          session_id: sessionId,
          payload,
        });
      } catch {
        // Event tracking should never break the chat experience.
      }
    },
    [sessionId]
  );

  const generateId = () => `msg_${++messageIdRef.current}_${Date.now()}`;

  const sendMessage = useCallback(async (text: string, options: { silent?: boolean } = {}) => {
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

    setMessages((prev) => (options.silent ? [...prev, loadingMessage] : [...prev, userMessage, loadingMessage]));
    setIsLoading(true);
    setError(null);
    setLastUserMessage(text.trim());
    await emitEvent("intent_selected", { query: text.trim() });

    try {
      const response = await sendChatMessage(text.trim(), sessionProfile);
      const nextProfile = response.session_profile ?? {};
      const becameComplete = hasCompleteLead(nextProfile) && !hasCompleteLead(sessionProfile);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: response.response,
                isLoading: false,
                sources: response.sources,
                actions: response.ui_hints?.actions,
                assessmentFocus: response.ui_hints?.assessment_focus ?? null,
              }
            : msg
        )
      );

      setSessionProfile(nextProfile);
      setChatState(response.state ?? "OPEN");
      setPendingRequiredField(response.ui_hints?.next_required_field ?? null);

      await emitEvent("response_generated", {
        query: text.trim(),
        route_decision: response.route_decision,
        provider_used: response.provider_used,
        fallback_reason: response.fallback_reason ?? null,
        next_required_field: response.ui_hints?.next_required_field ?? null,
        actions: response.ui_hints?.actions?.map((action) => action.value) ?? [],
        consultants: response.sources?.map((src) => src.metadata?.consultant_name).filter(Boolean) ?? [],
      });

      if (response.route_decision === "blocked") {
        await emitEvent("off_topic_query", {
          query: text.trim(),
          reason: response.fallback_reason ?? "blocked",
        });
      }

      if (response.sources?.length) {
        await emitEvent("consultant_viewed", {
          count: response.sources.length,
          consultants: response.sources
            .map((src) => src.metadata?.consultant_name)
            .filter(Boolean),
        });
      }

      if (becameComplete) {
        await emitEvent("lead_form_submitted", {
          name: nextProfile.name,
          email: nextProfile.email,
          phone: nextProfile.phone,
          service_needed: nextProfile.service_needed,
        });
      }
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
  }, [emitEvent, hasCompleteLead, isLoading, sessionProfile]);

  const sendSilentMessage = useCallback(async (text: string) => {
    await sendMessage(text, { silent: true });
  }, [sendMessage]);

  const sendQuickReply = useCallback(async (value: string) => {
    await emitEvent("cta_selected", { value });
    await sendMessage(value);
  }, [emitEvent, sendMessage]);

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessage || isLoading) return;
    await sendMessage(lastUserMessage);
  }, [isLoading, lastUserMessage, sendMessage]);

  const clearChat = useCallback(() => {
    emitEvent("session_exit", {
      reason: "user_cleared_chat",
      profile: sessionProfile,
      last_message: lastUserMessage,
    });
    setMessages([]);
    setError(null);
    setLastUserMessage(null);
    setSessionProfile({});
    setChatState("OPEN");
    setPendingRequiredField(null);
    sessionStorage.removeItem("ofstride_session_id");
  }, [emitEvent, lastUserMessage, sessionProfile]);

  return {
    messages,
    sendMessage,
    sendSilentMessage,
    sendQuickReply,
    retryLastMessage,
    emitEvent,
    sessionId,
    sessionProfile,
    chatState,
    pendingRequiredField,
    isLoading,
    error,
    clearChat,
  };
}