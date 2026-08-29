// The two places Schema Studio talks to a model.
//
// The client is chosen per call from whichever key is in the environment;
// `env.NAME` is a late-bound reference, so nothing is read until then. With no
// key at all, `studio.baml` takes the offline branch instead — it still renders
// these prompts and still parses the reply, it just supplies the reply itself.

/// Pull a record out of a document. `T` is supplied at the call site — usually
/// a class the user typed thirty seconds ago and the compiler minted just now.
function Extract<T>(document: string) -> T {
    client: if (env.ANTHROPIC_API_KEY.get() != null) { "anthropic/claude-sonnet-4-5" } else { "openai/gpt-4o-mini" }
    prompt: `
        ${role("system")}
        Read the document and fill in the schema. Copy values verbatim where you
        can. Leave a field null rather than guessing at it.

        ${role("user")}
        ${document}

        ${ctx.output_format}
    `
}

/// Turn a plain-English description into BAML class declarations.
function Draft(description: string) -> string {
    client: if (env.ANTHROPIC_API_KEY.get() != null) { "anthropic/claude-sonnet-4-5" } else { "openai/gpt-4o-mini" }
    prompt: `
        ${role("system")}
        Write BAML class declarations for the extraction task described below.

        Rules:
        - A class is: class Name { ... }
        - A field is a name, a space, and a type — one per line, no colon.
        - Types are string, int, float, bool, an array T[], an optional T?, or
          another class you declare.
        - Add @description("...") after a field when its name alone is ambiguous.
        - Declare the main record first. No comments, no prose, no code fences.

        ${role("user")}
        ${description}
    `
}
