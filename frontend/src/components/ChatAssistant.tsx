import { useEffect, useRef, useState, type FormEvent } from "react";

import { streamChatMessage, type ChatMessage } from "../lib/chat";
import styles from "./ChatAssistant.module.css";

type ChatAssistantProps = {
  context: Record<string, unknown>;
};

const STARTER_PROMPTS = [
  "What should I do nearby?",
  "Help me plan a Guam day trip.",
  "What should I know before visiting?",
];
const MAX_REQUEST_MESSAGES = 12;
const CHAT_TIMEOUT_MS = 45_000;

export function ChatAssistant({ context }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyStarted, setReplyStarted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [open, messages, loading]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function submitMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLastFailedPrompt(null);
    setLoading(true);
    setReplyStarted(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestMessages = nextMessages.slice(-MAX_REQUEST_MESSAGES);
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CHAT_TIMEOUT_MS);

    try {
      let streamedReply = "";

      await streamChatMessage(
        {
          messages: requestMessages,
          context,
        },
        {
          signal: controller.signal,
          onDelta: (delta) => {
            streamedReply += delta;
            setReplyStarted(true);
            setMessages([...nextMessages, { role: "assistant", content: streamedReply }]);
          },
        },
      );

      if (!streamedReply.trim()) {
        throw new Error("The GuamRadar assistant returned an empty reply.");
      }
    } catch (err) {
      if (controller.signal.aborted && !timedOut) return;
      setMessages(nextMessages);
      setLastFailedPrompt(trimmed);
      setError(
        timedOut
          ? "The assistant is taking too long to reply. Please try again."
          : err instanceof Error ? err.message : "The assistant could not reply.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setLoading(false);
      setReplyStarted(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  return (
    <div className={styles.assistant}>
      <section
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        aria-label="GuamRadar assistant"
        aria-hidden={!open}
      >
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.eyebrow}>GuamRadar</div>
            <h2 className={styles.title}>Ask GuamRadar</h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.messages} ref={messageListRef}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4.5 14.5c-1.2-3.9.8-8.2 4.7-9.7 4.2-1.6 8.9.5 10.5 4.7 1.5 4.1-.3 8.7-4.3 10.4-2.2.9-4.7.8-6.8-.3L4 20.4l.8-4.1c-.1-.5-.2-1.1-.3-1.8Z" />
                  <path d="M9.1 13.7c1.6.9 3.5.9 5.2 0" />
                  <path d="M8.8 10h.1M15.1 10h.1" />
                </svg>
              </div>
              <p>Ask about Guam places, villages, beaches, food, or trip planning.</p>
              <div className={styles.promptList}>
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className={styles.promptButton}
                    onClick={() => void submitMessage(prompt)}
                    disabled={loading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
              className={`${styles.messageRow} ${message.role === "user" ? styles.messageRowUser : ""}`}
            >
              <div className={`${styles.messageBubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
                {message.content}
              </div>
            </div>
          ))}

          {loading && !replyStarted && (
            <div className={styles.messageRow}>
              <div className={`${styles.messageBubble} ${styles.assistantBubble} ${styles.typingBubble}`}>
                <span className={styles.srOnly}>GuamRadar is thinking</span>
                <span className={styles.typingDot} aria-hidden="true" />
                <span className={styles.typingDot} aria-hidden="true" />
                <span className={styles.typingDot} aria-hidden="true" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            {lastFailedPrompt && (
              <button
                className={styles.retryButton}
                type="button"
                onClick={() => void submitMessage(lastFailedPrompt)}
                disabled={loading}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <form className={styles.form} onSubmit={onSubmit}>
          <input
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about Guam..."
            maxLength={2000}
            disabled={loading}
          />
          <button className={styles.sendButton} type="submit" disabled={loading || !input.trim()} aria-label="Send message">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 14-7-5 14-3-6-6-1Z" />
              <path d="m11 13 8-8" />
            </svg>
          </button>
        </form>
      </section>

      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ""}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close GuamRadar assistant" : "Open GuamRadar assistant"}
        aria-expanded={open}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path className={styles.iconBubble} d="M9 23.5C9 15.5 15.7 9 24 9s15 6.5 15 14.5S32.3 38 24 38c-2.1 0-4.1-.4-5.9-1.2L11 39l2.2-6.6A14 14 0 0 1 9 23.5Z" />
          <path className={styles.iconWave} d="M16.5 27.2c2.3 1.8 5 2.7 8 2.6 3-.1 5.6-1.2 7.7-3.1" />
          <path className={styles.iconPin} d="M24 14.5c-2.6 0-4.7 2.1-4.7 4.7 0 3.4 4.7 8.1 4.7 8.1s4.7-4.7 4.7-8.1c0-2.6-2.1-4.7-4.7-4.7Z" />
          <circle className={styles.iconDot} cx="24" cy="19.2" r="1.7" />
        </svg>
      </button>
    </div>
  );
}
