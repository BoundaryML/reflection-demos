// BEP-066 Scenario 3, product-shaped: a toggleable toolbox.
//
// Each tool's argument schema is minted at request time with
// `reflect.class.new`, and only the tools the user has switched ON are
// folded into the runtime union with `reflect.union.new`. The union that
// reaches the model is therefore never a superset that gets filtered after
// the fact — a disabled tool's class is never constructed into the union in
// the first place, so the model has no way to pick it.
//
// `PickAction<T>` is an ordinary generic BAML function; `unreflect(...)`
// turns the runtime `reflect.Type` value produced by `reflect.union.new` into a
// concrete type argument for it. Dispatch is the same trick in reverse:
// `action is unreflect(calc_t.as_type())` asks "is this value's *minted*
// type identical to the Calculator class I built a moment ago?" — a real
// type check, not a string compare on a `"tool"` field.

function PickAction<T>(request: string) -> T {
    // Inline client shorthand (resolves lazily at call time) rather than a
    // top-level `client X = anthropic.AnthropicClient.new(...)` declaration
    // — a style choice, not a workaround; both forms work fine against the
    // rebuilt bridge. See README for details.
    client: "anthropic/claude-haiku-4-5"
    prompt: `You are a routing layer for a small toolbox app. Read the
        user's request and produce exactly one tool call that satisfies it.

        User request: ${request}

        ${ctx.output_format}`
}

class ToolPick {
    matched bool
    tool string
    args_json string
    prompt_preview string
}

function RouteAndDispatch(
    calculator_on: bool,
    unit_converter_on: bool,
    note_saver_on: bool,
    weather_on: bool,
    request: string,
    mock_json: string?,
) -> ToolPick throws unknown {
    let calc_t = reflect.class.new("Calculator", {
        "expression": reflect.Type.of<string>().meta(
            description = "a math expression using + - * / ( ), e.g. \"2 * (3 + 4)\"",
        ),
    })
    let convert_t = reflect.class.new("UnitConverter", {
        "value": reflect.Type.of<float>().meta(description = "the numeric value to convert"),
        "from_unit": reflect.Type.of<string>().meta(
            alias = "from",
            description = "source unit, e.g. km, miles, celsius, kg",
        ),
        "to_unit": reflect.Type.of<string>().meta(
            alias = "to",
            description = "target unit, e.g. miles, km, fahrenheit, lb",
        ),
    })
    let note_t = reflect.class.new("NoteSaver", {
        "title": reflect.Type.of<string>().meta(description = "a short title for the note"),
        "body": reflect.Type.of<string>().meta(description = "the note's content"),
    })
    let weather_t = reflect.class.new("WeatherLookup", {
        "location": reflect.Type.of<string>().meta(
            alias = "city",
            description = "city name to look up current weather for",
        ),
    })

    let member_types: reflect.Type[] = []
    if (calculator_on) { member_types.push(calc_t.as_type()) }
    if (unit_converter_on) { member_types.push(convert_t.as_type()) }
    if (note_saver_on) { member_types.push(note_t.as_type()) }
    if (weather_on) { member_types.push(weather_t.as_type()) }

    if (member_types.length() == 0) {
        return ToolPick {
            matched: false,
            tool: "",
            args_json: "",
            prompt_preview: "(no tools enabled — nothing to route to)",
        }
    }

    // A one-tool toolbox has nothing to disambiguate; skip the union and
    // route straight to that tool's class.
    let action_t = if (member_types.length() == 1) {
        member_types[0]
    } else {
        reflect.union.new(member_types).as_type()
    }

    let prompt_preview = PickAction$render_prompt<unreflect(action_t)>(request).text()

    let action = if (mock_json != null) {
        PickAction$parse<unreflect(action_t)>(mock_json)
    } else {
        PickAction<unreflect(action_t)>(request)
    }

    let tool = if (action is unreflect(calc_t.as_type())) {
        "calculator"
    } else if (action is unreflect(convert_t.as_type())) {
        "unit_converter"
    } else if (action is unreflect(note_t.as_type())) {
        "note_saver"
    } else if (action is unreflect(weather_t.as_type())) {
        "weather"
    } else {
        ""
    }

    return ToolPick {
        matched: tool != "",
        tool: tool,
        args_json: baml.json.encode(action),
        prompt_preview: prompt_preview,
    }
}
