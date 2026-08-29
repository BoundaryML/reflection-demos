import { backendPort, frontendPort, type Demo } from "./demos";
import { useHealth } from "./useHealth";

function StatusDot({ port }: { port: number }) {
  const state = useHealth(port);
  const label =
    state === "up" ? "backend up" : state === "down" ? "backend down" : "checking…";
  return (
    <span className="status" title={`${label} (localhost:${port})`}>
      <span className={`status-dot status-dot--${state}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function DemoCard({ demo }: { demo: Demo }) {
  const backend = backendPort(demo.n);
  const frontend = frontendPort(demo.n);
  const href = `http://localhost:${frontend}`;

  return (
    <article className={`card${demo.flagship ? " card--flagship" : ""}`}>
      <header className="card-header">
        <span className="card-number">{String(demo.n).padStart(2, "0")}</span>
        <div className="card-heading">
          <h2>
            <a href={href} target="_blank" rel="noreferrer">
              {demo.title}
            </a>
          </h2>
          <span className="concept-tag">{demo.concept}</span>
        </div>
        {demo.flagship && <span className="flagship-badge">flagship</span>}
      </header>

      <p className="card-hook">{demo.hook}</p>
      <p className="card-scenario">{demo.scenario}</p>

      <footer className="card-footer">
        <StatusDot port={backend} />
        <a className="card-link" href={href} target="_blank" rel="noreferrer">
          localhost:{frontend} &rarr;
        </a>
      </footer>
    </article>
  );
}
