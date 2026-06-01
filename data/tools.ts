export type ToolStatus = "active" | "soon" | "ai";

export interface Tool {
  id: string;
  name: string;
  icon: string;
  status: ToolStatus;
  blurb: string;
  tag: string;
  href?: string;
  runs?: string;
}

export const TOOLS: Tool[] = [
  {
    id: "html-downloader",
    name: "HTML downloader",
    icon: "FileDown",
    status: "active",
    blurb: "Beautify messy markup and export it as a clean HTML or PDF file.",
    tag: "Exporter",
    href: "/tools/html_downloader",
    runs: "1.2k",
  },
  {
    id: "html-bulk-downloader",
    name: "HTML bulk downloader",
    icon: "FolderDown",
    status: "active",
    blurb: "Convert multiple HTML files to PDF and download them as a single ZIP archive.",
    tag: "Exporter",
    href: "/tools/html_bulk_downloader",
  },
  {
    id: "json-formatter",
    name: "JSON formatter",
    icon: "Braces",
    status: "soon",
    blurb: "Validate, prettify and collapse JSON trees at a glance.",
    tag: "Formatter",
  },
  {
    id: "regex-tester",
    name: "Regex tester",
    icon: "Regex",
    status: "soon",
    blurb: "Match patterns live with capture-group breakdown.",
    tag: "Text",
  },
  {
    id: "color-tools",
    name: "Color tools",
    icon: "Palette",
    status: "soon",
    blurb: "Convert, scale and check contrast on any color.",
    tag: "Design",
  },
  {
    id: "diff-viewer",
    name: "Diff viewer",
    icon: "GitCompare",
    status: "soon",
    blurb: "Compare two snippets side by side, line by line.",
    tag: "Text",
  },
  {
    id: "base64",
    name: "Base64 studio",
    icon: "Binary",
    status: "soon",
    blurb: "Encode and decode strings, files and data URIs.",
    tag: "Encode",
  },
];

export const ASSIST: Tool[] = [
  {
    id: "commit-writer",
    name: "Commit writer",
    icon: "GitCommitHorizontal",
    status: "ai",
    blurb: "Draft conventional commits from a diff.",
    tag: "AI feature",
  },
  {
    id: "snippet-explainer",
    name: "Snippet explainer",
    icon: "Sparkles",
    status: "ai",
    blurb: "Plain-language walkthrough of any code you paste.",
    tag: "AI feature",
  },
  {
    id: "naming-helper",
    name: "Naming helper",
    icon: "Wand2",
    status: "ai",
    blurb: "Suggest clear names for variables and functions.",
    tag: "AI feature",
  },
];

export const ALL_TOOLS = [...TOOLS, ...ASSIST];
