/// Whichever provider the user has a key for; OpenAI wins when both are set.
/// Lives in a namespace so the self-describing console (which enumerates the
/// root package's functions) doesn't grow a card for it.
function default_client() -> string {
  if (env.OPENAI_API_KEY.get() != null) { "openai/gpt-4o-mini" } else { "anthropic/claude-haiku-4-5" }
}
