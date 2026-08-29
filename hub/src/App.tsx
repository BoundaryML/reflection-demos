import { demos } from "./demos";
import { DemoCard } from "./DemoCard";

export default function App() {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">BAML &middot; BEP-066</p>
        <h1>Reflection Lab</h1>
        <p className="hero-lede">
          Types as runtime values — enums, classes, unions, packages, and
          sessions built <em>while the program runs</em>, not baked in ahead
          of time. Seven small products, each built on one reflection
          primitive. Click through — the BAML behind each one is a few lines
          long.
        </p>
      </header>

      <main className="grid">
        {demos.map((demo) => (
          <DemoCard key={demo.n} demo={demo} />
        ))}
      </main>

      <footer className="page-footer">
        <p>
          Hub runs on <code>localhost:4400</code>. Each demo is its own
          package under <code>demo-N-*/</code> — run everything with{" "}
          <code>pnpm install &amp;&amp; pnpm dev</code> from the repo root.
        </p>
      </footer>
    </div>
  );
}
