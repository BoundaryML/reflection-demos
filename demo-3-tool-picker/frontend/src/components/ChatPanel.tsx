import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types.js";
import MessageBubble from "./MessageBubble.js";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  disabled: boolean;
}

export default function ChatPanel({ messages, onSend, busy, disabled }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="chat-panel">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>Ask for a calculation, a unit conversion, a saved note, or the weather.</p>
            <p className="hint">Then turn a tool off in the sidebar and ask for it again.</p>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {busy ? (
          <div className="message-row assistant">
            <div className="bubble assistant typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          value={draft}
          placeholder={disabled ? "Turn on a tool to get started…" : "Type a request…"}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
