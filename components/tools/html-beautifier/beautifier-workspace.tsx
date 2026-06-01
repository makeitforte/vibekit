"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Copy, Download, FileCode, Eraser, Wand2, FileText } from "lucide-react";
import { toast } from "sonner";
import { beautifyHTML } from "@/lib/beautify";
import { highlightHTML } from "@/lib/highlight";
import { ResizableSplit } from "./resizable-split";

const SAMPLE =
  '<section class="hero" data-active="true"><h1>Ship faster</h1><p>Your dev environment, with a mind of its own.</p><button onclick="run()">Brief an agent</button><!-- cta --><ul><li>One</li><li>Two</li></ul></section>';

type IndentUnit = "  " | "    " | "\t";
type ExportFormat = "html" | "pdf";

export function BeautifierWorkspace() {
  const [input, setInput] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState<IndentUnit>("  ");
  const [exportDialog, setExportDialog] = useState(false);
  const [filename, setFilename] = useState("formatted");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html");
  const gutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = Math.max(input.split("\n").length, 1);
  const outLines = output ? output.split("\n").length : 0;

  const run = useCallback(() => {
    if (!input.trim()) {
      toast.warning("Nothing to beautify", { description: "Paste some HTML first." });
      return;
    }
    const result = beautifyHTML(input, indent);
    setOutput(result);
    toast.success("Beautified", {
      description: `${result.split("\n").length} lines formatted.`,
    });
  }, [input, indent]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  const copy = useCallback(() => {
    if (!output) {
      toast.info("No output yet", { description: "Hit Beautify first." });
      return;
    }
    navigator.clipboard?.writeText(output);
    toast.success("Copied", { description: `${output.length} characters copied.` });
  }, [output]);

  const doExportHTML = useCallback(() => {
    const content = output || beautifyHTML(input, indent);
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename || "formatted"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportDialog(false);
    toast.success("Exported", { description: `${a.download} downloaded.` });
  }, [output, input, indent, filename]);

  const doExportPDF = useCallback(() => {
    const content = output || beautifyHTML(input, indent);
    const highlighted = highlightHTML(content);
    const name = filename || "formatted";

    const printDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11.5px;
    line-height: 1.7;
    color: #17171a;
    background: #fff;
    padding: 48px 56px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e2e2e7;
  }
  .logo {
    width: 26px; height: 26px; border-radius: 6px;
    background: linear-gradient(135deg, #16a268, #22c97f);
    display: flex; align-items: center; justify-content: center;
  }
  .logo svg { display: block; }
  .meta { font-size: 11px; color: #73737c; }
  .meta strong { color: #17171a; font-weight: 600; }
  pre {
    white-space: pre;
    overflow: visible;
    word-break: break-all;
  }
  .tk-tag  { color: #0e7a4e; }
  .tk-name { color: #17171a; }
  .tk-attr { color: #117a4f; }
  .tk-val  { color: #876200; }
  .tk-cmt  { color: #a6a6ae; font-style: italic; }
  .tk-txt  { color: #51515a; }
  @page { margin: 2cm; size: A4; }
  @media print {
    body { padding: 0; }
    header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<header>
  <div class="logo">
    <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
      <path d="M3 7l4-4 3 3 3-3 4 4M3 13l4 4 3-3 3 3 4-4"
        stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <div class="meta">
    <strong>${name}.html</strong> &nbsp;·&nbsp; ${content.split("\n").length} lines &nbsp;·&nbsp; Exported from VibeKit HTML Beautifier
  </div>
</header>
<pre><code>${highlighted}</code></pre>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Popup blocked", { description: "Allow popups for this site and try again." });
      return;
    }
    printWindow.document.write(printDoc);
    printWindow.document.close();
    printWindow.focus();
    // Give fonts time to load before triggering print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 600);

    setExportDialog(false);
    toast.success("Print dialog opened", { description: "Choose 'Save as PDF' in your printer dialog." });
  }, [output, input, indent, filename]);

  const doExport = useCallback(() => {
    if (exportFormat === "pdf") doExportPDF();
    else doExportHTML();
  }, [exportFormat, doExportPDF, doExportHTML]);

  const syncGutter = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
    }
  };

  // ── Panes ──

  const inputPane = (
    <div className="bf-pane-inner">
      <div className="bf-colhead">
        <span className="bf-dot" />
        <span className="bf-col-label">Input · HTML</span>
        <span className="bf-col-meta">{input.length} chars</span>
        <button className="pane-btn" title="Load sample" onClick={() => { setInput(SAMPLE); setOutput(""); }} type="button">
          <FileCode size={14} />
        </button>
        <button className="pane-btn" title="Clear" onClick={() => { setInput(""); setOutput(""); }} type="button">
          <Eraser size={14} />
        </button>
      </div>
      <div className="bf-editor-area">
        <div className="bf-gutter" ref={gutterRef}>
          {Array.from({ length: lineCount }, (_, n) => (
            <div key={n}>{n + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="bf-textarea"
          value={input}
          spellCheck={false}
          placeholder="<div>paste your markup here…</div>"
          onChange={(e) => setInput(e.target.value)}
          onScroll={syncGutter}
        />
      </div>
    </div>
  );

  const outputPane = (
    <div className="bf-pane-inner">
      <div className="bf-colhead">
        <span className={`bf-dot${output ? " green" : ""}`} />
        <span className="bf-col-label">Output · Formatted</span>
        <span className="bf-col-meta">{outLines ? `${outLines} lines` : "—"}</span>
        <button className="pane-btn" title="Copy output" onClick={copy} type="button">
          <Copy size={14} />
        </button>
      </div>
      <div className="bf-editor-area">
        {output ? (
          <pre className="bf-output-pre">
            <code dangerouslySetInnerHTML={{ __html: highlightHTML(output) }} />
          </pre>
        ) : (
          <div className="bf-empty">
            <div className="bf-empty-icon">
              <Wand2 size={20} />
            </div>
            <p>No output yet. Hit <b>Beautify</b> to format your markup.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bf-workspace">
      {/* Tool header */}
      <div className="bf-header">
        <div className="bf-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <div>
          <h1 className="bf-title">HTML beautifier</h1>
          <p className="bf-subtitle">Paste raw markup, get clean indented HTML.</p>
        </div>
        <div className="bf-opts">
          <span className="seg-label">Indent</span>
          <div className="seg-control">
            {(["  ", "    ", "\t"] as IndentUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                className={`seg-btn${indent === u ? " active" : ""}`}
                onClick={() => setIndent(u)}
              >
                {u === "  " ? "2 sp" : u === "    " ? "4 sp" : "tab"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split pane */}
      <div className="bf-split-wrap">
        <ResizableSplit left={inputPane} right={outputPane} />
      </div>

      {/* Action bar */}
      <div className="bf-actions">
        <button className="btn btn-primary" onClick={run} type="button">
          <Sparkles size={15} /> Beautify
        </button>
        <button className="btn btn-ghost" onClick={copy} type="button">
          <Copy size={15} /> Copy code
        </button>
        <button className="btn btn-ghost" onClick={() => setExportDialog(true)} type="button">
          <Download size={15} /> Export file
        </button>
        <div className="bf-hint">
          <kbd className="key">Ctrl</kbd>
          <kbd className="key">↵</kbd>
          to beautify
        </div>
      </div>

      {/* Export dialog */}
      {exportDialog && (
        <div className="dlg-scrim" onClick={() => setExportDialog(false)}>
          <div className="dlg" onClick={(e) => e.stopPropagation()}>
            <div className="dlg-body">
              <h3>Export file</h3>
              <p className="dlg-desc">Download the formatted markup as a file.</p>

              {/* Format selector */}
              <label>Format</label>
              <div className="dlg-format-row">
                <button
                  type="button"
                  className={`dlg-format-btn${exportFormat === "html" ? " active" : ""}`}
                  onClick={() => setExportFormat("html")}
                >
                  <FileCode size={16} />
                  <span>.html</span>
                  <span className="dlg-format-desc">Source file</span>
                </button>
                <button
                  type="button"
                  className={`dlg-format-btn${exportFormat === "pdf" ? " active" : ""}`}
                  onClick={() => setExportFormat("pdf")}
                >
                  <FileText size={16} />
                  <span>.pdf</span>
                  <span className="dlg-format-desc">Print / share</span>
                </button>
              </div>

              {/* File name (HTML only) */}
              {exportFormat === "html" && (
                <>
                  <label htmlFor="dlg-fn" style={{ marginTop: 14 }}>File name</label>
                  <div className="dlg-field">
                    <input
                      id="dlg-fn"
                      autoFocus
                      value={filename}
                      onChange={(e) => setFilename(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && doExport()}
                    />
                    <span className="dlg-ext">.html</span>
                  </div>
                </>
              )}

              {exportFormat === "pdf" && (
                <p className="dlg-pdf-note">
                  Opens a print preview with syntax-highlighted code. Choose <strong>Save as PDF</strong> in your browser&apos;s print dialog.
                </p>
              )}
            </div>
            <div className="dlg-foot">
              <button className="btn btn-ghost" onClick={() => setExportDialog(false)} type="button">Cancel</button>
              <button className="btn btn-primary" onClick={doExport} type="button">
                <Download size={15} />
                {exportFormat === "pdf" ? "Open print preview" : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
