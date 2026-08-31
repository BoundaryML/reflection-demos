// The registry: it turns submitted plugin source into a runtime class that
// carries a witness for `Summarizer`, and it is the only door plugins get in
// through. Both gates below belong to the compiler, not to us.

/// A plugin exactly as the marketplace received it.
class Submission {
    /// The class the plugin declares in `source`.
    name: string,
    /// The plugin's own BAML source.
    source: string,
    /// Which of the plugin's fields answer each contract field.
    bindings: map<string, string>,
}

/// One field of an installed plugin, for the registry listing.
class PluginField {
    name: string,
    type: string,
    /// True when this field answers a contract field.
    contract: bool,
}

/// What one run of a plugin produced.
class Report {
    /// Read off the contract: an ordinary typed field read, on a class the host
    /// was never compiled against.
    summary: string,
    key_points: string[],
    /// The plugin's own extra fields, read reflectively and JSON-encoded.
    extras: map<string, string>,
    /// The request the plugin's schema produced.
    prompt: string,
}

/// Gate 1 — install.
///
/// Compiles the submission, re-mints its class as a runtime type, and attaches
/// a structural witness for `Summarizer`. A plugin that is missing a contract
/// field, or answers one with the wrong type, dies right here with the
/// compiler's own diagnostic.
///
/// `sign = false` is what an unchecked plugin loader would do: same class, no
/// witness. Gate 2 catches those.
function mint(submission: Submission, sign: bool = true) -> reflect.class.Type {
    let package = reflect.Package.compile({ "plugin.baml": submission.source });
    let declared = package.get_class("root." + submission.name)
        ?? throw "the plugin declares no class named `" + submission.name + "`";

    let fields: map<string, reflect.Type | reflect.WithMeta<reflect.Type>> = {};
    for (let field in declared.fields()) {
        let ty = field.type ?? throw "field `" + field.name + "` has no type";
        fields.set(
            field.name,
            ty.meta(description = field.meta.description, docstring = field.meta.docstring),
        )
    }

    if (!sign) {
        return reflect.class.new(submission.name, fields);
    }

    let witness = reflect.interface.implementation<Summarizer>();
    for (let name in contract_fields()) {
        witness = witness.field(name, class_field = submission.bindings.get(name))
    }
    reflect.class.new(submission.name, fields, implementations = [witness])
}

/// Gate 2 — invoke.
///
/// The host's only path to a plugin. `P extends Summarizer` is checked against
/// the runtime type at the call site, so `result.summary` below is an ordinary
/// typed field read — and a plugin that skipped gate 1 never reaches the model.
///
/// `answered` names the plugin's own fields that back the contract; everything
/// else the plugin declared is an extra, and extras are read reflectively.
function invoke<P extends Summarizer>(document: string, answered: string[]) -> Report {
    let prompt = Summarize$render_prompt<P>(document).text();
    let result: Summarizer = Summarize<P>(document);

    let extras: map<string, string> = {};
    let plugin = reflect.Type.of<P>().as_class() ?? throw "plugin type is not a class";
    for (let field in plugin.fields()) {
        if (!answered.includes(field.name)) {
            extras.set(
                field.name,
                baml.json.to_string(reflect.class.get_field<unknown>(result, field.name)),
            )
        }
    }

    Report {
        summary: result.summary,
        key_points: result.key_points,
        extras: extras,
        prompt: prompt,
    }
}

/// The manifest the registry stores: the minted class's own canonical BAML,
/// witness and all, rendered straight back out of the type.
///
/// TODO(to_baml): `to_baml()` renders every class the type's definitions carry,
/// not just the one it names — so a plugin minted from `reflect.Package.compile`
/// renders the witnessed class *and* a duplicate of the submission's class. Keep
/// the declaration that carries the witness until `to_baml()` renders only the
/// closure the type actually reaches.
function manifest(plugin: reflect.class.Type) -> string {
    let source = plugin.as_type().to_baml();
    for (let declaration in source.split("\n\n")) {
        if (declaration.includes("\n  implements ")) {
            return declaration;
        }
    }
    source
}

/// The field listing the marketplace shows for an installed plugin.
function describe(plugin: reflect.class.Type, answered: string[]) -> PluginField[] {
    let listing: PluginField[] = [];
    for (let field in plugin.fields()) {
        let ty = field.type ?? throw "field `" + field.name + "` has no type";
        listing.push(
            PluginField {
                name: field.name,
                type: ty.to_string(),
                contract: answered.includes(field.name),
            },
        )
    }
    listing
}
