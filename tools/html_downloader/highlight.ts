function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightLine(rest: string): string {
  if (rest.startsWith("<!--")) {
    return `<span class="tk-cmt">${escapeHTML(rest)}</span>`;
  }
  if (rest.startsWith("<")) {
    const m = rest.match(/^(<\/?)([a-zA-Z0-9-]+)([\s\S]*?)(\/?>)$/);
    if (!m) return `<span class="tk-tag">${escapeHTML(rest)}</span>`;
    const [, open, name, attrs, close] = m;
    const attrHtml = attrs.replace(
      /([a-zA-Z-]+)(?:(=)("[^"]*"|'[^']*'))?/g,
      (_full, an: string, eq: string, av: string) => {
        if (!an) return escapeHTML(_full);
        let out = `<span class="tk-attr">${escapeHTML(an)}</span>`;
        if (eq) out += "=";
        if (av) out += `<span class="tk-val">${escapeHTML(av)}</span>`;
        return out;
      }
    );
    return (
      `<span class="tk-tag">${escapeHTML(open)}</span>` +
      `<span class="tk-name">${escapeHTML(name)}</span>` +
      attrHtml +
      `<span class="tk-tag">${escapeHTML(close)}</span>`
    );
  }
  return `<span class="tk-txt">${escapeHTML(rest)}</span>`;
}

export function highlightHTML(formatted: string): string {
  return formatted
    .split("\n")
    .map((line) => {
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : "";
      return escapeHTML(indent) + highlightLine(line.slice(indent.length));
    })
    .join("\n");
}
