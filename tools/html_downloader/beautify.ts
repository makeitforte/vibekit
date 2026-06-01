const VOID_ELEMENTS = new Set([
  "area","base","br","col","embed","hr","img","input",
  "link","meta","param","source","track","wbr",
]);

export function beautifyHTML(src: string, indentUnit: string): string {
  src = (src || "").trim();
  if (!src) return "";

  type Token = { type: "tag" | "comment" | "text"; text: string };
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    if (src[i] === "<") {
      if (src.startsWith("<!--", i)) {
        const end = src.indexOf("-->", i);
        const e = end === -1 ? src.length : end + 3;
        tokens.push({ type: "comment", text: src.slice(i, e) });
        i = e;
      } else {
        const end = src.indexOf(">", i);
        const e = end === -1 ? src.length : end + 1;
        tokens.push({ type: "tag", text: src.slice(i, e).replace(/\s+/g, " ").trim() });
        i = e;
      }
    } else {
      const next = src.indexOf("<", i);
      const e = next === -1 ? src.length : next;
      const text = src.slice(i, e).replace(/\s+/g, " ").trim();
      if (text) tokens.push({ type: "text", text });
      i = e;
    }
  }

  let level = 0;
  const lines: string[] = [];
  const pad = (n: number) => indentUnit.repeat(Math.max(0, n));

  for (const tok of tokens) {
    if (tok.type === "tag") {
      const m = tok.text.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
      const name = m ? m[1].toLowerCase() : "";
      const isClose = /^<\s*\//.test(tok.text);
      const isSelf = /\/>\s*$/.test(tok.text) || VOID_ELEMENTS.has(name);
      const isMeta = /^<!/.test(tok.text);

      if (isClose) {
        level = Math.max(0, level - 1);
        lines.push(pad(level) + tok.text);
      } else if (isSelf || isMeta) {
        lines.push(pad(level) + tok.text);
      } else {
        lines.push(pad(level) + tok.text);
        level++;
      }
    } else if (tok.type === "comment") {
      lines.push(pad(level) + tok.text);
    } else {
      lines.push(pad(level) + tok.text);
    }
  }

  return lines.join("\n");
}
