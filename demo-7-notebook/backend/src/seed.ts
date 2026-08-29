/**
 * The notebook a new tab opens with — a guided tour that ends with the reader
 * holding a live session they can type into.
 *
 * Every BAML cell here has been run against the engine; the prose promises
 * only what the cells actually do.
 */

export interface SeedCell {
  kind: 'note' | 'baml';
  source: string;
}

export const SEED_CELLS: SeedCell[] = [
  {
    kind: 'note',
    source: [
      '# A notebook over the running service',
      '',
      'Every cell below is evaluated in a **`reflect.Session`** that belongs to this',
      'browser tab. Bindings, classes and functions persist from one cell to the next,',
      'and the support package the service ships is mounted as **`app`**.',
      '',
      'Run a cell with the ▶ button, or **⌘/Ctrl + Enter**.',
    ].join('\n'),
  },

  {
    kind: 'note',
    source: [
      '## 1 · The production package is already here',
      '',
      'No fixtures, no seeding. `app` is the real package — the same code that answers',
      'requests — reflected into the session.',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: 'app.LoadTickets().length()',
  },
  {
    kind: 'baml',
    source: 'app.Headline(app.GetTicket("SUP-1044"))',
  },

  {
    kind: 'note',
    source: [
      '## 2 · Declare a type, mid-session',
      '',
      'A cell can declare classes, functions, enums and type aliases. They are minted',
      "inside *this* session — the identical declaration in another tab is a different",
      'type, not a shared one.',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: ['class Digest {', '  id string', '  headline string', '  urgency string', '  channel string', '}'].join(
      '\n',
    ),
  },

  {
    kind: 'note',
    source: [
      '## 3 · Build one, using the app',
      '',
      '`Digest` from the last cell is still in scope, and so is everything `app` exports.',
      'This is the whole point: a REPL that reaches straight into production code.',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: [
      'let ticket = app.GetTicket("SUP-1044")',
      '',
      'let digest = Digest {',
      '  id: "SUP-1044",',
      '  headline: app.Headline(ticket),',
      '  urgency: app.Urgency(ticket),',
      '  channel: app.Slug(app.Headline(ticket)),',
      '}',
      '',
      'digest',
    ].join('\n'),
  },

  {
    kind: 'note',
    source: [
      '## 4 · State persists',
      '',
      '`digest` outlives the cell that made it. Read a field back:',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: 'digest.channel',
  },

  {
    kind: 'note',
    source: [
      '## 5 · This notebook is yours alone',
      '',
      'Run the next cell a few times and watch the count climb. Then hit',
      '**Open a second notebook** in the header and run the same two cells there:',
      'the two counters never meet, because they live in two different sessions.',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: 'let runs = 0',
  },
  {
    kind: 'baml',
    source: ['runs = runs + 1', 'runs'].join('\n'),
  },

  {
    kind: 'note',
    source: [
      "## 6 · A cell that doesn't compile",
      '',
      'A submission is type-checked before any of it runs, so a broken cell changes',
      "nothing at all. You get the compiler's real diagnostics — code, message and the",
      'submission it came from — and the session is untouched.',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: 'digest.no_such_field',
  },
  {
    kind: 'baml',
    source: 'digest.urgency  // still fine',
  },

  {
    kind: 'note',
    source: [
      '## 7 · A cell that throws halfway',
      '',
      'Containment is a committed prefix, not a rollback. Statements that already ran',
      'stay; the one that threw and everything after it never happened. Run all three',
      'cells below in order.',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: [
      'let kept = "this statement ran"',
      'let boom = app.GetTicket("SUP-9999")   // no such ticket',
      'let never = "this one did not"',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: 'kept',
  },
  {
    kind: 'baml',
    source: 'never',
  },

  {
    kind: 'note',
    source: [
      '## 8 · Scratch space',
      '',
      'The package is yours. Try:',
      '',
      '- `app.LoadTickets().map((t) -> { app.Urgency(t) })`',
      '- `app.Elapsed(402)`',
      '- `app.Slug("Seat count wrong after removing a teammate")`',
      '- `app.AssessPrompt(app.GetTicket("SUP-1041"))` — the prompt the model would see',
      '- `app.Assess(app.GetTicket("SUP-1041"))` — structured triage',
    ].join('\n'),
  },
  {
    kind: 'baml',
    source: 'app.LoadTickets().map((t) -> { app.Urgency(t) })',
  },
];
