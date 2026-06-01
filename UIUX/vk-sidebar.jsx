// ---- Sidebar ----
function Sidebar({ route, go, onOpenPalette }) {
  return (
    <aside className="side">
      <div className="side-top">
        <img className="brand-mark" src="assets/logomark.svg" alt="VibeKit" />
        <span className="brand-name">VibeKit</span>
        <span className="brand-badge">beta</span>
      </div>

      <button className="palette-trigger" onClick={onOpenPalette}>
        <Icon name="search" size={15} />
        <span>Search tools…</span>
        <span className="kbd">⌘K</span>
      </button>

      <div className="side-scroll">
        <div className="nav-label">
          <span>Tools</span>
          <span className="lcount">{TOOLS.filter(t => t.status === 'active').length} active</span>
        </div>
        <nav className="nav">
          {TOOLS.map(t => {
            const active = t.status === 'active';
            const here = route.name === 'tool' && route.id === t.id;
            return (
              <button key={t.id} className={'nav-item' + (here ? ' active' : '') + (active ? '' : ' soon')}
                onClick={() => active && go({ name: 'tool', id: t.id })}>
                <Icon name={t.icon} size={17} />
                <span>{t.name}</span>
                {!active && <span className="ni-tag">soon</span>}
              </button>
            );
          })}
        </nav>

        <div className="nav-label"><span>Personal assistance</span></div>
        <nav className="nav">
          {ASSIST.map(t => (
            <button key={t.id} className="nav-item soon" onClick={() => {}}>
              <Icon name={t.icon} size={17} />
              <span>{t.name}</span>
              <span className="ni-tag ai">AI</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="side-foot">
        <div className="avatar">JK</div>
        <div style={{ minWidth: 0 }}>
          <div className="who">Jordan Kessler</div>
          <div className="plan">Free plan</div>
        </div>
        <button className="cog" title="Settings"><Icon name="settings-2" size={16} /></button>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
