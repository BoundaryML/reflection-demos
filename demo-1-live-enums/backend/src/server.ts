import cors from "cors";
import express from "express";
import {
  addCategory,
  addTicket,
  deleteCategory,
  DuplicateCategoryName,
  getTicket,
  listCategories,
  listTickets,
  resetDemoData,
  setTicketClassification,
  updateCategory,
} from "./db.js";
import { classifyTicket, isMockMode } from "./bamlClient.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4410);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  res.json({ mode: isMockMode() ? "mock" : "live", model: "claude-haiku-4-5" });
});

app.get("/api/categories", (_req, res) => {
  res.json(listCategories());
});

app.post("/api/categories", (req, res) => {
  const { name, description } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const created = addCategory(name, typeof description === "string" ? description : null);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof DuplicateCategoryName) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

app.patch("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body ?? {};
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    res.status(400).json({ error: "name cannot be empty" });
    return;
  }
  let updated;
  try {
    updated = updateCategory(id, {
      name: typeof name === "string" ? name : undefined,
      description: description === null || typeof description === "string" ? description : undefined,
    });
  } catch (err) {
    if (err instanceof DuplicateCategoryName) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
  if (!updated) {
    res.status(404).json({ error: "category not found" });
    return;
  }
  res.json(updated);
});

app.delete("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  const ok = deleteCategory(id);
  if (!ok) {
    res.status(404).json({ error: "category not found" });
    return;
  }
  res.status(204).end();
});

app.get("/api/tickets", (_req, res) => {
  res.json(listTickets());
});

app.post("/api/tickets", (req, res) => {
  const { customer, subject, body } = req.body ?? {};
  if (typeof subject !== "string" || subject.trim().length === 0) {
    res.status(400).json({ error: "subject is required" });
    return;
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const from = typeof customer === "string" && customer.trim().length > 0 ? customer : "Walk-in";
  res.status(201).json(addTicket(from, subject, body));
});

app.post("/api/reset", (_req, res) => {
  resetDemoData();
  res.json({ categories: listCategories(), tickets: listTickets() });
});

app.post("/api/tickets/:id/classify", async (req, res) => {
  const id = Number(req.params.id);
  const ticket = getTicket(id);
  if (!ticket) {
    res.status(404).json({ error: "ticket not found" });
    return;
  }
  const categories = listCategories();
  try {
    const { category, mode } = await classifyTicket(`${ticket.subject}\n\n${ticket.body}`, categories);
    const updated = setTicketClassification(id, category);
    res.json({ ticket: updated, mode });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message ?? "classification failed" });
  }
});

app.post("/api/tickets/classify-all", async (_req, res) => {
  const categories = listCategories();
  if (categories.length === 0) {
    res.status(400).json({ error: "add at least one category before running triage" });
    return;
  }
  const tickets = listTickets();
  // A ticket that fails to classify keeps its previous badge and is reported
  // in `failed`, so the UI can say so instead of silently showing no change.
  const failed: Array<{ id: number; error: string }> = [];
  const results = await Promise.all(
    tickets.map(async (ticket) => {
      try {
        const { category } = await classifyTicket(`${ticket.subject}\n\n${ticket.body}`, categories);
        return setTicketClassification(ticket.id, category) ?? ticket;
      } catch (err) {
        failed.push({ id: ticket.id, error: (err as Error).message });
        return ticket;
      }
    }),
  );
  res.json({ tickets: results, mode: isMockMode() ? "mock" : "live", failed });
});

app.listen(PORT, () => {
  console.log(`live-triage backend listening on http://localhost:${PORT} (${isMockMode() ? "MOCK" : "LIVE"} mode)`);
});
