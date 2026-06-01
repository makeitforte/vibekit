// ---- Shared icon + data ----
function Icon({ name, size = 18, style, className }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { width: size, height: size }, nameAttr: 'data-lucide' });
    }
  }, [name, size]);
  return <span ref={ref} className={className} style={{ display: 'inline-flex', width: size, height: size, ...style }} />;
}

// Tool catalog for the landing hub + sidebar.
// status: 'active' | 'soon' | 'ai'
const TOOLS = [
  { id: 'html-beautifier', name: 'HTML beautifier', icon: 'code-2', status: 'active',
    blurb: 'Format messy markup into clean, indented HTML.', tag: 'Formatter', runs: '1.2k' },
  { id: 'json-formatter', name: 'JSON formatter', icon: 'braces', status: 'soon',
    blurb: 'Validate, prettify and collapse JSON trees.', tag: 'Formatter' },
  { id: 'regex-tester', name: 'Regex tester', icon: 'regex', status: 'soon',
    blurb: 'Match patterns live with capture-group breakdown.', tag: 'Text' },
  { id: 'color-tools', name: 'Color tools', icon: 'palette', status: 'soon',
    blurb: 'Convert, scale and check contrast on any color.', tag: 'Design' },
  { id: 'diff-viewer', name: 'Diff viewer', icon: 'git-compare', status: 'soon',
    blurb: 'Compare two snippets side by side, line by line.', tag: 'Text' },
  { id: 'base64', name: 'Base64 studio', icon: 'binary', status: 'soon',
    blurb: 'Encode and decode strings, files and data URIs.', tag: 'Encode' },
];

// "Personal assistance" — the AI-native section.
const ASSIST = [
  { id: 'commit-writer', name: 'Commit writer', icon: 'git-commit-horizontal', status: 'ai',
    blurb: 'Draft conventional commits from a diff.', tag: 'AI feature' },
  { id: 'snippet-explainer', name: 'Snippet explainer', icon: 'sparkles', status: 'ai',
    blurb: 'Plain-language walkthrough of any code you paste.', tag: 'AI feature' },
  { id: 'naming-helper', name: 'Naming helper', icon: 'wand-2', status: 'ai',
    blurb: 'Suggest clear names for variables and functions.', tag: 'AI feature' },
];

const ALL = [...TOOLS, ...ASSIST];

Object.assign(window, { Icon, TOOLS, ASSIST, ALL });
