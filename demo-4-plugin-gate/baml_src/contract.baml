// Digest — the public plugin contract for the summarizer marketplace.

/// Every summarizer plugin must answer these two fields.
///
/// Anything else a plugin declares is its own business: the host has never
/// seen those names and never will, except reflectively.
interface Summarizer {
  summary string
  key_points string[]
}

/// The contract's field names, in declaration order.
///
/// TODO(interface_fields): `reflect.interface.Type` cannot enumerate its own
/// fields yet, so the witness builder in `registry.baml` reads them from here.
function contract_fields() -> string[] {
    ["summary", "key_points"]
}

/// Produces one plugin's summary of `document`.
///
/// `T` is the plugin's own class. It is minted at install time from source the
/// host never compiled against, and handed to this function as a runtime type.
/// `T extends Summarizer` is the whole reason that is safe.
/// Whichever provider the user has a key for; OpenAI wins when both are set.
function default_client() -> string {
    if (env.OPENAI_API_KEY.get() != null) { "openai/gpt-4o-mini" } else { "anthropic/claude-haiku-4-5" }
}

function Summarize<T extends Summarizer>(document: string) -> T {
    client: env.PLUGIN_MODEL.get() ?? default_client()
    prompt: `
        Summarize the document below for a busy reader.

        <document>
        ${document}
        </document>

        ${ctx.output_format()}
    `
}
