// A toggleable toolbox: each tool's argument schema is minted at request
// time with `reflect.class.new`, and only the tools the user has switched
// ON are folded into the runtime union. A disabled tool's class is never
// constructed into the union in the first place, so the model has no way
// to pick it. Dispatch is the same trick in reverse: `action is
// unreflect(calc_t.as_type())` asks "is this value's minted type identical
// to the class I built a moment ago?" — a real type check, not a string
// compare on a `"tool"` field.

type ToolId = "calculator" | "unit_converter" | "note_saver" | "weather"

function pick_action<T>(request: string) -> T {
    client: "anthropic/claude-haiku-4-5"
    prompt: `
        You are a routing layer for a small toolbox app. Read the
        user's request and produce exactly one tool call that satisfies it.

        User request: ${request}

        ${ctx.output_format}
    `
}

class ToolPick {
    matched bool
    tool string
    args_json string
    prompt_preview string
}

function route_and_dispatch(enabled: ToolId[], request: string) -> ToolPick throws unknown {
    let calc_t = reflect.class.new("Calculator", {
        "expression": reflect.Type.of<string>().meta(
            description = "a math expression using + - * / ( ), e.g. \"2 * (3 + 4)\"",
        ),
    });
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
    });
    let note_t = reflect.class.new("NoteSaver", {
        "title": reflect.Type.of<string>().meta(description = "a short title for the note"),
        "body": reflect.Type.of<string>().meta(description = "the note's content"),
    });
    let weather_t = reflect.class.new("WeatherLookup", {
        "location": reflect.Type.of<string>().meta(
            alias = "city",
            description = "city name to look up current weather for",
        ),
    });

    // Escape hatch, same lesson as demo-1's Unknown category: without it a
    // cornered model invents a refusal shape ({"error": ...}) and the
    // schema-aligned parser coerces it into whichever tool has one string
    // field. Giving "nothing fits" a type of its own keeps every answer
    // honest — and the decline is a parse, not a retry-then-fail.
    let no_tool_t = reflect.class.new("NoTool", {
        "reason": reflect.Type.of<string>().meta(
            description = "use this when none of the other schemas can satisfy the request; explain briefly",
        ),
    });

    let member_types: reflect.Type[] = [];
    if (enabled.includes("calculator")) { member_types.push(calc_t.as_type()); }
    if (enabled.includes("unit_converter")) { member_types.push(convert_t.as_type()); }
    if (enabled.includes("note_saver")) { member_types.push(note_t.as_type()); }
    if (enabled.includes("weather")) { member_types.push(weather_t.as_type()); }

    if (member_types.length() == 0) {
        return ToolPick {
            matched: false,
            tool: "",
            args_json: "",
            prompt_preview: "(no tools enabled — nothing to route to)",
        };
    }

    member_types.push(no_tool_t.as_type());
    let action_t = reflect.union.new(member_types).as_type();

    let prompt_preview = pick_action$render_prompt<unreflect(action_t)>(request).text();
    let action = pick_action<unreflect(action_t)>(request);

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
    };

    ToolPick {
        matched: tool != "",
        tool: tool,
        args_json: baml.json.encode(action),
        prompt_preview: prompt_preview,
    }
}
