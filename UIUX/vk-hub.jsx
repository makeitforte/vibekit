// ---- Landing hub ----
const HUB_CSS = `
.hub { padding: var(--pad-page); max-width: 1180px; margin: 0 auto; animation: fadeUp var(--dur-slow) var(--ease-out); }
.hub-head { margin-bottom: 34px; }
.hub-eyebrow { font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--accent-text); margin: 0 0 12px; }
.hub-title { font-family: var(--font-display); font-size: 38px; font-weight: 600; letter-spacing: -0.02em;
  line-height: 1.1; color: var(--fg-1); margin: 0 0 10px; }
.hub-sub { font-family: var(--font-sans); font-size: 16px; color: var(--fg-3); margin: 0; max-width: 56ch; line-height: 1.5; }
.hub-stats { display: flex; gap: 28px; margin-top: 22px; }
.hub-stat { display: flex; flex-direction: column; gap: 2px; }
.hub-stat b { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--fg-1); letter-spacing: -0.01em; }
.hub-stat span { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-4); }

.sec-head { display: flex; align-items: baseline; gap: 10px; margin: 38px 0 16px; }
.sec-head h2 { font-family: var(--font-display); font-size: 17px; font-weight: 600; letter-spacing: -0.01em; color: var(--fg-1); margin: 0; }
.sec-head .sec-meta { font-family: var(--font-mono); font-size: 11px; color: var(--fg-4); }
.sec-head .sec-line { flex: 1; height: 1px; background: var(--border-subtle); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(264px, 1fr)); gap: var(--gap-card); }

/* ===== base card ===== */
.tcard { position: relative; text-align: left; border-radius: var(--radius-lg); cursor: pointer;
  background: var(--surface-1); border: 1px solid var(--border-subtle); padding: 20px;
  display: flex; flex-direction: column; gap: 12px; min-height: 168px; font-family: var(--font-sans);
  transition: border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out),
              transform var(--dur-base) var(--ease-out); }
.tcard .tc-icon { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center;
  justify-content: center; color: var(--accent); background: var(--accent-muted); flex-shrink: 0;
  transition: transform var(--dur-base) var(--ease-out); }
.tcard .tc-name { font-size: 15px; font-weight: 600; color: var(--fg-1); margin: 0; letter-spacing: -0.01em; }
.tcard .tc-blurb { font-size: 13px; line-height: 1.5; color: var(--fg-3); margin: 0; }
.tcard .tc-foot { margin-top: auto; display: flex; align-items: center; gap: 8px; }
.tcard .tc-tag { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--fg-4); border: 1px solid var(--border-subtle); border-radius: var(--radius-full); padding: 3px 9px; }
.tcard .tc-run { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;
  color: var(--accent-text); opacity: 0; transform: translateX(-4px);
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }

/* active hover — border zoom + lift, run indicator reveal */
.tcard.active:hover { border-color: var(--accent-border); box-shadow: var(--glow-accent); transform: translateY(-3px); }
.tcard.active:hover .tc-icon { transform: scale(1.08); }
.tcard.active:hover .tc-run { opacity: 1; transform: none; }
.tcard.active:focus-visible { border-color: var(--accent-border); box-shadow: 0 0 0 3px var(--accent-ring); }

/* upcoming / ai — translucent grayscale */
.tcard.locked { cursor: default; background: var(--surface-1); opacity: 0.66; }
.tcard.locked .tc-icon { color: var(--fg-3); background: var(--surface-3); filter: grayscale(1); }
.tcard.locked:hover { border-color: var(--border-strong); opacity: 0.82; }
.tcard.locked.ai .tc-badge { color: var(--accent-text); background: var(--accent-muted); }
.tc-badge { position: absolute; top: 16px; right: 16px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.06em;
  text-transform: uppercase; padding: 4px 8px; border-radius: var(--radius-full); color: var(--fg-3); background: var(--surface-3);
  display: inline-flex; align-items: center; gap: 5px; }

/* ===== direction: tile (OS app-tile motif) ===== */
.grid[data-cardstyle="tile"] .tcard { align-items: flex-start; }
.grid[data-cardstyle="tile"] .tc-icon { width: 52px; height: 52px; border-radius: var(--radius-lg); }
.grid[data-cardstyle="tile"] .tcard.active { background: linear-gradient(180deg, var(--surface-1), var(--surface-3)); }

/* ===== direction: mono (developer / terminal) ===== */
.grid[data-cardstyle="mono"] .tcard { border-radius: var(--radius-md); padding-top: 30px; }
.grid[data-cardstyle="mono"] .tc-icon { width: 34px; height: 34px; border-radius: var(--radius-sm); background: transparent;
  border: 1px solid var(--border-strong); }
.grid[data-cardstyle="mono"] .tcard::before { content: attr(data-idx); position: absolute; top: 12px; left: 20px;
  font-family: var(--font-mono); font-size: 10px; color: var(--fg-4); letter-spacing: 0.04em; }
.grid[data-cardstyle="mono"] .tc-name { font-family: var(--font-mono); font-size: 13.5px; font-weight: 600; }
.grid[data-cardstyle="mono"] .tc-run { font-family: var(--font-mono); font-weight: 500; }
`;

function ToolCard({ tool, idx, go, cardStyle }) {
  const active = tool.status === 'active';
  const ai = tool.status === 'ai';
  const badge = active ? null : (ai ? 'AI feature' : 'Upcoming');
  const onActivate = () => active && go({ name: 'tool', id: tool.id });
  return (
    <button
      className={'tcard ' + (active ? 'active' : 'locked') + (ai ? ' ai' : '')}
      data-idx={String(idx + 1).padStart(2, '0')}
      onClick={onActivate}
      tabIndex={active ? 0 : -1}
      aria-disabled={!active}
    >
      {badge && (
        <span className="tc-badge">
          {ai && <Icon name="sparkles" size={10} />}{badge}
        </span>
      )}
      <span className="tc-icon"><Icon name={tool.icon} size={cardStyle === 'tile' ? 24 : 20} /></span>
      <h3 className="tc-name">{tool.name}</h3>
      <p className="tc-blurb">{tool.blurb}</p>
      <div className="tc-foot">
        <span className="tc-tag">{tool.tag}</span>
        {active && (
          <span className="tc-run">Run tool <Icon name="arrow-right" size={14} /></span>
        )}
      </div>
    </button>
  );
}

function Hub({ go, cardStyle }) {
  return (
    <div className="hub">
      <style>{HUB_CSS}</style>
      <div className="hub-head">
        <p className="hub-eyebrow">Your toolkit</p>
        <h1 className="hub-title">Good evening, Jordan.</h1>
        <p className="hub-sub">Everything you reach for while you build, in one keyboard-driven place. Pick a tool to get going.</p>
        <div className="hub-stats">
          <div className="hub-stat"><b>1</b><span>Active</span></div>
          <div className="hub-stat"><b>{TOOLS.length - 1}</b><span>Upcoming</span></div>
          <div className="hub-stat"><b>{ASSIST.length}</b><span>AI features</span></div>
        </div>
      </div>

      <div className="sec-head">
        <h2>Tools</h2>
        <span className="sec-meta">{TOOLS.length}</span>
        <span className="sec-line"></span>
      </div>
      <div className="grid" data-cardstyle={cardStyle}>
        {TOOLS.map((t, i) => <ToolCard key={t.id} tool={t} idx={i} go={go} cardStyle={cardStyle} />)}
      </div>

      <div className="sec-head">
        <h2>Personal assistance</h2>
        <span className="sec-meta">AI</span>
        <span className="sec-line"></span>
      </div>
      <div className="grid" data-cardstyle={cardStyle}>
        {ASSIST.map((t, i) => <ToolCard key={t.id} tool={t} idx={TOOLS.length + i} go={go} cardStyle={cardStyle} />)}
      </div>
    </div>
  );
}

Object.assign(window, { Hub, ToolCard });
