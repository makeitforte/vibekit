import { HubTopbarClient } from "@/components/hub/hub-topbar-client";
import { ToolCard } from "@/components/hub/tool-card";
import { TOOLS, ASSIST } from "@/data/tools";

export default function HubPage() {
  const activeCount = TOOLS.filter((t) => t.status === "active").length;
  const soonCount = TOOLS.filter((t) => t.status === "soon").length;

  return (
    <>
      <HubTopbarClient />
      <div className="hub-content">
        <div className="hub">
          <p className="hub-eyebrow">Your toolkit</p>
          <h1 className="hub-title">Good morning, Jordan.</h1>
          <p className="hub-sub">
            Everything you reach for while you build, in one keyboard-driven place.
            Pick a tool to get going.
          </p>
          <div className="hub-stats">
            <div className="stat"><b>{activeCount}</b><span>Active</span></div>
            <div className="stat"><b>{soonCount}</b><span>Upcoming</span></div>
            <div className="stat"><b>{ASSIST.length}</b><span>AI features</span></div>
          </div>

          <div className="section-header">
            <h2>Tools</h2>
            <span className="section-meta">{TOOLS.length}</span>
            <span className="section-line" />
          </div>
          <div className="tool-grid">
            {TOOLS.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </div>

          <div className="section-header">
            <h2>Personal assistance</h2>
            <span className="section-meta">AI</span>
            <span className="section-line" />
          </div>
          <div className="tool-grid">
            {ASSIST.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
          </div>
        </div>
      </div>
    </>
  );
}
