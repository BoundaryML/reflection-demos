// Design-a-Form Extraction: the form is designed in the browser and stored
// as rows in sqlite. Every extraction mints a *runtime* BAML class from
// those rows — form_type — and extracts unstructured text straight into it.
// The schema is built from data; nothing is templated ahead of time.

client Extractor = anthropic.AnthropicClient.new(model = "claude-haiku-4-5")

// One saved form field, as persisted by the Design tab.
class SavedField {
    name string
    kind "text" | "number" | "dropdown" | "bulleted_list"
    options string[] // only meaningful for "dropdown"
    description string
}

// THE REFLECTION CALL: turn saved field rows into a runtime class type.
// A dropdown becomes a literal union (one literal per option); a bulleted
// list becomes a string array; every field carries its description as
// metadata, so the LLM prompt explains what each field means.
function form_type(saved: SavedField[]) -> reflect.class.Type {
    let fields: map<string, reflect.Type | reflect.WithMeta<reflect.Type>> = {};
    for (let field in saved) {
        let ty = match (field.kind) {
            "dropdown" => {
                let members: reflect.Type[] = [];
                for (let option in field.options) {
                    members.push(reflect.literal.new(option).as_type());
                }
                reflect.union.new(members).as_type()
            },
            "bulleted_list" => reflect.Type.of<string>().array().as_type(),
            "number" => reflect.Type.of<int>(),
            "text" => reflect.Type.of<string>(),
        };
        let description = if (field.kind == "bulleted_list") {
            `use short phrases; ${field.description}`
        } else {
            field.description
        };
        fields.set(field.name, ty.meta(description = description));
    }
    reflect.class.new("DesignedForm", fields)
}

// The extraction call — generic over whatever runtime type T is bound to.
function extract<T>(transcript: string) -> T {
    client: Extractor
    prompt: `Extract the fields described below from this text. Only use
    information that is actually present — never invent values.

    Text:
    ${transcript}

    ${ctx.output_format}`
}

// Mint the type, bind it, call the LLM through it, then read every field
// back out through baml.AnyClass — the uniform read-only reflection surface
// every class instance implements, minted classes included — flattened to
// strings so the frontend can render a plain filled-in form.
function extract_into_form(saved: SavedField[], transcript: string) -> map<string, string> {
    let form_t = form_type(saved);
    type F = unreflect(form_t.as_type());
    let note: baml.AnyClass = extract<F>(transcript) else {
        throw baml.errors.TypeMismatch { message: "extraction did not produce a class instance" }
    };

    let result: map<string, string> = {};
    for (let field in saved) {
        let value = match (field.kind) {
            "number" => (note.get<int>(field.name) ?? 0).to_string(),
            "dropdown" => note.get<string>(field.name) ?? "",
            "bulleted_list" => (note.get<string[]>(field.name) ?? []).join("; "),
            "text" => note.get<string>(field.name) ?? "",
        };
        result.set(field.name, value);
    }
    result
}

