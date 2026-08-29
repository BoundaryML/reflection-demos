import { useEffect, useRef, useState } from "react";

export type HealthState = "pending" | "up" | "down";

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 2500;

/**
 * Polls a backend's /api/health on a fixed interval and reports whether it's
 * reachable. Backends live on a different origin (different port) than the
 * hub, and demos aren't required to send CORS headers, so this uses
 * `mode: "no-cors"` — the response body is opaque and unreadable, but a
 * resolved fetch means *something* answered on that port, and a rejected
 * fetch (connection refused / timeout) means nothing did. That's the only
 * signal the status dot needs (up vs. down).
 */
export function useHealth(port: number): HealthState {
  const [state, setState] = useState<HealthState>("pending");
  // Guards against a slow, stale poll overwriting a newer result after unmount.
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const check = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        await fetch(`http://localhost:${port}/api/health`, {
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!cancelledRef.current) setState("up");
      } catch {
        if (!cancelledRef.current) setState("down");
      } finally {
        clearTimeout(timer);
      }
    };

    void check();
    const id = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [port]);

  return state;
}
