// ---- App root ----
const { useState, useEffect, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#6d5ef4",
  "density": "balanced",
  "cardStyle": "minimal",
  "separator": "chip"
}/*EDITMODE-END*/;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function darken(hex, f) { const [r, g, b] = hexToRgb(hex).map(v => Math.round(v * (1 - f))); return `rgb(${r},${g},${b})`; }

function applyAccent(hex) {
  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  root.setProperty('--accent-hover', darken(hex, 0.12));
  root.setProperty('--accent-active', darken(hex, 0.22));
  root.setProperty('--accent-text', darken(hex, 0.14));
  root.setProperty('--accent-muted', rgba(hex, 0.10));
  root.setProperty('--accent-border', rgba(hex, 0.35));
  root.setProperty('--accent-ring', rgba(hex, 0.34));
  root.setProperty('--accent-glow', rgba(hex, 0.20));
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState({ name: 'hub' });
  const [palette, setPalette] = useState(false);
  const [toasts, setToasts] = useState([]);

  const go = useCallback((r) => setRoute(r), []);
  const toast = useCallback((tt) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(list => [...list, { id, ...tt }]);
    setTimeout(() => setToasts(list => list.filter(x => x.id !== id)), 2800);
  }, []);

  useEffect(() => { applyAccent(t.accent); }, [t.accent]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tool = route.name === 'tool' ? ALL.find(x => x.id === route.id) : null;

  return (
    <div className="app" data-density={t.density}>
      <Sidebar route={route} go={go} onOpenPalette={() => setPalette(true)} />

      <div className="main">
        <div className="topbar">
          <div className="crumb">
            <button className="c-link" onClick={() => go({ name: 'hub' })}>VibeKit</button>
            <span className="c-sep"><Icon name="chevron-right" size={15} /></span>
            {route.name === 'hub'
              ? <span className="c-cur">Hub</span>
              : <>
                  <button className="c-link" onClick={() => go({ name: 'hub' })}>Tools</button>
                  <span className="c-sep"><Icon name="chevron-right" size={15} /></span>
                  <span className="c-cur">{tool ? tool.name : ''}</span>
                </>
            }
          </div>
          <div className="top-actions">
            <button className="icon-btn" title="Search (⌘K)" onClick={() => setPalette(true)}><Icon name="search" size={17} /></button>
            <button className="icon-btn" title="Documentation"><Icon name="book-open" size={17} /></button>
            <button className="icon-btn" title="Notifications"><Icon name="bell" size={17} /></button>
          </div>
        </div>

        <div className="content">
          {route.name === 'hub'
            ? <Hub go={go} cardStyle={t.cardStyle} />
            : <Beautifier toast={toast} separator={t.separator} />}
        </div>
      </div>

      {/* toasts */}
      <div className="toast-wrap">
        {toasts.map(tt => (
          <div key={tt.id} className={'toast ' + (tt.kind || 'info')}>
            <span className="t-ico"><Icon name={tt.kind === 'ok' ? 'check-circle-2' : 'info'} size={18} /></span>
            <div>
              <div className="t-msg">{tt.msg}</div>
              {tt.sub && <div className="t-sub">{tt.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} go={go} toast={toast} />

      <TweaksPanel>
        <TweakSection label="Accent" />
        <TweakColor label="Accent color" value={t.accent}
          options={['#6d5ef4', '#7c3aed', '#2a6fdb', '#16a268', '#e2434b']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
          options={['compact', 'balanced', 'airy']}
          onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Tool cards" />
        <TweakRadio label="Card style" value={t.cardStyle}
          options={['minimal', 'tile', 'mono']}
          onChange={(v) => setTweak('cardStyle', v)} />
        <TweakSection label="Beautifier" />
        <TweakSelect label="Separator" value={t.separator}
          options={['chip', 'grip', 'line', 'gutter', 'split']}
          onChange={(v) => setTweak('separator', v)} />
      </TweaksPanel>
    </div>
  );
}

function boot() {
  if (window.lucide) window.lucide.createIcons();
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
boot();
