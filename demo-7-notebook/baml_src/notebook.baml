// ═════════════════════════════════════════════════════════════════════════
// The notebook.
//
// This is the entire backend. A notebook is one `reflect.Session` with the
// production package mounted as `app`; running a cell is one `eval`.
//
// Sessions are generative: two notebooks that declare the same class get two
// different types, so two readers never share a binding.
// ═════════════════════════════════════════════════════════════════════════

/// Opens a notebook. The host keeps the returned Session for as long as the
/// browser tab is alive; every cell that tab runs lands in this one.
function OpenNotebook() -> reflect.Session throws unknown {
    reflect.Session.new(packages = { "app": reflect.Package.current() })
}

/// Runs one cell. A submission is compiled before any of it executes, so a
/// cell that does not compile changes nothing; a cell that throws part way
/// keeps the statements that already ran. Either way the notebook survives.
function RunCell(notebook: reflect.Session, source: string) -> unknown throws unknown {
    notebook.eval(source)
}
