// ============================================================================
// The demo's actual API: six ordinary BAML functions. This is the only file
// you should ever need to touch to add a new one — nothing in reflection.baml
// names a specific function, so a new one appears in the console on restart
// with zero other changes.
// ============================================================================

// ── Text utilities ──────────────────────────────────────────────────────

/// Reverses the characters in `text`.
function ReverseText(text: string) -> string {
  let out = ""
  for (let i = text.length() - 1; i >= 0; i -= 1) {
    out = out + text.slice(i, i + 1)
  }
  out
}

/// Title-cases every word in `text`.
function TitleCase(text: string) -> string {
  let words = text.split(" ")
  let out: string[] = []
  for (let w in words) {
    if w.length() == 0 {
      out.push(w)
    } else {
      out.push(w.slice(0, 1).to_upper_case() + w.slice(1, w.length()).to_lower_case())
    }
  }
  out.join(" ")
}

/// Counts how many times each word appears in `text` (case-insensitive).
function WordFrequency(text: string) -> map<string, int> {
  let counts: map<string, int> = {}
  let words = text.to_lower_case().split(" ")
  for (let w in words) {
    if w.length() > 0 {
      let current = counts.get(w)
      if current == null {
        counts.set(w, 1)
      } else {
        counts.set(w, current + 1)
      }
    }
  }
  counts
}

// ── Math helper ─────────────────────────────────────────────────────────

class DivisionByZeroError {
  message string
}

/// Divides two numbers, rejecting division by zero.
function Divide(numerator: float, denominator: float) -> float throws DivisionByZeroError {
  if denominator == 0.0 {
    throw DivisionByZeroError { message: "cannot divide " + numerator.to_string() + " by zero" }
  }
  numerator / denominator
}

// ── Data transformer ────────────────────────────────────────────────────

class Contact {
  name string
  email string
  phone string?
  tags string[]
}

class InvalidEmailError {
  email string
  message string
}

/// Builds a normalized contact record, validating the email shape.
function BuildContact(name: string, email: string, phone: string? = null, tags: string[] = []) -> Contact throws InvalidEmailError {
  if !email.includes("@") {
    throw InvalidEmailError { email: email, message: "missing '@'" }
  }
  Contact { name: name, email: email, phone: phone, tags: tags }
}

// ── LLM function ────────────────────────────────────────────────────────
//
// Inline client shorthand (`client: "anthropic/claude-haiku-4-5"`) resolves
// the provider lazily at call time and reads ANTHROPIC_API_KEY from the
// environment. A style choice, not a workaround: a top-level
// `client X = anthropic.AnthropicClient.new(...)` declaration works fine
// too (a stale-bridge version-skew build made it fail earlier in
// development; rebuilding the bridge fixed that).
//
// With no key (MOCK_LLM=1), the backend never calls this function directly:
// it invokes the compiler-synthesized `SummarizeText$parse` companion with a
// canned JSON response — through the exact same reflective dispatcher used
// for every other function. See backend/src/invoke.ts.

enum Tone {
  Neutral
  Enthusiastic
  Formal
}

class Summary {
  headline string
  bullets string[]
}

/// Summarizes `text` into a headline and a few bullets, in the requested tone.
function SummarizeText(text: string, tone: Tone) -> Summary {
  client: "anthropic/claude-haiku-4-5"
  prompt: `Summarize the following text with the tone ${tone}. Respond with a punchy headline and up to three bullets.

${text}

${ctx.output_format()}`
}
