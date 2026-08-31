import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.js";
import ChatPanel from "./components/ChatPanel.js";
import NotesPanel from "./components/NotesPanel.js";
import { fetchMode, fetchNotes, fetchTools, sendChat } from "./api.js";
import type { Note, ToolId, ToolMeta } from "./api.js";
import type { ChatMessage } from "./types.js";

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `m${nextId}`;
}

export default function App() {
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [enabled, setEnabled] = useState<Set<ToolId>>(new Set());
  const [mock, setMock] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTools().then((list) => {
      setTools(list);
      setEnabled(new Set(list.map((t) => t.id)));
    });
    fetchMode().then((m) => setMock(m.mock));
    fetchNotes().then(setNotes);
  }, []);

  function toggleTool(id: ToolId) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend(text: string) {
    const userMessage: ChatMessage = { id: newId(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setBusy(true);
    try {
      const res = await sendChat(text, Array.from(enabled));
      const assistantMessage: ChatMessage = {
        id: newId(),
        role: "assistant",
        text: res.reply,
        status: res.status,
        tool: res.tool,
        result: res.result,
        promptPreview: res.promptPreview,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      if (res.tool === "note_saver" && res.status === "matched") {
        fetchNotes().then(setNotes);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong talking to the backend.",
          status: "error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <Sidebar tools={tools} enabled={enabled} onToggle={toggleTool} mock={mock} />
      <main className="main">
        <ChatPanel messages={messages} onSend={handleSend} busy={busy} disabled={enabled.size === 0} />
        <NotesPanel notes={notes} />
      </main>
    </div>
  );
}
