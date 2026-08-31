import type { ChatMessage } from "../types.js";
import ResultCard from "./ResultCard.js";

const STATUS_CLASS: Record<string, string> = {
  matched: "assistant",
  no_tools: "info",
  no_match: "info",
  error: "warning",
};

export default function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="message-row user">
        <div className="bubble user">{message.text}</div>
      </div>
    );
  }

  const kind = message.status ? STATUS_CLASS[message.status] ?? "assistant" : "assistant";

  return (
    <div className="message-row assistant">
      <div className={`bubble ${kind}`}>
        <p>{message.text}</p>
        {message.status === "matched" && message.tool && message.result ? (
          <ResultCard tool={message.tool} result={message.result} />
        ) : null}
        {message.promptPreview ? (
          <details className="prompt-preview">
            <summary>what the model saw this turn</summary>
            <pre>{message.promptPreview}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
