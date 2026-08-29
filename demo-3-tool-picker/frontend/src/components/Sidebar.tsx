import type { ToolId, ToolMeta } from "../api.js";

interface SidebarProps {
  tools: ToolMeta[];
  enabled: Set<ToolId>;
  onToggle: (id: ToolId) => void;
  mock: boolean | null;
}

export default function Sidebar({ tools, enabled, onToggle, mock }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Toggleable Toolbox</h1>
        <p className="subtitle">Switch tools on or off — the assistant can only ever pick one that's on.</p>
      </div>

      <div className="tool-list">
        {tools.map((tool) => {
          const isOn = enabled.has(tool.id);
          return (
            <button
              key={tool.id}
              type="button"
              className={`tool-card ${isOn ? "on" : "off"}`}
              onClick={() => onToggle(tool.id)}
              aria-pressed={isOn}
            >
              <span className="tool-icon" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="tool-copy">
                <span className="tool-name">{tool.label}</span>
                <span className="tool-desc">{tool.description}</span>
              </span>
              <span className={`toggle ${isOn ? "on" : "off"}`} aria-hidden="true">
                <span className="toggle-knob" />
              </span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        {mock === null ? null : (
          <span className={`mode-badge ${mock ? "mock" : "live"}`}>
            {mock ? "Mock mode — offline" : "Live — calling Claude"}
          </span>
        )}
      </div>
    </aside>
  );
}
