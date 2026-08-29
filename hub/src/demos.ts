export interface Demo {
  /** 1-7, matches demo-N-* directory numbering and the 44N0/44N1 port scheme. */
  n: number;
  slug: string;
  title: string;
  concept: string;
  hook: string;
  scenario: string;
  flagship?: boolean;
}

/**
 * Card metadata for the seven reflection demos.
 * Ports follow CONVENTIONS.md: demo N backend = 44N0, frontend = 44N1.
 * `slug` matches the demo-N-<slug> directory name and the root
 * package.json pnpm --filter name (demo-N-<slug>).
 */
export const demos: Demo[] = [
  {
    n: 1,
    slug: "live-enums",
    title: "Live Triage",
    concept: "runtime enums",
    hook: "The triage queue's priority levels aren't in any schema file — they're an enum BAML builds while the ticket is being read.",
    scenario:
      "An LLM extraction function is handed an enum type assembled at request time (the live set of priority/category tags) instead of one fixed at compile time. Add or rename a tag and the very next extraction call honors it — no redeploy.",
  },
  {
    n: 2,
    slug: "form-builder",
    title: "Design-a-Form Extraction",
    concept: "runtime classes",
    hook: "Draw a form in the browser; BAML mints a matching class on the spot and extracts real data straight into it.",
    scenario:
      "A user-defined field layout becomes a live BAML class via reflection, and an extraction function targets that class immediately — no codegen step, no restart between designing the form and running it.",
  },
  {
    n: 3,
    slug: "tool-picker",
    title: "Toggleable Toolbox",
    concept: "tool unions",
    hook: "Flip tools on and off and watch the model's dispatch union grow and shrink in real time.",
    scenario:
      "A set of tool definitions, toggled live by the user, compose a runtime union type. The dispatch call only ever sees — and can only ever pick — whichever tools are currently enabled.",
  },
  {
    n: 4,
    slug: "plugin-gate",
    title: "Plugin Registry",
    concept: "witnessed contracts",
    hook: "Submit a plugin; the registry checks, at runtime, that it actually satisfies the interface it claims to implement.",
    scenario:
      "Plugins are checked against an interface contract with no compile step of their own — the registry produces a pass/fail witness live and only admits plugins that hold one.",
  },
  {
    n: 5,
    slug: "schema-studio",
    title: "Schema Studio",
    concept: "Package.compile",
    hook: "Type a schema, hit compile, and watch BAML build a whole package — types, functions, clients — from plain text.",
    scenario:
      "BAML source submitted as text at runtime is compiled with Package.compile into a full package and made immediately callable. This is the mechanism the other six demos are built on top of.",
    flagship: true,
  },
  {
    n: 6,
    slug: "api-explorer",
    title: "Self-Describing API",
    concept: "Package.current",
    hook: "Ask the API what it can do, and it answers by introspecting its own running package.",
    scenario:
      "An endpoint calls Package.current() to reflect over its own compiled package, generating live documentation and type schemas for itself instead of maintaining them by hand.",
  },
  {
    n: 7,
    slug: "notebook",
    title: "BAML Notebook",
    concept: "sessions",
    hook: "A REPL-style notebook where every cell runs in its own isolated session, packages mounted on demand.",
    scenario:
      "Each notebook cell evaluates inside its own Session, with its own mounted packages and state, so cells can experiment freely without stepping on one another.",
  },
];

export const backendPort = (n: number) => 4400 + n * 10;
export const frontendPort = (n: number) => 4400 + n * 10 + 1;
