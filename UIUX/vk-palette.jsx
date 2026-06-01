// ---- Command palette (⌘K) ----
function CommandPalette({ open, onClose, go, toast }) {
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);

  const items = [
    { id: 'home', icon: 'layout-grid', label: 'Go to hub', kind: 'Nav', run: () => go({ name: 'hub' }) },
    ...ALL.map(t => ({
      id: t.id, icon: t.icon, label: t.name,
      kind: t.status === 'active' ? 'Tool' : (t.status === 'ai' ? 'AI' : 'Soon'),
      run: () => {
        if (t.status === 'active') go({ name: 'tool', id: t.id });
        else toast({ kind: 'info', msg: t.name + ' is not ready', sub: t.status === 'ai' ? 'AI feature — coming soon.' : 'Upcoming tool.' });
      },
    })),
  ];
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));

  React.useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);
  React.useEffect(() => { setSel(0); }, [q]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[sel]) { filtered[sel].run(); onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, sel]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '13vh', zIndex: 65, animation: 'scrimIn var(--dur-base) var(--ease-out)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 564, maxWidth: '90vw', background: 'var(--surface-1)', border: '1px solid var(--border-strong)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', animation: 'paletteIn var(--dur-base) var(--ease-out)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Icon name="search" size={18} style={{ color: 'var(--fg-3)' }} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search tools or jump to…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--fg-1)', fontFamily: 'var(--font-sans)', fontSize: 16 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: '2px 6px' }}>esc</span>
        </div>
        <div className="palette-list" style={{ maxHeight: 348, overflow: 'auto', padding: 8 }}>
          {filtered.length === 0 && (
            <div style={{ padding: '26px 12px', textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}>No matches for “{q}”.</div>
          )}
          {filtered.map((it, i) => (
            <div key={it.id} onMouseEnter={() => setSel(i)} onClick={() => { it.run(); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 11px', borderRadius: 9, cursor: 'pointer',
                background: i === sel ? 'var(--accent-muted)' : 'transparent', color: i === sel ? 'var(--accent-text)' : 'var(--fg-2)' }}>
              <Icon name={it.icon} size={17} style={{ color: i === sel ? 'var(--accent-text)' : 'var(--fg-3)', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>{it.label}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-4)' }}>{it.kind}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
