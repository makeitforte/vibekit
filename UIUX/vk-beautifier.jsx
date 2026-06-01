// ---- HTML Beautifier tool space ----
const BF_CSS = `
.bf { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.bf-head { padding: 20px var(--pad-page) 16px; display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
.bf-head .bf-ico { width: 38px; height: 38px; border-radius: var(--radius-md); background: var(--accent-muted);
  color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.bf-head h1 { font-family: var(--font-display); font-size: 20px; font-weight: 600; letter-spacing: -0.01em; margin: 0; color: var(--fg-1); }
.bf-head p { font-size: 13px; color: var(--fg-3); margin: 2px 0 0; }
.bf-head .bf-opts { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.bf-seg { display: inline-flex; background: var(--surface-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 3px; gap: 2px; }
.bf-seg button { font-family: var(--font-mono); font-size: 11px; font-weight: 500; color: var(--fg-3); background: none; border: none;
  padding: 5px 11px; border-radius: var(--radius-sm); cursor: pointer; transition: background var(--dur-fast), color var(--dur-fast); }
.bf-seg button.on { background: var(--surface-1); color: var(--fg-1); box-shadow: var(--shadow-sm); }
.bf-seg-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-4); }

.bf-split { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  margin: 0 var(--pad-page); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
  overflow: hidden; background: var(--surface-1); position: relative; }
.bf-col { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.bf-col + .bf-col { border-left: 1px solid var(--border-strong); }
.bf-seam { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  border-radius: var(--radius-full); background: var(--surface-1); border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-md); display: flex; align-items: center; justify-content: center;
  color: var(--accent); z-index: 3; pointer-events: none; }
.bf-seam.chip { width: 32px; height: 32px; }
.bf-seam.grip { width: 15px; height: 48px; gap: 3px; color: var(--fg-4); }
.bf-seam.grip span { width: 2px; height: 16px; border-radius: 2px; background: currentColor; }
.bf-channel { position: absolute; left: 50%; top: 0; bottom: 0; width: 10px; transform: translateX(-50%);
  background: var(--bg-sunken); border-left: 1px solid var(--border-strong); border-right: 1px solid var(--border-strong);
  z-index: 1; pointer-events: none; }
.bf-split[data-sep="line"] .bf-col + .bf-col { border-left: 2px solid var(--border-strong); }
.bf-split[data-sep="gutter"] .bf-col + .bf-col { border-left: none; }
/* split — two separate cards with a gap, bridged by the chip */
.bf-split[data-sep="split"] { border: none; background: transparent; gap: 20px; overflow: visible; }
.bf-split[data-sep="split"] .bf-col { border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
  overflow: hidden; background: var(--surface-1); box-shadow: var(--shadow-sm); }
.bf-split[data-sep="split"] .bf-col + .bf-col { border-left: 1px solid var(--border-subtle); }
.bf-colhead { display: flex; align-items: center; gap: 9px; padding: 11px 16px; border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0; background: var(--surface-1); }
.bf-colhead .ch-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fg-2); font-weight: 500; }
.bf-colhead .ch-dot { width: 6px; height: 6px; border-radius: 50%; }
.bf-colhead .ch-meta { margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--fg-4); }
.bf-colhead .ch-btn { background: none; border: none; color: var(--fg-3); cursor: pointer; padding: 4px; border-radius: var(--radius-sm); display: inline-flex; }
.bf-colhead .ch-btn:hover { background: var(--surface-3); color: var(--fg-1); }

.bf-editor { flex: 1; min-height: 0; display: flex; overflow: hidden; background: var(--bg-sunken); position: relative; }
.bf-gutter { flex-shrink: 0; padding: 14px 10px 14px 14px; text-align: right; overflow: hidden; user-select: none;
  font-family: var(--font-mono); font-size: 12.5px; line-height: 1.65; color: var(--fg-4);
  background: var(--surface-1); border-right: 1px solid var(--border-subtle); }
.bf-gutter div { height: 20.6px; }
.bf-input { flex: 1; min-width: 0; resize: none; border: none; outline: none; padding: 14px 16px; background: transparent;
  color: var(--fg-1); font-family: var(--font-mono); font-size: 12.5px; line-height: 1.65; tab-size: 2; white-space: pre; overflow: auto; }
.bf-input::placeholder { color: var(--fg-4); }

.bf-pane { flex: 1; min-height: 0; overflow: auto; padding: 14px 16px; background: var(--bg-sunken); margin: 0; }
.bf-pane code { font-family: var(--font-mono); font-size: 12.5px; line-height: 1.65; white-space: pre; display: block; }
.bf-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--fg-4); text-align: center; }
.bf-empty .be-ico { width: 44px; height: 44px; border-radius: var(--radius-md); border: 1px dashed var(--border-strong); display: flex; align-items: center; justify-content: center; }
.bf-empty p { font-size: 13px; margin: 0; max-width: 26ch; line-height: 1.5; }

/* syntax tint */
.tk-tag { color: var(--accent-text); }
.tk-name { color: var(--fg-1); }
.tk-attr { color: var(--success-text); }
.tk-val { color: var(--warning-text); }
.tk-cmt { color: var(--fg-4); font-style: italic; }
.tk-txt { color: var(--fg-2); }

.bf-actions { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 14px var(--pad-page) 18px; }
.bf-actions .ba-hint { font-family: var(--font-mono); font-size: 11px; color: var(--fg-4); display: flex; align-items: center; gap: 6px; }
.bf-actions .ba-hint .k { background: var(--surface-3); border: 1px solid var(--border-subtle); border-bottom-width: 2px;
  border-radius: 5px; padding: 1px 5px; color: var(--fg-3); }
.bf-actions .spacer { flex: 1; }

/* toast */
.toast-wrap { position: fixed; bottom: 22px; right: 22px; display: flex; flex-direction: column; gap: 10px; z-index: 60; }
.toast { display: flex; align-items: center; gap: 11px; background: var(--surface-2); border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-pop); border-radius: var(--radius-md); padding: 12px 15px; min-width: 244px;
  animation: toastIn var(--dur-base) var(--ease-out); }
.toast .t-ico { display: flex; }
.toast.ok .t-ico { color: var(--success); }
.toast.info .t-ico { color: var(--accent); }
.toast .t-msg { font-size: 13px; font-weight: 500; color: var(--fg-1); }
.toast .t-sub { font-size: 12px; color: var(--fg-3); }

/* dialog */
.dlg-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; z-index: 70; animation: scrimIn var(--dur-base) var(--ease-out); }
.dlg { width: 420px; max-width: 92vw; background: var(--surface-1); border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); animation: paletteIn var(--dur-base) var(--ease-out); overflow: hidden; }
.dlg-body { padding: 22px 22px 8px; }
.dlg h3 { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin: 0 0 6px; color: var(--fg-1); }
.dlg .dlg-desc { font-size: 13px; color: var(--fg-3); margin: 0 0 18px; line-height: 1.5; }
.dlg label { display: block; font-size: 12px; font-weight: 600; color: var(--fg-2); margin: 0 0 7px; }
.dlg .dlg-field { display: flex; align-items: center; background: var(--surface-3); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md); padding: 0 12px; }
.dlg .dlg-field:focus-within { border-color: var(--accent-border); box-shadow: 0 0 0 3px var(--accent-ring); }
.dlg .dlg-field input { flex: 1; border: none; outline: none; background: transparent; padding: 10px 0; color: var(--fg-1);
  font-family: var(--font-mono); font-size: 13px; }
.dlg .dlg-field .ext { font-family: var(--font-mono); font-size: 13px; color: var(--fg-4); }
.dlg-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; margin-top: 14px; border-top: 1px solid var(--border-subtle); background: var(--surface-1); }
`;

const SAMPLE = '<section class="hero" data-active="true"><h1>Ship faster</h1><p>Your dev environment, with a mind of its own.</p><button onclick="run()">Brief an agent</button><!-- cta --><ul><li>One</li><li>Two</li></ul></section>';

function beautifyHTML(src, indentUnit) {
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  src = (src || '').trim();
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === '<') {
      if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i);
        const e = end === -1 ? src.length : end + 3;
        tokens.push({ type: 'comment', text: src.slice(i, e) });
        i = e;
      } else {
        const end = src.indexOf('>', i);
        const e = end === -1 ? src.length : end + 1;
        tokens.push({ type: 'tag', text: src.slice(i, e).replace(/\s+/g, ' ').trim() });
        i = e;
      }
    } else {
      const next = src.indexOf('<', i);
      const e = next === -1 ? src.length : next;
      const text = src.slice(i, e).replace(/\s+/g, ' ').trim();
      if (text) tokens.push({ type: 'text', text });
      i = e;
    }
  }
  let level = 0;
  const out = [];
  const pad = n => indentUnit.repeat(Math.max(0, n));
  for (const tok of tokens) {
    if (tok.type === 'tag') {
      const m = tok.text.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
      const name = m ? m[1].toLowerCase() : '';
      const isClose = /^<\s*\//.test(tok.text);
      const isSelf = /\/>\s*$/.test(tok.text) || voids.has(name);
      const isMeta = /^<!/.test(tok.text);
      if (isClose) { level = Math.max(0, level - 1); out.push(pad(level) + tok.text); }
      else if (isSelf || isMeta) { out.push(pad(level) + tok.text); }
      else { out.push(pad(level) + tok.text); level++; }
    } else if (tok.type === 'comment') {
      out.push(pad(level) + tok.text);
    } else {
      out.push(pad(level) + tok.text);
    }
  }
  return out.join('\n');
}

function escapeHTML(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// produce syntax-highlighted HTML string from formatted code.
// tokenizes each line and escapes every piece exactly once — no re-scanning
// of injected markup (which would otherwise re-highlight span attributes).
function highlightLine(rest) {
  if (rest.startsWith('<!--')) return '<span class="tk-cmt">' + escapeHTML(rest) + '</span>';
  if (rest.startsWith('<')) {
    const m = rest.match(/^(<\/?)([a-zA-Z0-9-]+)([\s\S]*?)(\/?>)$/);
    if (!m) return '<span class="tk-tag">' + escapeHTML(rest) + '</span>';
    const open = m[1], name = m[2], attrs = m[3], close = m[4];
    const attrHtml = attrs.replace(/([a-zA-Z-]+)(?:(=)("[^"]*"|'[^']*'))?/g, (full, an, eq, av) => {
      if (!an) return escapeHTML(full);
      let out = '<span class="tk-attr">' + escapeHTML(an) + '</span>';
      if (eq) out += '=';
      if (av) out += '<span class="tk-val">' + escapeHTML(av) + '</span>';
      return out;
    });
    return '<span class="tk-tag">' + escapeHTML(open) + '</span>'
      + '<span class="tk-name">' + escapeHTML(name) + '</span>'
      + attrHtml
      + '<span class="tk-tag">' + escapeHTML(close) + '</span>';
  }
  return '<span class="tk-txt">' + escapeHTML(rest) + '</span>';
}

function highlight(formatted) {
  return formatted.split('\n').map(line => {
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    return indent + highlightLine(line.slice(indent.length));
  }).join('\n');
}

function Beautifier({ toast, separator }) {
  const [input, setInput] = React.useState(SAMPLE);
  const [output, setOutput] = React.useState('');
  const [indent, setIndent] = React.useState('  ');
  const [dialog, setDialog] = React.useState(false);
  const [filename, setFilename] = React.useState('formatted');
  const gutterRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const lineCount = Math.max(input.split('\n').length, 1);
  const outLines = output ? output.split('\n').length : 0;

  const run = React.useCallback(() => {
    if (!input.trim()) { toast({ kind: 'info', msg: 'Nothing to beautify', sub: 'Paste some HTML first.' }); return; }
    const result = beautifyHTML(input, indent);
    setOutput(result);
    toast({ kind: 'ok', msg: 'Beautified', sub: result.split('\n').length + ' lines formatted.' });
  }, [input, indent, toast]);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const copy = () => {
    if (!output) { toast({ kind: 'info', msg: 'Run beautify first', sub: 'No formatted output yet.' }); return; }
    navigator.clipboard && navigator.clipboard.writeText(output);
    toast({ kind: 'ok', msg: 'Copied to clipboard', sub: output.length + ' characters.' });
  };

  const doExport = () => {
    const blob = new Blob([output || beautifyHTML(input, indent)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (filename || 'formatted') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setDialog(false);
    toast({ kind: 'ok', msg: 'Exported', sub: (filename || 'formatted') + '.html downloaded.' });
  };

  const syncScroll = (e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop; };

  return (
    <div className="bf">
      <style>{BF_CSS}</style>
      <div className="bf-head">
        <div className="bf-ico"><Icon name="code-2" size={20} /></div>
        <div>
          <h1>HTML beautifier</h1>
          <p>Paste raw markup, get clean indented HTML.</p>
        </div>
        <div className="bf-opts">
          <span className="bf-seg-label">Indent</span>
          <div className="bf-seg">
            <button className={indent === '  ' ? 'on' : ''} onClick={() => setIndent('  ')}>2 sp</button>
            <button className={indent === '    ' ? 'on' : ''} onClick={() => setIndent('    ')}>4 sp</button>
            <button className={indent === '\t' ? 'on' : ''} onClick={() => setIndent('\t')}>tab</button>
          </div>
        </div>
      </div>

      <div className="bf-split" data-sep={separator}>
        {/* input */}
        <div className="bf-col">
          <div className="bf-colhead">
            <span className="ch-dot" style={{ background: 'var(--fg-4)' }}></span>
            <span className="ch-label">Input · HTML</span>
            <span className="ch-meta">{input.length} chars</span>
            <button className="ch-btn" title="Load sample" onClick={() => setInput(SAMPLE)}><Icon name="file-code" size={15} /></button>
            <button className="ch-btn" title="Clear" onClick={() => { setInput(''); setOutput(''); }}><Icon name="eraser" size={15} /></button>
          </div>
          <div className="bf-editor">
            <div className="bf-gutter" ref={gutterRef}>
              {Array.from({ length: lineCount }, (_, n) => <div key={n}>{n + 1}</div>)}
            </div>
            <textarea ref={inputRef} className="bf-input" value={input} spellCheck={false}
              onChange={(e) => setInput(e.target.value)} onScroll={syncScroll}
              placeholder="<div>paste your markup here…</div>" />
          </div>
        </div>

        {/* output */}
        <div className="bf-col">
          <div className="bf-colhead">
            <span className="ch-dot" style={{ background: output ? 'var(--success)' : 'var(--fg-4)' }}></span>
            <span className="ch-label">Output · Formatted</span>
            <span className="ch-meta">{outLines ? outLines + ' lines' : '—'}</span>
            <button className="ch-btn" title="Copy" onClick={copy}><Icon name="copy" size={15} /></button>
          </div>
          {output ? (
            <pre className="bf-pane"><code dangerouslySetInnerHTML={{ __html: highlight(output) }} /></pre>
          ) : (
            <div className="bf-pane">
              <div className="bf-empty">
                <div className="be-ico"><Icon name="wand-2" size={20} /></div>
                <p>No output yet. Hit <b style={{ color: 'var(--fg-2)' }}>Beautify</b> to format your markup.</p>
              </div>
            </div>
          )}
        </div>

        {(separator === 'chip' || separator === 'split') && <div className="bf-seam chip"><Icon name="arrow-right" size={15} /></div>}
        {separator === 'grip' && <div className="bf-seam grip"><span></span><span></span></div>}
        {separator === 'gutter' && <div className="bf-channel"></div>}
      </div>

      <div className="bf-actions">
        <button className="btn btn-primary" onClick={run}><Icon name="sparkles" size={15} />Beautify</button>
        <button className="btn btn-ghost" onClick={copy}><Icon name="copy" size={15} />Copy code</button>
        <button className="btn btn-ghost" onClick={() => setDialog(true)}><Icon name="download" size={15} />Export file</button>
        <div className="spacer"></div>
        <span className="ba-hint"><span className="k">⌘</span><span className="k">⏎</span> to beautify</span>
      </div>

      {dialog && (
        <div className="dlg-scrim" onClick={() => setDialog(false)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <div className="dlg-body">
              <h3>Export file</h3>
              <p className="dlg-desc">Download the formatted markup as a standalone HTML file.</p>
              <label htmlFor="fn">File name</label>
              <div className="dlg-field">
                <input id="fn" value={filename} autoFocus onChange={(e) => setFilename(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && doExport()} />
                <span className="ext">.html</span>
              </div>
            </div>
            <div className="dlg-foot">
              <button className="btn btn-ghost" onClick={() => setDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={doExport}><Icon name="download" size={15} />Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Beautifier });
