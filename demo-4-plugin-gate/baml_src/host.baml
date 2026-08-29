// Plumbing: the long-lived plugin host.
//
// This is the process the web backend talks to. It reads one JSON request per
// line on stdin and writes one JSON reply per line on stdout, and it holds the
// minted plugin types in `plugins` for the whole session — a runtime type stays
// usable for as long as something holds it.

class Request {
    id: string,
    /// "install" | "invoke" | "force"
    op: string,
    name: string?,
    source: string?,
    bindings: map<string, string>?,
    document: string?,
    /// A canned model response. Present in mock mode, absent in live mode.
    canned: string?,
}

class Reply {
    id: string,
    ok: bool,
    manifest: string?,
    fields: PluginField[]?,
    report: Report?,
    error: Failure?,
}

class Failure {
    message: string,
    diagnostics: Diagnostic[],
}

class Diagnostic {
    code: string,
    message: string,
    file: string?,
    start: int?,
    end: int?,
}

function plugin_host() -> null {
    let plugins: map<string, reflect.class.Type> = {};
    let answered: map<string, string[]> = {};

    while (true) {
        let line = baml.io.input(null);
        if (line == "") {
            break;
        }
        let request = baml.json.from_string<Request>(line);

        let reply = {
            if (request.op == "install") {
                let submission = submission_of(request);
                let plugin = mint(submission);
                let backing = submission.bindings.values();
                plugins.set(submission.name, plugin);
                answered.set(submission.name, backing);
                Reply {
                    id: request.id,
                    ok: true,
                    manifest: manifest(plugin),
                    fields: describe(plugin, backing),
                    report: null,
                    error: null,
                }
            } else if (request.op == "invoke") {
                let name = request.name ?? throw "the request names no plugin";
                let plugin = plugins.get(name) ?? throw "`" + name + "` is not installed";
                run(request, plugin, answered.get(name) ?? [])
            } else if (request.op == "force") {
                // Load the plugin the way an unchecked loader would — no witness — and
                // then use it anyway. Gate 2 answers.
                run(request, mint(submission_of(request), sign = false), [])
            } else {
                throw "unknown op `" + request.op + "`"
            }
        } catch (error) {
            _ => {
                Reply {
                    id: request.id,
                    ok: false,
                    manifest: null,
                    fields: null,
                    report: null,
                    error: failure(error),
                }
            }
        };

        baml.io.println(baml.json.encode(reply))
    }
    null
}

function run(request: Request, plugin: reflect.class.Type, answered: string[]) -> Reply {
    let report = {
        type P = unreflect(plugin.as_type());
        invoke<P>(request.document ?? "", request.canned, answered)
    };
    Reply { id: request.id, ok: true, manifest: null, fields: null, report: report, error: null }
}

function submission_of(request: Request) -> Submission {
    Submission {
        name: request.name ?? throw "the request names no plugin",
        source: request.source ?? throw "the request carries no plugin source",
        bindings: request.bindings ?? {},
    }
}

/// Flatten anything thrown into the wire shape the UI renders.
function failure(error: unknown) -> Failure throws never {
    if (error is reflect.errors.CompilationError) {
        let diagnostics: Diagnostic[] = [];
        for (let d in error.diagnostics) {
            let span = d.span;
            if (span == null) {
                diagnostics.push(
                    Diagnostic {
                        code: d.code,
                        message: d.message,
                        file: null,
                        start: null,
                        end: null,
                    },
                )
            } else {
                diagnostics.push(
                    Diagnostic {
                        code: d.code,
                        message: d.message,
                        file: span.file,
                        start: span.start,
                        end: span.end,
                    },
                )
            }
        }
        return Failure { message: error.message, diagnostics: diagnostics };
    }
    if (error is string) {
        return Failure { message: error, diagnostics: [] };
    }
    Failure { message: string.from(error), diagnostics: [] }
}
