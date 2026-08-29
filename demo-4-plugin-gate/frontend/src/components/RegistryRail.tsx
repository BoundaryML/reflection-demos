import type { Plugin } from "../api.js";

export function RegistryRail({
  plugins,
  selected,
  onSelect,
  onRemove,
}: {
  plugins: Plugin[];
  selected: string | null;
  onSelect: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  return (
    <section className="card rail-card">
      <h2 className="rail-title">
        Installed <span className="count">{plugins.length}</span>
      </h2>
      {plugins.length === 0 && <p className="rail-note">Nothing has passed the gate yet.</p>}
      <ul className="registry">
        {plugins.map((plugin) => (
          <li key={plugin.name}>
            <button
              type="button"
              className={`registry-item${selected === plugin.name ? " registry-item-on" : ""}`}
              onClick={() => onSelect(plugin.name)}
            >
              <span className="registry-name">{plugin.name}</span>
              <span className="registry-vendor">{plugin.vendor}</span>
              <span className="registry-fields">
                {plugin.fields.map((field) => (
                  <span
                    key={field.name}
                    className={`pill${field.contract ? " pill-contract" : ""}`}
                    title={field.contract ? "answers the contract" : "the plugin's own field"}
                  >
                    {field.name}
                  </span>
                ))}
              </span>
            </button>
            <button
              type="button"
              className="registry-remove"
              title={`Remove ${plugin.name}`}
              onClick={() => onRemove(plugin.name)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
