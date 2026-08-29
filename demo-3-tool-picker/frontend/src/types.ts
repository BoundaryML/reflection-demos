import type { ChatStatus, ToolId } from "./api.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: ChatStatus;
  tool?: ToolId;
  result?: unknown;
}
