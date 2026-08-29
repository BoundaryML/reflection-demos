// Design-a-Form Extraction — BEP-066 Scenario 2 live.
//
// The user designs a form in the "Design" tab (stored as rows in sqlite).
// Every extraction request mints a *runtime* BAML class from those rows —
// FormType below — and extracts unstructured text straight into it.
// Nothing here is templated per-field-kind ahead of time; the schema is
// built from data.

client Extractor = anthropic.AnthropicClient.new(model = "claude-haiku-4-5")

// One saved form field, as persisted by the Design tab.
class SavedField {
    name string
    kind string // "text" | "number" | "dropdown" | "bulleted_list"
    options string[] // only meaningful for "dropdown"
    description string
}

class UnknownFieldKind {
    kind string
}

// The reflection call: turn saved field rows into a runtime class type.
// A dropdown becomes a literal union (one literal per option); a bulleted
// list becomes a string array; everything carries its description as
// field metadata so the LLM prompt explains what each field means.
function FormType(saved: SavedField[]) -> reflect.class.Type {
    let fields: map<string, reflect.Type | reflect.WithMeta<reflect.Type>> = {}
    for (let field in saved) {
        let ty = match (field.kind) {
            "dropdown" => {
                let members: reflect.Type[] = []
                for (let option in field.options) {
                    members.push(reflect.literal.new(option).as_type())
                }
                reflect.union.new(members).as_type()
            },
            "bulleted_list" => reflect.Type.of<string>().array().as_type(),
            "number" => reflect.Type.of<int>(),
            "text" => reflect.Type.of<string>(),
            _ => throw UnknownFieldKind { kind: field.kind },
        }
        let description = if (field.kind == "bulleted_list") {
            "use short phrases; " + field.description
        } else {
            field.description
        }
        fields.set(field.name, ty.meta(description = description))
    }
    reflect.class.new("DesignedForm", fields)
}

// The extraction call itself — generic over whatever runtime type the
// caller binds T to via unreflect(...).
function Extract<T>(transcript: string) -> T {
    client: Extractor
    prompt: `Extract the fields described below from this text. Only use
    information that is actually present — never invent values.

    Text:
    ${transcript}

    ${ctx.output_format}`
}

// Live path: mint the type, call the LLM through it, read every field
// back out with reflect.class.get_field, and flatten to strings so the
// frontend can render a plain filled-in form.
function ExtractIntoFormLive(saved: SavedField[], transcript: string) -> map<string, string> {
    let form_t = FormType(saved)
    let note = Extract<unreflect(form_t.as_type())>(transcript)
    let result: map<string, string> = {}
    for (let field in saved) {
        let value = match (field.kind) {
            "number" => reflect.class.get_field<int>(note, field.name).to_string(),
            "dropdown" => reflect.class.get_field<string>(note, field.name),
            "bulleted_list" => {
                let items = reflect.class.get_field<string[]>(note, field.name)
                let text = ""
                for (let item in items) {
                    text = if (text == "") { item } else { text + "; " + item }
                }
                text
            },
            "text" => reflect.class.get_field<string>(note, field.name),
            _ => throw UnknownFieldKind { kind: field.kind },
        }
        result.set(field.name, value)
    }
    result
}

// Mock path: same mint, same reads — only the source of the "model
// output" differs. render_prompt proves the schema renders into a real
// prompt; parse takes canned JSON instead of a network call. This is the
// exact offline seam the BAML test suite runs on.
function ExtractIntoFormMock(saved: SavedField[], transcript: string, mock_json: string) -> map<string, string> {
    let form_t = FormType(saved)
    Extract$render_prompt<unreflect(form_t.as_type())>(transcript)
    let note = Extract$parse<unreflect(form_t.as_type())>(mock_json)
    let result: map<string, string> = {}
    for (let field in saved) {
        let value = match (field.kind) {
            "number" => reflect.class.get_field<int>(note, field.name).to_string(),
            "dropdown" => reflect.class.get_field<string>(note, field.name),
            "bulleted_list" => {
                let items = reflect.class.get_field<string[]>(note, field.name)
                let text = ""
                for (let item in items) {
                    text = if (text == "") { item } else { text + "; " + item }
                }
                text
            },
            "text" => reflect.class.get_field<string>(note, field.name),
            _ => throw UnknownFieldKind { kind: field.kind },
        }
        result.set(field.name, value)
    }
    result
}
