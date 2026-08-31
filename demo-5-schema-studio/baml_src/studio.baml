// Schema Studio.
//
// The text in the editor is never templated, matched or trusted — it goes
// straight into `reflect.Package.compile`, and whatever the compiler says comes
// back as structured diagnostics with real source spans. Compiling is local, so
// it runs on every keystroke; the model is only involved when you ask it to be.

class Note {
    code string
    message string
    file string?
    start int
    end int
}

class Member {
    name string
    type string
    description string?
}

class Record {
    name string
    fields Member[]
}

class Compilation {
    ok bool
    records Record[]
    notes Note[]
    /// Wall time of `reflect.Package.compile` alone, in microseconds.
    micros bigint
}

class Extraction {
    prompt string
    response string
}

class SchemaDraft {
    prompt string
    schema string
}

// ── compile ─────────────────────────────────────────────────────────────────

/// Compile the editor's text and report what the compiler found.
function CompileSchema(source: string) -> Compilation throws unknown {
    let started = baml.time.Instant.now()
    let pkg = reflect.Package.compile({ "schema.baml": source }) catch (e) {
        let rejected: reflect.errors.CompilationError => return Compilation {
            ok: false,
            records: [],
            notes: retell(rejected.diagnostics),
            micros: elapsed_micros(started),
        },
        _ => throw e,
    }
    Compilation {
        ok: true,
        records: declared(pkg),
        notes: retell(pkg.diagnostics()),
        micros: elapsed_micros(started),
    }
}

/// The classes the package declares, with their fields.
function declared(pkg: reflect.Package) -> Record[] throws never {
    let out: Record[] = []
    let classes = pkg.classes()
    for (let key in classes.keys()) {
        // Every class gets a `Foo$stream` partial twin; the studio shows the real one.
        if (!key.ends_with("$stream")) {
            if let found: reflect.class.Type = classes.get(key) {
                out.push(Record { name: unqualify(key), fields: members(found) })
            }
        }
    }
    out
}

function members(found: reflect.class.Type) -> Member[] throws never {
    found.fields().map((f: reflect.class.Field) -> Member {
        Member {
            name: f.name,
            type: f.type?.to_string() ?? "unknown",
            description: f.meta.description,
        }
    })
}

/// Compiler diagnostics, flattened for the wire. Spans are byte offsets into
/// the submitted file — the editor turns them back into line and column.
function retell(found: reflect.Diagnostic[]) -> Note[] throws never {
    found.map((d: reflect.Diagnostic) -> Note {
        Note {
            code: d.code,
            message: d.message,
            file: d.span?.file,
            start: d.span?.start ?? 0,
            end: d.span?.end ?? 0,
        }
    })
}

// ── extract ─────────────────────────────────────────────────────────────────

/// Extract a document into one of the classes the editor just defined:
/// compile the editor's text, bind the chosen class as a type, and make a
/// generic LLM call over it.
function RunExtraction(source: string, record: string, document: string) -> Extraction throws unknown {
    let pkg = reflect.Package.compile({ "schema.baml": source });
    let target = pkg.get_class(record) ?? throw `the package has no class named ${record}`;
    // NOTE: inline `unreflect(shape)` at each use site, not `type T = ...` —
    // at this canary a named binding drops the package's sibling classes
    // (`LineItem`), and extraction dies with "host-supplied type names
    // unknown declaration". Same engine edge demo-7's README documents.
    let shape = target.as_type();

    Extraction {
        prompt: Extract$render_prompt<unreflect(shape)>(document).text(),
        response: json.encode(Extract<unreflect(shape)>(document)),
    }
}

// ── draft ───────────────────────────────────────────────────────────────────

/// Ask the model for a schema. Its text lands in the editor and compiles
/// like anything a human typed.
function DraftSchema(description: string) -> SchemaDraft throws unknown {
    SchemaDraft {
        prompt: Draft$render_prompt(description).text(),
        schema: Draft(description),
    }
}

// ── helpers ─────────────────────────────────────────────────────────────────

/// `classes()` keys are package-absolute (`root.Invoice`); the editor shows the
/// name the user typed.
function unqualify(key: string) -> string throws never {
    key.replace("root.", "")
}

function elapsed_micros(started: baml.time.Instant) -> bigint throws never {
    started.elapsed().to_microseconds()
}
